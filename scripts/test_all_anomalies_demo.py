import asyncio
import json
import httpx
import websockets

MODES_TO_TEST = [
    ("temperature_spike", {"magnitude": 18.0}, "TEMPERATURE_SPIKE"),
    ("temperature_drop", {"magnitude": 16.0}, "TEMPERATURE_DROP"),
    ("frozen_sensor", {"target_sensor": "temperature"}, "FROZEN_SENSOR"),
    ("sensor_drift", {"drift_rate": 0.8, "target_sensor": "temperature"}, "SENSOR_DRIFT"),
    ("missing_data", {"target_sensor": "temperature"}, "MISSING_DATA"),
    ("multivariate_inconsistency", {"temperature": 48.0, "relative_humidity": 98.0}, "MULTIVARIATE_INCONSISTENCY"),
]

async def test_all_6_modes():
    print("=" * 80)
    print("STARTING END-TO-END AWS ANOMALY SIMULATION DEMO VERIFICATION")
    print("=" * 80)
    
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
        await client.post("/api/simulator/start", json={"interval_seconds": 0.3})

        async with websockets.connect("ws://127.0.0.1:8000/api/ws/telemetry") as ws:
            for mode_key, params, expected_classif in MODES_TO_TEST:
                print(f"\n[DEMO SCENARIO] Injecting: {mode_key}...")
                
                inj_res = await client.post("/api/simulator/inject", json={
                    "anomaly_type": mode_key,
                    "duration": 10,
                    "params": params,
                })
                assert inj_res.status_code == 200
                
                detected_target = False
                for step in range(14):
                    raw_msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    packet = json.loads(raw_msg)["data"]
                    
                    t = packet.get("temperature")
                    p = packet.get("pressure")
                    h = packet.get("humidity")
                    anom_type = packet.get("anomaly_type")
                    sev = packet.get("severity")
                    conf = packet.get("confidence")
                    exp = packet.get("explanation", "").encode("ascii", "ignore").decode("ascii")
                    
                    if anom_type == expected_classif:
                        detected_target = True
                        print(f"  [PASS] Step {step+1}: DETECTED {anom_type} | Sev={sev} | Conf={conf} | T={t}, P={p}, RH={h}")
                        print(f"         XAI Explanation: {exp[:110]}...")
                        break
                    else:
                        print(f"    Step {step+1}: Processing T={t}, P={p}, RH={h} -> {anom_type}")

                assert detected_target, f"Failed to detect {expected_classif} for injection {mode_key}"
                
                await client.post("/api/simulator/inject", json={"anomaly_type": "normal", "duration": 1})
                await asyncio.sleep(0.6)

    print("\n" + "=" * 80)
    print("ALL 6 ANOMALY SCENARIOS PASSED THE FULL BACKEND AI/ML PIPELINE END-TO-END!")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(test_all_6_modes())
