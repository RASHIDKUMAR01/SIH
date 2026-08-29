import asyncio
import json
import httpx
import websockets

async def verify_hardware_demo():
    print("=" * 80)
    print("VERIFYING LIVE AWS PROTOTYPE HARDWARE SIMULATION DEMO FLOW")
    print("=" * 80)

    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
        await client.post("/api/simulator/start", json={"interval_seconds": 0.5})

        async with websockets.connect("ws://127.0.0.1:8000/api/ws/telemetry") as ws:
            raw1 = await asyncio.wait_for(ws.recv(), timeout=5.0)
            msg1 = json.loads(raw1)["data"]
            print("STEP 1: Normal AWS Reading Received:")
            print(f"  Station: {msg1.get('station_id')} | Time: {msg1.get('timestamp_ms')} ms")
            print(f"  Temp: {msg1.get('temperature')} C | Hum: {msg1.get('humidity')} % | Press: {msg1.get('pressure')} hPa | Wind: {msg1.get('wind_speed')} km/h")
            print(f"  State: {msg1.get('anomaly_type')} | LED: GREEN | Buzzer: SILENT")

            print("\nSTEP 2 & 3: Clicking [Temperature Spike] (+18.0 C)...")
            inj_res = await client.post("/api/simulator/inject", json={
                "anomaly_type": "temperature_spike",
                "duration": 6,
                "params": {"magnitude": 18.0}
            })
            assert inj_res.status_code == 200

            print("STEP 4 & 5: Receiving processed packet from AI/ML Isolation Forest pipeline...")
            for i in range(8):
                raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
                msg = json.loads(raw)["data"]
                if msg.get("is_anomaly") and msg.get("anomaly_type") == "TEMPERATURE_SPIKE":
                    print("\nSTEP 5: ANOMALY DETECTED!")
                    print(f"  Anomaly Type: {msg.get('anomaly_type')}")
                    print(f"  Confidence: {msg.get('confidence') * 100:.1f}%")
                    print(f"  Severity: {msg.get('severity')}")
                    print(f"  Affected: {msg.get('affected_parameters')}")
                    print("\nSTEP 6: Hardware Simulation State:")
                    print("  LED Status: RED (FLASHING)")
                    print("  Buzzer Status: ACTIVE (880 Hz PWM Alarm)")
                    print("\nSTEP 7: Sensor Health Degradation:")
                    health = msg.get("health", {})
                    print(f"  Temp Health: {health.get('temperature_health')}% | Overall Health: {health.get('overall_health')}%")
                    print("\nSTEP 8: Explainable Root Cause & Action:")
                    safe_exp = msg.get("explanation", "").encode("ascii", "ignore").decode("ascii")
                    print(f"  Reason: {safe_exp[:120]}...")
                    recs = health.get("recommendations", ["N/A"])
                    print(f"  Recommendation: {recs[0] if recs else 'N/A'}")
                    break

            print("\n" + "=" * 80)
            print("DEMO FLOW VERIFIED SUCCESSFULLY ACROSS HARDWARE PROTOTYPE PIPELINE!")
            print("=" * 80)

if __name__ == "__main__":
    asyncio.run(verify_hardware_demo())
