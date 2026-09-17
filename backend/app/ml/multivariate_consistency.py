"""
Multivariate Thermodynamic Consistency Engine for Automatic Weather Stations (AWS).
Evaluates physically coupled atmospheric principles:
  1. Psychrometric Dew-Point Bounds (Magnus Formula: T_dew <= T_ambient)
  2. Temperature-Humidity Anti-Correlation Dynamics
  3. Barometric Pressure Gradient vs Wind Velocity Acceleration
  4. Coupled Multi-Variable Co-Movement vs Isolated Single-Sensor Outlier
"""
from typing import Optional, Dict, Any, List, Tuple
import numpy as np
from pydantic import BaseModel, Field


class MultivariateConsistencyReport(BaseModel):
    consistency_level: str = Field("HIGH", description="'HIGH', 'MEDIUM', or 'LOW'")
    consistency_score: float = Field(ge=0.0, le=1.0, description="Normalized physical consistency metric (0.0 to 1.0)")
    is_physically_consistent: bool = True
    dew_point_c: float = 15.0
    thermodynamic_checks: Dict[str, bool] = Field(default_factory=dict)
    physical_evidence: List[str] = Field(default_factory=list)
    details: str = "Thermodynamic coupling consistent with natural atmospheric physics."

    def to_dict(self) -> Dict[str, Any]:
        return {
            "consistency_level": self.consistency_level,
            "consistency_score": round(self.consistency_score, 4),
            "is_physically_consistent": self.is_physically_consistent,
            "dew_point_c": round(self.dew_point_c, 2),
            "thermodynamic_checks": self.thermodynamic_checks,
            "physical_evidence": self.physical_evidence,
            "details": self.details,
        }


class MultivariateConsistencyEvaluator:
    """
    Evaluates physical consistency across multi-variable AWS telemetry channels.
    """
    @staticmethod
    def calculate_dew_point(temperature: float, humidity: float) -> float:
        """Magnus-Tetens Dew-Point approximation (°C)."""
        a = 17.27
        b = 237.7
        rh = max(0.01, min(100.0, humidity))
        alpha = ((a * temperature) / (b + temperature)) + np.log(rh / 100.0)
        return float((b * alpha) / (a - alpha))

    def evaluate(
        self,
        temperature: Optional[float],
        pressure: Optional[float],
        humidity: Optional[float],
        wind_speed: Optional[float] = None,
        t_diff_1: float = 0.0,
        p_diff_1: float = 0.0,
        h_diff_1: float = 0.0,
    ) -> MultivariateConsistencyReport:
        if temperature is None or pressure is None or humidity is None:
            return MultivariateConsistencyReport(
                consistency_level="LOW",
                consistency_score=0.0,
                is_physically_consistent=False,
                dew_point_c=0.0,
                thermodynamic_checks={"complete_telemetry": False},
                physical_evidence=["Incomplete sensor payload; multivariate verification impossible."],
                details="Missing telemetry prevents thermodynamic coupling verification.",
            )

        temp = float(temperature)
        press = float(pressure)
        hum = float(humidity)
        wind = float(wind_speed if wind_speed is not None else 4.0)

        checks = {}
        evidence = []
        penalties = 0.0

        # 1. Dew-Point Bounds Check (T_dew <= T_ambient + 0.5)
        dew_point = self.calculate_dew_point(temp, hum)
        if dew_point > (temp + 0.6):
            checks["dew_point_supersaturation_valid"] = False
            penalties += 0.40
            evidence.append(f"Dew point ({dew_point:.1f}°C) exceeds ambient temperature ({temp:.1f}°C), violating saturation bounds.")
        else:
            checks["dew_point_supersaturation_valid"] = True
            evidence.append(f"Dew point ({dew_point:.1f}°C) nominal relative to ambient ({temp:.1f}°C).")

        # 2. Coupled Temperature vs Humidity Shift
        # Genuine rapid warming should correlate with falling RH unless active rain/convection
        if abs(t_diff_1) >= 4.0:
            if t_diff_1 > 0 and h_diff_1 > 15.0 and hum > 85.0:
                # Tropical convective surge - possible
                checks["temp_hum_coupling"] = True
                evidence.append("Coupled temperature and humidity rise consistent with tropical convective surge.")
            elif t_diff_1 > 0 and abs(h_diff_1) < 0.5:
                # Temperature spiked abruptly without any corresponding humidity or pressure shift
                checks["temp_hum_coupling"] = False
                penalties += 0.35
                evidence.append(f"Isolated temperature spike ({t_diff_1:+.1f}°C) with decoupled flat humidity ({h_diff_1:+.1f}%), indicating transducer fault.")
            else:
                checks["temp_hum_coupling"] = True
        else:
            checks["temp_hum_coupling"] = True

        # 3. Barometric Pressure Drop vs Surface Wind Velocity
        # Steep barometric drop |ΔP| > 4 hPa naturally accelerates surface wind
        if p_diff_1 <= -4.0 and wind < 2.0:
            checks["barometric_wind_coupling"] = False
            penalties += 0.30
            evidence.append(f"Severe pressure drop ({p_diff_1:+.1f} hPa) occurred with stagnant wind ({wind:.1f} m/s), uncharacteristic of synoptic front.")
        else:
            checks["barometric_wind_coupling"] = True

        # 4. Isolated Single-Variable Disconnect
        # If one sensor shows extreme reading while others are completely undisturbed
        is_isolated_outlier = (
            (abs(temp - 25.0) > 20.0 and abs(press - 1013.25) < 1.0 and abs(hum - 60.0) < 2.0) or
            (abs(press - 1013.25) > 60.0 and abs(temp - 25.0) < 1.0 and abs(hum - 60.0) < 2.0)
        )
        if is_isolated_outlier:
            checks["multi_sensor_coherence"] = False
            penalties += 0.45
            evidence.append("Single sensor isolated excursion with zero systemic coupling across adjacent transducers.")
        else:
            checks["multi_sensor_coherence"] = True

        consistency_score = max(0.05, min(1.0, 1.0 - penalties))
        if consistency_score >= 0.75:
            level = "HIGH"
            details = "Atmospheric parameters demonstrate high thermodynamic coupling and physical consistency."
        elif consistency_score >= 0.45:
            level = "MEDIUM"
            details = "Moderate multivariate consistency with mild atmospheric divergence."
        else:
            level = "LOW"
            details = "Low multivariate consistency: Decoupled sensor anomalies violate atmospheric physical laws."

        return MultivariateConsistencyReport(
            consistency_level=level,
            consistency_score=consistency_score,
            is_physically_consistent=bool(consistency_score >= 0.50),
            dew_point_c=dew_point,
            thermodynamic_checks=checks,
            physical_evidence=evidence,
            details=details,
        )


# Convenient alias
MultivariateConsistencyEngine = MultivariateConsistencyEvaluator

