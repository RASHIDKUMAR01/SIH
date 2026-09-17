"""
AWS Mesonet Network Simulation Engine (SIH26073 Local Brain V4 Standard).
Coordinates a dynamic fleet of Automatic Weather Stations (AWS) with real geographic
coordinates, microclimate physics, per-station Local Brain edge diagnostics, and multi-station
scenario execution without physical hardware requirements.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
import numpy as np

from app.ml.local_brain import LocalBrain, LocalBrainReport
from app.ml.spatial_analyzer import haversine_distance
from app.simulator.physics import AtmosphericPhysicsEngine
from app.simulator.injector import AnomalyInjector
from app.simulator.schemas import AnomalyType


class StationNode:
    """Individual AWS Station representation within the Mesonet."""
    def __init__(
        self,
        station_id: str,
        name: str,
        latitude: float,
        longitude: float,
        elevation_m: float = 200.0,
        battery_base: float = 4.12,
        seed: int = 42,
    ):
        self.station_id = station_id
        self.name = name
        self.latitude = latitude
        self.longitude = longitude
        self.elevation_m = elevation_m
        self.battery_base = battery_base
        
        self.physics = AtmosphericPhysicsEngine(seed=seed)
        self.injector = AnomalyInjector()
        self.local_brain = LocalBrain(station_id=station_id)
        
        self.current_temp: float = 25.0
        self.current_press: float = 1013.25
        self.current_hum: float = 60.0
        self.current_wind_speed: float = 4.0
        self.current_wind_dir: float = 180.0
        self.current_solar: float = 450.0
        self.current_rainfall: float = 0.0
        self.current_battery: float = battery_base
        self.is_reporting: bool = True
        
        self.latest_report: Optional[LocalBrainReport] = None
        self.history: List[Dict[str, Any]] = []

    def reset(self):
        self.injector.cancel()
        self.local_brain.reset_state()
        self.is_reporting = True
        self.history.clear()


class MesonetNetworkManager:
    """
    Manages the multi-station AWS network simulation fleet.
    Generates realistic spatial-temporal atmospheric states and executes multi-station demonstration scenarios.
    """
    def __init__(self, start_time: Optional[datetime] = None):
        self.current_time = start_time or datetime.now(timezone.utc)
        self.step_count = 0
        self.active_scenario: str = "SCENARIO_E_NOMINAL"
        self.scenario_steps_remaining: int = 0
        self.primary_station_id: str = "AWS-01"

        # Initialize Default Real Mesonet Fleet (Vellore District Cluster)
        self.stations: Dict[str, StationNode] = {
            "AWS-01": StationNode("AWS-01", "Vellore North AWS", 12.9165, 79.1325, 216.0, 4.15, seed=101),
            "AWS-02": StationNode("AWS-02", "Katpadi Central AWS", 12.9698, 79.1350, 224.0, 4.10, seed=102),
            "AWS-03": StationNode("AWS-03", "Ranipet Industrial AWS", 12.9229, 79.3323, 160.0, 4.08, seed=103),
            "AWS-04": StationNode("AWS-04", "Chittoor Border AWS", 13.2172, 79.1003, 315.0, 4.18, seed=104),
            "AWS-05": StationNode("AWS-05", "Arcot Valley AWS", 12.9048, 79.3175, 165.0, 4.12, seed=105),
        }

    def set_primary_station(self, station_id: str):
        if station_id in self.stations:
            self.primary_station_id = station_id

    def trigger_scenario(self, scenario_id: str, duration_steps: int = 25) -> Dict[str, Any]:
        """
        Inject a calibrated multi-station demonstration scenario:
          - SCENARIO_A: Localized Anomaly (AWS-01 spike while AWS-02..05 normal -> SENSOR FAULT)
          - SCENARIO_B: Regional Weather Event (Multi-station storm front -> GENUINE WEATHER EVENT)
          - SCENARIO_C: Sensor Drift (AWS-02 / AWS-03 gradual drift -> SENSOR DRIFT)
          - SCENARIO_D: Communication Dropout (AWS-04 offline -> COMMUNICATION FAULT)
          - SCENARIO_E: Nominal Reset (All stations normal -> NORMAL)
        """
        sc_up = scenario_id.upper()
        self.active_scenario = sc_up
        self.scenario_steps_remaining = duration_steps

        # Reset all active station injectors
        for node in self.stations.values():
            node.injector.cancel()
            node.is_reporting = True

        if "SCENARIO_A" in sc_up or "LOCALIZED" in sc_up:
            self.active_scenario = "SCENARIO_A_LOCALIZED_SPIKE"
            # Target AWS-01 single sensor spike +22°C
            self.stations["AWS-01"].injector.trigger(
                anomaly_type=AnomalyType.TEMPERATURE_SPIKE,
                duration_steps=duration_steps,
                params={"magnitude": 22.5},
            )
            return {"status": "scenario_active", "scenario": "SCENARIO_A_LOCALIZED_SPIKE", "duration": duration_steps}

        elif "SCENARIO_B" in sc_up or "REGIONAL" in sc_up or "STORM" in sc_up:
            self.active_scenario = "SCENARIO_B_REGIONAL_STORM"
            # All mesonet stations experience coordinated storm front
            for sid, node in self.stations.items():
                node.injector.trigger(
                    anomaly_type=AnomalyType.TEMPERATURE_DROP,
                    duration_steps=duration_steps,
                    params={"magnitude": 6.0},
                )
            return {"status": "scenario_active", "scenario": "SCENARIO_B_REGIONAL_STORM", "duration": duration_steps}

        elif "SCENARIO_C" in sc_up or "DRIFT" in sc_up:
            self.active_scenario = "SCENARIO_C_SENSOR_DRIFT"
            # Target AWS-02 gradual drift
            self.stations["AWS-02"].injector.trigger(
                anomaly_type=AnomalyType.SENSOR_DRIFT,
                duration_steps=duration_steps,
                params={"drift_rate": 3.0},
            )
            return {"status": "scenario_active", "scenario": "SCENARIO_C_SENSOR_DRIFT", "duration": duration_steps}

        elif "SCENARIO_D" in sc_up or "COMM" in sc_up or "DROPOUT" in sc_up:
            self.active_scenario = "SCENARIO_D_COMM_DROPOUT"
            # Target AWS-04 transmission dropped
            self.stations["AWS-04"].is_reporting = False
            return {"status": "scenario_active", "scenario": "SCENARIO_D_COMM_DROPOUT", "duration": duration_steps}

        else:
            self.active_scenario = "SCENARIO_E_NOMINAL"
            self.scenario_steps_remaining = 0
            for node in self.stations.values():
                node.reset()
            return {"status": "scenario_active", "scenario": "SCENARIO_E_NOMINAL", "duration": 0}

    def step(self) -> Dict[str, Any]:
        """
        Advance the entire AWS mesonet network by 1 simulation interval.
        Returns complete network telemetry, Local Brain reports, and spatial topology.
        """
        self.current_time += timedelta(seconds=60)
        self.step_count += 1
        
        if self.scenario_steps_remaining > 0:
            self.scenario_steps_remaining -= 1
            if self.scenario_steps_remaining == 0 and self.active_scenario != "SCENARIO_E_NOMINAL":
                self.active_scenario = "SCENARIO_E_NOMINAL"
                for node in self.stations.values():
                    node.injector.cancel()
                    node.is_reporting = True

        hour = self.current_time.hour + (self.current_time.minute / 60.0)
        diurnal_solar = max(0.0, float(np.sin((hour - 6.0) * np.pi / 12.0) * 920.0))

        station_summaries = []

        for sid, node in self.stations.items():
            if not node.is_reporting:
                # Station packet dropped / offline
                report = node.local_brain.evaluate(
                    temperature=None,
                    pressure=None,
                    humidity=None,
                    wind_speed=None,
                    timestamp=self.current_time.isoformat(),
                )
                node.latest_report = report
                station_summaries.append({
                    "station_id": node.station_id,
                    "station_name": node.name,
                    "latitude": node.latitude,
                    "longitude": node.longitude,
                    "elevation_m": node.elevation_m,
                    "temperature": None,
                    "pressure": None,
                    "humidity": None,
                    "wind_speed": None,
                    "wind_direction": None,
                    "rainfall": None,
                    "solar_radiation": None,
                    "battery_voltage": round(node.current_battery, 2),
                    "battery_level": int(np.clip((node.current_battery - 3.2) / 1.0 * 100, 0, 100)),
                    "trust_score": round(report.trust_score, 4),
                    "local_status": "OFFLINE",
                    "fault_type": "MISSING_DATA",
                    "severity": "CRITICAL",
                    "confidence": 1.0,
                    "is_reporting": False,
                    "last_report": self.current_time.isoformat(),
                    "sensor_health": {"temperature": 0.0, "pressure": 0.0, "humidity": 0.0, "overall": 0.0},
                })
                continue

            # 1. Base physics with elevation lapse rate (-0.0065°C / meter)
            elev_offset_t = -0.0065 * (node.elevation_m - 200.0)
            elev_offset_p = -0.12 * (node.elevation_m - 200.0)
            
            raw_t, raw_p, raw_h = node.physics.calculate_state(self.current_time)
            raw_t += elev_offset_t
            raw_p += elev_offset_p
            
            # Micro-turbulent spatial variation per station
            raw_t += float(np.sin(self.step_count * 0.1 + hash(sid) % 7) * 0.25)
            raw_p += float(np.cos(self.step_count * 0.1 + hash(sid) % 5) * 0.15)
            raw_h += float(np.sin(self.step_count * 0.15 + hash(sid) % 9) * 0.5)

            # 2. Anomaly Injection Layer
            t_val, p_val, h_val, is_anom, anom_type, meta = node.injector.process(raw_t, raw_p, raw_h)

            # Coordinated regional storm adjustments
            if "STORM" in self.active_scenario or "SCENARIO_B" in self.active_scenario:
                p_val = round(float(np.clip(p_val - 32.0, 970.0, 995.0)), 2)
                h_val = round(float(np.clip(h_val + 35.0, 88.0, 99.0)), 2)
                w_speed = round(float(np.clip(22.0 + (hash(sid) % 5) * 1.5, 18.0, 32.0)), 2)
            else:
                w_speed = float(np.clip(4.2 + (abs(1013.25 - p_val) * 0.8) + np.sin(self.step_count * 0.2) * 1.5, 0.5, 35.0))
            w_dir = float((180.0 + np.sin(self.step_count * 0.05) * 60.0) % 360.0)
            solar = float(np.clip(diurnal_solar + (hash(sid) % 15) * 2.0, 0.0, 1100.0))
            rain = float(max(0.0, (h_val - 90.0) * 0.4)) if h_val > 90.0 else 0.0
            
            batt = node.battery_base + (0.05 if solar > 200 else -0.05)

            node.current_temp = round(t_val, 2)
            node.current_press = round(p_val, 2)
            node.current_hum = round(h_val, 2)
            node.current_wind_speed = round(w_speed, 2)
            node.current_wind_dir = round(w_dir, 1)
            node.current_solar = round(solar, 1)
            node.current_rainfall = round(rain, 2)
            node.current_battery = round(batt, 2)

            # 4. Local Brain Edge Evaluation
            report = node.local_brain.evaluate(
                temperature=t_val,
                pressure=p_val,
                humidity=h_val,
                wind_speed=w_speed,
                wind_direction=w_dir,
                rainfall=rain,
                solar_radiation=solar,
                battery_voltage=batt,
                timestamp=self.current_time.isoformat(),
            )
            node.latest_report = report

            # Calculate individual transducer health percentages
            t_hlth = 100.0 if "temperature" not in report.affected_sensors else 30.0
            p_hlth = 100.0 if "pressure" not in report.affected_sensors else 30.0
            h_hlth = 100.0 if "humidity" not in report.affected_sensors else 30.0
            overall_hlth = (t_hlth + p_hlth + h_hlth) / 3.0

            summary = {
                "station_id": node.station_id,
                "station_name": node.name,
                "latitude": node.latitude,
                "longitude": node.longitude,
                "elevation_m": node.elevation_m,
                "temperature": node.current_temp,
                "pressure": node.current_press,
                "humidity": node.current_hum,
                "wind_speed": node.current_wind_speed,
                "wind_direction": node.current_wind_dir,
                "rainfall": node.current_rainfall,
                "solar_radiation": node.current_solar,
                "battery_voltage": node.current_battery,
                "battery_level": int(np.clip((node.current_battery - 3.2) / 1.0 * 100, 0, 100)),
                "trust_score": round(report.trust_score, 4),
                "local_status": report.status,
                "fault_type": report.fault_type,
                "severity": report.severity,
                "confidence": round(report.confidence, 4),
                "is_reporting": True,
                "last_report": self.current_time.isoformat(),
                "sensor_health": {
                    "temperature": t_hlth,
                    "pressure": p_hlth,
                    "humidity": h_hlth,
                    "overall": round(overall_hlth, 1),
                },
            }
            station_summaries.append(summary)

        # Build Neighbor List for the Primary Station
        primary_node = self.stations.get(self.primary_station_id, list(self.stations.values())[0])
        primary_neighbors = []
        for sid, node in self.stations.items():
            if sid != primary_node.station_id and node.is_reporting:
                dist = haversine_distance(primary_node.latitude, primary_node.longitude, node.latitude, node.longitude)
                primary_neighbors.append({
                    "station_id": node.station_id,
                    "station_name": node.name,
                    "temperature": node.current_temp,
                    "pressure": node.current_press,
                    "humidity": node.current_hum,
                    "wind_speed": node.current_wind_speed,
                    "distance_km": dist,
                    "latitude": node.latitude,
                    "longitude": node.longitude,
                })

        # Build Spatial Topology Matrix (Connections between all nearby stations)
        spatial_topology = []
        s_list = list(self.stations.values())
        for i in range(len(s_list)):
            for j in range(i + 1, len(s_list)):
                d = haversine_distance(s_list[i].latitude, s_list[i].longitude, s_list[j].latitude, s_list[j].longitude)
                spatial_topology.append({
                    "from_station": s_list[i].station_id,
                    "to_station": s_list[j].station_id,
                    "distance_km": d,
                })

        network_health = float(np.mean([
            s["sensor_health"]["overall"] for s in station_summaries if s["is_reporting"]
        ])) if station_summaries else 100.0

        return {
            "timestamp": self.current_time.isoformat(),
            "active_scenario": self.active_scenario,
            "scenario_steps_remaining": self.scenario_steps_remaining,
            "primary_station_id": self.primary_station_id,
            "primary_station": next((s for s in station_summaries if s["station_id"] == self.primary_station_id), station_summaries[0]),
            "primary_neighbors": primary_neighbors,
            "stations": station_summaries,
            "spatial_topology": spatial_topology,
            "network_health": round(network_health, 1),
            "total_stations": len(station_summaries),
            "online_stations": sum(1 for s in station_summaries if s["is_reporting"]),
        }


# Global Singleton Mesonet Network Instance
mesonet_manager = MesonetNetworkManager()
MesonetSimulator = MesonetNetworkManager