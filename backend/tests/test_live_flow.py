"""
End-to-end integration test verifying full WebSocket and REST dataflow between frontend client and backend.
"""
import asyncio
import json
import pytest
import websockets
import httpx


@pytest.mark.asyncio
async def test_full_live_streaming_and_injection_flow():
    base_http = "http://127.0.0.1:8000"
    base_ws = "ws://127.0.0.1:8000/api/ws/telemetry"

    async with httpx.AsyncClient(base_url=base_http) as client:
        # 1. Health check
        h_res = await client.get("/api/health")
        assert h_res.status_code == 200
        assert h_res.json()["status"] in ("healthy", "degraded")

        # 2. Start simulator
        sim_res = await client.post("/api/simulator/start", json={"interval_seconds": 0.5})
        assert sim_res.status_code == 200

        # 3. Connect to WebSocket stream and receive live ticks
        async with websockets.connect(base_ws) as ws:
            # Receive at least 1 normal tick
            msg_raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
            msg = json.loads(msg_raw)
            assert msg["type"] == "TELEMETRY_UPDATE"
            assert "data" in msg
            assert "temperature" in msg["data"]

            # 4. Inject Temperature Spike Anomaly via HTTP API
            inj_res = await client.post(
                "/api/simulator/inject",
                json={"anomaly_type": "temperature_spike", "duration": 5, "params": {"magnitude": 20.0}},
            )
            assert inj_res.status_code == 200
            assert inj_res.json()["status"] == "anomaly_injected"

            # 5. Receive subsequent ticks and verify anomaly detection
            detected_anomaly = False
            for _ in range(10):
                tick_raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
                tick = json.loads(tick_raw)
                if tick.get("type") == "TELEMETRY_UPDATE" and tick["data"].get("is_anomaly"):
                    detected_anomaly = True
                    assert tick["data"]["anomaly_type"] in ("TEMPERATURE_SPIKE", "UNKNOWN_ANOMALY")
                    assert "explanation" in tick["data"]
                    assert "confidence" in tick["data"]
                    assert "health" in tick["data"]
                    break

            assert detected_anomaly is True

        # 6. Verify SQLite Anomalies incident log has recorded the event
        anom_res = await client.get("/api/anomalies?limit=5")
        assert anom_res.status_code == 200
        anoms = anom_res.json()["anomalies"]
        assert len(anoms) > 0
        assert any(a["anomaly_type"] == "TEMPERATURE_SPIKE" for a in anoms)
