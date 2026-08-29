"""
Automatic Weather Station (AWS) Telemetry Simulator.
Generates continuous streaming data and historical CSV datasets with realistic atmospheric dynamics
and configurable anomaly injection scenarios.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Generator
import os
import pandas as pd

from app.simulator.schemas import WeatherDataPoint, AnomalyType
from app.simulator.physics import AtmosphericPhysicsEngine
from app.simulator.injector import AnomalyInjector


class AWSSimulator:
    def __init__(
        self,
        station_id: str = "AWS-SIH-001",
        start_time: Optional[datetime] = None,
        interval_seconds: int = 60,
        seed: int = 42,
    ):
        self.station_id = station_id
        self.current_time = start_time or datetime.now(timezone.utc)
        self.interval = timedelta(seconds=interval_seconds)
        self.step_count = 0
        
        self.physics = AtmosphericPhysicsEngine(seed=seed)
        self.injector = AnomalyInjector()

    def step(self) -> WeatherDataPoint:
        """
        Advance simulator by one time step and produce a WeatherDataPoint.
        """
        self.current_time += self.interval
        self.step_count += 1
        
        # 1. Physics Engine baseline calculation
        raw_temp, raw_press, raw_hum = self.physics.calculate_state(self.current_time)
        
        # 2. Anomaly Injection layer
        temp, press, hum, is_anomaly, anomaly_type, meta = self.injector.process(
            raw_temp, raw_press, raw_hum
        )
        
        meta["station_id"] = self.station_id
        meta["step_index"] = self.step_count
        
        return WeatherDataPoint(
            timestamp=self.current_time.isoformat(),
            temperature=temp,
            atmospheric_pressure=press,
            relative_humidity=hum,
            is_anomaly=is_anomaly,
            anomaly_type=anomaly_type,
            metadata=meta,
        )

    def trigger_anomaly(
        self,
        anomaly_type: AnomalyType,
        duration_steps: int = 10,
        params: Optional[Dict[str, Any]] = None,
    ):
        """
        Trigger an anomaly injection.
        """
        self.injector.trigger(
            anomaly_type=anomaly_type,
            duration_steps=duration_steps,
            params=params,
        )

    def reset_anomaly(self):
        """
        Clear active anomaly.
        """
        self.injector.cancel()

    def generate_historical(
        self,
        num_records: int = 1440,
        interval_minutes: int = 1,
        anomalies_schedule: Optional[List[Dict[str, Any]]] = None,
        output_csv_path: Optional[str] = None,
    ) -> pd.DataFrame:
        """
        Generate a batch historical dataset containing normal and scheduled anomaly episodes.
        
        Args:
            num_records: Number of time series steps to simulate (default: 1440 = 24 hours at 1-min intervals)
            interval_minutes: Timestep interval in minutes
            anomalies_schedule: List of dicts specifying scheduled anomalies, e.g.:
                [
                    {"step": 120, "type": AnomalyType.TEMPERATURE_SPIKE, "duration": 5},
                    {"step": 300, "type": AnomalyType.FROZEN_SENSOR, "duration": 15},
                    {"step": 600, "type": AnomalyType.SENSOR_DRIFT, "duration": 40},
                    {"step": 900, "type": AnomalyType.MISSING_DATA, "duration": 10},
                    {"step": 1100, "type": AnomalyType.MULTIVARIATE_INCONSISTENCY, "duration": 8},
                ]
            output_csv_path: Optional file path to save CSV output.
        """
        self.interval = timedelta(minutes=interval_minutes)
        schedule = {item["step"]: item for item in (anomalies_schedule or [])}
        
        records = []
        for i in range(num_records):
            if i in schedule:
                event = schedule[i]
                self.trigger_anomaly(
                    anomaly_type=event["type"],
                    duration_steps=event.get("duration", 10),
                    params=event.get("params", {}),
                )
            
            point = self.step()
            records.append({
                "timestamp": point.timestamp,
                "temperature": point.temperature,
                "atmospheric_pressure": point.atmospheric_pressure,
                "relative_humidity": point.relative_humidity,
                "is_anomaly": 1 if point.is_anomaly else 0,
                "anomaly_type": point.anomaly_type.value,
                "description": point.metadata.get("description", "Normal operating conditions"),
            })
            
        df = pd.DataFrame(records)
        
        if output_csv_path:
            os.makedirs(os.path.dirname(os.path.abspath(output_csv_path)), exist_ok=True)
            df.to_csv(output_csv_path, index=False)
            
        return df
