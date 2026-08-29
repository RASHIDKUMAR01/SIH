"""
SQLAlchemy ORM models for SQLite persistence:
  1. sensor_readings: Stores continuous AWS meteorological time series telemetry.
  2. anomalies: Dedicated log of detected anomalous incidents with explainability.
  3. sensor_health: Historical audit trail of individual and overall sensor health.
"""
from datetime import datetime, timezone
import json
from typing import Dict, Any, List, Optional
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, Text, Index
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class SensorReading(Base):
    """Table 1: sensor_readings"""
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(String, nullable=False, index=True)
    station_id = Column(String, default="AWS-SIH-001", index=True)
    temperature = Column(Float, nullable=True)
    pressure = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    
    # Anomaly status & metadata
    is_anomaly = Column(Boolean, default=False, index=True)
    anomaly_type = Column(String, default="NORMAL", index=True)
    anomaly_score = Column(Float, default=0.0)
    confidence = Column(Float, default=1.0)
    severity = Column(String, default="LOW", index=True)
    explanation = Column(Text, default="")
    affected_parameters = Column(String, default="[]")
    
    # Health Snapshot
    temp_health = Column(Float, default=100.0)
    press_health = Column(Float, default=100.0)
    hum_health = Column(Float, default=100.0)
    overall_health = Column(Float, default=100.0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    __table_args__ = (
        Index("idx_sensor_readings_ts_station", "timestamp", "station_id"),
        Index("idx_sensor_readings_anomaly_ts", "is_anomaly", "timestamp"),
    )

    def to_dict(self) -> Dict[str, Any]:
        try:
            affected = json.loads(self.affected_parameters) if self.affected_parameters else []
        except Exception:
            affected = []

        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "station_id": self.station_id,
            "temperature": self.temperature,
            "pressure": self.pressure,
            "humidity": self.humidity,
            "is_anomaly": self.is_anomaly,
            "anomaly_type": self.anomaly_type,
            "anomaly_score": self.anomaly_score,
            "confidence": self.confidence,
            "severity": self.severity,
            "explanation": self.explanation,
            "affected_parameters": affected,
            "sensor_health": {
                "temperature": self.temp_health,
                "pressure": self.press_health,
                "humidity": self.hum_health,
                "overall": self.overall_health,
            },
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AnomalyRecord(Base):
    """Table 2: anomalies"""
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(String, nullable=False, index=True)
    station_id = Column(String, default="AWS-SIH-001", index=True)
    anomaly_type = Column(String, nullable=False, index=True)
    severity = Column(String, nullable=False, index=True)
    confidence = Column(Float, default=1.0)
    anomaly_score = Column(Float, default=0.0)
    explanation = Column(Text, default="")
    affected_parameters = Column(String, default="[]")
    
    # Telemetry snapshot at time of incident
    temperature = Column(Float, nullable=True)
    pressure = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    
    is_resolved = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    __table_args__ = (
        Index("idx_anomalies_type_sev", "anomaly_type", "severity"),
        Index("idx_anomalies_ts", "timestamp"),
    )

    def to_dict(self) -> Dict[str, Any]:
        try:
            affected = json.loads(self.affected_parameters) if self.affected_parameters else []
        except Exception:
            affected = []

        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "station_id": self.station_id,
            "anomaly_type": self.anomaly_type,
            "severity": self.severity,
            "confidence": self.confidence,
            "anomaly_score": self.anomaly_score,
            "explanation": self.explanation,
            "affected_parameters": affected,
            "temperature": self.temperature,
            "pressure": self.pressure,
            "humidity": self.humidity,
            "is_resolved": self.is_resolved,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SensorHealthRecord(Base):
    """Table 3: sensor_health"""
    __tablename__ = "sensor_health"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(String, nullable=False, index=True)
    station_id = Column(String, default="AWS-SIH-001", index=True)
    temperature_health = Column(Float, default=100.0)
    pressure_health = Column(Float, default=100.0)
    humidity_health = Column(Float, default=100.0)
    overall_health = Column(Float, default=100.0)
    health_status = Column(String, default="EXCELLENT", index=True)
    maintenance_required = Column(Boolean, default=False, index=True)
    recommendations = Column(Text, default="[]")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    __table_args__ = (
        Index("idx_sensor_health_ts", "timestamp"),
    )

    def to_dict(self) -> Dict[str, Any]:
        try:
            recs = json.loads(self.recommendations) if self.recommendations else []
        except Exception:
            recs = []

        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "station_id": self.station_id,
            "temperature_health": self.temperature_health,
            "pressure_health": self.pressure_health,
            "humidity_health": self.humidity_health,
            "overall_health": self.overall_health,
            "health_status": self.health_status,
            "maintenance_required": self.maintenance_required,
            "recommendations": recs,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
