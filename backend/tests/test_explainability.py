"""
Unit tests for Explainable AI (XAI) and SHAP Explanation Engine.
"""
import pytest
import numpy as np
import pandas as pd
from app.ml.explainability import AnomalyExplainer, AnomalyExplanation
from app.ml.anomaly_detector import IsolationForestAnomalyDetector


@pytest.fixture
def trained_detector() -> IsolationForestAnomalyDetector:
    train_data = []
    for i in range(200):
        train_data.append({
            "timestamp": f"2026-08-01T{i//60:02d}:{i%60:02d}:00Z",
            "temperature": 25.0 + 3.0 * np.sin(i * 0.1) + np.random.normal(0, 0.05),
            "pressure": 1013.0 + 1.0 * np.sin(i * 0.05) + np.random.normal(0, 0.02),
            "humidity": 60.0 - 10.0 * np.sin(i * 0.1) + np.random.normal(0, 0.1),
            "anomaly": 0,
        })
    df = pd.DataFrame(train_data)
    detector = IsolationForestAnomalyDetector(n_estimators=50, random_state=42)
    detector.fit(df, train_only_normal=True)
    return detector


def test_explain_temperature_spike():
    explainer = AnomalyExplainer()
    telemetry = {
        "temperature": 43.4,
        "pressure": 1013.2,
        "humidity": 60.0,
        "temp_diff_1": 18.4,
        "press_diff_1": -0.02,
        "hum_diff_1": -0.1,
        "temp_dev_mean_15": 18.1,
        "temp_zscore_15": 5.2,
    }
    exp: AnomalyExplanation = explainer.explain(
        telemetry=telemetry,
        anomaly_type="TEMPERATURE_SPIKE",
        affected_parameters=["temperature"],
    )
    
    assert exp.primary_parameter == "temperature"
    assert exp.delta_value == 18.4
    assert exp.z_score == 5.2
    assert "18.40°C" in exp.summary or "18.4°C" in exp.summary
    assert "pressure" in exp.corroborating_evidence.lower()
    assert "temperature sensor fault" in exp.summary.lower() or "thermal" in exp.summary.lower()


def test_explain_frozen_sensor():
    explainer = AnomalyExplainer()
    telemetry = {
        "temperature": 24.5,
        "pressure": 1013.0,
        "humidity": 60.0,
        "temp_diff_1": 0.0,
        "temp_dev_mean_15": 0.0,
        "temp_zscore_15": 0.0,
    }
    exp = explainer.explain(
        telemetry=telemetry,
        anomaly_type="FROZEN_SENSOR",
        affected_parameters=["temperature"],
    )
    assert exp.primary_parameter == "temperature"
    assert "stuck" in exp.summary.lower() or "frozen" in exp.summary.lower()
    assert "zero standard deviation" in exp.summary.lower()


def test_explain_missing_data():
    explainer = AnomalyExplainer()
    telemetry = {
        "temperature": None,
        "pressure": 1013.0,
        "humidity": 60.0,
    }
    exp = explainer.explain(
        telemetry=telemetry,
        anomaly_type="MISSING_DATA",
        affected_parameters=["temperature"],
    )
    assert "temperature" in exp.primary_parameter
    assert "packet dropout" in exp.summary.lower()


def test_explain_multivariate_inconsistency():
    explainer = AnomalyExplainer()
    telemetry = {
        "temperature": 47.5,
        "pressure": 1013.0,
        "humidity": 98.0,
    }
    exp = explainer.explain(
        telemetry=telemetry,
        anomaly_type="MULTIVARIATE_INCONSISTENCY",
        affected_parameters=["temperature", "humidity"],
    )
    assert "psychrometric" in exp.summary.lower() or "thermodynamic" in exp.summary.lower()


def test_shap_feature_importance_attribution(trained_detector):
    explainer = AnomalyExplainer(
        isolation_forest_model=trained_detector.model,
        feature_columns=trained_detector.feature_columns,
    )
    assert explainer.shap_explainer is not None

    # Transform a sample reading with a massive temperature spike
    spike_df = pd.DataFrame([{
        "timestamp": "2026-08-01T12:00:00Z",
        "temperature": 52.0,
        "pressure": 1013.0,
        "humidity": 60.0,
    }])
    feat_df = trained_detector.preprocessor.extract_features(spike_df)
    scaled_vec = trained_detector.preprocessor.scaler.transform(feat_df[trained_detector.feature_columns].values)[0]

    exp = explainer.explain(
        telemetry=feat_df.iloc[0].to_dict(),
        anomaly_type="TEMPERATURE_SPIKE",
        affected_parameters=["temperature"],
        scaled_feature_vector=scaled_vec,
    )

    assert len(exp.top_shap_features) > 0
    top_feature_names = [f.feature_name for f in exp.top_shap_features]
    assert any("temp" in name for name in top_feature_names)
