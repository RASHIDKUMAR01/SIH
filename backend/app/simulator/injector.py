"""
Anomaly injection engine for AWS Weather Simulator.
Supports all standard sensor failure modes, physical anomalies, and communication dropouts.
"""
from typing import Optional, Dict, Any, Tuple
from app.simulator.schemas import AnomalyType


class AnomalyInjector:
    def __init__(self):
        self.active_anomaly: AnomalyType = AnomalyType.NORMAL
        self.remaining_steps: int = 0
        self.current_step_in_anomaly: int = 0
        self.total_anomaly_duration: int = 0
        self.custom_params: Dict[str, Any] = {}
        
        # Frozen state cache
        self.frozen_temp: Optional[float] = None
        self.frozen_press: Optional[float] = None
        self.frozen_hum: Optional[float] = None

    def trigger(
        self,
        anomaly_type: AnomalyType,
        duration_steps: int = 10,
        params: Optional[Dict[str, Any]] = None,
    ):
        """
        Arm the simulator to inject a specified anomaly for a given duration in steps.
        """
        self.active_anomaly = anomaly_type
        self.remaining_steps = max(1, duration_steps)
        self.total_anomaly_duration = self.remaining_steps
        self.current_step_in_anomaly = 0
        self.custom_params = params or {}
        
        # Reset freeze cache
        self.frozen_temp = None
        self.frozen_press = None
        self.frozen_hum = None

    def cancel(self):
        """Cancel any ongoing anomaly injection and return to NORMAL."""
        self.active_anomaly = AnomalyType.NORMAL
        self.remaining_steps = 0
        self.current_step_in_anomaly = 0
        self.total_anomaly_duration = 0
        self.custom_params = {}
        self.frozen_temp = None
        self.frozen_press = None
        self.frozen_hum = None

    def process(
        self,
        raw_temp: float,
        raw_press: float,
        raw_hum: float,
    ) -> Tuple[Optional[float], Optional[float], Optional[float], bool, AnomalyType, Dict[str, Any]]:
        """
        Apply active anomaly transformation to raw physical weather variables.
        Returns:
            (temp, press, hum, is_anomaly, anomaly_type, metadata)
        """
        if self.remaining_steps <= 0 or self.active_anomaly == AnomalyType.NORMAL:
            self.cancel()
            return raw_temp, raw_press, raw_hum, False, AnomalyType.NORMAL, {}

        self.current_step_in_anomaly += 1
        self.remaining_steps -= 1
        
        anomaly_mode = self.active_anomaly
        metadata = {
            "step": self.current_step_in_anomaly,
            "total_duration": self.total_anomaly_duration,
            "raw_values": {
                "temperature": raw_temp,
                "atmospheric_pressure": raw_press,
                "relative_humidity": raw_hum,
            },
        }

        temp: Optional[float] = raw_temp
        press: Optional[float] = raw_press
        hum: Optional[float] = raw_hum

        if anomaly_mode == AnomalyType.TEMPERATURE_SPIKE:
            magnitude = self.custom_params.get("magnitude", 15.0)
            temp = round(raw_temp + magnitude, 2)
            metadata["description"] = f"Sudden positive thermal spike (+{magnitude}°C)"

        elif anomaly_mode == AnomalyType.TEMPERATURE_DROP:
            magnitude = self.custom_params.get("magnitude", 16.0)
            temp = round(raw_temp - magnitude, 2)
            metadata["description"] = f"Sudden thermal drop plunge (-{magnitude}°C)"

        elif anomaly_mode == AnomalyType.PRESSURE_SPIKE:
            magnitude = self.custom_params.get("magnitude", 35.0)
            press = round(raw_press + magnitude, 2)
            metadata["description"] = f"Barometric pressure surge (+{magnitude} hPa)"

        elif anomaly_mode == AnomalyType.HUMIDITY_SPIKE:
            magnitude = self.custom_params.get("magnitude", 45.0)
            hum = round(min(100.0, raw_hum + magnitude), 2)
            metadata["description"] = f"Instantaneous relative humidity surge (+{magnitude}%)"

        elif anomaly_mode == AnomalyType.FROZEN_SENSOR:
            target = self.custom_params.get("target_sensor", "all")
            metadata["target_sensor"] = target
            metadata["description"] = f"Stuck/Frozen sensor reading on {target} (zero variance)"
            
            if self.frozen_temp is None:
                self.frozen_temp = raw_temp
                self.frozen_press = raw_press
                self.frozen_hum = raw_hum

            if target in ("all", "temperature"):
                temp = self.frozen_temp
            if target in ("all", "atmospheric_pressure", "pressure"):
                press = self.frozen_press
            if target in ("all", "relative_humidity", "humidity"):
                hum = self.frozen_hum

        elif anomaly_mode == AnomalyType.SENSOR_DRIFT:
            drift_rate = self.custom_params.get("drift_rate", 0.4)
            target = self.custom_params.get("target_sensor", "temperature")
            drift_offset = round(drift_rate * self.current_step_in_anomaly, 2)
            metadata["drift_offset"] = drift_offset
            metadata["target_sensor"] = target
            metadata["description"] = f"Linear sensor calibration drift (+{drift_offset} units on {target})"
            
            if target in ("temperature", "temp"):
                temp = round(raw_temp + drift_offset, 2)
            elif target in ("atmospheric_pressure", "pressure"):
                press = round(raw_press + drift_offset, 2)
            elif target in ("relative_humidity", "humidity"):
                hum = round(min(100.0, max(0.0, raw_hum + drift_offset)), 2)

        elif anomaly_mode == AnomalyType.MISSING_DATA:
            target = self.custom_params.get("target_sensor", "all")
            metadata["target_sensor"] = target
            metadata["description"] = f"Packet loss / telemetry dropout on {target}"
            
            if target == "all":
                temp, press, hum = None, None, None
            elif target in ("temperature", "temp"):
                temp = None
            elif target in ("atmospheric_pressure", "pressure"):
                press = None
            elif target in ("relative_humidity", "humidity"):
                hum = None

        elif anomaly_mode == AnomalyType.MULTIVARIATE_INCONSISTENCY:
            # Physical conflict: extreme desert temperature + near saturation humidity + aberrant pressure
            temp = self.custom_params.get("temperature", 47.8)
            hum = self.custom_params.get("relative_humidity", 97.5)
            press = self.custom_params.get("atmospheric_pressure", 1045.0)
            metadata["description"] = "Multivariate thermodynamic inconsistency (47.8°C + 97.5% RH violates psychrometric ceiling)"

        return temp, press, hum, True, anomaly_mode, metadata
