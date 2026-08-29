"""
Unit tests for Sensor Health Monitoring and Predictive Maintenance Engine.
"""
import pytest
from app.services.sensor_health import SensorHealthMonitor, SensorHealthReport


@pytest.fixture
def monitor() -> SensorHealthMonitor:
    m = SensorHealthMonitor(recovery_rate=0.5)
    m.reset()
    return m


def test_initial_health_is_pristine_100(monitor):
    rep = monitor.update("NORMAL", "LOW", [], 1.0)
    assert rep.temperature_health == 100.0
    assert rep.pressure_health == 100.0
    assert rep.humidity_health == 100.0
    assert rep.overall_health == 100.0
    assert rep.health_status == "EXCELLENT"
    assert rep.maintenance_required is False


def test_isolated_anomaly_does_not_drop_to_zero(monitor):
    # Single high-severity spike on temperature
    rep = monitor.update("TEMPERATURE_SPIKE", "HIGH", ["temperature"], 0.95)
    
    # Health should decrease moderately, NOT drop to 0
    assert 75.0 <= rep.temperature_health <= 90.0
    assert rep.pressure_health == 100.0
    assert rep.humidity_health == 100.0
    assert rep.overall_health >= 90.0
    assert rep.health_status in ("EXCELLENT", "GOOD")


def test_recovery_after_normal_operation(monitor):
    # 1. Cause minor health drop
    rep1 = monitor.update("TEMPERATURE_SPIKE", "HIGH", ["temperature"], 0.95)
    dropped_health = rep1.temperature_health
    assert dropped_health < 100.0
    
    # 2. Feed 40 normal steps
    for _ in range(40):
        rep2 = monitor.update("NORMAL", "LOW", [], 1.0)
        
    assert rep2.temperature_health > dropped_health
    assert rep2.temperature_health == 100.0
    assert rep2.overall_health == 100.0


def test_consecutive_repeated_anomalies_gradual_decay(monitor):
    # Feed 15 consecutive critical frozen sensor anomalies on temperature
    for _ in range(15):
        rep = monitor.update("FROZEN_SENSOR", "HIGH", ["temperature"], 0.95)
        
    assert rep.temperature_health < 40.0
    assert rep.health_status in ("DEGRADED", "CRITICAL")
    assert rep.maintenance_required is True
    assert any("temperature" in r.lower() for r in rep.recommendations)


def test_individual_sensor_independence(monitor):
    # Feed pressure anomaly only
    rep = monitor.update("PRESSURE_ANOMALY", "CRITICAL", ["pressure"], 0.99)
    
    assert rep.pressure_health < 80.0
    assert rep.temperature_health == 100.0
    assert rep.humidity_health == 100.0


def test_maintenance_recommendations_generation(monitor):
    # Drive humidity to critical failure
    for _ in range(10):
        rep = monitor.update("HUMIDITY_ANOMALY", "CRITICAL", ["humidity"], 0.98)
        
    assert rep.humidity_health < 50.0
    assert rep.maintenance_required is True
    assert any("humidity" in r.lower() for r in rep.recommendations)
