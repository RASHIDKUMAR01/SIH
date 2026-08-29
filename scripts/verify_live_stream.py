import asyncio
import json
import httpx
import websockets

async def verify():
    print("1. Checking GET http://127.0.0.1:8000/api/health...")
    async with httpx.AsyncClient() as client:
        res = await client.get("http://127.0.0.1:8000/api/health")
        print("Health Response:", res.json())
        assert res.status_code == 200

        print("2. Connecting to WebSocket ws://127.0.0.1:8000/api/ws/telemetry...")
        async with websockets.connect("ws://127.0.0.1:8000/api/ws/telemetry") as ws:
            print("WebSocket Connected Successfully!")
            
            # Read first live tick
            tick1_raw = await asyncio.wait_for(ws.recv(), timeout=6.0)
            tick1 = json.loads(tick1_raw)
            print(f"Received Live Tick: Temp={tick1['data']['temperature']} C, Anomaly={tick1['data']['is_anomaly']}")

            # Inject Temperature Spike
            print("3. Injecting Temperature Spike (+18.0 C) via REST API...")
            inj = await client.post("http://127.0.0.1:8000/api/simulator/inject", json={
                "anomaly_type": "temperature_spike",
                "duration": 5,
                "params": {"magnitude": 18.0}
            })
            print("Injection Result:", inj.json())

            # Await pushed anomalies
            print("4. Awaiting pushed anomaly packets over WebSocket...")
            found_anomaly = False
            for i in range(8):
                t_raw = await asyncio.wait_for(ws.recv(), timeout=6.0)
                t = json.loads(t_raw)
                d = t["data"]
                t_val = d.get("temperature")
                a_type = d.get("anomaly_type")
                sev = d.get("severity")
                conf = d.get("confidence")
                th = d.get("health", {}).get("temperature_health")
                print(f"   [Tick {i+1}] Temp={t_val} C | Anomaly={a_type} | Sev={sev} | Conf={conf} | Health={th}%")
                if d.get("is_anomaly") and a_type == "TEMPERATURE_SPIKE":
                    found_anomaly = True
                    safe_exp = d.get("explanation", "").encode("ascii", "ignore").decode("ascii")
                    print(f"   >>> Root Cause Explanation: {safe_exp}")

            assert found_anomaly, "Anomaly was detected over live WebSocket stream!"
            print("\n*** FULL LIVE WEBSOCKET & REST DATAFLOW VERIFIED SUCCESSFULLY! ***")

if __name__ == "__main__":
    asyncio.run(verify())
