"""
Comprehensive API Integration tests for all FastAPI endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import init_db


@pytest.fixture(scope="module")
def client():
    init_db()
    with TestClient(app) as c:
        yield c


def test_api_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("healthy", "degraded")
    assert data["service"] == "SIH 26073 - AWS Intelligent Anomaly Detection Engine"
    assert data["database_connected"] is True


def test_api_current_endpoint(client):
    response = client.get("/api/current")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "status" in data


def test_api_history_endpoint(client):
    response = client.get("/api/history?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "count" in data
    assert "records" in data
    assert isinstance(data["records"], list)


def test_api_analyze_endpoint_normal(client):
    payload = {
        "timestamp": "2026-08-01T12:00:00Z",
        "temperature": 26.5,
        "pressure": 1013.2,
        "humidity": 62.0,
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_anomaly"] is False
    assert data["anomaly_type"] == "NORMAL"
    assert data["confidence"] >= 0.70
    assert "sensor_health" in data
    assert "maintenance_recommendation" in data
    assert len(data["affected_parameters"]) == 0


def test_api_analyze_endpoint_temperature_spike(client):
    payload = {
        "timestamp": "2026-08-01T12:01:00Z",
        "temperature": 48.5,
        "pressure": 1013.2,
        "humidity": 62.0,
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_anomaly"] is True
    assert data["anomaly_type"] == "TEMPERATURE_SPIKE"
    assert data["severity"] in ("HIGH", "CRITICAL")
    assert "temperature" in data["affected_parameters"]
    exp = data["explanation"].lower()
    assert any(k in exp for k in ("thermal", "surge", "spike", "temperature sensor fault", "jump"))


def test_api_analyze_endpoint_missing_data(client):
    payload = {
        "timestamp": "2026-08-01T12:02:00Z",
        "temperature": None,
        "pressure": 1013.2,
        "humidity": 62.0,
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_anomaly"] is True
    assert data["anomaly_type"] == "MISSING_DATA"
    assert "temperature" in data["affected_parameters"]


def test_api_simulator_controls(client):
    res_stop = client.post("/api/simulator/stop")
    assert res_stop.status_code == 200
    
    res_start = client.post("/api/simulator/start", json={"interval_seconds": 1.0})
    assert res_start.status_code == 200
    assert res_start.json()["status"] in ("started", "already_running")
    
    res_inj = client.post(
        "/api/simulator/inject",
        json={"anomaly_type": "temperature_spike", "duration": 5, "params": {"magnitude": 18.0}},
    )
    assert res_inj.status_code == 200
    assert res_inj.json()["status"] == "anomaly_injected"


def test_api_anomalies_endpoint(client):
    response = client.get("/api/anomalies?limit=20")
    assert response.status_code == 200
    data = response.json()
    assert "count" in data
    assert "anomalies" in data


def test_api_sensor_health_endpoint(client):
    response = client.get("/api/sensor-health")
    assert response.status_code == 200
    data = response.json()
    assert "temperature_health" in data
    assert "pressure_health" in data
    assert "humidity_health" in data
    assert "overall_health" in data
    assert "health_status" in data
    assert "maintenance_recommendations" in data


def test_api_statistics_endpoint(client):
    response = client.get("/api/statistics")
    assert response.status_code == 200
    data = response.json()
    assert "total_records" in data
    assert "total_anomalies" in data
    assert "anomaly_rate_percent" in data
    assert "breakdown_by_type" in data
    assert "breakdown_by_severity" in data


def test_api_train_endpoint(client):
    response = client.post("/api/train", json={"records": 2000, "contamination": 0.05})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "training_initiated"
