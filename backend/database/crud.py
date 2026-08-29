"""
CRUD Operations for SQLite persistence across sensor_readings, anomalies, and sensor_health tables.
"""
import json
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.database.models import SensorReading, AnomalyRecord, SensorHealthRecord


def insert_reading(db: Session, data: Dict[str, Any]) -> SensorReading:
    """
    Insert a sensor reading record into `sensor_readings`.
    Also automatically logs to `anomalies` if an anomaly is detected,
    and updates `sensor_health` snapshot.
    """
    affected = data.get("affected_parameters", [])
    affected_str = json.dumps(affected) if isinstance(affected, list) else str(affected)

    health_data = data.get("health", {})
    if isinstance(health_data, dict):
        t_h = float(health_data.get("temperature_health", 100.0))
        p_h = float(health_data.get("pressure_health", 100.0))
        h_h = float(health_data.get("humidity_health", 100.0))
        o_h = float(health_data.get("overall_health", 100.0))
        h_status = health_data.get("health_status", "EXCELLENT")
        m_req = bool(health_data.get("maintenance_required", False))
        recs = health_data.get("recommendations", [])
    else:
        t_h = float(data.get("temp_health", 100.0))
        p_h = float(data.get("press_health", 100.0))
        h_h = float(data.get("hum_health", 100.0))
        o_h = float(data.get("overall_health", 100.0))
        h_status = "EXCELLENT"
        m_req = False
        recs = []

    reading = SensorReading(
        timestamp=str(data.get("timestamp")),
        station_id=data.get("station_id", "AWS-SIH-001"),
        temperature=data.get("temperature"),
        pressure=data.get("pressure"),
        humidity=data.get("humidity"),
        is_anomaly=bool(data.get("is_anomaly", False)),
        anomaly_type=data.get("anomaly_type", "NORMAL"),
        anomaly_score=float(data.get("anomaly_score", 0.0)),
        confidence=float(data.get("confidence", 1.0)),
        severity=data.get("severity", "LOW"),
        explanation=data.get("explanation", ""),
        affected_parameters=affected_str,
        temp_health=t_h,
        press_health=p_h,
        hum_health=h_h,
        overall_health=o_h,
    )
    db.add(reading)

    # 1. If anomaly detected, log to anomalies table
    if reading.is_anomaly:
        anomaly_entry = AnomalyRecord(
            timestamp=reading.timestamp,
            station_id=reading.station_id,
            anomaly_type=reading.anomaly_type,
            severity=reading.severity,
            confidence=reading.confidence,
            anomaly_score=reading.anomaly_score,
            explanation=reading.explanation,
            affected_parameters=affected_str,
            temperature=reading.temperature,
            pressure=reading.pressure,
            humidity=reading.humidity,
        )
        db.add(anomaly_entry)

    # 2. Record to sensor_health audit table
    health_entry = SensorHealthRecord(
        timestamp=reading.timestamp,
        station_id=reading.station_id,
        temperature_health=t_h,
        pressure_health=p_h,
        humidity_health=h_h,
        overall_health=o_h,
        health_status=h_status,
        maintenance_required=m_req,
        recommendations=json.dumps(recs) if isinstance(recs, list) else str(recs),
    )
    db.add(health_entry)

    db.commit()
    db.refresh(reading)
    return reading


def retrieve_recent_readings(db: Session, limit: int = 50) -> List[SensorReading]:
    """Retrieve most recent N sensor readings (ordered chronological oldest to newest)."""
    records = db.query(SensorReading).order_by(desc(SensorReading.id)).limit(limit).all()
    return list(reversed(records))


def retrieve_historical_readings(
    db: Session,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    limit: int = 1000,
) -> List[SensorReading]:
    """Retrieve historical sensor readings using timestamp indexes."""
    query = db.query(SensorReading)
    if start_time:
        query = query.filter(SensorReading.timestamp >= start_time)
    if end_time:
        query = query.filter(SensorReading.timestamp <= end_time)
    records = query.order_by(desc(SensorReading.timestamp)).limit(limit).all()
    return list(reversed(records))


def insert_anomaly(db: Session, anomaly_data: Dict[str, Any]) -> AnomalyRecord:
    """Explicitly insert an anomaly incident record."""
    affected = anomaly_data.get("affected_parameters", [])
    affected_str = json.dumps(affected) if isinstance(affected, list) else str(affected)

    anomaly = AnomalyRecord(
        timestamp=str(anomaly_data.get("timestamp")),
        station_id=anomaly_data.get("station_id", "AWS-SIH-001"),
        anomaly_type=anomaly_data.get("anomaly_type", "UNKNOWN_ANOMALY"),
        severity=anomaly_data.get("severity", "MEDIUM"),
        confidence=float(anomaly_data.get("confidence", 1.0)),
        anomaly_score=float(anomaly_data.get("anomaly_score", 0.0)),
        explanation=anomaly_data.get("explanation", ""),
        affected_parameters=affected_str,
        temperature=anomaly_data.get("temperature"),
        pressure=anomaly_data.get("pressure"),
        humidity=anomaly_data.get("humidity"),
        is_resolved=bool(anomaly_data.get("is_resolved", False)),
    )
    db.add(anomaly)
    db.commit()
    db.refresh(anomaly)
    return anomaly


def retrieve_anomalies(
    db: Session,
    limit: int = 50,
    severity: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
) -> List[AnomalyRecord]:
    """Retrieve detected anomalies with optional severity, type, and timestamp filters."""
    query = db.query(AnomalyRecord)
    if severity and severity.upper() != "ALL":
        query = query.filter(AnomalyRecord.severity == severity.upper())
    if anomaly_type and anomaly_type.upper() != "ALL":
        query = query.filter(AnomalyRecord.anomaly_type == anomaly_type.upper())
    if start_time:
        query = query.filter(AnomalyRecord.timestamp >= start_time)
    if end_time:
        query = query.filter(AnomalyRecord.timestamp <= end_time)
    return query.order_by(desc(AnomalyRecord.id)).limit(limit).all()


def store_health_status(db: Session, health_data: Dict[str, Any]) -> SensorHealthRecord:
    """Explicitly record a sensor health audit point."""
    recs = health_data.get("recommendations", [])
    recs_str = json.dumps(recs) if isinstance(recs, list) else str(recs)

    entry = SensorHealthRecord(
        timestamp=str(health_data.get("timestamp")),
        station_id=health_data.get("station_id", "AWS-SIH-001"),
        temperature_health=float(health_data.get("temperature_health", 100.0)),
        pressure_health=float(health_data.get("pressure_health", 100.0)),
        humidity_health=float(health_data.get("humidity_health", 100.0)),
        overall_health=float(health_data.get("overall_health", 100.0)),
        health_status=health_data.get("health_status", "EXCELLENT"),
        maintenance_required=bool(health_data.get("maintenance_required", False)),
        recommendations=recs_str,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def retrieve_latest_health(db: Session) -> Optional[SensorHealthRecord]:
    """Retrieve most recent sensor health audit record."""
    return db.query(SensorHealthRecord).order_by(desc(SensorHealthRecord.id)).first()


def retrieve_health_history(db: Session, limit: int = 100) -> List[SensorHealthRecord]:
    """Retrieve chronological health history records."""
    records = db.query(SensorHealthRecord).order_by(desc(SensorHealthRecord.id)).limit(limit).all()
    return list(reversed(records))


def get_telemetry_statistics(db: Session) -> Dict[str, Any]:
    """Calculate aggregate telemetry metrics, anomaly breakdown counts, and current health."""
    total_records = db.query(func.count(SensorReading.id)).scalar() or 0
    total_anomalies = db.query(func.count(AnomalyRecord.id)).scalar() or 0

    type_counts = (
        db.query(AnomalyRecord.anomaly_type, func.count(AnomalyRecord.id))
        .group_by(AnomalyRecord.anomaly_type)
        .all()
    )
    breakdown_by_type = {t: count for t, count in type_counts}

    sev_counts = (
        db.query(AnomalyRecord.severity, func.count(AnomalyRecord.id))
        .group_by(AnomalyRecord.severity)
        .all()
    )
    breakdown_by_severity = {s: count for s, count in sev_counts}

    latest = db.query(SensorReading).order_by(desc(SensorReading.id)).first()
    if latest:
        current_health = {
            "temperature": latest.temp_health,
            "pressure": latest.press_health,
            "humidity": latest.hum_health,
            "overall": latest.overall_health,
        }
    else:
        current_health = {"temperature": 100.0, "pressure": 100.0, "humidity": 100.0, "overall": 100.0}

    anomaly_rate = round((total_anomalies / total_records * 100.0), 2) if total_records > 0 else 0.0

    return {
        "total_records": total_records,
        "total_anomalies": total_anomalies,
        "anomaly_rate_percent": anomaly_rate,
        "current_health": current_health,
        "breakdown_by_type": breakdown_by_type,
        "breakdown_by_severity": breakdown_by_severity,
    }
