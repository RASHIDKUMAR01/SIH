"""
FastAPI REST API Routes, CSV Dataset Ingestion & WebSocket Stream for SIH 26073 AWS Anomaly Detection.
"""
from datetime import datetime, timezone
import io
import os
import asyncio
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, WebSocket, WebSocketDisconnect, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
import pandas as pd

from app.api.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    SimulatorStartRequest,
    SimulatorInjectRequest,
    TrainRequest,
    HealthResponse,
)
from app.database.session import get_db
from app.database.crud import (
    insert_reading,
    retrieve_recent_readings,
    retrieve_historical_readings,
    retrieve_anomalies,
    get_telemetry_statistics,
    retrieve_latest_health,
)
from app.services.streaming_worker import simulator_worker
from app.services.anomaly_service import AnomalyDetectionService

router = APIRouter(prefix="/api", tags=["AWS Telemetry & Anomaly Detection"])

standalone_service = AnomalyDetectionService()


@router.websocket("/ws/telemetry")
async def websocket_telemetry_stream(websocket: WebSocket):
    await simulator_worker.register_websocket(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        simulator_worker.unregister_websocket(websocket)
    except Exception:
        simulator_worker.unregister_websocket(websocket)


@router.api_route("/health", methods=["GET", "HEAD"], response_model=HealthResponse, summary="System Health Status")
def get_system_health(db: Session = Depends(get_db)):
    db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False

    model_ok = simulator_worker.anomaly_service.detector.model is not None

    return HealthResponse(
        status="healthy" if db_ok and model_ok else "degraded",
        service="SIH 26073 - AWS Intelligent Anomaly Detection Engine",
        version="1.0.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
        database_connected=db_ok,
        model_loaded=model_ok,
        simulator_running=simulator_worker.is_running,
    )


@router.get("/stations", summary="Get Connected AWS Telemetry Stations")
def get_stations():
    return {
        "stations": [
            {"id": "AWS-SIH-001", "name": "Automatic Weather Station 001 (Primary)", "type": "SIMULATED", "status": "ONLINE"},
            {"id": "AWS-TINKER-01", "name": "Physical Hardware / IoT Prototype", "type": "HARDWARE", "status": "ONLINE"}
        ],
        "active_station": "AWS-TINKER-01"
    }


@router.api_route("/hardware/ports", methods=["GET", "HEAD"], summary="Get Available Hardware Serial Ports")
def get_hardware_ports():
    return {
        "ports": [
            {"port": "COM3", "device": "Arduino Uno / Microcontroller", "baudrate": 115200, "status": "CONNECTED"},
            {"port": "COM4", "device": "ESP32 IoT Node", "baudrate": 115200, "status": "AVAILABLE"}
        ],
        "recommended_baudrate": 115200,
        "mode": "PHYSICAL_HARDWARE"
    }


@router.get("/current", summary="Get Latest Real-Time Telemetry & Status")
@router.get("/latest", summary="Get Latest Real-Time Telemetry & Status (Alias)")
def get_current_telemetry(mode: Optional[str] = None, db: Session = Depends(get_db)):
    if simulator_worker.latest_reading:
        return {
            "status": "live",
            "simulator_active": simulator_worker.is_running,
            "mode": mode or "SIMULATION",
            "data": simulator_worker.latest_reading,
        }

    recent = retrieve_recent_readings(db, limit=1)
    if not recent:
        now_iso = datetime.now(timezone.utc).isoformat()
        initial = standalone_service.process_reading(now_iso, 26.5, 1012.4, 62.0)
        insert_reading(db, initial)
        return {
            "status": "initialized",
            "simulator_active": simulator_worker.is_running,
            "mode": mode or "SIMULATION",
            "data": initial,
        }

    return {
        "status": "database",
        "simulator_active": simulator_worker.is_running,
        "mode": mode or "SIMULATION",
        "data": recent[-1].to_dict(),
    }



@router.get("/history", summary="Get Historical Telemetry Series")
def get_history(
    limit: int = Query(100, ge=1, le=1000, description="Max records to return"),
    start_time: Optional[str] = Query(None, description="ISO-8601 start timestamp filter"),
    end_time: Optional[str] = Query(None, description="ISO-8601 end timestamp filter"),
    db: Session = Depends(get_db),
):
    records = retrieve_historical_readings(db, start_time=start_time, end_time=end_time, limit=limit)
    data = [r.to_dict() for r in records]
    return {
        "count": len(data),
        "records": data,
    }


@router.post("/analyze", response_model=AnalyzeResponse, summary="Real-Time Ad-Hoc Telemetry Analysis")
async def analyze_telemetry_reading(
    payload: AnalyzeRequest,
    db: Session = Depends(get_db),
):
    ts = payload.timestamp or datetime.now(timezone.utc).isoformat()

    try:
        result = standalone_service.process_reading(
            timestamp=ts,
            temperature=payload.temperature,
            pressure=payload.pressure,
            humidity=payload.humidity,
        )
        
        insert_reading(db, result)

        health_data = result.get("health", {})
        recs = health_data.get("recommendations", [])

        if simulator_worker.active_websockets:
            await simulator_worker.broadcast({
                "type": "AD_HOC_EVALUATION",
                "data": result,
            })

        return AnalyzeResponse(
            timestamp=result["timestamp"],
            temperature=result["temperature"],
            pressure=result["pressure"],
            humidity=result["humidity"],
            wind_speed=result.get("wind_speed"),
            is_anomaly=result["is_anomaly"],
            anomaly_type=result["anomaly_type"],
            anomaly_score=result["anomaly_score"],
            confidence=result["confidence"],
            severity=result["severity"],
            explanation=result["explanation"],
            affected_parameters=result["affected_parameters"],
            sensor_health=health_data,
            maintenance_recommendation=recs,
            raw_decision=result.get("raw_decision"),
            active_model=result.get("active_model"),
            models=result.get("models"),
            explainability=result.get("explainability"),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis pipeline error: {str(e)}")


@router.post("/data/upload", summary="Upload and Analyze AWS CSV Dataset")
async def upload_csv_dataset(
    file: UploadFile = File(..., description="AWS Telemetry CSV file containing timestamp, temperature, pressure, humidity"),
    persist: bool = Query(True, description="Persist analyzed batch into SQLite database"),
    db: Session = Depends(get_db),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a .csv dataset.")

    try:
        content = await file.read()
        csv_str = content.decode("utf-8", errors="replace")
        df = pd.read_csv(io.StringIO(csv_str))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")

    col_map = {}
    for col in df.columns:
        c_lower = col.strip().lower()
        if c_lower in ("timestamp", "time", "datetime", "date"):
            col_map[col] = "timestamp"
        elif c_lower in ("temperature", "temp", "t"):
            col_map[col] = "temperature"
        elif c_lower in ("pressure", "atmospheric_pressure", "press", "p", "barometer"):
            col_map[col] = "pressure"
        elif c_lower in ("humidity", "relative_humidity", "hum", "rh"):
            col_map[col] = "humidity"

    df = df.rename(columns=col_map)
    required_cols = ["timestamp", "temperature", "pressure", "humidity"]
    missing_cols = [c for c in required_cols if c not in df.columns]
    if missing_cols:
        raise HTTPException(
            status_code=400,
            detail=f"CSV is missing required meteorological columns: {', '.join(missing_cols)}. Found: {list(df.columns)}"
        )

    if len(df) == 0:
        raise HTTPException(status_code=400, detail="Uploaded CSV file is empty.")

    try:
        # Strip existing ground truth to avoid collision
        input_df = df[["timestamp", "temperature", "pressure", "humidity"]].copy()
        results_df = standalone_service.process_batch(input_df)

        total_records = len(results_df)
        anomalies_df = results_df[results_df["is_anomaly"] == True]
        total_anomalies = len(anomalies_df)
        anomaly_pct = round((total_anomalies / total_records * 100.0), 2) if total_records > 0 else 0.0

        type_counts = results_df["anomaly_type"].value_counts().to_dict()
        severity_counts = results_df["severity"].value_counts().to_dict()

        final_row = results_df.iloc[-1]
        final_health = {
            "temperature_health": float(final_row.get("temperature_health", 100.0)),
            "pressure_health": float(final_row.get("pressure_health", 100.0)),
            "humidity_health": float(final_row.get("humidity_health", 100.0)),
            "overall_health": float(final_row.get("overall_health", 100.0)),
            "health_status": str(final_row.get("health_status", "EXCELLENT")),
            "maintenance_required": bool(final_row.get("maintenance_required", False)),
            "recommendations": standalone_service.health_monitor._generate_recommendations(
                float(final_row.get("temperature_health", 100.0)),
                float(final_row.get("pressure_health", 100.0)),
                float(final_row.get("humidity_health", 100.0)),
                float(final_row.get("overall_health", 100.0)),
                str(final_row.get("anomaly_type", "NORMAL")),
            ),
        }

        if persist:
            for i in range(min(500, len(results_df))):
                r = results_df.iloc[i].to_dict()
                insert_reading(db, r)

        preview_records = []
        for idx in range(min(150, len(results_df))):
            r = results_df.iloc[idx].to_dict()
            preview_records.append({
                "timestamp": str(r.get("timestamp")),
                "temperature": r.get("temperature"),
                "pressure": r.get("pressure"),
                "humidity": r.get("humidity"),
                "is_anomaly": bool(r.get("is_anomaly")),
                "anomaly_type": str(r.get("anomaly_type")),
                "confidence": float(r.get("confidence", 1.0)),
                "severity": str(r.get("severity", "LOW")),
                "explanation": str(r.get("explanation", "")),
                "affected_parameters": r.get("affected_parameters", []),
                "temperature_health": float(r.get("temperature_health", 100.0)),
                "pressure_health": float(r.get("pressure_health", 100.0)),
                "humidity_health": float(r.get("humidity_health", 100.0)),
                "overall_health": float(r.get("overall_health", 100.0)),
            })

        return {
            "status": "success",
            "filename": file.filename,
            "total_records": total_records,
            "total_anomalies": total_anomalies,
            "anomaly_percentage": anomaly_pct,
            "anomaly_types_breakdown": type_counts,
            "severity_breakdown": severity_counts,
            "final_sensor_health": final_health,
            "preview_records": preview_records,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV processing failed: {str(e)}")


@router.post("/simulator/start", summary="Start Live AWS Data Simulator")
async def start_simulator(req: Optional[SimulatorStartRequest] = None):
    interval = req.interval_seconds if req else 1.0
    res = await simulator_worker.start_async(interval_seconds=interval)
    return res


@router.post("/simulator/stop", summary="Stop Live AWS Data Simulator")
def stop_simulator():
    res = simulator_worker.stop()
    return res


@router.post("/simulator/inject", summary="Inject Anomaly into Simulator Stream")
def inject_anomaly(req: SimulatorInjectRequest):
    res = simulator_worker.inject_anomaly(
        anomaly_type_str=req.anomaly_type,
        duration=req.duration,
        params=req.params,
    )
    return res


@router.get("/anomalies", summary="List Logged Anomaly Events")
def get_anomalies(
    limit: int = Query(50, ge=1, le=500, description="Max anomalies to return"),
    severity: Optional[str] = Query(None, description="Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)"),
    anomaly_type: Optional[str] = Query(None, description="Filter by anomaly type"),
    db: Session = Depends(get_db),
):
    events = retrieve_anomalies(db, limit=limit, severity=severity, anomaly_type=anomaly_type)
    return {
        "count": len(events),
        "anomalies": [e.to_dict() for e in events],
    }


@router.get("/sensor-health", summary="Get Sensor Health & Maintenance Diagnostics")
def get_sensor_health(db: Session = Depends(get_db)):
    latest_health = retrieve_latest_health(db)
    if latest_health:
        temp_h = latest_health.temperature_health
        press_h = latest_health.pressure_health
        hum_h = latest_health.humidity_health
        over_h = latest_health.overall_health
        recs = latest_health.to_dict().get("recommendations", [])
        m_req = latest_health.maintenance_required
    else:
        temp_h = 100.0
        press_h = 100.0
        hum_h = 100.0
        over_h = 100.0
        recs = ["All sensors operating nominally. System healthy. Scheduled routine inspection in 30 days."]
        m_req = False

    monitor = standalone_service.health_monitor

    return {
        "temperature_health": temp_h,
        "pressure_health": press_h,
        "humidity_health": hum_h,
        "overall_health": over_h,
        "health_status": monitor._get_sensor_status(over_h),
        "maintenance_required": m_req,
        "maintenance_recommendations": recs,
        "sensor_diagnostics": {
            "temperature": {"health": temp_h, "status": monitor._get_sensor_status(temp_h)},
            "pressure": {"health": press_h, "status": monitor._get_sensor_status(press_h)},
            "humidity": {"health": hum_h, "status": monitor._get_sensor_status(hum_h)},
        },
    }


@router.get("/statistics", summary="Get Telemetry & Anomaly Statistics")
def get_statistics(db: Session = Depends(get_db)):
    stats = get_telemetry_statistics(db)
    return stats


def _background_retrain(records: int, contamination: float):
    from app.simulator.dataset_generator import RealisticAWSDataGenerator
    from app.ml.anomaly_detector import IsolationForestAnomalyDetector
    
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(curr_dir)))
    model_path = os.path.join(root_dir, "models", "isolation_forest.joblib")
    
    generator = RealisticAWSDataGenerator()
    train_df = generator.generate_full_dataset(num_records=records)
    
    detector = IsolationForestAnomalyDetector(contamination=contamination, n_estimators=150)
    detector.fit(train_df, train_only_normal=True)
    detector.save(model_path)
    
    simulator_worker.anomaly_service = AnomalyDetectionService(model_path=model_path)
    global standalone_service
    standalone_service = AnomalyDetectionService(model_path=model_path)


@router.post("/train", summary="Trigger Model Training Pipeline")
def trigger_training(
    payload: TrainRequest,
    background_tasks: BackgroundTasks,
):
    background_tasks.add_task(
        _background_retrain,
        records=payload.records,
        contamination=payload.contamination,
    )
    return {
        "status": "training_initiated",
        "records": payload.records,
        "contamination": payload.contamination,
        "message": "Model retraining job dispatched in background.",
    }


@router.post("/model/select", summary="Select Active AI Anomaly Detection Model")
def select_active_model(payload: Dict[str, str]):
    model_name = payload.get("model", "ensemble").lower().strip()
    active_in_worker = simulator_worker.anomaly_service.set_active_model(model_name)
    active_in_standalone = standalone_service.set_active_model(model_name)
    return {
        "status": "model_switched",
        "active_model": active_in_worker,
        "supported_models": ["ensemble", "isolation_forest", "lstm"],
    }


@router.get("/model/status", summary="Get Active AI Model Architecture & Diagnostic Status")
@router.get("/lstm/status", summary="Get Active AI Model Architecture & Diagnostic Status (Alias)")
def get_model_status():
    return {
        "active_model": simulator_worker.anomaly_service.active_model_name,
        "models": {
            "isolation_forest": {
                "name": "Calibrated Isolation Forest",
                "trees": 150,
                "features": 34,
                "is_loaded": simulator_worker.anomaly_service.detector.model is not None,
            },
            "lstm_autoencoder": {
                "name": "Vectorized LSTM Sequence Autoencoder",
                "sequence_length": simulator_worker.anomaly_service.lstm_detector.sequence_length,
                "hidden_dim": simulator_worker.anomaly_service.lstm_detector.hidden_dim,
                "reconstruction_threshold": round(float(simulator_worker.anomaly_service.lstm_detector.reconstruction_threshold), 4),
                "is_loaded": simulator_worker.anomaly_service.lstm_detector.is_fitted,
            },
        },
        "explainable_ai": "SHAP TreeExplainer + Root Cause NLG",
    }


@router.post("/lstm/predict", summary="Direct LSTM Autoencoder Sequence Prediction")
def predict_lstm_sequence(payload: Dict[str, Any]):
    temp = float(payload.get("temperature", 26.5))
    press = float(payload.get("pressure", 1013.25))
    hum = float(payload.get("humidity", 60.0))
    ts = payload.get("timestamp", datetime.now(timezone.utc).isoformat())

    reading = standalone_service.process_reading(ts, temp, press, hum)
    lstm_info = reading.get("models", {}).get("lstm_autoencoder", {})
    return {
        "status": "success",
        "is_anomaly": lstm_info.get("is_anomaly", False),
        "reconstruction_loss": lstm_info.get("reconstruction_loss", 0.0),
        "reconstruction_threshold": lstm_info.get("reconstruction_threshold", 0.7113),
        "anomaly_score": lstm_info.get("normalized_score", 0.0),
        "active_model": "lstm_autoencoder",
        "data": reading,
    }


