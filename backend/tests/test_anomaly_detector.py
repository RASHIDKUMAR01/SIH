"""
Unit tests for IsolationForestAnomalyDetector.
"""
import os
import pytest
import numpy as np
import pandas as pd
from app.ml.anomaly_detector import IsolationForestAnomalyDetector


def test_detector_fit_predict_and_persistence(tmp_path):
    # Create simple synthetic train and test frames
    train_data = []
    for i in range(200):
        train_data.append({
            "timestamp": f"2026-08-01T{i//60:02d}:{i%60:02d}:00Z",
            "temperature": 25.0 + 3.0 * np.sin(i * 0.1) + np.random.normal(0, 0.05),
            "pressure": 1013.0 + 1.0 * np.sin(i * 0.05) + np.random.normal(0, 0.02),
            "humidity": 60.0 - 10.0 * np.sin(i * 0.1) + np.random.normal(0, 0.1),
            "anomaly": 0,
        })
    train_df = pd.DataFrame(train_data)
    
    detector = IsolationForestAnomalyDetector(contamination=0.05, n_estimators=50, random_state=42)
    detector.fit(train_df, train_only_normal=True)
    
    # Save & load
    model_file = os.path.join(tmp_path, "detector_test.joblib")
    detector.save(model_file)
    assert os.path.exists(model_file)
    
    loaded_detector = IsolationForestAnomalyDetector.load(model_file)
    
    # Batch predict
    test_df = train_df.head(20).copy()
    results = loaded_detector.predict_batch(test_df)
    assert "is_anomaly" in results.columns
    assert "anomaly_score" in results.columns
    assert "prediction" in results.columns
    assert len(results) == 20
    
    # Single reading predict
    single_out = loaded_detector.predict_single("2026-08-01T12:00:00Z", 25.5, 1013.0, 60.0)
    assert "is_anomaly" in single_out
    assert "anomaly_score" in single_out
    assert "prediction" in single_out
    assert 0.0 <= single_out["anomaly_score"] <= 1.0
