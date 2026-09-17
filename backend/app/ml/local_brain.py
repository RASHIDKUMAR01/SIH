"""
Local Brain: Station-Level Edge Diagnostic Engine (SIH26073 V4 Standard).
Performs ultra-fast, station-level anomaly screening including:
  1. Absolute physical atmospheric boundary checking
  2. Single-step rapid rate-of-change (ROC) spikes and drops
  3. Consecutive zero-variance (frozen transducer) detection
  4. Telemetry packet dropout / null payload detection
  5. Station electrical / battery voltage bounds
  6. Station trust score calibration & fault classification
"""
from typing import Optional, Dict, Any, List, Union
from datetime import datetime, timezone
from pydantic import BaseModel, Field

from app.ml.preprocessing import PHYSICAL_BOUNDS


class LocalBrainReport(BaseModel):
    station_id: str = "AWS-01"
    status: str = Field("NORMAL", description="'NORMAL', 'WARNING', 'ANOMALY', or 'OFFLINE'")
    is_alert: bool = False
    trigger_type: str = "NOMINAL"
    fault_type: str = "NOMINAL"
    severity: str = "LOW"
    confidence: float = 1.0
    trust_score: float = Field(0.98, ge=0.0, le=1.0, description="Station data integrity trust score")
    affected_sensors: List[str] = Field(default_factory=list)
    details: str = "All local station transducers operating within nominal limits."
    raw_flags: Dict[str, Any] = Field(default_factory=dict)
    is_reporting: bool = True
    last_report: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "station_id": self.station_id,
            "status": self.status,
            "is_alert": self.is_alert,
            "trigger_type": self.trigger_type,
            "fault_type": self.fault_type,
            "severity": self.severity,
            "confidence": round(self.confidence, 4),
            "trust_score": round(self.trust_score, 4),
            "affected_sensors": self.affected_sensors,
            "details": self.details,
            "raw_flags": self.raw_flags,
            "is_reporting": self.is_reporting,
            "last_report": self.last_report,
        }


class LocalBrain:
    """
    Station-level edge diagnostic engine.
    Maintains per-station rolling state for zero-variance, rate-of-change, and trust score tracking.
    """
    def __init__(self, station_id: str = "AWS-01"):
        self.station_id = station_id
        self.last_values: Dict[str, Optional[float]] = {
            "temperature": None,
            "pressure": None,
            "humidity": None,
            "wind_speed": None,
            "solar_radiation": None,
            "battery_voltage": None,
        }
        self.consecutive_frozen: Dict[str, int] = {
            "temperature": 0,
            "pressure": 0,
            "humidity": 0,
        }
        self.step_count = 0
        self.consecutive_faults = 0
        self.consecutive_normal = 0
        self.trust_score: float = 0.98

    def reset_state(self):
        self.last_values = {
            "temperature": None,
            "pressure": None,
            "humidity": None,
            "wind_speed": None,
            "solar_radiation": None,
            "battery_voltage": None,
        }
        self.consecutive_frozen = {"temperature": 0, "pressure": 0, "humidity": 0}
        self.step_count = 0
        self.consecutive_faults = 0
        self.consecutive_normal = 0
        self.trust_score = 0.98

    def evaluate_reading(self, reading: Dict[str, Any]) -> Dict[str, Any]:
        """Convenience method to evaluate a dictionary reading and return dictionary report."""
        report = self.evaluate(
            temperature=reading.get("temperature"),
            pressure=reading.get("pressure"),
            humidity=reading.get("humidity"),
            wind_speed=reading.get("wind_speed"),
            wind_direction=reading.get("wind_direction"),
            rainfall=reading.get("rainfall"),
            solar_radiation=reading.get("solar_radiation"),
            battery_voltage=reading.get("battery_voltage"),
            timestamp=reading.get("timestamp"),
        )
        res = report.to_dict()
        res["local_status"] = report.status
        res["is_flagged"] = report.is_alert
        res["boundary_violations"] = report.affected_sensors if ("boundary_violation" in report.raw_flags or report.trigger_type == "BOUNDARY_VIOLATION") else []
        return res

    def evaluate(
        self,
        temperature: Optional[float],
        pressure: Optional[float],
        humidity: Optional[float],
        wind_speed: Optional[float] = None,
        wind_direction: Optional[float] = None,
        rainfall: Optional[float] = None,
        solar_radiation: Optional[float] = None,
        battery_voltage: Optional[float] = None,
        timestamp: Optional[str] = None,
    ) -> LocalBrainReport:
        self.step_count += 1
        now_ts = timestamp or datetime.now(timezone.utc).isoformat()
        flags = {}
        missing_sensors = []

        # 1. Missing Data / Telemetry Drop Check (Communication Fault)
        if temperature is None:
            missing_sensors.append("temperature")
        if pressure is None:
            missing_sensors.append("pressure")
        if humidity is None:
            missing_sensors.append("humidity")

        if missing_sensors:
            flags["missing_data"] = True
            self.consecutive_faults += 1
            self.consecutive_normal = 0
            self.trust_score = max(0.10, self.trust_score - 0.25)
            
            is_total_drop = len(missing_sensors) >= 3
            return LocalBrainReport(
                station_id=self.station_id,
                status="OFFLINE" if is_total_drop else "ANOMALY",
                is_alert=True,
                trigger_type="MISSING_DATA",
                fault_type="MISSING_DATA",
                severity="CRITICAL" if is_total_drop else "HIGH",
                confidence=1.0,
                trust_score=self.trust_score,
                affected_sensors=missing_sensors,
                details=f"Local edge detected telemetry dropout on: {', '.join(missing_sensors)}.",
                raw_flags=flags,
                is_reporting=not is_total_drop,
                last_report=now_ts,
            )

        temp = float(temperature)
        press = float(pressure)
        hum = float(humidity)
        batt = float(battery_voltage if battery_voltage is not None else 4.10)

        # 2. Rapid Step Rate-of-Change (Spike / Drop) Detection
        step_spikes = []
        if self.last_values["temperature"] is not None:
            t_diff = temp - self.last_values["temperature"]
            if abs(t_diff) >= 4.5:
                step_spikes.append(("temperature", t_diff, "TEMPERATURE_SPIKE" if t_diff > 0 else "TEMPERATURE_DROP"))
        
        if self.last_values["pressure"] is not None:
            p_diff = press - self.last_values["pressure"]
            if abs(p_diff) >= 7.0:
                step_spikes.append(("pressure", p_diff, "PRESSURE_ANOMALY"))

        if self.last_values["humidity"] is not None:
            h_diff = hum - self.last_values["humidity"]
            if abs(h_diff) >= 20.0:
                step_spikes.append(("humidity", h_diff, "HUMIDITY_ANOMALY"))

        # 3. Consecutive Zero-Variance (Frozen Sensor) Detection
        frozen_sensors = []
        for s_name, curr_val in [("temperature", temp), ("pressure", press), ("humidity", hum)]:
            last_v = self.last_values[s_name]
            if last_v is not None and abs(curr_val - last_v) < 0.0001:
                self.consecutive_frozen[s_name] += 1
            else:
                self.consecutive_frozen[s_name] = 0

            # Require at least 5 consecutive identical readings
            if self.consecutive_frozen[s_name] >= 5:
                frozen_sensors.append(s_name)

        # Update last observed values for subsequent cycles
        self.last_values["temperature"] = temp
        self.last_values["pressure"] = press
        self.last_values["humidity"] = hum
        if wind_speed is not None:
            self.last_values["wind_speed"] = float(wind_speed)
        if solar_radiation is not None:
            self.last_values["solar_radiation"] = float(solar_radiation)
        if battery_voltage is not None:
            self.last_values["battery_voltage"] = float(battery_voltage)

        # 4. Rapid Step Spikes
        if step_spikes:
            sensor, diff, spike_type = step_spikes[0]
            flags["rapid_step_jump"] = True
            self.consecutive_faults += 1
            self.consecutive_normal = 0
            self.trust_score = max(0.20, self.trust_score - 0.15)
            
            return LocalBrainReport(
                station_id=self.station_id,
                status="ANOMALY",
                is_alert=True,
                trigger_type=spike_type,
                fault_type="SENSOR_SPIKE" if "SPIKE" in spike_type else "SENSOR_DROP",
                severity="HIGH",
                confidence=0.88,
                trust_score=self.trust_score,
                affected_sensors=[sensor],
                details=f"Local edge detected instantaneous jump of {diff:+.2f} on '{sensor}'.",
                raw_flags=flags,
                is_reporting=True,
                last_report=now_ts,
            )

        # 5. Physical Range Boundary Check
        out_of_bounds = []
        if temp < PHYSICAL_BOUNDS["temperature"][0] or temp > PHYSICAL_BOUNDS["temperature"][1]:
            out_of_bounds.append(("temperature", temp, PHYSICAL_BOUNDS["temperature"]))
        if press < PHYSICAL_BOUNDS["pressure"][0] or press > PHYSICAL_BOUNDS["pressure"][1]:
            out_of_bounds.append(("pressure", press, PHYSICAL_BOUNDS["pressure"]))
        if hum < PHYSICAL_BOUNDS["humidity"][0] or hum > PHYSICAL_BOUNDS["humidity"][1]:
            out_of_bounds.append(("humidity", hum, PHYSICAL_BOUNDS["humidity"]))

        if out_of_bounds:
            sensor_name, val, bounds = out_of_bounds[0]
            trigger = (
                "TEMPERATURE_SPIKE" if sensor_name == "temperature" and val > bounds[1]
                else "TEMPERATURE_DROP" if sensor_name == "temperature"
                else "PRESSURE_ANOMALY" if sensor_name == "pressure"
                else "HUMIDITY_ANOMALY"
            )
            flags["boundary_violation"] = True
            self.consecutive_faults += 1
            self.consecutive_normal = 0
            self.trust_score = max(0.15, self.trust_score - 0.20)
            
            return LocalBrainReport(
                station_id=self.station_id,
                status="ANOMALY",
                is_alert=True,
                trigger_type=trigger,
                fault_type="BOUNDARY_VIOLATION",
                severity="CRITICAL",
                confidence=0.99,
                trust_score=self.trust_score,
                affected_sensors=[sensor_name],
                details=f"Local transducer '{sensor_name}' breached physical threshold ({val} not in [{bounds[0]}, {bounds[1]}]).",
                raw_flags=flags,
                is_reporting=True,
                last_report=now_ts,
            )

        # 6. Frozen Sensor
        if len(frozen_sensors) >= 2 or (len(frozen_sensors) >= 1 and self.step_count > 5):
            flags["frozen_sensor"] = True
            self.consecutive_faults += 1
            self.consecutive_normal = 0
            self.trust_score = max(0.25, self.trust_score - 0.12)
            
            return LocalBrainReport(
                station_id=self.station_id,
                status="ANOMALY",
                is_alert=True,
                trigger_type="FROZEN_SENSOR",
                fault_type="FROZEN_SENSOR",
                severity="HIGH",
                confidence=min(0.70 + (0.05 * max(self.consecutive_frozen.values())), 0.99),
                trust_score=self.trust_score,
                affected_sensors=frozen_sensors,
                details=f"Local transducer(s) {', '.join(frozen_sensors)} exhibiting zero-variance lock across consecutive samples.",
                raw_flags=flags,
                is_reporting=True,
                last_report=now_ts,
            )

        # 7. Low Battery Warning
        if batt < 3.40:
            flags["battery_low"] = True
            return LocalBrainReport(
                station_id=self.station_id,
                status="WARNING",
                is_alert=True,
                trigger_type="BATTERY_LOW",
                fault_type="BATTERY_LOW",
                severity="MEDIUM",
                confidence=0.95,
                trust_score=max(0.65, self.trust_score - 0.05),
                affected_sensors=["power_supply"],
                details=f"Station battery voltage low ({batt:.2f}V < 3.40V threshold).",
                raw_flags=flags,
                is_reporting=True,
                last_report=now_ts,
            )

        # 8. All local checks nominal
        self.consecutive_normal += 1
        self.consecutive_faults = 0
        self.trust_score = min(0.99, self.trust_score + 0.02)
        
        return LocalBrainReport(
            station_id=self.station_id,
            status="NORMAL",
            is_alert=False,
            trigger_type="NOMINAL",
            fault_type="NOMINAL",
            severity="LOW",
            confidence=0.98,
            trust_score=self.trust_score,
            affected_sensors=[],
            details="All local station transducers operating within nominal limits.",
            raw_flags=flags,
            is_reporting=True,
            last_report=now_ts,
        )
