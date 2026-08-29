"""
Unit tests for SQLite database operations across sensor_readings, anomalies, and sensor_health tables.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.models import Base, SensorReading, AnomalyRecord, SensorHealthRecord
from app.database.crud import (
    insert_reading,
    retrieve_recent_readings,
    retrieve_historical_readings,
    insert_anomaly,
    retrieve_anomalies,
    store_health_status,
    retrieve_latest_health,
    retrieve_health_history,
    get_telemetry_statistics,
)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_insert_and_retrieve_reading(db_session):
    reading_data = {
        "timestamp": "2026-08-01T10:00:00Z",
        "station_id": "AWS-SIH-001",
        "temperature": 27.5,
        "pressure": 1012.8,
        "humidity": 65.0,
        "is_anomaly": False,
        "anomaly_type": "NORMAL",
        "anomaly_score": 0.12,
        "confidence": 0.95,
        "severity": "LOW",
        "explanation": "Normal reading",
        "affected_parameters": [],
        "health": {
            "temperature_health": 100.0,
            "pressure_health": 100.0,
            "humidity_health": 100.0,
            "overall_health": 100.0,
            "health_status": "EXCELLENT",
            "maintenance_required": False,
            "recommendations": ["All sensors nominal"],
        },
    }
    rec = insert_reading(db_session, reading_data)
    assert rec.id is not None
    assert rec.temperature == 27.5
    assert rec.is_anomaly is False

    # Check that sensor_health record was also automatically generated
    health = retrieve_latest_health(db_session)
    assert health is not None
    assert health.overall_health == 100.0


def test_retrieve_recent_and_historical_readings(db_session):
    for i in range(15):
        insert_reading(db_session, {
            "timestamp": f"2026-08-01T12:{i:02d}:00Z",
            "temperature": 25.0 + i * 0.1,
            "pressure": 1013.0,
            "humidity": 60.0,
            "is_anomaly": (i == 10),
            "anomaly_type": "TEMPERATURE_SPIKE" if i == 10 else "NORMAL",
            "severity": "HIGH" if i == 10 else "LOW",
            "confidence": 0.90 if i == 10 else 1.0,
        })

    recent = retrieve_recent_readings(db_session, limit=5)
    assert len(recent) == 5
    assert recent[-1].timestamp == "2026-08-01T12:14:00Z"

    # Test historical timestamp range query
    history = retrieve_historical_readings(
        db_session,
        start_time="2026-08-01T12:05:00Z",
        end_time="2026-08-01T12:10:00Z",
    )
    assert len(history) == 6
    assert history[0].timestamp == "2026-08-01T12:05:00Z"
    assert history[-1].timestamp == "2026-08-01T12:10:00Z"


def test_insert_and_retrieve_anomalies(db_session):
    anom1 = insert_anomaly(db_session, {
        "timestamp": "2026-08-01T14:00:00Z",
        "anomaly_type": "TEMPERATURE_SPIKE",
        "severity": "CRITICAL",
        "confidence": 0.98,
        "anomaly_score": 0.95,
        "explanation": "Massive thermal spike",
        "affected_parameters": ["temperature"],
        "temperature": 52.0,
        "pressure": 1013.0,
        "humidity": 60.0,
    })
    anom2 = insert_anomaly(db_session, {
        "timestamp": "2026-08-01T14:05:00Z",
        "anomaly_type": "FROZEN_SENSOR",
        "severity": "MEDIUM",
        "confidence": 0.85,
        "anomaly_score": 0.70,
        "explanation": "Stuck sensor",
        "affected_parameters": ["humidity"],
        "temperature": 25.0,
        "pressure": 1013.0,
        "humidity": 60.0,
    })

    # Retrieve all
    all_anoms = retrieve_anomalies(db_session)
    assert len(all_anoms) == 2

    # Filter by severity
    crit_anoms = retrieve_anomalies(db_session, severity="CRITICAL")
    assert len(crit_anoms) == 1
    assert crit_anoms[0].anomaly_type == "TEMPERATURE_SPIKE"

    # Filter by type
    frozen_anoms = retrieve_anomalies(db_session, anomaly_type="FROZEN_SENSOR")
    assert len(frozen_anoms) == 1
    assert frozen_anoms[0].severity == "MEDIUM"


def test_store_and_retrieve_health_status(db_session):
    store_health_status(db_session, {
        "timestamp": "2026-08-01T15:00:00Z",
        "temperature_health": 85.0,
        "pressure_health": 100.0,
        "humidity_health": 90.0,
        "overall_health": 91.8,
        "health_status": "EXCELLENT",
        "maintenance_required": False,
        "recommendations": ["Routine monitoring"],
    })
    
    latest = retrieve_latest_health(db_session)
    assert latest is not None
    assert latest.temperature_health == 85.0
    assert latest.overall_health == 91.8
    assert latest.health_status == "EXCELLENT"

    history = retrieve_health_history(db_session)
    assert len(history) == 1


def test_telemetry_statistics_aggregation(db_session):
    # Insert 10 normal and 2 anomalies
    for i in range(10):
        insert_reading(db_session, {
            "timestamp": f"2026-08-01T16:{i:02d}:00Z",
            "temperature": 25.0,
            "pressure": 1013.0,
            "humidity": 60.0,
            "is_anomaly": False,
            "anomaly_type": "NORMAL",
            "severity": "LOW",
        })
    insert_reading(db_session, {
        "timestamp": "2026-08-01T16:10:00Z",
        "temperature": 49.0,
        "pressure": 1013.0,
        "humidity": 60.0,
        "is_anomaly": True,
        "anomaly_type": "TEMPERATURE_SPIKE",
        "severity": "CRITICAL",
        "confidence": 0.95,
        "affected_parameters": ["temperature"],
    })

    stats = get_telemetry_statistics(db_session)
    assert stats["total_records"] == 11
    assert stats["total_anomalies"] == 1
    assert stats["breakdown_by_type"]["TEMPERATURE_SPIKE"] == 1
    assert stats["breakdown_by_severity"]["CRITICAL"] == 1
