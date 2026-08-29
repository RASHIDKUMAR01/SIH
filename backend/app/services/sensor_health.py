"""
Sensor Health Monitoring and Predictive Maintenance Engine for Automatic Weather Stations (AWS).
Calculates real-time decaying & recovering health indices (0-100) for individual sensors and
overall AWS station health, incorporating anomaly frequencies, cumulative severity,
zero-variance freezes, chronic drift, and missing telemetry packets.
"""
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class SensorHealthStatus(str):
    EXCELLENT = "EXCELLENT"
    GOOD = "GOOD"
    DEGRADED = "DEGRADED"
    CRITICAL = "CRITICAL"


class SensorHealthReport(BaseModel):
    temperature_health: float = Field(ge=0.0, le=100.0, description="Temperature sensor health score (0-100)")
    pressure_health: float = Field(ge=0.0, le=100.0, description="Pressure sensor health score (0-100)")
    humidity_health: float = Field(ge=0.0, le=100.0, description="Humidity sensor health score (0-100)")
    overall_health: float = Field(ge=0.0, le=100.0, description="Overall AWS station health score (0-100)")
    health_status: str = Field(description="Categorical health status: EXCELLENT, GOOD, DEGRADED, CRITICAL")
    maintenance_required: bool = Field(description="Flag indicating if technician maintenance is required")
    recommendations: List[str] = Field(default_factory=list, description="Actionable maintenance recommendations")
    sensor_breakdown: Dict[str, Any] = Field(default_factory=dict, description="Detailed diagnostic metrics per sensor")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "temperature_health": round(self.temperature_health, 1),
            "pressure_health": round(self.pressure_health, 1),
            "humidity_health": round(self.humidity_health, 1),
            "overall_health": round(self.overall_health, 1),
            "health_status": self.health_status,
            "maintenance_required": self.maintenance_required,
            "recommendations": self.recommendations,
            "sensor_breakdown": self.sensor_breakdown,
        }


class SensorHealthMonitor:
    def __init__(
        self,
        recovery_rate: float = 0.6,
        window_size: int = 60,
    ):
        self.recovery_rate = recovery_rate
        self.window_size = window_size
        
        # Current health values (0.0 to 100.0)
        self.health: Dict[str, float] = {
            "temperature": 100.0,
            "pressure": 100.0,
            "humidity": 100.0,
        }
        
        # History tracking
        self.anomaly_counts: Dict[str, int] = {"temperature": 0, "pressure": 0, "humidity": 0}
        self.consecutive_anomalies: Dict[str, int] = {"temperature": 0, "pressure": 0, "humidity": 0}
        self.recent_history: List[Dict[str, Any]] = []

    def reset(self):
        """Reset all health metrics to pristine baseline (100.0)."""
        self.health = {"temperature": 100.0, "pressure": 100.0, "humidity": 100.0}
        self.anomaly_counts = {"temperature": 0, "pressure": 0, "humidity": 0}
        self.consecutive_anomalies = {"temperature": 0, "pressure": 0, "humidity": 0}
        self.recent_history.clear()

    def update(
        self,
        anomaly_type: str,
        severity: str,
        affected_parameters: List[str],
        confidence: float = 1.0,
    ) -> SensorHealthReport:
        """
        Update sensor health scores based on latest classified telemetry event.
        """
        is_anom = (anomaly_type != "NORMAL")
        
        # 1. Base penalty configuration per severity level
        severity_penalty = {
            "LOW": 2.5,
            "MEDIUM": 6.0,
            "HIGH": 14.0,
            "CRITICAL": 24.0,
        }.get(severity, 2.5)

        # 2. Update each sensor
        for sensor in ["temperature", "pressure", "humidity"]:
            if is_anom and (sensor in affected_parameters or "all" in affected_parameters):
                self.consecutive_anomalies[sensor] += 1
                self.anomaly_counts[sensor] += 1
                
                # Fatigue multiplier for repeated consecutive anomalies
                consec = self.consecutive_anomalies[sensor]
                fatigue = 1.0 + min(2.0, 0.15 * (consec - 1))
                
                # Type-specific degradation weights
                type_mult = 1.0
                if anomaly_type == "FROZEN_SENSOR":
                    type_mult = 1.4  # Zero variance is a severe hardware failure
                elif anomaly_type == "MISSING_DATA":
                    type_mult = 1.5  # Packet loss / disconnection
                elif anomaly_type == "SENSOR_DRIFT":
                    type_mult = 1.2  # Calibration drift

                penalty = severity_penalty * fatigue * type_mult * max(0.5, confidence)
                self.health[sensor] = max(0.0, self.health[sensor] - penalty)
            else:
                # Normal recovery on clean readings
                self.consecutive_anomalies[sensor] = 0
                self.health[sensor] = min(100.0, self.health[sensor] + self.recovery_rate)

        # 3. Overall Station Health Score
        # Weighted mean: 35% Temp, 35% Pressure, 30% Humidity
        w_t, w_p, w_h = 0.35, 0.35, 0.30
        raw_overall = (
            w_t * self.health["temperature"]
            + w_p * self.health["pressure"]
            + w_h * self.health["humidity"]
        )
        
        # If any single sensor is severely compromised (< 35), cap overall health
        min_health = min(self.health.values())
        if min_health < 35.0:
            overall_health = min(raw_overall, min_health + 20.0)
        else:
            overall_health = raw_overall

        overall_health = round(float(overall_health), 1)
        temp_h = round(float(self.health["temperature"]), 1)
        press_h = round(float(self.health["pressure"]), 1)
        hum_h = round(float(self.health["humidity"]), 1)

        # 4. Status Determination
        if overall_health >= 88.0:
            status = "EXCELLENT"
        elif overall_health >= 72.0:
            status = "GOOD"
        elif overall_health >= 48.0:
            status = "DEGRADED"
        else:
            status = "CRITICAL"

        # 5. Maintenance Recommendations Generation
        recommendations = self._generate_recommendations(temp_h, press_h, hum_h, overall_health, anomaly_type)
        maintenance_required = overall_health < 72.0 or min_health < 60.0

        sensor_breakdown = {
            "temperature": {
                "health": temp_h,
                "status": self._get_sensor_status(temp_h),
                "consecutive_anomalies": self.consecutive_anomalies["temperature"],
            },
            "pressure": {
                "health": press_h,
                "status": self._get_sensor_status(press_h),
                "consecutive_anomalies": self.consecutive_anomalies["pressure"],
            },
            "humidity": {
                "health": hum_h,
                "status": self._get_sensor_status(hum_h),
                "consecutive_anomalies": self.consecutive_anomalies["humidity"],
            },
        }

        return SensorHealthReport(
            temperature_health=temp_h,
            pressure_health=press_h,
            humidity_health=hum_h,
            overall_health=overall_health,
            health_status=status,
            maintenance_required=maintenance_required,
            recommendations=recommendations,
            sensor_breakdown=sensor_breakdown,
        )

    def _get_sensor_status(self, score: float) -> str:
        if score >= 88.0:
            return "EXCELLENT"
        if score >= 72.0:
            return "GOOD"
        if score >= 48.0:
            return "DEGRADED"
        return "CRITICAL"

    def _generate_recommendations(
        self,
        t_h: float,
        p_h: float,
        h_h: float,
        overall: float,
        last_anomaly: str,
    ) -> List[str]:
        recs = []
        
        # Sensor specific recommendations
        if t_h < 50.0:
            recs.append("Temperature Sensor Critical: Inspect PT100/Thermistor probe for wiring fault, radiation shield blockage, or ADC failure. Replace sensor element.")
        elif t_h < 75.0:
            recs.append("Temperature Sensor Warning: Minor thermal irregularities detected. Clean multi-plate solar radiation shield and inspect electrical contacts.")

        if p_h < 50.0:
            recs.append("Pressure Sensor Critical: Barometric transducer malfunction. Check static port tube for dust obstruction or venting valve failure.")
        elif p_h < 75.0:
            recs.append("Pressure Sensor Warning: Pressure signal noise detected. Perform zero-point barometric calibration check against secondary standard.")

        if h_h < 50.0:
            recs.append("Humidity Sensor Critical: Capacitive polymer degradation or water condensation trap. Replace protective sinter filter cap or sensor chip.")
        elif h_h < 75.0:
            recs.append("Humidity Sensor Warning: Slow response time. Clean membrane filter and check for salt/dust accumulation.")

        # Station level recommendations
        if overall < 45.0:
            recs.insert(0, "URGENT: Station health critically degraded. Dispatch field maintenance technician for full AWS diagnostic overhaul.")
        elif not recs:
            recs.append("All sensors operating nominally. System healthy. Scheduled routine inspection in 30 days.")

        return recs
