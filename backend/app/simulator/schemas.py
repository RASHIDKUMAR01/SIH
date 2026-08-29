"""
Data schemas and enums for AWS Weather Simulator.
"""
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class AnomalyType(str, Enum):
    NORMAL = "normal"
    TEMPERATURE_SPIKE = "temperature_spike"
    TEMPERATURE_DROP = "temperature_drop"
    PRESSURE_SPIKE = "pressure_spike"
    HUMIDITY_SPIKE = "humidity_spike"
    FROZEN_SENSOR = "frozen_sensor"
    SENSOR_DRIFT = "sensor_drift"
    MISSING_DATA = "missing_data"
    MULTIVARIATE_INCONSISTENCY = "multivariate_inconsistency"


class WeatherDataPoint(BaseModel):
    timestamp: str = Field(description="ISO-8601 UTC timestamp")
    temperature: Optional[float] = Field(None, description="Ambient Temperature in °C")
    atmospheric_pressure: Optional[float] = Field(None, description="Atmospheric Pressure in hPa")
    relative_humidity: Optional[float] = Field(None, description="Relative Humidity in %")
    is_anomaly: bool = Field(False, description="Ground truth anomaly indicator")
    anomaly_type: AnomalyType = Field(AnomalyType.NORMAL, description="Injected anomaly category")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Ground truth simulation details")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "temperature": self.temperature,
            "atmospheric_pressure": self.atmospheric_pressure,
            "relative_humidity": self.relative_humidity,
            "is_anomaly": self.is_anomaly,
            "anomaly_type": self.anomaly_type.value,
            "metadata": self.metadata,
        }
