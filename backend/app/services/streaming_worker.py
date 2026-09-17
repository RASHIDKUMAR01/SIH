"""
Background Asynchronous Streaming Telemetry Worker with WebSocket Broadcaster.
"""
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Set
import logging
from fastapi import WebSocket

from app.simulator.weather_simulator import AWSSimulator
from app.simulator.mesonet_network import mesonet_manager, MesonetNetworkManager
from app.simulator.schemas import AnomalyType
from app.services.anomaly_service import AnomalyDetectionService
from app.database.session import SessionLocal
from app.database.crud import insert_reading, get_telemetry_statistics

logger = logging.getLogger("aws_streaming_worker")


class StreamingSimulatorWorker:
    def __init__(self, interval_seconds: float = 1.0, station_id: str = "AWS-01"):
        self.interval_seconds = interval_seconds
        self.station_id = station_id
        
        self.mesonet = mesonet_manager
        self.anomaly_service = AnomalyDetectionService()
        
        self._task: Optional[asyncio.Task] = None
        self._is_running: bool = False
        self.latest_reading: Optional[Dict[str, Any]] = None
        self.last_tick_time: Optional[datetime] = None
        self.active_websockets: Set[WebSocket] = set()

    @property
    def is_running(self) -> bool:
        return self._is_running

    def set_primary_station(self, station_id: str):
        self.station_id = station_id
        self.mesonet.set_primary_station(station_id)

    async def register_websocket(self, websocket: WebSocket):
        await websocket.accept()
        self.active_websockets.add(websocket)
        if self.latest_reading:
            await self.send_to_socket(websocket, {
                "type": "TELEMETRY_UPDATE",
                "data": self.latest_reading,
            })

    def unregister_websocket(self, websocket: WebSocket):
        self.active_websockets.discard(websocket)

    async def send_to_socket(self, ws: WebSocket, message: Dict[str, Any]):
        try:
            await ws.send_json(message)
        except Exception:
            self.active_websockets.discard(ws)

    async def broadcast(self, message: Dict[str, Any]):
        dead_sockets = set()
        for ws in self.active_websockets:
            try:
                await ws.send_json(message)
            except Exception:
                dead_sockets.add(ws)
        self.active_websockets.difference_update(dead_sockets)

    async def start_async(self, interval_seconds: Optional[float] = None) -> Dict[str, Any]:
        if interval_seconds is not None:
            self.interval_seconds = max(0.05, interval_seconds)
            
        if self._is_running:
            return {"status": "already_running", "interval_seconds": self.interval_seconds}

        self._is_running = True
        loop = asyncio.get_running_loop()
        self._task = loop.create_task(self._run_loop())
        logger.info(f"AWS Simulator Worker started with {self.interval_seconds}s interval.")
        return {"status": "started", "interval_seconds": self.interval_seconds, "station_id": self.station_id}

    def start(self, interval_seconds: Optional[float] = None) -> Dict[str, Any]:
        if interval_seconds is not None:
            self.interval_seconds = max(0.05, interval_seconds)
            
        if self._is_running:
            return {"status": "already_running", "interval_seconds": self.interval_seconds}

        self._is_running = True
        try:
            loop = asyncio.get_running_loop()
            self._task = loop.create_task(self._run_loop())
        except RuntimeError:
            pass
        return {"status": "started", "interval_seconds": self.interval_seconds, "station_id": self.station_id}

    def stop(self) -> Dict[str, Any]:
        if not self._is_running:
            return {"status": "already_stopped"}

        self._is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
        self._task = None
        logger.info("AWS Simulator Worker stopped.")
        return {"status": "stopped"}

    def trigger_scenario(self, scenario_id: str, duration: int = 25) -> Dict[str, Any]:
        return self.mesonet.trigger_scenario(scenario_id, duration_steps=duration)

    def inject_anomaly(
        self,
        anomaly_type_str: str,
        duration: int = 10,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        name_map = {
            "temperature_spike": AnomalyType.TEMPERATURE_SPIKE,
            "temperature_drop": AnomalyType.TEMPERATURE_DROP,
            "pressure_spike": AnomalyType.PRESSURE_SPIKE,
            "pressure_anomaly": AnomalyType.PRESSURE_SPIKE,
            "humidity_spike": AnomalyType.HUMIDITY_SPIKE,
            "humidity_anomaly": AnomalyType.HUMIDITY_SPIKE,
            "frozen_sensor": AnomalyType.FROZEN_SENSOR,
            "sensor_drift": AnomalyType.SENSOR_DRIFT,
            "missing_data": AnomalyType.MISSING_DATA,
            "multivariate_inconsistency": AnomalyType.MULTIVARIATE_INCONSISTENCY,
            "normal": AnomalyType.NORMAL,
        }
        anom_enum = name_map.get(anomaly_type_str.lower(), AnomalyType.NORMAL)

        primary_node = self.mesonet.stations.get(self.station_id, list(self.mesonet.stations.values())[0])
        primary_node.injector.trigger(
            anomaly_type=anom_enum,
            duration_steps=duration,
            params=params or {},
        )
        return {
            "status": "anomaly_injected",
            "anomaly_type": anom_enum.value,
            "duration_steps": duration,
            "params": params or {},
        }

    async def _run_loop(self):
        while self._is_running:
            try:
                # 1. Advance entire AWS Mesonet Fleet
                net_state = self.mesonet.step()
                pri = net_state["primary_station"]

                is_regional = ("REGIONAL" in net_state.get("active_scenario", ""))

                # 2. Process active station through Local Brain -> LSTM -> Global Brain
                processed = self.anomaly_service.process_reading(
                    timestamp=net_state["timestamp"],
                    temperature=pri.get("temperature"),
                    pressure=pri.get("pressure"),
                    humidity=pri.get("humidity"),
                    wind_speed=pri.get("wind_speed"),
                    station_id=pri.get("station_id", self.station_id),
                    neighbors=net_state.get("primary_neighbors", []),
                    is_simulated_event_regional=is_regional,
                )

                # 3. Enrich payload with complete Multi-Station network telemetry
                processed["station_name"] = pri.get("station_name", "Primary AWS Node")
                processed["latitude"] = pri.get("latitude")
                processed["longitude"] = pri.get("longitude")
                processed["elevation_m"] = pri.get("elevation_m")
                processed["wind_direction"] = pri.get("wind_direction", 180.0)
                processed["solar_radiation"] = pri.get("solar_radiation", 450.0)
                processed["rainfall"] = pri.get("rainfall", 0.0)
                processed["battery_voltage"] = pri.get("battery_voltage", 4.10)
                processed["battery_level"] = pri.get("battery_level", 95)
                
                # Multi-Station fleet arrays
                processed["stations"] = net_state.get("stations", [])
                processed["spatial_topology"] = net_state.get("spatial_topology", [])
                processed["active_scenario"] = net_state.get("active_scenario", "SCENARIO_E_NOMINAL")
                processed["network_health"] = net_state.get("network_health", 100.0)
                processed["total_stations"] = net_state.get("total_stations", len(net_state.get("stations", [])))
                processed["online_stations"] = net_state.get("online_stations", len(net_state.get("stations", [])))

                self.latest_reading = processed
                self.last_tick_time = datetime.now(timezone.utc)

                db = SessionLocal()
                try:
                    insert_reading(db, processed)
                except Exception as db_err:
                    logger.error(f"Failed to persist telemetry record: {db_err}")
                finally:
                    db.close()

                # Broadcast live multi-station packet to all connected WebSockets
                await self.broadcast({
                    "type": "TELEMETRY_UPDATE",
                    "data": processed,
                })

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in streaming simulator worker tick: {e}", exc_info=True)

            await asyncio.sleep(self.interval_seconds)


simulator_worker = StreamingSimulatorWorker()
