"""
Pydantic validation schemas for FastAPI REST endpoints.
"""
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    timestamp: Optional[str] = Field(None, description="ISO-8601 Timestamp (defaults to current UTC time)")
    temperature: Optional[float] = Field(None, description="Ambient temperature reading in °C")
    pressure: Optional[float] = Field(None, description="Atmospheric pressure reading in hPa")
    humidity: Optional[float] = Field(None, description="Relative humidity reading in %")


class AnalyzeResponse(BaseModel):
    timestamp: str
    temperature: Optional[float]
    pressure: Optional[float]
    humidity: Optional[float]
    wind_speed: Optional[float] = None
    is_anomaly: bool
    anomaly_type: str
    anomaly_score: float
    confidence: float
    severity: str
    explanation: str
    affected_parameters: List[str]
    sensor_health: Dict[str, Any]
    maintenance_recommendation: List[str]
    raw_decision: Optional[float] = None
    active_model: Optional[str] = None
    models: Optional[Dict[str, Any]] = None
    explainability: Optional[Dict[str, Any]] = None



class SimulatorStartRequest(BaseModel):
    interval_seconds: Optional[float] = Field(1.0, ge=0.05, le=60.0, description="Telemetry stream tick interval in seconds")
    station_id: Optional[str] = Field("AWS-SIH-001", description="Automatic Weather Station ID")


class SimulatorInjectRequest(BaseModel):
    anomaly_type: str = Field(..., description="Anomaly category to inject (e.g. temperature_spike, frozen_sensor, etc.)")
    duration: Optional[int] = Field(10, ge=1, le=500, description="Anomaly duration in time-series steps")
    params: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Custom parameters (e.g. magnitude, target_sensor)")


class TrainRequest(BaseModel):
    records: Optional[int] = Field(15000, ge=1000, le=100000, description="Number of baseline samples to generate & train")
    contamination: Optional[float] = Field(0.05, ge=0.001, le=0.20, description="Expected contamination fraction")


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str
    database_connected: bool
    model_loaded: bool
    simulator_running: bool
