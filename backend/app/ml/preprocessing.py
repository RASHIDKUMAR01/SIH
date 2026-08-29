"""
AWS Telemetry Preprocessing and Feature Engineering Pipeline.
Provides dual-mode functionality:
  1. Batch historical processing for dataset cleaning and ML model training.
  2. Stateful streaming buffer for real-time sensor ingestion without future data leakage.
"""
from typing import Optional, List, Dict, Any, Tuple, Union
from datetime import datetime
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import RobustScaler


PHYSICAL_BOUNDS = {
    "temperature": (-50.0, 65.0),
    "pressure": (800.0, 1100.0),
    "humidity": (0.0, 100.0),
}

FEATURE_COLUMNS = [
    # Raw & cleaned baselines
    "temperature", "pressure", "humidity",
    # 1-step immediate differences
    "temp_diff_1", "press_diff_1", "hum_diff_1",
    # 5-step rate of change
    "temp_roc_5", "press_roc_5", "hum_roc_5",
    # Rolling 15-step statistics
    "temp_roll_mean_15", "temp_roll_std_15",
    "press_roll_mean_15", "press_roll_std_15",
    "hum_roll_mean_15", "hum_roll_std_15",
    # Rolling 30-step statistics
    "temp_roll_mean_30", "temp_roll_std_30",
    "press_roll_mean_30", "press_roll_std_30",
    "hum_roll_mean_30", "hum_roll_std_30",
    # Deviations and Z-scores from rolling 15-step mean
    "temp_dev_mean_15", "press_dev_mean_15", "hum_dev_mean_15",
    "temp_zscore_15", "press_zscore_15", "hum_zscore_15",
    # Zero-variance / frozen sensor log-dispersion indicators
    "temp_log_variance", "press_log_variance", "hum_log_variance",
    # Meteorological & Thermodynamic cross-features
    "dew_point_depression", "psychrometric_spread",
    # Diurnal cyclic features
    "hour_sin", "hour_cos",
    # Missing indicator flags
    "temp_is_missing", "press_is_missing", "hum_is_missing",
]


def calculate_dew_point(temp: float, hum: float) -> float:
    if pd.isna(temp) or pd.isna(hum) or hum <= 0:
        return temp if not pd.isna(temp) else 0.0
    a = 17.27
    b = 237.7
    hum_clamped = max(1e-3, min(100.0, hum))
    alpha = ((a * temp) / (b + temp)) + np.log(hum_clamped / 100.0)
    return (b * alpha) / (a - alpha)


class AWSPreprocessor:
    def __init__(self, window_sizes: Tuple[int, ...] = (5, 15, 30)):
        self.window_sizes = window_sizes
        self.scaler = RobustScaler()
        self.is_fitted = False
        self.feature_columns: List[str] = FEATURE_COLUMNS.copy()

    def clean_raw_data(self, df: pd.DataFrame) -> pd.DataFrame:
        data = df.copy()
        data["timestamp"] = pd.to_datetime(data["timestamp"], utc=True)
        data = data.drop_duplicates(subset=["timestamp"], keep="last")
        data = data.sort_values("timestamp").reset_index(drop=True)
        
        for col, (min_v, max_v) in PHYSICAL_BOUNDS.items():
            if col in data.columns:
                invalid_mask = (data[col] < min_v) | (data[col] > max_v)
                data.loc[invalid_mask, col] = np.nan
                
        return data

    def extract_features(self, df: pd.DataFrame) -> pd.DataFrame:
        data = self.clean_raw_data(df)
        n_rows = len(data)
        
        data["temp_is_missing"] = data["temperature"].isna().astype(float)
        data["press_is_missing"] = data["pressure"].isna().astype(float)
        data["hum_is_missing"] = data["humidity"].isna().astype(float)
            
        for col in ["temperature", "pressure", "humidity"]:
            data[col] = data[col].ffill().bfill().fillna(0.0)
            
        data["temp_diff_1"] = data["temperature"].diff(1).fillna(0.0)
        data["press_diff_1"] = data["pressure"].diff(1).fillna(0.0)
        data["hum_diff_1"] = data["humidity"].diff(1).fillna(0.0)
        
        data["temp_roc_5"] = data["temperature"].diff(5).fillna(0.0)
        data["press_roc_5"] = data["pressure"].diff(5).fillna(0.0)
        data["hum_roc_5"] = data["humidity"].diff(5).fillna(0.0)
        
        # Default baseline standard deviation priors for warm-up steps
        default_std = {"temperature": 0.12, "pressure": 0.08, "humidity": 0.25}
        
        for w in (15, 30):
            data[f"temp_roll_mean_{w}"] = data["temperature"].rolling(window=w, min_periods=1).mean()
            raw_t_std = data["temperature"].rolling(window=w, min_periods=2).std()
            data[f"temp_roll_std_{w}"] = raw_t_std.fillna(default_std["temperature"]) if n_rows < 3 else raw_t_std.fillna(0.0)
            
            data[f"press_roll_mean_{w}"] = data["pressure"].rolling(window=w, min_periods=1).mean()
            raw_p_std = data["pressure"].rolling(window=w, min_periods=2).std()
            data[f"press_roll_std_{w}"] = raw_p_std.fillna(default_std["pressure"]) if n_rows < 3 else raw_p_std.fillna(0.0)
            
            data[f"hum_roll_mean_{w}"] = data["humidity"].rolling(window=w, min_periods=1).mean()
            raw_h_std = data["humidity"].rolling(window=w, min_periods=2).std()
            data[f"hum_roll_std_{w}"] = raw_h_std.fillna(default_std["humidity"]) if n_rows < 3 else raw_h_std.fillna(0.0)

        data["temp_dev_mean_15"] = data["temperature"] - data["temp_roll_mean_15"]
        data["press_dev_mean_15"] = data["pressure"] - data["press_roll_mean_15"]
        data["hum_dev_mean_15"] = data["humidity"] - data["hum_roll_mean_15"]
        
        eps = 1e-4
        data["temp_zscore_15"] = data["temp_dev_mean_15"] / (data["temp_roll_std_15"] + eps)
        data["press_zscore_15"] = data["press_dev_mean_15"] / (data["press_roll_std_15"] + eps)
        data["hum_zscore_15"] = data["hum_dev_mean_15"] / (data["hum_roll_std_15"] + eps)
        
        data["temp_log_variance"] = np.log(data["temp_roll_std_15"].clip(lower=1e-5) + 1e-5)
        data["press_log_variance"] = np.log(data["press_roll_std_15"].clip(lower=1e-5) + 1e-5)
        data["hum_log_variance"] = np.log(data["hum_roll_std_15"].clip(lower=1e-5) + 1e-5)
        
        a = 17.27
        b = 237.7
        hum_clamped = data["humidity"].clip(lower=0.1, upper=100.0)
        temp_val = data["temperature"]
        alpha = ((a * temp_val) / (b + temp_val)) + np.log(hum_clamped / 100.0)
        t_dew = (b * alpha) / (a - alpha)
        data["dew_point_depression"] = temp_val - t_dew
        data["psychrometric_spread"] = (temp_val * (100.0 - data["humidity"])) / 100.0
        
        hours = data["timestamp"].dt.hour + (data["timestamp"].dt.minute / 60.0)
        data["hour_sin"] = np.sin(2.0 * np.pi * hours / 24.0)
        data["hour_cos"] = np.cos(2.0 * np.pi * hours / 24.0)
        
        return data

    def fit(self, df: pd.DataFrame) -> "AWSPreprocessor":
        feat_df = self.extract_features(df)
        X = feat_df[self.feature_columns].values
        self.scaler.fit(X)
        self.is_fitted = True
        return self

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        if not self.is_fitted:
            raise ValueError("AWSPreprocessor must be fitted with fit() before calling transform().")
        feat_df = self.extract_features(df)
        X = feat_df[self.feature_columns].values
        return self.scaler.transform(X)

    def fit_transform(self, df: pd.DataFrame) -> np.ndarray:
        return self.fit(df).transform(df)

    def save(self, file_path: str):
        os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
        joblib.dump({
            "scaler": self.scaler,
            "is_fitted": self.is_fitted,
            "feature_columns": self.feature_columns,
            "window_sizes": self.window_sizes,
        }, file_path)

    @classmethod
    def load(cls, file_path: str) -> "AWSPreprocessor":
        obj_dict = joblib.load(file_path)
        instance = cls(window_sizes=obj_dict.get("window_sizes", (5, 15, 30)))
        instance.scaler = obj_dict["scaler"]
        instance.is_fitted = obj_dict["is_fitted"]
        instance.feature_columns = obj_dict.get("feature_columns", FEATURE_COLUMNS.copy())
        return instance


class StreamingPreprocessor:
    def __init__(self, preprocessor: AWSPreprocessor, max_window: int = 60):
        self.preprocessor = preprocessor
        self.max_window = max_window
        self.buffer: List[Dict[str, Any]] = []

    def push_and_extract(
        self,
        timestamp: Union[str, datetime],
        temperature: Optional[float],
        pressure: Optional[float],
        humidity: Optional[float],
    ) -> Tuple[pd.DataFrame, np.ndarray]:
        ts_str = timestamp.isoformat() if isinstance(timestamp, datetime) else str(timestamp)
        
        if self.buffer:
            try:
                last_ts = pd.to_datetime(self.buffer[-1]["timestamp"], utc=True)
                curr_ts = pd.to_datetime(ts_str, utc=True)
                if abs((curr_ts - last_ts).total_seconds()) > 900:
                    self.buffer.clear()
            except Exception:
                pass

        reading = {
            "timestamp": ts_str,
            "temperature": temperature,
            "pressure": pressure,
            "humidity": humidity,
        }
        
        self.buffer.append(reading)
        if len(self.buffer) > self.max_window:
            self.buffer.pop(0)
            
        buf_df = pd.DataFrame(self.buffer)
        feat_df = self.preprocessor.extract_features(buf_df)
        
        curr_feat_df = feat_df.iloc[[-1]].copy()
        
        if self.preprocessor.is_fitted:
            X_curr = self.preprocessor.scaler.transform(curr_feat_df[self.preprocessor.feature_columns].values)
        else:
            X_curr = curr_feat_df[self.preprocessor.feature_columns].values
            
        return curr_feat_df, X_curr

    def clear(self):
        self.buffer.clear()
