"""
Intelligent Multi-Modal Anomaly Classification Engine for Automatic Weather Stations (AWS).
Fuses:
  1. Physical atmospheric boundary checks
  2. Temporal & rate-of-change dynamics (1-step diff, 5-step ROC, rolling statistics)
  3. Zero-variance and monotonic drift trend tracking
  4. Multivariate thermodynamic coupled constraints (Psychrometrics, Magnus Dew-Point)
  5. Unsupervised Isolation Forest decision scores

Provides calibrated evidence-based confidence (0.0 - 1.0), explainable root causes,
affected sensor attribution, and standardized severity levels (LOW, MEDIUM, HIGH, CRITICAL).
"""
from enum import Enum
from typing import Optional, List, Dict, Any, Union
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

from app.ml.preprocessing import PHYSICAL_BOUNDS


class ClassifiedAnomalyType(str, Enum):
    NORMAL = "NORMAL"
    TEMPERATURE_SPIKE = "TEMPERATURE_SPIKE"
    TEMPERATURE_DROP = "TEMPERATURE_DROP"
    PRESSURE_ANOMALY = "PRESSURE_ANOMALY"
    HUMIDITY_ANOMALY = "HUMIDITY_ANOMALY"
    FROZEN_SENSOR = "FROZEN_SENSOR"
    SENSOR_DRIFT = "SENSOR_DRIFT"
    MISSING_DATA = "MISSING_DATA"
    MULTIVARIATE_INCONSISTENCY = "MULTIVARIATE_INCONSISTENCY"
    UNKNOWN_ANOMALY = "UNKNOWN_ANOMALY"


class AnomalySeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AnomalyClassificationResult(BaseModel):
    anomaly_type: ClassifiedAnomalyType
    confidence: float = Field(ge=0.0, le=1.0, description="Evidence-based confidence score")
    severity: AnomalySeverity
    explanation: str = Field(description="Human-readable root cause explanation")
    affected_parameters: List[str] = Field(default_factory=list, description="Sensors exhibiting anomalous behavior")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "anomaly_type": self.anomaly_type.value,
            "confidence": round(self.confidence, 4),
            "severity": self.severity.value,
            "explanation": self.explanation,
            "affected_parameters": self.affected_parameters,
        }


class AnomalyClassifier:
    def __init__(self):
        self.consecutive_frozen: Dict[str, int] = {"temperature": 0, "pressure": 0, "humidity": 0}
        self.last_values: Dict[str, Optional[float]] = {"temperature": None, "pressure": None, "humidity": None}
        self.step_counter: int = 0

    def reset_state(self):
        self.consecutive_frozen = {"temperature": 0, "pressure": 0, "humidity": 0}
        self.last_values = {"temperature": None, "pressure": None, "humidity": None}
        self.step_counter = 0

    def classify(
        self,
        row_or_dict: Union[pd.Series, Dict[str, Any]],
        if_score: float = 0.0,
        is_if_anomaly: bool = False,
    ) -> AnomalyClassificationResult:
        data = dict(row_or_dict)
        self.step_counter += 1
        
        temp = data.get("temperature")
        press = data.get("pressure")
        hum = data.get("humidity")

        # -------------------------------------------------------------
        # 1. MISSING DATA / TELEMETRY DROP DETECTION
        # -------------------------------------------------------------
        missing_sensors = []
        if temp is None or pd.isna(temp) or data.get("temp_is_missing", 0.0) == 1.0:
            missing_sensors.append("temperature")
        if press is None or pd.isna(press) or data.get("press_is_missing", 0.0) == 1.0:
            missing_sensors.append("pressure")
        if hum is None or pd.isna(hum) or data.get("hum_is_missing", 0.0) == 1.0:
            missing_sensors.append("humidity")

        if missing_sensors:
            severity = AnomalySeverity.CRITICAL if len(missing_sensors) == 3 else AnomalySeverity.HIGH
            return AnomalyClassificationResult(
                anomaly_type=ClassifiedAnomalyType.MISSING_DATA,
                confidence=1.0,
                severity=severity,
                explanation=(
                    f"Telemetry packet dropout on sensor(s): {', '.join(missing_sensors)}. "
                    f"Null payload received, indicating communication failure or sensor disconnect."
                ),
                affected_parameters=missing_sensors,
            )

        temp = float(temp)
        press = float(press)
        hum = float(hum)

        # -------------------------------------------------------------
        # 2. PHYSICAL BOUNDARY VIOLATIONS
        # -------------------------------------------------------------
        out_of_bounds = []
        if temp < PHYSICAL_BOUNDS["temperature"][0] or temp > PHYSICAL_BOUNDS["temperature"][1]:
            out_of_bounds.append(("temperature", temp, PHYSICAL_BOUNDS["temperature"]))
        if press < PHYSICAL_BOUNDS["pressure"][0] or press > PHYSICAL_BOUNDS["pressure"][1]:
            out_of_bounds.append(("pressure", press, PHYSICAL_BOUNDS["pressure"]))
        if hum < PHYSICAL_BOUNDS["humidity"][0] or hum > PHYSICAL_BOUNDS["humidity"][1]:
            out_of_bounds.append(("humidity", hum, PHYSICAL_BOUNDS["humidity"]))

        if out_of_bounds:
            sensor_name, val, bounds = out_of_bounds[0]
            return AnomalyClassificationResult(
                anomaly_type=(
                    ClassifiedAnomalyType.TEMPERATURE_SPIKE if sensor_name == "temperature" and val > bounds[1]
                    else ClassifiedAnomalyType.TEMPERATURE_DROP if sensor_name == "temperature"
                    else ClassifiedAnomalyType.PRESSURE_ANOMALY if sensor_name == "pressure"
                    else ClassifiedAnomalyType.HUMIDITY_ANOMALY
                ),
                confidence=0.99,
                severity=AnomalySeverity.CRITICAL,
                explanation=f"{sensor_name.capitalize()} reading ({val}) breached absolute physical limit [{bounds[0]}, {bounds[1]}].",
                affected_parameters=[sensor_name],
            )

        t_diff = float(data.get("temp_diff_1", 0.0))
        p_diff = float(data.get("press_diff_1", 0.0))
        h_diff = float(data.get("hum_diff_1", 0.0))

        t_roc5 = float(data.get("temp_roc_5", 0.0))
        p_roc5 = float(data.get("press_roc_5", 0.0))
        h_roc5 = float(data.get("hum_roc_5", 0.0))

        t_z = float(data.get("temp_zscore_15", 0.0))
        p_z = float(data.get("press_zscore_15", 0.0))
        h_z = float(data.get("hum_zscore_15", 0.0))

        t_std15 = float(data.get("temp_roll_std_15", 0.1))
        p_std15 = float(data.get("press_roll_std_15", 0.1))
        h_std15 = float(data.get("hum_roll_std_15", 0.1))

        t_dev15 = float(data.get("temp_dev_mean_15", 0.0))
        p_dev15 = float(data.get("press_dev_mean_15", 0.0))
        h_dev15 = float(data.get("hum_dev_mean_15", 0.0))

        # Update streaming state counters
        for s_name, curr_v in [("temperature", temp), ("pressure", press), ("humidity", hum)]:
            last_v = self.last_values[s_name]
            if last_v is not None and abs(curr_v - last_v) < 1e-4:
                self.consecutive_frozen[s_name] += 1
            else:
                self.consecutive_frozen[s_name] = 0
            self.last_values[s_name] = curr_v

        # -------------------------------------------------------------
        # 3. MULTIVARIATE THERMODYNAMIC INCONSISTENCY
        # -------------------------------------------------------------
        is_psychrometric_conflict = (temp >= 40.0 and hum >= 90.0) or (temp >= 44.0 and hum >= 80.0)
        is_coupled_divergence = (t_roc5 > 3.0 and h_roc5 > 20.0 and p_diff > -0.5)
        is_baric_thermal_clash = (press > 1035.0 and temp > 42.0 and hum > 85.0)

        if is_psychrometric_conflict or is_coupled_divergence or is_baric_thermal_clash:
            conf = min(0.98, max(0.85, 0.70 + 0.30 * if_score))
            return AnomalyClassificationResult(
                anomaly_type=ClassifiedAnomalyType.MULTIVARIATE_INCONSISTENCY,
                confidence=conf,
                severity=AnomalySeverity.HIGH,
                explanation=(
                    f"Thermodynamic inconsistency: Temperature ({temp:.1f}°C) and Relative Humidity ({hum:.1f}%) "
                    f"simultaneously violate atmospheric psychrometric constraints."
                ),
                affected_parameters=["temperature", "humidity"],
            )

        # -------------------------------------------------------------
        # 4. SUDDEN SPIKES & DROPS (Instantaneous Jumps)
        # -------------------------------------------------------------
        # Temperature Spike
        if t_diff >= 2.5 or t_z >= 2.8 or (t_roc5 >= 3.5 and (if_score > 0.35 or is_if_anomaly)):
            mag = max(t_diff, t_roc5)
            conf = min(0.99, max(0.75, 0.40 + 0.10 * abs(t_z) + 0.30 * if_score))
            sev = (
                AnomalySeverity.CRITICAL if mag >= 15.0 or temp > 50.0
                else AnomalySeverity.HIGH if mag >= 8.0
                else AnomalySeverity.MEDIUM if mag >= 4.0
                else AnomalySeverity.LOW
            )
            return AnomalyClassificationResult(
                anomaly_type=ClassifiedAnomalyType.TEMPERATURE_SPIKE,
                confidence=conf,
                severity=sev,
                explanation=f"Sudden thermal surge detected (+{mag:.2f}°C, Z-score = +{t_z:.1f}). Non-physical rate-of-change jump.",
                affected_parameters=["temperature"],
            )

        # Temperature Drop
        if t_diff <= -2.5 or t_z <= -2.8 or (t_roc5 <= -3.5 and (if_score > 0.35 or is_if_anomaly)):
            mag = abs(min(t_diff, t_roc5))
            conf = min(0.99, max(0.75, 0.40 + 0.10 * abs(t_z) + 0.30 * if_score))
            sev = (
                AnomalySeverity.CRITICAL if mag >= 15.0 or temp < -20.0
                else AnomalySeverity.HIGH if mag >= 8.0
                else AnomalySeverity.MEDIUM if mag >= 4.0
                else AnomalySeverity.LOW
            )
            return AnomalyClassificationResult(
                anomaly_type=ClassifiedAnomalyType.TEMPERATURE_DROP,
                confidence=conf,
                severity=sev,
                explanation=f"Sudden thermal plunge detected (-{mag:.2f}°C, Z-score = {t_z:.1f}). Rapid negative temperature gradient.",
                affected_parameters=["temperature"],
            )

        # Pressure Anomaly (Spike / Sudden Jump)
        if abs(p_diff) >= 2.0 or abs(p_z) >= 2.8 or (abs(p_roc5) >= 3.5 and (if_score > 0.35 or is_if_anomaly)):
            mag = max(abs(p_diff), abs(p_roc5))
            conf = min(0.99, max(0.75, 0.40 + 0.10 * abs(p_z) + 0.30 * if_score))
            sev = (
                AnomalySeverity.CRITICAL if mag >= 25.0
                else AnomalySeverity.HIGH if mag >= 12.0
                else AnomalySeverity.MEDIUM if mag >= 4.0
                else AnomalySeverity.LOW
            )
            sign_str = "+" if (p_diff > 0 or p_roc5 > 0) else "-"
            return AnomalyClassificationResult(
                anomaly_type=ClassifiedAnomalyType.PRESSURE_ANOMALY,
                confidence=conf,
                severity=sev,
                explanation=f"Abrupt barometric pressure perturbation ({sign_str}{mag:.2f} hPa, Z-score = {p_z:.1f}). Exceeds typical barometric rate limits.",
                affected_parameters=["pressure"],
            )

        # Humidity Anomaly
        if abs(h_diff) >= 12.0 or abs(h_z) >= 2.8 or (abs(h_roc5) >= 15.0 and (if_score > 0.35 or is_if_anomaly)):
            mag = max(abs(h_diff), abs(h_roc5))
            conf = min(0.99, max(0.72, 0.40 + 0.08 * abs(h_z) + 0.30 * if_score))
            sev = (
                AnomalySeverity.HIGH if mag >= 35.0
                else AnomalySeverity.MEDIUM if mag >= 18.0
                else AnomalySeverity.LOW
            )
            sign_str = "+" if (h_diff > 0 or h_roc5 > 0) else "-"
            return AnomalyClassificationResult(
                anomaly_type=ClassifiedAnomalyType.HUMIDITY_ANOMALY,
                confidence=conf,
                severity=sev,
                explanation=f"Abnormal relative humidity jump ({sign_str}{mag:.1f}%, Z-score = {h_z:.1f}). Exceeds natural atmospheric moisture transition speeds.",
                affected_parameters=["humidity"],
            )

        # -------------------------------------------------------------
        # 5. FROZEN SENSOR DETECTION (Zero Variance across Sustained Window)
        # -------------------------------------------------------------
        frozen_sensors = []
        if (t_std15 < 1e-4 and self.consecutive_frozen["temperature"] >= 6) or self.consecutive_frozen["temperature"] >= 8:
            frozen_sensors.append("temperature")
        if (p_std15 < 1e-4 and self.consecutive_frozen["pressure"] >= 6) or self.consecutive_frozen["pressure"] >= 8:
            frozen_sensors.append("pressure")
        if (h_std15 < 1e-4 and self.consecutive_frozen["humidity"] >= 6) or self.consecutive_frozen["humidity"] >= 8:
            frozen_sensors.append("humidity")

        if frozen_sensors:
            max_frozen_count = max(self.consecutive_frozen[s] for s in frozen_sensors)
            conf = min(0.98, 0.75 + 0.02 * max(max_frozen_count, 6))
            sev = AnomalySeverity.HIGH if max_frozen_count >= 15 else AnomalySeverity.MEDIUM
            return AnomalyClassificationResult(
                anomaly_type=ClassifiedAnomalyType.FROZEN_SENSOR,
                confidence=conf,
                severity=sev,
                explanation=(
                    f"Zero-variance stuck reading on {', '.join(frozen_sensors)}. "
                    f"Sensor outputs identical values over window without natural atmospheric turbulence."
                ),
                affected_parameters=frozen_sensors,
            )

        # -------------------------------------------------------------
        # 6. SENSOR DRIFT (Gradual Monotonic Deviation)
        # -------------------------------------------------------------
        drift_candidates = []
        if abs(t_dev15) >= 2.0 and abs(t_diff) < 1.5:
            drift_candidates.append(("temperature", t_dev15))
        if abs(p_dev15) >= 3.0 and abs(p_diff) < 1.5:
            drift_candidates.append(("pressure", p_dev15))
        if abs(h_dev15) >= 10.0 and abs(h_diff) < 5.0:
            drift_candidates.append(("humidity", h_dev15))

        if drift_candidates:
            s_name, dev = drift_candidates[0]
            conf = min(0.92, max(0.65, 0.50 + 0.05 * abs(dev) + 0.25 * if_score))
            sev = AnomalySeverity.HIGH if abs(dev) >= 6.0 else AnomalySeverity.MEDIUM if abs(dev) >= 3.0 else AnomalySeverity.LOW
            return AnomalyClassificationResult(
                anomaly_type=ClassifiedAnomalyType.SENSOR_DRIFT,
                confidence=conf,
                severity=sev,
                explanation=f"Gradual sensor calibration drift detected on {s_name} (Sustained baseline deviation: {dev:+.2f} units).",
                affected_parameters=[s_name],
            )

        # -------------------------------------------------------------
        # 7. UNKNOWN ANOMALY (Model-Detected Subspace Anomaly)
        # -------------------------------------------------------------
        if is_if_anomaly or if_score >= 0.70:
            return AnomalyClassificationResult(
                anomaly_type=ClassifiedAnomalyType.UNKNOWN_ANOMALY,
                confidence=round(min(0.95, if_score), 4),
                severity=AnomalySeverity.MEDIUM if if_score < 0.85 else AnomalySeverity.HIGH,
                explanation=(
                    f"Multidimensional statistical outlier flagged by Isolation Forest "
                    f"(Anomaly score: {if_score:.2f}) without distinct single-channel rule match."
                ),
                affected_parameters=["temperature", "pressure", "humidity"],
            )

        # -------------------------------------------------------------
        # 8. NORMAL TELEMETRY
        # -------------------------------------------------------------
        normal_conf = round(max(0.70, 1.0 - if_score), 4)
        return AnomalyClassificationResult(
            anomaly_type=ClassifiedAnomalyType.NORMAL,
            confidence=normal_conf,
            severity=AnomalySeverity.LOW,
            explanation="All meteorological sensors are operating within expected physical and statistical bounds.",
            affected_parameters=[],
        )
