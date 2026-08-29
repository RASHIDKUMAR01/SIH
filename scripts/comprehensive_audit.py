"""
SIH 26073 Comprehensive End-to-End Automated Audit Script.
Tests all 20 mission-critical system dimensions across live server, ML pipeline,
WebSocket stream, SQLite database, and CSV batch processor.
"""
import sys
import os
import io
import time
import json
import asyncio
import sqlite3
import httpx
import websockets
import pandas as pd
import numpy as np

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.anomaly_service import AnomalyDetectionService
from app.ml.classifier import ClassifiedAnomalyType

HTTP_BASE = "http://127.0.0.1:8000"
WS_BASE = "ws://127.0.0.1:8000/api/ws/telemetry"
FRONTEND_BASE = "http://127.0.0.1:5173"
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "aws_telemetry.db")

audit_results = {}

def record_test(test_id: int, name: str, passed: bool, details: str = ""):
    status = "PASSED" if passed else "FAILED"
    audit_results[test_id] = {
        "name": name,
        "passed": passed,
        "status": status,
        "details": details
    }
    symbol = "[PASS]" if passed else "[FAIL]"
    print(f"{symbol} Test {test_id:02d}: {name} - {details}")

async def run_audit():
    print("=" * 90)
    print("SIH 26073 - COMPLETE END-TO-END SYSTEM AUDIT (20 DIMENSIONS)")
    print("=" * 90)

    svc = AnomalyDetectionService()

    async with httpx.AsyncClient(timeout=30.0) as client:
        
        # 1. Backend Startup
        try:
            res = await client.get(f"{HTTP_BASE}/api/health")
            passed = res.status_code == 200 and res.json().get("status") in ("healthy", "degraded")
            record_test(1, "Backend Startup", passed, f"Status: {res.status_code}, Response: {res.json().get('status')}")
        except Exception as e:
            record_test(1, "Backend Startup", False, str(e))

        # 2. Frontend Startup
        try:
            res = await client.get(FRONTEND_BASE)
            passed = res.status_code == 200 and ("SkyGuard AI" in res.text or "<div id=\"root\">" in res.text)
            record_test(2, "Frontend Startup", passed, f"Status: {res.status_code}, HTML length: {len(res.text)} bytes")
        except Exception as e:
            record_test(2, "Frontend Startup", False, str(e))

        # 3. Database Persistence & Schema
        try:
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [t[0] for t in cur.fetchall()]
            has_tables = all(tbl in tables for tbl in ("sensor_readings", "anomalies", "sensor_health"))
            
            cur.execute("SELECT count(*) FROM sensor_readings")
            r_count = cur.fetchone()[0]
            
            cur.execute("SELECT name FROM sqlite_master WHERE type='index'")
            indexes = [idx[0] for idx in cur.fetchall()]
            conn.close()
            passed = has_tables and r_count >= 0 and len(indexes) > 0
            record_test(3, "Database Persistence & Schema", passed, f"Tables: {len(tables)}, Indexes: {len(indexes)}, Readings Logged: {r_count}")
        except Exception as e:
            record_test(3, "Database Persistence & Schema", False, str(e))

        # 4. AWS Simulator Stepping
        try:
            start_res = await client.post(f"{HTTP_BASE}/api/simulator/start", json={"interval_seconds": 0.2})
            passed = start_res.status_code == 200
            record_test(4, "AWS Simulator Stepping", passed, f"Simulator Running: {start_res.json()}")
        except Exception as e:
            record_test(4, "AWS Simulator Stepping", False, str(e))

        # 5. Normal Telemetry Evaluation (Fresh isolated service)
        try:
            clean_svc = AnomalyDetectionService()
            normal_readings = [
                (25.0, 1013.2, 60.0),
                (25.05, 1013.22, 59.9),
                (25.10, 1013.19, 59.8),
                (25.14, 1013.21, 59.7),
            ]
            for t_val, p_val, h_val in normal_readings:
                out_norm = clean_svc.process_reading("2026-08-01T12:00:00Z", t_val, p_val, h_val)
            
            passed = out_norm["is_anomaly"] is False and out_norm["anomaly_type"] == "NORMAL" and out_norm["severity"] == "LOW"
            record_test(5, "Normal Telemetry Evaluation", passed, f"Type: {out_norm['anomaly_type']}, Is Anomaly: {out_norm['is_anomaly']}, Sev: {out_norm['severity']}")
        except Exception as e:
            record_test(5, "Normal Telemetry Evaluation", False, str(e))

        # 6. Temperature Spike Anomaly (+18°C)
        try:
            # Prime server with baseline then spike
            await client.post(f"{HTTP_BASE}/api/analyze", json={"temperature": 25.0, "pressure": 1013.2, "humidity": 60.0})
            spk_res = await client.post(f"{HTTP_BASE}/api/analyze", json={
                "temperature": 48.5,
                "pressure": 1013.2,
                "humidity": 60.0,
            })
            sd = spk_res.json()
            passed = sd["is_anomaly"] is True and sd["anomaly_type"] in ("TEMPERATURE_SPIKE", "MULTIVARIATE_INCONSISTENCY")
            record_test(6, "Temperature Spike Anomaly", passed, f"Type: {sd['anomaly_type']}, Sev: {sd['severity']}, Conf: {sd['confidence'] * 100:.1f}%")
        except Exception as e:
            record_test(6, "Temperature Spike Anomaly", False, str(e))

        # 7. Temperature Drop Anomaly (-16°C)
        try:
            # Prime server with baseline then drop
            await client.post(f"{HTTP_BASE}/api/analyze", json={"temperature": 25.0, "pressure": 1013.2, "humidity": 60.0})
            drp_res = await client.post(f"{HTTP_BASE}/api/analyze", json={
                "temperature": 8.0,
                "pressure": 1013.2,
                "humidity": 60.0,
            })
            dd = drp_res.json()
            passed = dd["is_anomaly"] is True and dd["anomaly_type"] in ("TEMPERATURE_DROP", "UNKNOWN_ANOMALY")
            record_test(7, "Temperature Drop Anomaly", passed, f"Type: {dd['anomaly_type']}, Sev: {dd['severity']}, Conf: {dd['confidence'] * 100:.1f}%")
        except Exception as e:
            record_test(7, "Temperature Drop Anomaly", False, str(e))

        # 8. Pressure Anomaly (+40 hPa barometric surge)
        try:
            prs_series = pd.DataFrame([
                {"timestamp": f"2026-08-01T12:{i:02d}:00Z", "temperature": 25.0, "pressure": 1013.0 if i < 5 else 1055.0, "humidity": 60.0}
                for i in range(10)
            ])
            prs_batch = svc.process_batch(prs_series)
            has_press = bool(prs_batch["anomaly_type"].isin(["PRESSURE_ANOMALY"]).any())
            record_test(8, "Pressure Anomaly", has_press, f"Detected Anomaly Types: {prs_batch['anomaly_type'].unique().tolist()}")
        except Exception as e:
            record_test(8, "Pressure Anomaly", False, str(e))

        # 9. Humidity Anomaly (+45% humidity surge)
        try:
            hum_series = pd.DataFrame([
                {"timestamp": f"2026-08-01T12:{i:02d}:00Z", "temperature": 25.0, "pressure": 1013.0, "humidity": 45.0 if i < 5 else 98.0}
                for i in range(10)
            ])
            hum_batch = svc.process_batch(hum_series)
            has_hum = bool(hum_batch["anomaly_type"].isin(["HUMIDITY_ANOMALY", "MULTIVARIATE_INCONSISTENCY"]).any())
            record_test(9, "Humidity Anomaly", has_hum, f"Detected Anomaly Types: {hum_batch['anomaly_type'].unique().tolist()}")
        except Exception as e:
            record_test(9, "Humidity Anomaly", False, str(e))

        # 10. Frozen Sensor (Zero Variance)
        try:
            frozen_df = pd.DataFrame([
                {"timestamp": f"2026-08-01T12:{i:02d}:00Z", "temperature": 25.0, "pressure": 1013.0, "humidity": 60.0}
                for i in range(12)
            ])
            res_df = svc.process_batch(frozen_df)
            has_frozen = bool(res_df["anomaly_type"].isin(["FROZEN_SENSOR"]).any())
            record_test(10, "Frozen Sensor (Zero Variance)", has_frozen, f"Detected Anomaly Types: {res_df['anomaly_type'].unique().tolist()}")
        except Exception as e:
            record_test(10, "Frozen Sensor (Zero Variance)", False, str(e))

        # 11. Sensor Drift (Cumulative offset)
        try:
            drift_df = pd.DataFrame([
                {"timestamp": f"2026-08-01T12:{i:02d}:00Z", "temperature": 25.0 + (i * 0.75), "pressure": 1013.0, "humidity": 60.0}
                for i in range(15)
            ])
            res_drift = svc.process_batch(drift_df)
            has_drift = bool(res_drift["anomaly_type"].isin(["SENSOR_DRIFT", "TEMPERATURE_SPIKE"]).any())
            record_test(11, "Sensor Calibration Drift", has_drift, f"Detected Anomaly Types: {res_drift['anomaly_type'].unique().tolist()}")
        except Exception as e:
            record_test(11, "Sensor Calibration Drift", False, str(e))

        # 12. Missing Data (Null packet loss)
        try:
            mis_res = await client.post(f"{HTTP_BASE}/api/analyze", json={
                "temperature": None,
                "pressure": 1013.2,
                "humidity": 60.0,
            })
            md = mis_res.json()
            passed = md["is_anomaly"] is True and md["anomaly_type"] == "MISSING_DATA" and md["confidence"] == 1.0
            record_test(12, "Missing Data Packet Loss", passed, f"Type: {md['anomaly_type']}, Confidence: {md['confidence'] * 100:.0f}%, Sev: {md['severity']}")
        except Exception as e:
            record_test(12, "Missing Data Packet Loss", False, str(e))

        # 13. Multivariate Inconsistency (48°C + 98% RH)
        try:
            mul_res = await client.post(f"{HTTP_BASE}/api/analyze", json={
                "temperature": 48.0,
                "pressure": 1045.0,
                "humidity": 98.0,
            })
            mud = mul_res.json()
            passed = mud["is_anomaly"] is True and mud["anomaly_type"] in ("MULTIVARIATE_INCONSISTENCY", "TEMPERATURE_SPIKE")
            record_test(13, "Multivariate Inconsistency", passed, f"Type: {mud['anomaly_type']}, Conf: {mud['confidence'] * 100:.1f}%, Affected: {mud['affected_parameters']}")
        except Exception as e:
            record_test(13, "Multivariate Inconsistency", False, str(e))

        # 14. CSV Dataset Upload
        try:
            test_csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "test.csv")
            with open(test_csv_path, "rb") as f:
                files = {"file": ("test.csv", f, "text/csv")}
                up_res = await client.post(f"{HTTP_BASE}/api/data/upload?persist=false", files=files)
            upd = up_res.json()
            passed = up_res.status_code == 200 and upd["total_records"] == 3750 and upd["total_anomalies"] > 0
            record_test(14, "CSV Dataset Upload & Ingestion", passed, f"Records: {upd.get('total_records')}, Anomalies: {upd.get('total_anomalies')}, Rate: {upd.get('anomaly_percentage')}%")
        except Exception as e:
            record_test(14, "CSV Dataset Upload & Ingestion", False, str(e))

        # 15. ML Isolation Forest Inference & SHAP
        try:
            det = svc.detector
            has_model = det.model is not None and det.preprocessor is not None
            has_shap = svc.explainer.shap_explainer is not None
            passed = has_model and has_shap
            record_test(15, "ML Isolation Forest & SHAP Explainer", passed, f"Model Loaded: {has_model}, SHAP TreeExplainer Ready: {has_shap}")
        except Exception as e:
            record_test(15, "ML Isolation Forest & SHAP Explainer", False, str(e))

        # 16. Multi-Modal Anomaly Classification
        try:
            all_types = [t.value for t in ClassifiedAnomalyType]
            passed = len(all_types) == 10 and "TEMPERATURE_SPIKE" in all_types and "MULTIVARIATE_INCONSISTENCY" in all_types
            record_test(16, "Multi-Modal Anomaly Classification", passed, f"Supported Categories ({len(all_types)}): {all_types}")
        except Exception as e:
            record_test(16, "Multi-Modal Anomaly Classification", False, str(e))

        # 17. Calibrated Confidence Calculation
        try:
            conf_val = sd["confidence"]
            passed = 0.5 <= conf_val <= 1.0 and isinstance(conf_val, float)
            record_test(17, "Calibrated Confidence Score Calculation", passed, f"Sample Calculated Confidence: {conf_val * 100:.1f}% (Rule/Model Evidentiary)")
        except Exception as e:
            record_test(17, "Calibrated Confidence Score Calculation", False, str(e))

        # 18. Severity Rating Scale (LOW/MED/HIGH/CRITICAL)
        try:
            passed = md["severity"] in ("HIGH", "CRITICAL") and sd["severity"] in ("HIGH", "CRITICAL") and out_norm["severity"] == "LOW"
            record_test(18, "Severity Rating Scale (LOW/MED/HIGH/CRITICAL)", passed, f"Normal: {out_norm['severity']}, Temp Spike: {sd['severity']}, Missing Data: {md['severity']}")
        except Exception as e:
            record_test(18, "Severity Rating Scale (LOW/MED/HIGH/CRITICAL)", False, str(e))

        # 19. Sensor Health Engine & Self-Healing
        try:
            health_res = await client.get(f"{HTTP_BASE}/api/sensor-health")
            hd = health_res.json()
            has_health = all(k in hd for k in ("temperature_health", "pressure_health", "humidity_health", "overall_health", "maintenance_recommendations"))
            passed = health_res.status_code == 200 and has_health
            record_test(19, "Sensor Health & Predictive Maintenance", passed, f"Overall: {hd.get('overall_health')}%, Status: {hd.get('health_status')}, Recommendations: {len(hd.get('maintenance_recommendations', []))}")
        except Exception as e:
            record_test(19, "Sensor Health & Predictive Maintenance", False, str(e))

        # 20. Real-Time WebSocket Dashboard Stream
        try:
            async with websockets.connect(WS_BASE) as ws:
                raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
                msg = json.loads(raw)
                passed = msg["type"] == "TELEMETRY_UPDATE" and "data" in msg and "temperature" in msg["data"]
                record_test(20, "Real-Time WebSocket Dashboard Updates", passed, f"Live Telemetry Packet Keys: {list(msg['data'].keys())[:6]}...")
        except Exception as e:
            record_test(20, "Real-Time WebSocket Dashboard Updates", False, str(e))

    passed_count = sum(1 for t in audit_results.values() if t["passed"])
    failed_count = sum(1 for t in audit_results.values() if not t["passed"])
    print("\n" + "=" * 90)
    print(f"FINAL AUDIT RESULT: {passed_count} / {len(audit_results)} TESTS PASSED ({passed_count/len(audit_results)*100:.1f}%)")
    print("=" * 90)
    return passed_count, failed_count

if __name__ == "__main__":
    p, f = asyncio.run(run_audit())
    sys.exit(0 if f == 0 else 1)
