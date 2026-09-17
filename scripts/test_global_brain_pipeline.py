"""
Comprehensive Automated Test Suite for SkyGuard AI Global Brain Architecture.
Tests:
1. Normal station behavior -> NORMAL
2. Single-station temperature spike (A=47, B=32, C=32) -> SENSOR_FAULT (Low spatial agreement)
3. Regional temperature event (A=42, B=41.7, C=42.2, D=41.5) -> GENUINE_WEATHER_EVENT (High spatial agreement)
4. Frozen sensor (zero variance) -> SENSOR_FAULT (FROZEN_SENSOR)
5. Sensor drift (monotonic drift) -> SENSOR_FAULT
6. Communication dropout (null telemetry payload) -> COMMUNICATION_FAULT (MISSING_DATA)
"""
import sys
import os
from datetime import datetime, timezone

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.anomaly_service import AnomalyDetectionService


def run_tests():
    print("================================================================================")
    print("SKYGUARD AI - GLOBAL BRAIN SPATIAL-TEMPORAL ARCHITECTURE VERIFICATION")
    print("================================================================================")
    
    svc = AnomalyDetectionService()

    # -------------------------------------------------------------
    # TEST 1: Normal Station Behavior
    # -------------------------------------------------------------
    ts = datetime.now(timezone.utc).isoformat()
    # Feed baseline samples to stabilize rolling buffer
    for i in range(5):
        svc.process_reading(ts, 25.0 + (i * 0.05), 1013.25 - (i * 0.02), 60.0 + (i * 0.1), 4.0)
    
    res1 = svc.process_reading(ts, 25.3, 1013.15, 60.4, 4.1)
    diag1 = res1.get("global_brain", {})
    assert diag1.get("diagnosis_category") == "NORMAL", f"Expected NORMAL, got {diag1.get('diagnosis_category')}"
    assert res1.get("is_anomaly") is False
    print(f"[PASS] TEST 1: Normal Station Behavior -> {diag1.get('diagnosis_category')} (Spatial: {res1.get('spatial_analysis', {}).get('spatial_agreement_pct')}%)")

    # -------------------------------------------------------------
    # TEST 2: Single-Station Temperature Spike (Isolated Transducer Anomaly)
    # Target Station A = 47°C, Neighbors = [32°C, 32°C, 31.8°C]
    # -------------------------------------------------------------
    neighbors_normal = [
        {"station_id": "AWS-002", "temperature": 32.0, "pressure": 1013.0, "humidity": 60.0, "wind_speed": 4.0},
        {"station_id": "AWS-003", "temperature": 32.0, "pressure": 1013.1, "humidity": 59.8, "wind_speed": 4.2},
        {"station_id": "AWS-004", "temperature": 31.8, "pressure": 1013.0, "humidity": 60.2, "wind_speed": 3.9},
    ]
    res2 = svc.process_reading(
        ts,
        temperature=47.0,
        pressure=1013.25,
        humidity=60.0,
        wind_speed=4.0,
        neighbors=neighbors_normal,
    )
    diag2 = res2.get("global_brain", {})
    spatial2 = res2.get("spatial_analysis", {})
    assert diag2.get("diagnosis_category") == "SENSOR_FAULT", f"Expected SENSOR_FAULT, got {diag2.get('diagnosis_category')}"
    assert spatial2.get("spatial_agreement_pct") < 40.0, f"Expected low spatial agreement, got {spatial2.get('spatial_agreement_pct')}"
    print(f"[PASS] TEST 2: Single-Station Spike (A=47, B=32, C=32) -> {diag2.get('diagnosis_category')} (Agreement: {spatial2.get('spatial_agreement_pct')}%)")

    # -------------------------------------------------------------
    # TEST 3: Regional Temperature Event (Genuine Weather Event)
    # Target Station A = 42.0°C, Neighbors = [41.7°C, 42.2°C, 41.5°C] with pressure drop
    # -------------------------------------------------------------
    neighbors_event = [
        {"station_id": "AWS-002", "temperature": 41.7, "pressure": 1008.2, "humidity": 45.0, "wind_speed": 16.0},
        {"station_id": "AWS-003", "temperature": 42.2, "pressure": 1008.0, "humidity": 44.5, "wind_speed": 17.5},
        {"station_id": "AWS-004", "temperature": 41.5, "pressure": 1008.4, "humidity": 45.2, "wind_speed": 15.8},
    ]
    res3 = svc.process_reading(
        ts,
        temperature=42.0,
        pressure=1008.1,
        humidity=45.0,
        wind_speed=16.5,
        neighbors=neighbors_event,
        is_simulated_event_regional=True,
    )
    diag3 = res3.get("global_brain", {})
    spatial3 = res3.get("spatial_analysis", {})
    multi3 = res3.get("multivariate_consistency", {})
    assert diag3.get("diagnosis_category") == "GENUINE_WEATHER_EVENT", f"Expected GENUINE_WEATHER_EVENT, got {diag3.get('diagnosis_category')}"
    assert spatial3.get("spatial_agreement_pct") >= 70.0, f"Expected high spatial agreement, got {spatial3.get('spatial_agreement_pct')}"
    print(f"[PASS] TEST 3: Regional Weather Event (A=42, B=41.7, C=42.2, D=41.5) -> {diag3.get('diagnosis_category')} (Agreement: {spatial3.get('spatial_agreement_pct')}%, Multi: {multi3.get('consistency_level')})")

    # -------------------------------------------------------------
    # TEST 4: Frozen Sensor (Zero-Variance Lock)
    # -------------------------------------------------------------
    frozen_svc = AnomalyDetectionService()
    for _ in range(7):
        res4 = frozen_svc.process_reading(ts, 24.5000, 1013.25, 60.00, 4.0)
    
    diag4 = res4.get("global_brain", {})
    assert diag4.get("diagnosis_category") == "SENSOR_FAULT", f"Expected SENSOR_FAULT, got {diag4.get('diagnosis_category')}"
    assert diag4.get("specific_type") == "FROZEN_SENSOR", f"Expected FROZEN_SENSOR, got {diag4.get('specific_type')}"
    print(f"[PASS] TEST 4: Frozen Sensor (Zero Variance) -> {diag4.get('diagnosis_category')} ({diag4.get('specific_type')})")

    # -------------------------------------------------------------
    # TEST 5: Sensor Drift (Gradual Monotonic Deviation)
    # -------------------------------------------------------------
    drift_svc = AnomalyDetectionService()
    for drift_step in range(15):
        val = 24.0 + (drift_step * 1.5)
        res5 = drift_svc.process_reading(ts, val, 1013.25, 60.0, 4.0, neighbors=neighbors_normal)
    
    diag5 = res5.get("global_brain", {})
    assert diag5.get("diagnosis_category") == "SENSOR_FAULT", f"Expected SENSOR_FAULT for uncorroborated drift, got {diag5.get('diagnosis_category')}"
    print(f"[PASS] TEST 5: Gradual Sensor Drift -> {diag5.get('diagnosis_category')} ({diag5.get('specific_type')})")

    # -------------------------------------------------------------
    # TEST 6: Communication Dropout (Missing Telemetry)
    # -------------------------------------------------------------
    comm_svc = AnomalyDetectionService()
    res6 = comm_svc.process_reading(ts, None, None, None, None)
    diag6 = res6.get("global_brain", {})
    assert diag6.get("diagnosis_category") == "COMMUNICATION_FAULT", f"Expected COMMUNICATION_FAULT, got {diag6.get('diagnosis_category')}"
    assert diag6.get("specific_type") == "MISSING_DATA"
    print(f"[PASS] TEST 6: Communication Dropout (Null Telemetry) -> {diag6.get('diagnosis_category')} ({diag6.get('specific_type')})")

    print("\n================================================================================")
    print("ALL 6 GLOBAL BRAIN TESTS PASSED (100%)!")
    print("================================================================================")


if __name__ == "__main__":
    run_tests()
