"""
Unit tests for integrated AnomalyDetectionService.
"""
import pytest
import pandas as pd
from app.services.anomaly_service import AnomalyDetectionService
from app.ml.classifier import ClassifiedAnomalyType, AnomalySeverity


def test_service_streaming_and_batch():
    service = AnomalyDetectionService()
    
    # Test normal reading stream
    normal_res = service.process_reading("2026-08-01T12:00:00Z", 25.0, 1013.0, 60.0)
    assert "anomaly_type" in normal_res
    assert "confidence" in normal_res
    assert "severity" in normal_res
    assert "explanation" in normal_res
    assert "affected_parameters" in normal_res
    
    # Test spike stream
    spike_res = service.process_reading("2026-08-01T12:01:00Z", 48.0, 1013.0, 60.0)
    assert spike_res["is_anomaly"] is True
    assert spike_res["anomaly_type"] == ClassifiedAnomalyType.TEMPERATURE_SPIKE.value
    assert spike_res["affected_parameters"] == ["temperature"]
    assert spike_res["severity"] in (AnomalySeverity.HIGH.value, AnomalySeverity.CRITICAL.value)
    
    # Test missing stream
    missing_res = service.process_reading("2026-08-01T12:02:00Z", None, 1013.0, 60.0)
    assert missing_res["is_anomaly"] is True
    assert missing_res["anomaly_type"] == ClassifiedAnomalyType.MISSING_DATA.value
    assert missing_res["affected_parameters"] == ["temperature"]
