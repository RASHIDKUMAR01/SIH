"""
Unit and integration tests for POST /api/data/upload endpoint.
"""
import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import init_db


@pytest.fixture(scope="module")
def client():
    init_db()
    with TestClient(app) as c:
        yield c


def test_upload_valid_csv(client):
    csv_content = """timestamp,temperature,pressure,humidity
2026-08-01T12:00:00Z,25.0,1013.0,60.0
2026-08-01T12:01:00Z,25.2,1013.1,59.8
2026-08-01T12:02:00Z,25.1,1012.9,60.2
2026-08-01T12:03:00Z,48.5,1013.0,60.0
2026-08-01T12:04:00Z,25.3,1013.0,60.1
"""
    files = {"file": ("test_data.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    response = client.post("/api/data/upload?persist=true", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["total_records"] == 5
    assert data["total_anomalies"] >= 1
    assert "anomaly_types_breakdown" in data
    assert "final_sensor_health" in data
    assert len(data["preview_records"]) == 5


def test_upload_invalid_extension(client):
    files = {"file": ("test_data.txt", io.BytesIO(b"hello world"), "text/plain")}
    response = client.post("/api/data/upload", files=files)
    assert response.status_code == 400
    assert "Invalid file format" in response.json()["detail"]


def test_upload_missing_columns(client):
    csv_content = """timestamp,temp_only
2026-08-01T12:00:00Z,25.0
"""
    files = {"file": ("bad_data.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    response = client.post("/api/data/upload", files=files)
    assert response.status_code == 400
    assert "missing required meteorological columns" in response.json()["detail"]
