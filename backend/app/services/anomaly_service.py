"""
End-to-end Integrated Anomaly Detection, Classification, Explainability, and Health Service.
Unifies:
  - Feature Engineering & Robust Scaling
  - Isolation Forest Model Inference & SHAP TreeExplainer
  - Vectorized LSTM Sequence Autoencoder Inference & Reconstruction Loss
  - Multi-Modal Anomaly Classification & Cross-Model Fusion
  - Explainable Root-Cause Generation
  - Real-Time Sensor Health Scoring & Predictive Maintenance
  - Hardware & IoT Station Prototype Compatibility
"""
import os
import time
from datetime import datetime
from typing import Optional, List, Dict, Any, Union, Deque
from collections import deque
import pandas as pd
import numpy as np

from app.ml.preprocessing import AWSPreprocessor, StreamingPreprocessor
from app.ml.anomaly_detector import IsolationForestAnomalyDetector
from app.ml.lstm_detector import LSTMAnomalyDetector
from app.ml.classifier import AnomalyClassifier, AnomalyClassificationResult, ClassifiedAnomalyType, AnomalySeverity
from app.ml.explainability import AnomalyExplainer, AnomalyExplanation
from app.services.sensor_health import SensorHealthMonitor, SensorHealthReport


class AnomalyDetectionService:
    def __init__(self, model_path: Optional[str] = None):
        self.classifier = AnomalyClassifier()
        self.health_monitor = SensorHealthMonitor()
        self.active_model_name: str = "ensemble" # "ensemble", "isolation_forest", "lstm"
        
        curr_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(curr_dir)))
        backend_dir = os.path.dirname(os.path.dirname(curr_dir))
        
        # 1. Load Isolation Forest Detector
        if_paths = [
            model_path,
            os.path.join(root_dir, "models", "isolation_forest.joblib"),
            os.path.join(backend_dir, "models", "isolation_forest.joblib"),
            os.path.join(curr_dir, "models", "isolation_forest.joblib"),
            "models/isolation_forest.joblib",
        ]
        loaded_if = False
        for p in if_paths:
            if p and os.path.exists(p):
                self.detector = IsolationForestAnomalyDetector.load(p)
                loaded_if = True
                break
        if not loaded_if:
            self.detector = IsolationForestAnomalyDetector()

        # 2. Load LSTM Sequence Autoencoder Detector
        lstm_paths = [
            os.path.join(root_dir, "models", "lstm_autoencoder.joblib"),
            os.path.join(backend_dir, "models", "lstm_autoencoder.joblib"),
            os.path.join(curr_dir, "models", "lstm_autoencoder.joblib"),
            "models/lstm_autoencoder.joblib",
        ]
        loaded_lstm = False
        for p in lstm_paths:
            if p and os.path.exists(p):
                self.lstm_detector = LSTMAnomalyDetector.load(p)
                loaded_lstm = True
                break
        if not loaded_lstm:
            self.lstm_detector = LSTMAnomalyDetector(sequence_length=8)

        # Sliding sequence vector buffer for LSTM inference
        self.sequence_buffer: Deque[np.ndarray] = deque(maxlen=8)

        self.explainer = AnomalyExplainer(
            isolation_forest_model=self.detector.model,
            feature_columns=self.detector.feature_columns,
        )

    def set_active_model(self, model_name: str) -> str:
        valid_models = {"ensemble", "isolation_forest", "lstm"}
        name = model_name.lower().strip()
        if name in valid_models:
            self.active_model_name = name
        return self.active_model_name

    def process_reading(
        self,
        timestamp: Union[str, Any],
        temperature: Optional[float],
        pressure: Optional[float],
        humidity: Optional[float],
        wind_speed: Optional[float] = None,
        station_id: str = "AWS-TINKER-01",
    ) -> Dict[str, Any]:
        if self.detector.streaming_preprocessor is None:
            prep = self.detector.preprocessor if self.detector.preprocessor is not None else AWSPreprocessor()
            self.detector.streaming_preprocessor = StreamingPreprocessor(prep, max_window=60)

        feat_df, X_curr = self.detector.streaming_preprocessor.push_and_extract(
            timestamp=timestamp,
            temperature=temperature,
            pressure=pressure,
            humidity=humidity,
        )
        
        row_dict = feat_df.iloc[0].to_dict()

        # 1. Isolation Forest Evaluation
        if self.detector.model is not None:
            raw_decision = float(self.detector.model.decision_function(X_curr)[0])
            is_if_anomaly = bool(raw_decision < self.detector.decision_threshold)
            if_score = float(self.detector._compute_anomaly_score(np.array([raw_decision]))[0])
        else:
            raw_decision = 0.0
            is_if_anomaly = False
            if_score = 0.0

        # 2. LSTM Autoencoder Sequence Evaluation
        self.sequence_buffer.append(X_curr[0])
        seq_len = self.lstm_detector.sequence_length
        if len(self.sequence_buffer) < seq_len:
            pad_count = seq_len - len(self.sequence_buffer)
            pad_arr = [self.sequence_buffer[0]] * pad_count
            full_seq = np.array(pad_arr + list(self.sequence_buffer))
        else:
            full_seq = np.array(list(self.sequence_buffer))

        lstm_loss, is_lstm_anomaly, lstm_score = self.lstm_detector.score_sequence(full_seq)

        # 3. Model Selection / Fusion
        if self.active_model_name == "lstm":
            effective_score = lstm_score
            effective_is_anomaly = is_lstm_anomaly
        elif self.active_model_name == "isolation_forest":
            effective_score = if_score
            effective_is_anomaly = is_if_anomaly
        else: # Ensemble (Both models collaborating)
            effective_score = max(if_score, lstm_score)
            effective_is_anomaly = is_if_anomaly or is_lstm_anomaly

        # 4. Multi-Modal Rule & Physics Classifier
        classif: AnomalyClassificationResult = self.classifier.classify(
            row_or_dict=row_dict,
            if_score=effective_score,
            is_if_anomaly=effective_is_anomaly,
        )

        is_anomaly = bool(classif.anomaly_type != ClassifiedAnomalyType.NORMAL)
        final_anomaly_score = max(effective_score, classif.confidence if is_anomaly else 1.0 - classif.confidence)

        # 5. Explainable AI Root Cause
        explanation: AnomalyExplanation = self.explainer.explain(
            telemetry=row_dict,
            anomaly_type=classif.anomaly_type.value,
            affected_parameters=classif.affected_parameters,
            scaled_feature_vector=X_curr,
        )

        # 6. Sensor Health Assessment
        health_report: SensorHealthReport = self.health_monitor.update(
            anomaly_type=classif.anomaly_type.value,
            severity=classif.severity.value,
            affected_parameters=classif.affected_parameters,
            confidence=classif.confidence,
        )

        # Compute realistic synoptic surface wind speed if not provided
        if wind_speed is None:
            try:
                hour = datetime.fromisoformat(str(timestamp).replace("Z", "+00:00")).hour if "T" in str(timestamp) else 12
            except Exception:
                hour = 12
            p_val = pressure if pressure is not None else 1013.25
            p_delta = abs(p_val - 1013.25)
            calculated_wind = 12.0 + (p_delta * 1.5) + (5.0 * np.sin((hour - 6) * np.pi / 12))
            wind_speed = float(np.clip(calculated_wind, 0.0, 65.0))

        try:
            ts_str = str(timestamp).replace("Z", "+00:00")
            ts_dt = datetime.fromisoformat(ts_str) if "T" in ts_str else datetime.utcnow()
            ts_ms = int(ts_dt.timestamp() * 1000) % 100000000
        except Exception:
            ts_ms = int(time.time() * 1000) % 100000000

        return {
            "timestamp": str(timestamp),
            "timestamp_ms": ts_ms,
            "station_id": station_id,
            "temperature": temperature,
            "pressure": pressure,
            "humidity": humidity,
            "wind_speed": round(float(wind_speed), 2),
            "is_anomaly": is_anomaly,
            "anomaly_score": round(float(final_anomaly_score), 4),
            "anomaly_type": classif.anomaly_type.value,
            "confidence": round(float(classif.confidence), 4),
            "severity": classif.severity.value,
            "explanation": explanation.summary,
            "affected_parameters": classif.affected_parameters,
            "raw_decision": round(raw_decision, 5),
            "active_model": self.active_model_name,
            "models": {
                "isolation_forest": {
                    "score": round(float(if_score), 4),
                    "is_anomaly": is_if_anomaly,
                    "decision": round(float(raw_decision), 4),
                },
                "lstm_autoencoder": {
                    "reconstruction_loss": round(float(lstm_loss), 4),
                    "reconstruction_threshold": round(float(self.lstm_detector.reconstruction_threshold), 4),
                    "is_anomaly": is_lstm_anomaly,
                    "score": round(float(lstm_score), 4),
                },
            },
            "explainability": explanation.to_dict(),
            "health": health_report.to_dict(),
        }

    def process_batch(self, df: pd.DataFrame) -> pd.DataFrame:
        if self.detector.model is None or self.detector.preprocessor is None:
            raise ValueError("Isolation Forest model must be trained or loaded before processing batch.")

        if_results = self.detector.predict_batch(df)
        lstm_results = self.lstm_detector.predict_batch(df)
        feat_df = self.detector.preprocessor.extract_features(df)
        X_scaled = self.detector.transform(df)

        classified_records = []
        self.classifier.reset_state()
        self.health_monitor.reset()

        for i in range(len(df)):
            row_feats = feat_df.iloc[i].to_dict()
            if_row = if_results.iloc[i]
            lstm_row = lstm_results.iloc[i]
            x_vec = X_scaled[i]
            
            if_s = float(if_row["anomaly_score"])
            is_if = bool(if_row["is_anomaly"])
            lstm_s = float(lstm_row["lstm_anomaly_score"])
            is_lstm = bool(lstm_row["is_lstm_anomaly"])

            if self.active_model_name == "lstm":
                eff_score, eff_is_anom = lstm_s, is_lstm
            elif self.active_model_name == "isolation_forest":
                eff_score, eff_is_anom = if_s, is_if
            else:
                eff_score = max(if_s, lstm_s)
                eff_is_anom = is_if or is_lstm
            
            classif = self.classifier.classify(
                row_or_dict=row_feats,
                if_score=eff_score,
                is_if_anomaly=eff_is_anom,
            )
            
            is_anom = bool(classif.anomaly_type != ClassifiedAnomalyType.NORMAL)
            score = max(eff_score, classif.confidence if is_anom else 1.0 - classif.confidence)
            
            explanation = self.explainer.explain(
                telemetry=row_feats,
                anomaly_type=classif.anomaly_type.value,
                affected_parameters=classif.affected_parameters,
                scaled_feature_vector=x_vec,
            )
            
            health = self.health_monitor.update(
                anomaly_type=classif.anomaly_type.value,
                severity=classif.severity.value,
                affected_parameters=classif.affected_parameters,
                confidence=classif.confidence,
            )
            
            classified_records.append({
                "is_anomaly": is_anom,
                "anomaly_score": round(score, 4),
                "anomaly_type": classif.anomaly_type.value,
                "confidence": round(classif.confidence, 4),
                "severity": classif.severity.value,
                "explanation": explanation.summary,
                "affected_parameters": classif.affected_parameters,
                "isolation_forest_score": round(if_s, 4),
                "lstm_reconstruction_loss": lstm_row["lstm_reconstruction_loss"],
                "lstm_score": lstm_s,
                "temperature_health": health.temperature_health,
                "pressure_health": health.pressure_health,
                "humidity_health": health.humidity_health,
                "overall_health": health.overall_health,
                "health_status": health.health_status,
                "maintenance_required": health.maintenance_required,
            })

        meta_df = pd.DataFrame(classified_records)
        cols_to_drop = [c for c in meta_df.columns if c in df.columns]
        base_df = df.drop(columns=cols_to_drop, errors="ignore")
        return pd.concat([base_df.reset_index(drop=True), meta_df], axis=1)
