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
    diagnosis_category: Optional[str] = "NORMAL"
    anomaly_score: float
    confidence: float
    severity: str
    explanation: str
    affected_parameters: List[str]
    sensor_health: Optional[Dict[str, Any]] = None
    maintenance_recommendation: Optional[List[str]] = None
    raw_decision: Optional[float] = None
    active_model: Optional[str] = None
    local_brain: Optional[Dict[str, Any]] = None
    spatial_analysis: Optional[Dict[str, Any]] = None
    multivariate_consistency: Optional[Dict[str, Any]] = None
    global_brain: Optional[Dict[str, Any]] = None
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


class LoginRequest(BaseModel):
    username: str = Field(..., description="Operator username or ID")
    password: str = Field(..., description="Operator secret password")
    remember_me: Optional[bool] = Field(False, description="Extend session duration")


class UserProfile(BaseModel):
    username: str
    role: str
    station_id: str
    full_name: Optional[str] = "SkyGuard Lead Operator"


class LoginResponse(BaseModel):
    success: bool
    message: str
    token: str
    expires_at: str
    user: UserProfile


class VerifyTokenResponse(BaseModel):
    valid: bool
    user: UserProfile


class ScenarioTriggerRequest(BaseModel):
    scenario: Optional[str] = Field(None, description="Scenario ID: SCENARIO_A, SCENARIO_B, SCENARIO_C, SCENARIO_D, SCENARIO_E")
    scenario_key: Optional[str] = Field(None, description="Alternative key name for scenario")
    duration_steps: Optional[int] = Field(25, ge=1, le=200, description="Duration of scenario in simulation ticks")

    @property
    def target_scenario(self) -> str:
        return self.scenario or self.scenario_key or "SCENARIO_E_NOMINAL"



class StationItemSchema(BaseModel):
    station_id: str
    station_name: str
    latitude: float
    longitude: float
    elevation_m: float
    temperature: Optional[float] = None
    pressure: Optional[float] = None
    humidity: Optional[float] = None
    wind_speed: Optional[float] = None
    wind_direction: Optional[float] = None
    rainfall: Optional[float] = None
    solar_radiation: Optional[float] = None
    battery_voltage: Optional[float] = None
    battery_level: Optional[int] = 100
    trust_score: float = 0.98
    local_status: str = "NORMAL"
    fault_type: str = "NOMINAL"
    severity: str = "LOW"
    confidence: float = 1.0
    is_reporting: bool = True
    last_report: str
    sensor_health: Dict[str, Any] = Field(default_factory=dict)


class StationsListResponse(BaseModel):
    timestamp: str
    active_scenario: str
    primary_station_id: str
    network_health: float
    total_stations: int
    online_stations: int
    stations: List[StationItemSchema]


