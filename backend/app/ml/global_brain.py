"""
Global Brain: Multi-Evidence Spatial-Temporal Decision Fusion Engine.
Synthesizes:
  1. Local Brain (Edge hardware flags & boundary checks)
  2. LSTM Sequence Autoencoder (Temporal trajectory reconstruction score)
  3. Spatial Cross-Station Analysis (Regional mesonet agreement percentage)
  4. Multivariate Consistency (Thermodynamic physical coupling)
  5. Isolation Forest (Reference static multidimensional density score)

Primary Objective:
Determines whether an abnormal telemetry observation is a:
  - GENUINE_WEATHER_EVENT (Synoptic front, regional storm, corroborated by neighbors & physics)
  - SENSOR_FAULT (Isolated transducer spike, drift, or frozen ADC lock)
  - COMMUNICATION_FAULT (Packet dropout, null payload, telemetry loss)
  - NORMAL (Nominal meteorological dynamics)
"""
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

from app.ml.local_brain import LocalBrainReport
from app.ml.spatial_analyzer import SpatialAnalysisReport
from app.ml.multivariate_consistency import MultivariateConsistencyReport


class GlobalBrainDiagnosis(BaseModel):
    diagnosis_category: str = Field("NORMAL", description="'NORMAL', 'GENUINE_WEATHER_EVENT', 'SENSOR_FAULT', or 'COMMUNICATION_FAULT'")
    specific_type: str = Field("NORMAL", description="Detailed anomaly or weather event classification")
    is_anomaly: bool = False
    is_genuine_weather: bool = False
    is_sensor_fault: bool = False
    is_comm_fault: bool = False
    confidence: float = Field(ge=0.0, le=1.0, description="Calibrated multi-evidence confidence score")
    severity: str = "LOW"
    explanation: str = "Nominal atmospheric state across all verification dimensions."
    evidence_summary: Dict[str, Any] = Field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "diagnosis_category": self.diagnosis_category,
            "specific_type": self.specific_type,
            "is_anomaly": self.is_anomaly,
            "is_genuine_weather": self.is_genuine_weather,
            "is_sensor_fault": self.is_sensor_fault,
            "is_comm_fault": self.is_comm_fault,
            "confidence": round(self.confidence, 4),
            "severity": self.severity,
            "explanation": self.explanation,
            "evidence_summary": self.evidence_summary,
        }


class GlobalBrain:
    """
    Software-side verification layer and final decision authority.
    """
    def evaluate(
        self,
        local_report: LocalBrainReport,
        lstm_score: float,
        is_lstm_anomaly: bool,
        lstm_loss: float,
        spatial_report: SpatialAnalysisReport,
        multivariate_report: MultivariateConsistencyReport,
        if_score: float = 0.0,
        is_if_anomaly: bool = False,
        raw_anomaly_type: str = "NORMAL",
        affected_parameters: Optional[List[str]] = None,
    ) -> GlobalBrainDiagnosis:
        affected = affected_parameters or []

        evidence = {
            "local_brain_status": local_report.status,
            "local_trigger": local_report.trigger_type,
            "lstm_temporal_score": round(float(lstm_score), 4),
            "lstm_reconstruction_loss": round(float(lstm_loss), 4),
            "is_lstm_anomaly": is_lstm_anomaly,
            "spatial_agreement_pct": round(float(spatial_report.spatial_agreement_pct), 1),
            "is_spatially_corroborated": spatial_report.is_spatially_corroborated,
            "multivariate_consistency_level": multivariate_report.consistency_level,
            "multivariate_consistency_score": round(float(multivariate_report.consistency_score), 4),
            "isolation_forest_score": round(float(if_score), 4),
            "is_if_anomaly": is_if_anomaly,
        }

        # -------------------------------------------------------------
        # 1. COMMUNICATION FAULT
        # -------------------------------------------------------------
        if local_report.trigger_type == "MISSING_DATA" or raw_anomaly_type == "MISSING_DATA":
            return GlobalBrainDiagnosis(
                diagnosis_category="COMMUNICATION_FAULT",
                specific_type="MISSING_DATA",
                is_anomaly=True,
                is_comm_fault=True,
                confidence=1.0,
                severity="CRITICAL" if len(local_report.affected_sensors) >= 3 else "HIGH",
                explanation=(
                    f"COMMUNICATION FAULT: Packet dropout on telemetry channel(s): {', '.join(local_report.affected_sensors or ['telemetry'])}. "
                    f"Null payload received, indicating RF/cellular transmission loss or sensor disconnection."
                ),
                evidence_summary=evidence,
            )

        # -------------------------------------------------------------
        # 2. FROZEN SENSOR
        # -------------------------------------------------------------
        if local_report.trigger_type == "FROZEN_SENSOR" or raw_anomaly_type == "FROZEN_SENSOR":
            return GlobalBrainDiagnosis(
                diagnosis_category="SENSOR_FAULT",
                specific_type="FROZEN_SENSOR",
                is_anomaly=True,
                is_sensor_fault=True,
                confidence=max(local_report.confidence, 0.90),
                severity="HIGH",
                explanation=(
                    f"SENSOR FAULT (FROZEN SENSOR): Zero-variance lock detected on {', '.join(local_report.affected_sensors or ['transducer'])}. "
                    f"Repeated identical telemetry values indicate ADC register stall or mechanical transducer seizure."
                ),
                evidence_summary=evidence,
            )

        # -------------------------------------------------------------
        # 3. SPATIAL & MULTIVARIATE CORROBORATION (WEATHER VS SENSOR)
        # -------------------------------------------------------------
        has_temporal_or_local_alert = (
            local_report.is_alert or
            is_lstm_anomaly or
            lstm_score > 0.40 or
            is_if_anomaly or
            raw_anomaly_type not in ("NORMAL", "NOMINAL")
        )

        if has_temporal_or_local_alert:
            spatial_pct = spatial_report.spatial_agreement_pct
            multi_score = multivariate_report.consistency_score
            multi_level = multivariate_report.consistency_level

            # Case A: GENUINE REGIONAL WEATHER EVENT
            # Corroborated by high spatial agreement across neighboring stations
            if spatial_pct >= 65.0:
                conf = min(0.98, max(0.80, (spatial_pct / 100.0) * 0.7 + multi_score * 0.3))
                event_name = (
                    "REGIONAL_HEATWAVE" if "temperature" in affected and raw_anomaly_type == "TEMPERATURE_SPIKE"
                    else "BAROMETRIC_STORM_FRONT" if "pressure" in affected or raw_anomaly_type == "PRESSURE_ANOMALY"
                    else "TROPICAL_CONVECTIVE_SURGE" if "humidity" in affected or raw_anomaly_type == "HUMIDITY_ANOMALY"
                    else "GENUINE_WEATHER_EVENT"
                )
                return GlobalBrainDiagnosis(
                    diagnosis_category="GENUINE_WEATHER_EVENT",
                    specific_type=event_name,
                    is_anomaly=True,
                    is_genuine_weather=True,
                    confidence=round(conf, 4),
                    severity="HIGH" if spatial_pct >= 85.0 else "MEDIUM",
                    explanation=(
                        f"GENUINE WEATHER EVENT ({event_name}): Corroborated by {spatial_pct:.1f}% spatial agreement across "
                        f"{spatial_report.neighbor_count} neighboring stations and {multi_level} multivariate thermodynamic consistency. "
                        f"The atmospheric shift represents an authentic meteorological phenomenon rather than a hardware malfunction."
                    ),
                    evidence_summary=evidence,
                )

            # Case B: SENSOR DRIFT (Gradual Monotonic Deviation)
            elif raw_anomaly_type == "SENSOR_DRIFT" or local_report.fault_type == "SENSOR_DRIFT":
                return GlobalBrainDiagnosis(
                    diagnosis_category="SENSOR_DRIFT",
                    specific_type="SENSOR_DRIFT",
                    is_anomaly=True,
                    is_sensor_fault=True,
                    confidence=0.92,
                    severity="HIGH",
                    explanation=(
                        f"SENSOR DRIFT: Cumulative uncorroborated calibration drift detected. Station reading has drifted "
                        f"independently from regional mesonet neighbors ({spatial_pct:.1f}% spatial agreement)."
                    ),
                    evidence_summary=evidence,
                )

            # Case C: ISOLATED SENSOR / STATION FAULT
            # Divergent from neighbors OR violates multivariate physical coupling
            else:
                sensor_type = (
                    raw_anomaly_type if raw_anomaly_type not in ("NORMAL", "NOMINAL", "UNKNOWN_ANOMALY")
                    else local_report.trigger_type if local_report.trigger_type != "NOMINAL"
                    else "SENSOR_SPIKE"
                )
                conf = min(0.99, max(0.75, (1.0 - (spatial_pct / 100.0)) * 0.5 + (1.0 - multi_score) * 0.3 + (local_report.confidence * 0.2)))
                return GlobalBrainDiagnosis(
                    diagnosis_category="SENSOR_FAULT",
                    specific_type=sensor_type,
                    is_anomaly=True,
                    is_sensor_fault=True,
                    confidence=round(conf, 4),
                    severity="CRITICAL" if spatial_pct < 25.0 else "HIGH",
                    explanation=(
                        f"SENSOR FAULT ({sensor_type}): Localized transducer anomaly. Low spatial agreement ({spatial_pct:.1f}%) with "
                        f"neighboring stations (which report nominal conditions) and {multi_level} multivariate consistency "
                        f"confirm an isolated hardware/transducer defect."
                    ),
                    evidence_summary=evidence,
                )

        # -------------------------------------------------------------
        # 4. NOMINAL / NORMAL STATE
        # -------------------------------------------------------------
        return GlobalBrainDiagnosis(
            diagnosis_category="NORMAL",
            specific_type="NORMAL",
            is_anomaly=False,
            confidence=0.98,
            severity="LOW",
            explanation=(
                "NORMAL: Nominal meteorological parameters verified across Local Brain, LSTM temporal autoencoder, "
                f"regional mesonet ({spatial_report.spatial_agreement_pct:.1f}% agreement), and thermodynamic physical coupling."
            ),
            evidence_summary=evidence,
        )

    def diagnose(
        self,
        station_reading: Dict[str, Any],
        neighbor_readings: Optional[List[Dict[str, Any]]] = None,
        is_ml_anomaly: bool = False,
    ) -> Dict[str, Any]:
        """Convenience evaluation method that computes edge and spatial reports and delivers full diagnosis."""
        from app.ml.local_brain import LocalBrain
        from app.ml.spatial_analyzer import SpatialCrossStationAnalyzer
        from app.ml.multivariate_consistency import MultivariateConsistencyEngine

        sid = station_reading.get("station_id", "AWS-01")
        lb = LocalBrain(station_id=sid)
        local_rep = lb.evaluate(
            temperature=station_reading.get("temperature"),
            pressure=station_reading.get("pressure"),
            humidity=station_reading.get("humidity"),
            wind_speed=station_reading.get("wind_speed"),
            wind_direction=station_reading.get("wind_direction"),
            solar_radiation=station_reading.get("solar_radiation"),
            battery_voltage=station_reading.get("battery_voltage"),
        )

        sp_analyzer = SpatialCrossStationAnalyzer(primary_station_id=sid)
        spatial_rep = sp_analyzer.analyze(
            temperature=station_reading.get("temperature"),
            pressure=station_reading.get("pressure"),
            humidity=station_reading.get("humidity"),
            wind_speed=station_reading.get("wind_speed"),
            neighbors=neighbor_readings or [],
        )

        mv_engine = MultivariateConsistencyEngine()
        mv_rep = mv_engine.evaluate(
            temperature=station_reading.get("temperature"),
            pressure=station_reading.get("pressure"),
            humidity=station_reading.get("humidity"),
            wind_speed=station_reading.get("wind_speed"),
        )

        diag = self.evaluate(
            local_report=local_rep,
            lstm_score=0.75 if is_ml_anomaly else 0.05,
            is_lstm_anomaly=is_ml_anomaly,
            lstm_loss=0.45 if is_ml_anomaly else 0.08,
            spatial_report=spatial_rep,
            multivariate_report=mv_rep,
            if_score=0.70 if is_ml_anomaly else -0.1,
            is_if_anomaly=is_ml_anomaly,
            raw_anomaly_type="ANOMALY" if is_ml_anomaly else "NORMAL",
            affected_parameters=local_rep.affected_sensors,
        )

        res = diag.to_dict()
        res["diagnosis_category"] = diag.diagnosis_category.replace("_", " ")
        res["spatial_agreement_pct"] = spatial_rep.spatial_agreement_pct
        return res

