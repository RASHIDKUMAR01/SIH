"""
Unit tests for AWS Anomaly Classification Engine.
Tests all 10 anomaly categories, confidence calibration, severity levels, and explanations.
"""
import pytest
import numpy as np
from app.ml.classifier import (
    AnomalyClassifier,
    ClassifiedAnomalyType,
    AnomalySeverity,
    AnomalyClassificationResult,
)


@pytest.fixture
def classifier() -> AnomalyClassifier:
    clf = AnomalyClassifier()
    clf.reset_state()
    return clf


def test_classify_normal(classifier):
    data = {
        "temperature": 25.4,
        "pressure": 1013.2,
        "humidity": 65.0,
        "temp_diff_1": 0.05,
        "press_diff_1": -0.02,
        "hum_diff_1": -0.15,
        "temp_roc_5": 0.12,
        "press_roc_5": -0.05,
        "hum_roc_5": -0.45,
        "temp_zscore_15": 0.25,
        "press_zscore_15": -0.10,
        "hum_zscore_15": -0.30,
        "temp_roll_std_15": 0.12,
        "press_roll_std_15": 0.08,
        "hum_roll_std_15": 0.35,
        "temp_dev_mean_15": 0.03,
        "press_dev_mean_15": -0.01,
        "hum_dev_mean_15": -0.10,
    }
    res = classifier.classify(data, if_score=0.15, is_if_anomaly=False)
    
    assert res.anomaly_type == ClassifiedAnomalyType.NORMAL
    assert res.severity == AnomalySeverity.LOW
    assert res.confidence >= 0.70
    assert len(res.affected_parameters) == 0
    assert "expected physical and statistical bounds" in res.explanation


def test_classify_temperature_spike(classifier):
    data = {
        "temperature": 42.5,
        "pressure": 1013.0,
        "humidity": 60.0,
        "temp_diff_1": 15.2,
        "press_diff_1": 0.0,
        "hum_diff_1": 0.0,
        "temp_roc_5": 15.5,
        "temp_zscore_15": 4.8,
        "temp_roll_std_15": 0.25,
    }
    res = classifier.classify(data, if_score=0.85, is_if_anomaly=True)
    
    assert res.anomaly_type == ClassifiedAnomalyType.TEMPERATURE_SPIKE
    assert res.severity in (AnomalySeverity.HIGH, AnomalySeverity.CRITICAL)
    assert res.confidence >= 0.80
    assert res.affected_parameters == ["temperature"]
    assert "thermal surge" in res.explanation.lower() or "spike" in res.explanation.lower()


def test_classify_temperature_drop(classifier):
    data = {
        "temperature": 10.2,
        "pressure": 1013.0,
        "humidity": 60.0,
        "temp_diff_1": -14.8,
        "temp_roc_5": -15.0,
        "temp_zscore_15": -4.5,
        "temp_roll_std_15": 0.20,
    }
    res = classifier.classify(data, if_score=0.82, is_if_anomaly=True)
    
    assert res.anomaly_type == ClassifiedAnomalyType.TEMPERATURE_DROP
    assert res.severity in (AnomalySeverity.HIGH, AnomalySeverity.CRITICAL)
    assert res.confidence >= 0.80
    assert res.affected_parameters == ["temperature"]
    assert "plunge" in res.explanation.lower() or "drop" in res.explanation.lower()


def test_classify_pressure_anomaly(classifier):
    data = {
        "temperature": 25.0,
        "pressure": 1048.5,
        "humidity": 60.0,
        "press_diff_1": 35.5,
        "press_roc_5": 36.0,
        "press_zscore_15": 5.2,
        "press_roll_std_15": 0.15,
    }
    res = classifier.classify(data, if_score=0.90, is_if_anomaly=True)
    
    assert res.anomaly_type == ClassifiedAnomalyType.PRESSURE_ANOMALY
    assert res.severity == AnomalySeverity.CRITICAL
    assert res.confidence >= 0.80
    assert res.affected_parameters == ["pressure"]
    assert "barometric" in res.explanation.lower()


def test_classify_humidity_anomaly(classifier):
    data = {
        "temperature": 25.0,
        "pressure": 1013.0,
        "humidity": 98.0,
        "hum_diff_1": 42.0,
        "hum_roc_5": 45.0,
        "hum_zscore_15": 4.5,
        "hum_roll_std_15": 0.40,
    }
    res = classifier.classify(data, if_score=0.78, is_if_anomaly=True)
    
    assert res.anomaly_type == ClassifiedAnomalyType.HUMIDITY_ANOMALY
    assert res.severity in (AnomalySeverity.HIGH, AnomalySeverity.CRITICAL)
    assert res.confidence >= 0.75
    assert res.affected_parameters == ["humidity"]


def test_classify_frozen_sensor(classifier):
    # Simulate 10 identical steps to trigger consecutive freeze counter & zero std
    data = {
        "temperature": 24.50,
        "pressure": 1013.0,
        "humidity": 60.0,
        "temp_diff_1": 0.0,
        "press_diff_1": 0.02,
        "hum_diff_1": -0.10,
        "temp_roll_std_15": 0.000001,
        "press_roll_std_15": 0.08,
        "hum_roll_std_15": 0.35,
    }
    for _ in range(10):
        res = classifier.classify(data, if_score=0.30, is_if_anomaly=False)
        
    assert res.anomaly_type == ClassifiedAnomalyType.FROZEN_SENSOR
    assert "temperature" in res.affected_parameters
    assert res.severity in (AnomalySeverity.MEDIUM, AnomalySeverity.HIGH)
    assert "zero-variance" in res.explanation.lower() or "stuck" in res.explanation.lower()


def test_classify_sensor_drift(classifier):
    data = {
        "temperature": 32.5,
        "pressure": 1013.0,
        "humidity": 60.0,
        "temp_diff_1": 0.15,  # Small 1-step delta (not a sudden spike)
        "temp_dev_mean_15": 4.5,  # Substantial sustained deviation
        "temp_roll_std_15": 0.20,
        "temp_zscore_15": 1.2,
    }
    res = classifier.classify(data, if_score=0.55, is_if_anomaly=False)
    
    assert res.anomaly_type == ClassifiedAnomalyType.SENSOR_DRIFT
    assert res.affected_parameters == ["temperature"]
    assert res.severity == AnomalySeverity.MEDIUM
    assert "drift" in res.explanation.lower()


def test_classify_missing_data(classifier):
    # Single missing sensor
    data1 = {"temperature": None, "pressure": 1013.0, "humidity": 60.0}
    res1 = classifier.classify(data1)
    assert res1.anomaly_type == ClassifiedAnomalyType.MISSING_DATA
    assert res1.affected_parameters == ["temperature"]
    assert res1.severity == AnomalySeverity.HIGH
    assert res1.confidence == 1.0

    # All missing sensors (total blackout)
    data2 = {"temperature": None, "pressure": None, "humidity": None}
    res2 = classifier.classify(data2)
    assert res2.anomaly_type == ClassifiedAnomalyType.MISSING_DATA
    assert set(res2.affected_parameters) == {"temperature", "pressure", "humidity"}
    assert res2.severity == AnomalySeverity.CRITICAL


def test_classify_multivariate_inconsistency(classifier):
    # Scorching desert heat with extreme saturation humidity
    data = {
        "temperature": 47.5,
        "pressure": 1013.0,
        "humidity": 97.0,
        "temp_diff_1": 0.1,
        "press_diff_1": 0.0,
        "hum_diff_1": 0.2,
        "temp_roll_std_15": 0.2,
    }
    res = classifier.classify(data, if_score=0.92, is_if_anomaly=True)
    
    assert res.anomaly_type == ClassifiedAnomalyType.MULTIVARIATE_INCONSISTENCY
    assert "temperature" in res.affected_parameters
    assert "humidity" in res.affected_parameters
    assert res.severity == AnomalySeverity.HIGH
    assert "psychrometric" in res.explanation.lower() or "thermodynamic" in res.explanation.lower()


def test_classify_unknown_anomaly(classifier):
    # High Isolation Forest score with no single-rule trigger
    data = {
        "temperature": 26.0,
        "pressure": 1013.0,
        "humidity": 60.0,
        "temp_diff_1": 0.05,
        "press_diff_1": 0.02,
        "hum_diff_1": 0.05,
        "temp_roll_std_15": 0.2,
        "press_roll_std_15": 0.1,
        "hum_roll_std_15": 0.3,
    }
    res = classifier.classify(data, if_score=0.88, is_if_anomaly=True)
    
    assert res.anomaly_type == ClassifiedAnomalyType.UNKNOWN_ANOMALY
    assert res.confidence == pytest.approx(0.88, abs=1e-3)
    assert res.severity == AnomalySeverity.HIGH
    assert "isolation forest" in res.explanation.lower()
