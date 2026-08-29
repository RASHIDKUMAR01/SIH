"""
Atmospheric physics and diurnal cycle generator for realistic weather simulation.
Uses coupled thermodynamics, solar radiation curves, barometric thermal tides,
and Ornstein-Uhlenbeck stochastic micro-variations.
"""
import math
import numpy as np
from datetime import datetime


class AtmosphericPhysicsEngine:
    def __init__(
        self,
        base_temperature: float = 27.0,
        temp_amplitude: float = 7.5,
        base_pressure: float = 1012.5,
        pressure_amplitude: float = 2.0,
        base_humidity: float = 65.0,
        humidity_amplitude: float = 25.0,
        seed: int = 42,
    ):
        self.base_temperature = base_temperature
        self.temp_amplitude = temp_amplitude
        self.base_pressure = base_pressure
        self.pressure_amplitude = pressure_amplitude
        self.base_humidity = base_humidity
        self.humidity_amplitude = humidity_amplitude
        
        self.rng = np.random.default_rng(seed)
        
        # Ornstein-Uhlenbeck noise states (mean-reverting turbulence)
        self.temp_noise = 0.0
        self.press_noise = 0.0
        self.hum_noise = 0.0
        
        # Reversion speeds and noise volatilities
        self.theta = 0.08
        self.sigma_temp = 0.12
        self.sigma_press = 0.08
        self.sigma_hum = 0.35

    def _update_ou_noise(self):
        """Step the Ornstein-Uhlenbeck mean-reverting noise processes."""
        self.temp_noise += -self.theta * self.temp_noise + self.sigma_temp * self.rng.normal()
        self.press_noise += -self.theta * self.press_noise + self.sigma_press * self.rng.normal()
        self.hum_noise += -self.theta * self.hum_noise + self.sigma_hum * self.rng.normal()

    def calculate_state(self, current_time: datetime) -> tuple[float, float, float]:
        """
        Calculate realistic coupled atmospheric parameters for a given datetime.
        Returns:
            (temperature_c, pressure_hpa, humidity_percent)
        """
        hour = current_time.hour + (current_time.minute / 60.0) + (current_time.second / 3600.0)
        
        # 1. Temperature: Diurnal solar curve (lowest at 05:30, peak at 14:30)
        # Shift phase so peak is at 14.5 hr -> sin((hour - 8.5) * 2pi / 24)
        t_phase = (hour - 8.5) * (2.0 * math.pi / 24.0)
        temp_diurnal = self.base_temperature + self.temp_amplitude * math.sin(t_phase)
        
        # 2. Relative Humidity: Inversely coupled with temperature
        # When temperature rises, saturation vapor pressure rises, dropping RH
        h_phase = (hour - 8.5) * (2.0 * math.pi / 24.0)
        hum_diurnal = self.base_humidity - self.humidity_amplitude * math.sin(h_phase)
        
        # 3. Atmospheric Pressure: Semi-diurnal atmospheric thermal tide (12-hour period)
        # Peaks around 09:00-10:00 and 21:00-22:00
        p_semi_phase = (hour - 3.5) * (2.0 * math.pi / 12.0)
        p_diurnal_phase = (hour - 12.0) * (2.0 * math.pi / 24.0)
        press_tide = (
            self.base_pressure
            + self.pressure_amplitude * math.sin(p_semi_phase)
            + 0.5 * math.sin(p_diurnal_phase)
        )
        
        # Step stochastic micro-turbulence
        self._update_ou_noise()
        
        final_temp = round(float(temp_diurnal + self.temp_noise), 2)
        final_press = round(float(press_tide + self.press_noise), 2)
        final_hum = round(float(np.clip(hum_diurnal + self.hum_noise, 5.0, 99.5)), 2)
        
        return final_temp, final_press, final_hum
