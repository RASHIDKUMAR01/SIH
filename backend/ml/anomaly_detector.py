"""
Isolation Forest Anomaly Detection Engine for Automatic Weather Stations (AWS).
Implements unsupervised temporal anomaly detection with robust feature scaling,
decision function calibration, continuous anomaly scoring (0.0 to 1.0), and both
batch and single-reading streaming inference.
"""
import os
from typing import Optional, List, Dict, Any, Union, Tuple
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import IsolationForest

from app.ml.preprocessing import AWSPreprocessor, StreamingPreprocessor, FEATURE_COLUMNS


class IsolationForestAnomalyDetector:
    def __init__(
        self,
        contamination: float = 0.05,
        n_estimators: int = 150,
        max_samples: Union[str, int] = "auto",
        random_state: int = 42,
        threshold_offset: float = 0.0,
    ):
        self.contamination = contamination
        self.n_estimators = n_estimators
        self.max_samples = max_samples
        self.random_state = random_state
        self.threshold_offset = threshold_offset
        
        self.model: Optional[IsolationForest] = None
        self.preprocessor: Optional[AWSPreprocessor] = None
        self.streaming_preprocessor: Optional[StreamingPreprocessor] = None
        self.feature_columns: List[str] = FEATURE_COLUMNS.copy()
        
        self.score_min: float = -0.35
        self.score_max: float = 0.20
        self.decision_threshold: float = 0.0

    def fit(
        self,
        train_df: pd.DataFrame,
        train_only_normal: bool = True,
        val_df: Optional[pd.DataFrame] = None,
    ) -> "IsolationForestAnomalyDetector":
        if train_only_normal and "anomaly" in train_df.columns:
            data_to_fit = train_df[train_df["anomaly"] == 0].copy()
        else:
            data_to_fit = train_df.copy()

        self.preprocessor = AWSPreprocessor()
        X_train = self.preprocessor.fit_transform(data_to_fit)
        self.feature_columns = self.preprocessor.feature_columns

        self.model = IsolationForest(
            contamination=self.contamination,
            n_estimators=self.n_estimators,
            max_samples=self.max_samples,
            random_state=self.random_state,
            n_jobs=-1,
        )
        self.model.fit(X_train)

        raw_decisions = self.model.decision_function(X_train)
        self.score_min = float(np.percentile(raw_decisions, 0.5)) - 0.10
        self.score_max = float(np.percentile(raw_decisions, 99.5)) + 0.05
        self.decision_threshold = 0.0 + self.threshold_offset

        if val_df is not None and "anomaly" in val_df.columns:
            self._tune_threshold_on_validation(val_df)

        self.streaming_preprocessor = StreamingPreprocessor(self.preprocessor, max_window=60)
        return self

    def _tune_threshold_on_validation(self, val_df: pd.DataFrame):
        X_val = self.preprocessor.transform(val_df)
        decisions = self.model.decision_function(X_val)
        y_val = val_df["anomaly"].values
        
        best_th = 0.0
        best_f1 = 0.0
        
        for th in np.linspace(-0.10, 0.10, 41):
            preds = (decisions < th).astype(int)
            tp = np.sum((preds == 1) & (y_val == 1))
            fp = np.sum((preds == 1) & (y_val == 0))
            fn = np.sum((preds == 0) & (y_val == 1))
            prec = tp / (tp + fp) if (tp + fp) > 0 else 0
            rec = tp / (tp + fn) if (tp + fn) > 0 else 0
            f1 = 2 * (prec * rec) / (prec + rec) if (prec + rec) > 0 else 0
            if f1 > best_f1:
                best_f1 = f1
                best_th = float(th)
                
        self.decision_threshold = best_th

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        if self.preprocessor is None:
            raise ValueError("Preprocessor not fitted.")
        return self.preprocessor.transform(df)

    def _compute_anomaly_score(self, decision_scores: np.ndarray) -> np.ndarray:
        denom = (self.score_max - self.score_min) if (self.score_max - self.score_min) != 0 else 1.0
        normalized = (self.score_max - decision_scores) / denom
        return np.clip(np.round(normalized, 4), 0.0, 1.0)

    def predict_batch(self, df: pd.DataFrame) -> pd.DataFrame:
        if self.model is None or self.preprocessor is None:
            raise ValueError("Model must be trained with fit() or loaded with load() before inference.")

        X = self.preprocessor.transform(df)
        raw_decisions = self.model.decision_function(X)
        is_anom = raw_decisions < self.decision_threshold
        anomaly_scores = self._compute_anomaly_score(raw_decisions)

        result_df = df.copy()
        result_df["is_anomaly"] = is_anom
        result_df["anomaly_score"] = anomaly_scores
        result_df["prediction"] = is_anom.astype(int)
        result_df["raw_decision"] = np.round(raw_decisions, 5)

        return result_df

    def predict_single(
        self,
        timestamp: Union[str, Any],
        temperature: Optional[float],
        pressure: Optional[float],
        humidity: Optional[float],
    ) -> Dict[str, Any]:
        if self.model is None or self.streaming_preprocessor is None:
            raise ValueError("Model must be trained with fit() or loaded with load() before inference.")

        _, X_curr = self.streaming_preprocessor.push_and_extract(
            timestamp=timestamp,
            temperature=temperature,
            pressure=pressure,
            humidity=humidity,
        )

        raw_decision = float(self.model.decision_function(X_curr)[0])
        is_anomaly = bool(raw_decision < self.decision_threshold)
        anomaly_score = float(self._compute_anomaly_score(np.array([raw_decision]))[0])

        return {
            "timestamp": str(timestamp),
            "temperature": temperature,
            "pressure": pressure,
            "humidity": humidity,
            "is_anomaly": is_anomaly,
            "anomaly_score": anomaly_score,
            "prediction": 1 if is_anomaly else 0,
            "raw_decision": round(raw_decision, 5),
        }

    def save(self, model_path: str):
        os.makedirs(os.path.dirname(os.path.abspath(model_path)), exist_ok=True)
        payload = {
            "model": self.model,
            "preprocessor": self.preprocessor,
            "contamination": self.contamination,
            "n_estimators": self.n_estimators,
            "max_samples": self.max_samples,
            "random_state": self.random_state,
            "threshold_offset": self.threshold_offset,
            "decision_threshold": self.decision_threshold,
            "score_min": self.score_min,
            "score_max": self.score_max,
            "feature_columns": self.feature_columns,
        }
        joblib.dump(payload, model_path)

    @classmethod
    def load(cls, model_path: str) -> "IsolationForestAnomalyDetector":
        payload = joblib.load(model_path)
        instance = cls(
            contamination=payload.get("contamination", 0.05),
            n_estimators=payload.get("n_estimators", 150),
            max_samples=payload.get("max_samples", "auto"),
            random_state=payload.get("random_state", 42),
            threshold_offset=payload.get("threshold_offset", 0.0),
        )
        instance.model = payload["model"]
        instance.preprocessor = payload["preprocessor"]
        instance.decision_threshold = payload.get("decision_threshold", 0.0)
        instance.score_min = payload.get("score_min", -0.35)
        instance.score_max = payload.get("score_max", 0.20)
        instance.feature_columns = payload.get("feature_columns", FEATURE_COLUMNS.copy())
        instance.streaming_preprocessor = StreamingPreprocessor(instance.preprocessor, max_window=60)
        return instance
