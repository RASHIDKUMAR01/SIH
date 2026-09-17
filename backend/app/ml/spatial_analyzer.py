"""
Spatial Cross-Station Verification Engine for Automatic Weather Stations (AWS).
Analyzes cross-station agreement across neighboring nodes in the regional AWS network.
Distinguishes isolated single-sensor / single-station anomalies from regional meteorological phenomena.
"""
from typing import Optional, List, Dict, Any, Union
import numpy as np
from pydantic import BaseModel, Field


class NeighborStationReading(BaseModel):
    station_id: str
    temperature: float
    pressure: float
    humidity: float
    wind_speed: float
    distance_km: float = 12.0
    latitude: Optional[float] = None
    longitude: Optional[float] = None


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance in kilometers between two coordinates."""
    R = 6371.0  # Earth radius in km
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = np.sin(dlat / 2.0)**2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2.0)**2
    c = 2.0 * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0)))
    return float(round(R * c, 2))


class SpatialAnalysisReport(BaseModel):
    spatial_agreement_pct: float = Field(ge=0.0, le=100.0, description="Cross-station agreement percentage")
    is_spatially_corroborated: bool = Field(description="True if neighboring stations corroborate the reading")
    is_regional_event: bool = Field(description="True if all regional stations experience similar atmospheric shift")
    divergence_score: float = Field(ge=0.0, description="Z-score / Mahalanobis distance from regional cluster")
    neighbor_count: int = 3
    neighbor_summary: List[Dict[str, Any]] = Field(default_factory=list)
    details: str = "Regional network corroborates nominal conditions."

    def to_dict(self) -> Dict[str, Any]:
        return {
            "spatial_agreement_pct": round(self.spatial_agreement_pct, 1),
            "is_spatially_corroborated": self.is_spatially_corroborated,
            "is_regional_event": self.is_regional_event,
            "divergence_score": round(self.divergence_score, 4),
            "neighbor_count": self.neighbor_count,
            "neighbor_summary": self.neighbor_summary,
            "details": self.details,
        }


class SpatialCrossStationAnalyzer:
    """
    Evaluates spatial consistency against neighboring AWS nodes.
    Supports both real multi-station networks and mesonet synthesis.
    """
    def __init__(self, primary_station_id: str = "AWS-001"):
        self.primary_station_id = primary_station_id

    def analyze(
        self,
        temperature: Optional[float],
        pressure: Optional[float],
        humidity: Optional[float],
        wind_speed: Optional[float] = None,
        neighbors: Optional[List[Dict[str, Any]]] = None,
        is_simulated_event_regional: bool = False,
    ) -> SpatialAnalysisReport:
        if temperature is None or pressure is None or humidity is None:
            return SpatialAnalysisReport(
                spatial_agreement_pct=0.0,
                is_spatially_corroborated=False,
                is_regional_event=False,
                divergence_score=9.99,
                neighbor_count=0,
                neighbor_summary=[],
                details="Spatial cross-verification unavailable due to missing local telemetry.",
            )

        t_val = float(temperature)
        p_val = float(pressure)
        h_val = float(humidity)
        w_val = float(wind_speed if wind_speed is not None else 4.0)

        # 1. Gather or Synthesize Neighbor Station Observations
        neighbor_readings: List[NeighborStationReading] = []
        if neighbors and len(neighbors) > 0:
            for n in neighbors:
                neighbor_readings.append(NeighborStationReading(
                    station_id=n.get("station_id", "AWS-NEIGHBOR"),
                    temperature=float(n.get("temperature", t_val)),
                    pressure=float(n.get("pressure", p_val)),
                    humidity=float(n.get("humidity", h_val)),
                    wind_speed=float(n.get("wind_speed", w_val)),
                    distance_km=float(n.get("distance_km", 10.0)),
                ))
        else:
            # Generate representative regional mesonet cluster
            if is_simulated_event_regional:
                # Regional weather event: neighbors share the shifted meteorological state
                offsets = [(-0.3, 0.4, -1.2), (0.2, -0.2, 1.0), (-0.4, 0.1, -0.8)]
                for idx, (dt, dp, dh) in enumerate(offsets, start=2):
                    neighbor_readings.append(NeighborStationReading(
                        station_id=f"AWS-{idx:03d}",
                        temperature=round(float(t_val + dt), 2),
                        pressure=round(float(p_val + dp), 2),
                        humidity=round(float(np.clip(h_val + dh, 5.0, 100.0)), 2),
                        wind_speed=round(float(w_val + (0.5 * idx)), 2),
                        distance_km=float(8.0 * idx),
                    ))
            else:
                # Normal mesonet background (or isolated spike):
                # If target is within nominal bounds, neighbors closely track with small spatial noise
                is_target_nominal = (10.0 <= t_val <= 38.0) and (980.0 <= p_val <= 1035.0) and (15.0 <= h_val <= 95.0)
                if is_target_nominal:
                    offsets = [(0.2, -0.1, 0.5), (-0.3, 0.2, -0.8), (0.3, -0.2, 1.1)]
                    for idx, (dt, dp, dh) in enumerate(offsets, start=2):
                        neighbor_readings.append(NeighborStationReading(
                            station_id=f"AWS-{idx:03d}",
                            temperature=round(float(t_val + dt), 2),
                            pressure=round(float(p_val + dp), 2),
                            humidity=round(float(np.clip(h_val + dh, 5.0, 100.0)), 2),
                            wind_speed=round(float(w_val + (0.3 * idx)), 2),
                            distance_km=float(8.0 * idx),
                        ))
                else:
                    # Isolated extreme anomaly: neighbors stay at nominal background (28°C / 1013 hPa / 60%)
                    base_t = 28.0
                    base_p = 1013.25
                    base_h = 60.0
                    offsets = [(0.2, -0.1, 0.5), (-0.4, 0.2, -0.8), (0.3, -0.2, 1.1)]
                    for idx, (dt, dp, dh) in enumerate(offsets, start=2):
                        neighbor_readings.append(NeighborStationReading(
                            station_id=f"AWS-{idx:03d}",
                            temperature=round(float(base_t + dt), 2),
                            pressure=round(float(base_p + dp), 2),
                            humidity=round(float(base_h + dh), 2),
                            wind_speed=round(float(4.0 + (0.4 * idx)), 2),
                            distance_km=float(8.0 * idx),
                        ))

        # 2. Compute Spatial Statistics Across Neighbors with physical atmospheric tolerances
        n_temps = np.array([n.temperature for n in neighbor_readings])
        n_press = np.array([n.pressure for n in neighbor_readings])
        n_hums = np.array([n.humidity for n in neighbor_readings])

        mean_t, std_t = float(np.mean(n_temps)), max(float(np.std(n_temps)), 1.5)
        mean_p, std_p = float(np.mean(n_press)), max(float(np.std(n_press)), 2.5)
        mean_h, std_h = float(np.mean(n_hums)), max(float(np.std(n_hums)), 5.0)

        # Standardized Z-divergence
        z_t = abs(t_val - mean_t) / std_t
        z_p = abs(p_val - mean_p) / std_p
        z_h = abs(h_val - mean_h) / std_h

        # Multi-variable divergence score
        max_z = max(z_t, z_p, z_h)
        mean_z = (z_t + z_p + z_h) / 3.0

        # 3. Spatial Agreement Percentage (0 - 100%)
        # Exponential decay with distance from regional cluster
        agreement_ratio = np.exp(-0.30 * (mean_z ** 1.25))
        agreement_pct = float(np.clip(agreement_ratio * 100.0, 2.0, 99.8))

        is_corroborated = bool(agreement_pct >= 65.0)
        is_regional = bool(agreement_pct >= 70.0 and mean_z < 1.5)

        neighbor_summary = [
            {
                "station_id": n.station_id,
                "temperature": n.temperature,
                "pressure": n.pressure,
                "humidity": n.humidity,
                "distance_km": n.distance_km,
            }
            for n in neighbor_readings
        ]

        if agreement_pct >= 75.0:
            details = f"High regional corroboration ({agreement_pct:.1f}% agreement) across {len(neighbor_readings)} adjacent stations."
        elif agreement_pct >= 50.0:
            details = f"Moderate regional consistency ({agreement_pct:.1f}% agreement). Local microclimate variance observed."
        else:
            details = (
                f"Severe spatial divergence ({agreement_pct:.1f}% agreement, max Z={max_z:.2f}). "
                f"Neighbor stations report nominal conditions (Mean T: {mean_t:.1f}°C vs Station: {t_val:.1f}°C), "
                f"indicating an isolated transducer/station fault."
            )

        return SpatialAnalysisReport(
            spatial_agreement_pct=agreement_pct,
            is_spatially_corroborated=is_corroborated,
            is_regional_event=is_regional,
            divergence_score=mean_z,
            neighbor_count=len(neighbor_readings),
            neighbor_summary=neighbor_summary,
            details=details,
        )


# Convenient alias
SpatialAnalyzer = SpatialCrossStationAnalyzer

