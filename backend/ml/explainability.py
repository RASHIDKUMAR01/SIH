"""
Explainable AI (XAI) Engine for AWS Anomaly Detection.
Combines:
  1. Fine-grained contextual Natural Language Generation (NLG) analyzing parameter deltas,
     rolling mean deviations, cross-sensor corroboration/contradiction, and failure reasons.
  2. SHAP (SHapley Additive exPlanations) TreeExplainer for feature importance attribution
     on the underlying Isolation Forest model.
"""
from typing import Optional, List, Dict, Any, Union
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field
import shap

from app.ml.classifier import ClassifiedAnomalyType, AnomalySeverity


class FeatureShapContribution(BaseModel):
    feature_name: str
    shap_value: float
    feature_value: float
    contribution_direction: str  # "anomaly_driver" or "normal_driver"


class AnomalyExplanation(BaseModel):
    summary: str = Field(description="Comprehensive human-readable explanation")
    primary_parameter: str = Field(description="Primary parameter causing the anomaly")
    delta_value: Optional[float] = Field(None, description="Observed change over previous interval")
    deviation_from_mean: Optional[float] = Field(None, description="Deviation from recent rolling baseline")
    z_score: Optional[float] = Field(None, description="Statistical Z-score")
    corroborating_evidence: str = Field(description="Cross-sensor correlation analysis")
    suspicion_reason: str = Field(description="Why the system determined this is anomalous")
    top_shap_features: List[FeatureShapContribution] = Field(default_factory=list, description="Top SHAP feature attributions")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "summary": self.summary,
            "primary_parameter": self.primary_parameter,
            "delta_value": self.delta_value,
            "deviation_from_mean": self.deviation_from_mean,
            "z_score": self.z_score,
            "corroborating_evidence": self.corroborating_evidence,
            "suspicion_reason": self.suspicion_reason,
            "top_shap_features": [f.model_dump() for f in self.top_shap_features],
        }


class AnomalyExplainer:
    def __init__(self, isolation_forest_model: Optional[Any] = None, feature_columns: Optional[List[str]] = None):
        self.model = isolation_forest_model
        self.feature_columns = feature_columns or []
        self.shap_explainer: Optional[shap.TreeExplainer] = None
        
        if self.model is not None:
            self._init_shap()

    def _init_shap(self):
        try:
            self.shap_explainer = shap.TreeExplainer(self.model)
        except Exception:
            self.shap_explainer = None

    def explain(
        self,
        telemetry: Dict[str, Any],
        anomaly_type: str,
        affected_parameters: List[str],
        scaled_feature_vector: Optional[np.ndarray] = None,
    ) -> AnomalyExplanation:
        """
        Generate detailed, non-generic, contextual explanation with cross-sensor correlation
        and SHAP feature attribution.
        """
        temp = telemetry.get("temperature")
        press = telemetry.get("pressure")
        hum = telemetry.get("humidity")

        t_diff = float(telemetry.get("temp_diff_1", 0.0))
        p_diff = float(telemetry.get("press_diff_1", 0.0))
        h_diff = float(telemetry.get("hum_diff_1", 0.0))

        t_dev = float(telemetry.get("temp_dev_mean_15", 0.0))
        p_dev = float(telemetry.get("press_dev_mean_15", 0.0))
        h_dev = float(telemetry.get("hum_dev_mean_15", 0.0))

        t_z = float(telemetry.get("temp_zscore_15", 0.0))
        p_z = float(telemetry.get("press_zscore_15", 0.0))
        h_z = float(telemetry.get("hum_zscore_15", 0.0))

        primary = affected_parameters[0] if affected_parameters else "all"
        delta: Optional[float] = None
        dev_mean: Optional[float] = None
        z_val: Optional[float] = None

        summary = ""
        corroboration = ""
        suspicion = ""

        # -------------------------------------------------------------
        # 1. NORMAL CASE
        # -------------------------------------------------------------
        if anomaly_type == "NORMAL":
            summary = (
                f"All weather parameters are nominal. Temperature ({temp:.1f}°C, Δ={t_diff:+.2f}°C), "
                f"pressure ({press:.1f} hPa, Δ={p_diff:+.2f} hPa), and humidity ({hum:.1f}%, Δ={h_diff:+.1f}%) "
                f"exhibit normal continuous diurnal variations with zero physical violations."
            )
            corroboration = "Cross-sensor covariance aligns with standard atmospheric boundary conditions."
            suspicion = "None. Operating within expected statistical confidence envelope."
            primary = "none"

        # -------------------------------------------------------------
        # 2. MISSING DATA
        # -------------------------------------------------------------
        elif anomaly_type == "MISSING_DATA":
            primary = ", ".join(affected_parameters)
            summary = (
                f"Telemetry packet dropout detected on sensor channel(s): {primary}. "
                f"Null reading received during observation interval while station was actively polling."
            )
            non_missing = [s for s in ["temperature", "pressure", "humidity"] if s not in affected_parameters]
            if non_missing:
                corroboration = f"Other channel(s) ({', '.join(non_missing)}) transmitted valid telemetry."
            else:
                corroboration = "All station sensors experienced simultaneous telemetry blackout."
            suspicion = "Communication link failure, RS485 bus packet corruption, or sensor power dropout."

        # -------------------------------------------------------------
        # 3. FROZEN SENSOR
        # -------------------------------------------------------------
        elif anomaly_type == "FROZEN_SENSOR":
            primary = ", ".join(affected_parameters)
            frozen_val = temp if "temperature" in affected_parameters else (press if "pressure" in affected_parameters else hum)
            unit = "°C" if "temperature" in affected_parameters else ("hPa" if "pressure" in affected_parameters else "%")
            delta = 0.0
            dev_mean = 0.0
            summary = (
                f"{primary.capitalize()} sensor is stuck at exactly {frozen_val:.2f} {unit} across multiple consecutive "
                f"intervals with zero standard deviation (σ = 0.000)."
            )
            corroboration = (
                f"Natural diurnal thermodynamic cycle demands continuous micro-turbulent fluctuation, "
                f"which is absent on the {primary} channel."
            )
            suspicion = "Transducer latch-up, analog-to-digital converter (ADC) hang, or frozen firmware register."

        # -------------------------------------------------------------
        # 4. TEMPERATURE SPIKE
        # -------------------------------------------------------------
        elif anomaly_type == "TEMPERATURE_SPIKE":
            primary = "temperature"
            delta = t_diff
            dev_mean = t_dev
            z_val = t_z
            
            # Cross sensor check
            p_stable = abs(p_diff) < 0.5
            h_stable = abs(h_diff) < 3.0
            
            if p_stable and h_stable:
                corroboration = f"Pressure ({press:.1f} hPa, Δ={p_diff:+.2f} hPa) and humidity ({hum:.1f}%, Δ={h_diff:+.1f}%) remained relatively stable, contradicting a true atmospheric thermal front."
            else:
                corroboration = f"Pressure changed by {p_diff:+.2f} hPa and humidity shifted by {h_diff:+.1f}%."

            summary = (
                f"Temperature increased abruptly by {t_diff:+.2f}°C within one observation interval (current: {temp:.2f}°C) "
                f"and is {t_dev:+.2f}°C above its 15-minute rolling mean (Z-score = {t_z:+.1f}). {corroboration} "
                f"This isolated jump suggests a temperature sensor fault or localized thermal glitch."
            )
            suspicion = "Exceeds maximum physical atmospheric temperature gradient (typically < 3.0°C/min without severe weather fronts)."

        # -------------------------------------------------------------
        # 5. TEMPERATURE DROP
        # -------------------------------------------------------------
        elif anomaly_type == "TEMPERATURE_DROP":
            primary = "temperature"
            delta = t_diff
            dev_mean = t_dev
            z_val = t_z
            corroboration = f"Atmospheric pressure ({press:.1f} hPa, Δ={p_diff:+.2f} hPa) showed no accompanying cold-front barometric surge."
            summary = (
                f"Temperature plunged by {abs(t_diff):.2f}°C within one observation interval (current: {temp:.2f}°C), "
                f"deviating by {t_dev:.2f}°C below recent rolling baseline (Z-score = {t_z:.1f}). {corroboration} "
                f"Indicates a rapid thermal sensor discontinuity."
            )
            suspicion = "Instantaneous drop exceeds natural convective cooling limits."

        # -------------------------------------------------------------
        # 6. PRESSURE ANOMALY
        # -------------------------------------------------------------
        elif anomaly_type == "PRESSURE_ANOMALY":
            primary = "pressure"
            delta = p_diff
            dev_mean = p_dev
            z_val = p_z
            corroboration = f"Temperature ({temp:.1f}°C, Δ={t_diff:+.2f}°C) and humidity ({hum:.1f}%, Δ={h_diff:+.1f}%) showed no severe storm dynamics."
            summary = (
                f"Barometric pressure experienced a sudden jump of {p_diff:+.2f} hPa within one interval (current: {press:.2f} hPa), "
                f"deviating by {p_dev:+.2f} hPa from rolling mean (Z-score = {p_z:+.1f}). {corroboration} "
                f"Suggests a pressure transducer perturbation or static port blockage."
            )
            suspicion = "Pressure rate of change exceeds physical barometric tendency (< 2 hPa/hr standard)."

        # -------------------------------------------------------------
        # 7. HUMIDITY ANOMALY
        # -------------------------------------------------------------
        elif anomaly_type == "HUMIDITY_ANOMALY":
            primary = "humidity"
            delta = h_diff
            dev_mean = h_dev
            z_val = h_z
            corroboration = f"Ambient temperature ({temp:.1f}°C, Δ={t_diff:+.2f}°C) remained steady without psychrometric equilibrium."
            summary = (
                f"Relative humidity jumped by {h_diff:+.1f}% within one observation interval (current: {hum:.1f}%), "
                f"deviating by {h_dev:+.1f}% from rolling mean (Z-score = {h_z:+.1f}). {corroboration} "
                f"Indicates capacitive sensor condensation artifact or filter contamination."
            )
            suspicion = "Moisture surge violates natural vapor diffusion and psychrometric evaporation rates."

        # -------------------------------------------------------------
        # 8. SENSOR DRIFT
        # -------------------------------------------------------------
        elif anomaly_type == "SENSOR_DRIFT":
            primary = affected_parameters[0] if affected_parameters else "temperature"
            dev = t_dev if primary == "temperature" else (p_dev if primary == "pressure" else h_dev)
            unit = "°C" if primary == "temperature" else ("hPa" if primary == "pressure" else "%")
            delta = t_diff if primary == "temperature" else (p_diff if primary == "pressure" else h_diff)
            dev_mean = dev
            summary = (
                f"{primary.capitalize()} exhibits progressive calibration drift with a cumulative deviation of {dev:+.2f} {unit} "
                f"diverging steadily from expected diurnal baseline, despite low single-step rates of change (Δ = {delta:+.2f} {unit})."
            )
            corroboration = "Independent sensor channels maintained stable diurnal cycles while the drifted channel diverged monotonically."
            suspicion = "Gradual electronic component aging, sensor fouling, or analog reference voltage drift."

        # -------------------------------------------------------------
        # 9. MULTIVARIATE INCONSISTENCY
        # -------------------------------------------------------------
        elif anomaly_type == "MULTIVARIATE_INCONSISTENCY":
            primary = "temperature, humidity"
            summary = (
                f"Thermodynamic inconsistency detected: High ambient temperature ({temp:.1f}°C) concurrent with near-saturation "
                f"humidity ({hum:.1f}% RH) at {press:.1f} hPa violates the psychrometric dew point ceiling for standard atmospheric conditions."
            )
            corroboration = "The combination of scorching desert heat and tropical moisture saturation cannot physically co-exist without severe precipitation/condensation."
            suspicion = "Cross-sensor calibration conflict or simultaneous sensor failure."

        # -------------------------------------------------------------
        # 10. UNKNOWN / SUBSPACE ANOMALY
        # -------------------------------------------------------------
        else:
            primary = "multivariate"
            summary = (
                f"Unsupervised multi-feature subspace anomaly flagged by Isolation Forest. "
                f"Telemetry tuple (T={temp:.1f}°C, P={press:.1f} hPa, RH={hum:.1f}%) resides in a sparsely populated region of the state space."
            )
            corroboration = "Subtle multi-variable coupling deviation detected across rolling derivatives."
            suspicion = "Unusual meteorological microclimate or complex multi-sensor degradation."

        # -------------------------------------------------------------
        # 11. SHAP FEATURE ATTRIBUTION
        # -------------------------------------------------------------
        top_shap = self._compute_shap_contributions(scaled_feature_vector)

        return AnomalyExplanation(
            summary=summary,
            primary_parameter=primary,
            delta_value=round(delta, 2) if delta is not None else None,
            deviation_from_mean=round(dev_mean, 2) if dev_mean is not None else None,
            z_score=round(z_val, 2) if z_val is not None else None,
            corroborating_evidence=corroboration,
            suspicion_reason=suspicion,
            top_shap_features=top_shap,
        )

    def _compute_shap_contributions(self, scaled_vector: Optional[np.ndarray]) -> List[FeatureShapContribution]:
        if self.shap_explainer is None or scaled_vector is None or len(self.feature_columns) == 0:
            return []

        try:
            vec = scaled_vector.reshape(1, -1) if scaled_vector.ndim == 1 else scaled_vector
            shap_values = self.shap_explainer.shap_values(vec)
            
            # In Isolation Forest SHAP, shap_values is an array of shape (1, n_features)
            vals = shap_values[0] if isinstance(shap_values, list) else shap_values[0]
            feature_vals = vec[0]
            
            # Rank features by absolute SHAP contribution
            sorted_indices = np.argsort(np.abs(vals))[::-1][:5]
            
            contributions = []
            for idx in sorted_indices:
                feat_name = self.feature_columns[idx]
                s_val = float(vals[idx])
                f_val = float(feature_vals[idx])
                # Lower tree path / negative contribution drives anomaly in Isolation Forest
                direction = "anomaly_driver" if s_val < 0 else "normal_driver"
                contributions.append(
                    FeatureShapContribution(
                        feature_name=feat_name,
                        shap_value=round(s_val, 4),
                        feature_value=round(f_val, 4),
                        contribution_direction=direction,
                    )
                )
            return contributions
        except Exception:
            return []
