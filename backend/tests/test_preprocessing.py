"""
Unit tests for AWS Preprocessing and Feature Engineering Pipeline.
"""
import os
import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone

from app.ml.preprocessing import (
    AWSPreprocessor,
    StreamingPreprocessor,
    PHYSICAL_BOUNDS,
    FEATURE_COLUMNS,
    calculate_dew_point,
)


@pytest.fixture
def sample_raw_data() -> pd.DataFrame:
    base_time = datetime(2026, 8, 1, 0, 0, 0, tzinfo=timezone.utc)
    records = []
    for i in range(100):
        t = base_time + timedelta(minutes=i)
        temp = 25.0 + 5.0 * np.sin(i * 2 * np.pi / 60) + np.random.normal(0, 0.1)
        press = 1013.0 + 2.0 * np.sin(i * 2 * np.pi / 30) + np.random.normal(0, 0.05)
        hum = 60.0 - 15.0 * np.sin(i * 2 * np.pi / 60) + np.random.normal(0, 0.2)
        records.append({
            "timestamp": t.isoformat(),
            "temperature": round(float(temp), 2),
            "pressure": round(float(press), 2),
            "humidity": round(float(hum), 2),
        })
    return pd.DataFrame(records)


def test_clean_raw_data_sorting_and_deduplication(sample_raw_data):
    preprocessor = AWSPreprocessor()
    df = sample_raw_data.copy()
    
    # Shuffle and duplicate
    shuffled = df.sample(frac=1.0, random_state=42).reset_index(drop=True)
    dup_row = df.iloc[[10]].copy()
    dup_row["temperature"] = 99.9
    with_dup = pd.concat([shuffled, dup_row], ignore_index=True)
    
    cleaned = preprocessor.clean_raw_data(with_dup)
    
    assert len(cleaned) == len(df)
    assert cleaned["timestamp"].is_monotonic_increasing


def test_clean_raw_data_physical_bounds():
    preprocessor = AWSPreprocessor()
    raw = pd.DataFrame([
        {"timestamp": "2026-08-01T00:00:00Z", "temperature": -100.0, "pressure": 1013.0, "humidity": 50.0},
        {"timestamp": "2026-08-01T00:01:00Z", "temperature": 25.0, "pressure": 500.0, "humidity": 50.0},
        {"timestamp": "2026-08-01T00:02:00Z", "temperature": 25.0, "pressure": 1013.0, "humidity": 150.0},
        {"timestamp": "2026-08-01T00:03:00Z", "temperature": 28.0, "pressure": 1012.0, "humidity": 45.0},
    ])
    cleaned = preprocessor.clean_raw_data(raw)
    
    assert np.isnan(cleaned.loc[0, "temperature"])
    assert np.isnan(cleaned.loc[1, "pressure"])
    assert np.isnan(cleaned.loc[2, "humidity"])
    assert cleaned.loc[3, "temperature"] == 28.0


def test_missing_value_imputation_and_indicators():
    preprocessor = AWSPreprocessor()
    raw = pd.DataFrame([
        {"timestamp": "2026-08-01T00:00:00Z", "temperature": 20.0, "pressure": 1013.0, "humidity": 60.0},
        {"timestamp": "2026-08-01T00:01:00Z", "temperature": None, "pressure": None, "humidity": None},
        {"timestamp": "2026-08-01T00:02:00Z", "temperature": 22.0, "pressure": 1014.0, "humidity": 62.0},
    ])
    feats = preprocessor.extract_features(raw)
    
    assert feats.loc[1, "temp_is_missing"] == 1.0
    assert feats.loc[1, "press_is_missing"] == 1.0
    assert feats.loc[1, "hum_is_missing"] == 1.0
    assert feats.loc[0, "temp_is_missing"] == 0.0
    assert feats.loc[2, "temp_is_missing"] == 0.0
    
    assert feats.loc[1, "temperature"] == 20.0
    assert feats.loc[1, "pressure"] == 1013.0
    assert feats.loc[1, "humidity"] == 60.0


def test_feature_extraction_columns_and_values(sample_raw_data):
    preprocessor = AWSPreprocessor()
    feat_df = preprocessor.extract_features(sample_raw_data)
    
    for col in FEATURE_COLUMNS:
        assert col in feat_df.columns, f"Missing feature column: {col}"
        
    assert feat_df.loc[1, "temp_diff_1"] == pytest.approx(
        sample_raw_data.loc[1, "temperature"] - sample_raw_data.loc[0, "temperature"], abs=1e-3
    )
    
    assert not feat_df["temp_roll_mean_15"].isna().any()
    assert not feat_df["temp_zscore_15"].isna().any()
    assert not feat_df["dew_point_depression"].isna().any()


def test_no_future_data_leakage(sample_raw_data):
    """
    Critical requirement: modifying future rows (k+1 to N) MUST NOT alter the
    feature values calculated for row k.
    """
    preprocessor = AWSPreprocessor()
    k = 40
    
    feat_df_original = preprocessor.extract_features(sample_raw_data)
    features_at_k_original = feat_df_original.iloc[k][FEATURE_COLUMNS].to_dict()
    
    # Corrupt future data at k+1, k+5, k+10
    corrupted_data = sample_raw_data.copy()
    corrupted_data.loc[k + 1, "temperature"] = 55.0
    corrupted_data.loc[k + 5, "pressure"] = 850.0
    corrupted_data.loc[k + 10, "humidity"] = 99.0
    
    feat_df_corrupted = preprocessor.extract_features(corrupted_data)
    features_at_k_after = feat_df_corrupted.iloc[k][FEATURE_COLUMNS].to_dict()
    
    for col in FEATURE_COLUMNS:
        orig_val = float(features_at_k_original[col])
        new_val = float(features_at_k_after[col])
        assert orig_val == pytest.approx(new_val, abs=1e-7), (
            f"Future data leakage detected in feature '{col}': {orig_val} vs {new_val}"
        )


def test_streaming_preprocessor_matches_batch(sample_raw_data):
    """
    Verify that StreamingPreprocessor produces identical feature vector to batch processing.
    """
    preprocessor = AWSPreprocessor()
    preprocessor.fit(sample_raw_data)
    
    batch_features = preprocessor.extract_features(sample_raw_data)
    streamer = StreamingPreprocessor(preprocessor, max_window=60)
    
    target_idx = 45
    for i in range(target_idx + 1):
        row = sample_raw_data.iloc[i]
        stream_feat_df, stream_scaled_X = streamer.push_and_extract(
            timestamp=row["timestamp"],
            temperature=row["temperature"],
            pressure=row["pressure"],
            humidity=row["humidity"],
        )
        
    batch_row_feats = np.asarray(batch_features.iloc[target_idx][FEATURE_COLUMNS].values, dtype=np.float64)
    stream_row_feats = np.asarray(stream_feat_df[FEATURE_COLUMNS].values[0], dtype=np.float64)
    
    np.testing.assert_allclose(
        stream_row_feats,
        batch_row_feats,
        rtol=1e-4,
        atol=1e-4,
        err_msg="Streaming features do not match batch features",
    )


def test_scaler_fit_transform_save_load(sample_raw_data, tmp_path):
    preprocessor = AWSPreprocessor()
    preprocessor.fit(sample_raw_data)
    
    X_transformed = preprocessor.transform(sample_raw_data)
    assert X_transformed.shape == (len(sample_raw_data), len(FEATURE_COLUMNS))
    
    save_path = os.path.join(tmp_path, "preprocessor_test.joblib")
    preprocessor.save(save_path)
    assert os.path.exists(save_path)
    
    loaded_preprocessor = AWSPreprocessor.load(save_path)
    assert loaded_preprocessor.is_fitted
    X_loaded = loaded_preprocessor.transform(sample_raw_data)
    
    np.testing.assert_allclose(X_transformed, X_loaded)
