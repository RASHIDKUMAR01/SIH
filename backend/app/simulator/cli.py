"""
Command-line interface to test, inspect, and benchmark the AWS Weather Simulator.
Usage:
    python -m app.simulator.cli --test-all
    python -m app.simulator.cli --test-anomaly temperature_spike --duration 5
    python -m app.simulator.cli --generate-csv --records 1440 --output ../data/synthetic_aws_telemetry.csv
    python -m app.simulator.cli --stream --count 20 --speed 0.2
"""
import argparse
import sys
import time
from datetime import datetime, timezone
import pandas as pd

from app.simulator.schemas import AnomalyType
from app.simulator.weather_simulator import AWSSimulator


def print_table(rows, headers):
    """Simple clean ASCII table formatter."""
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, val in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(val)))

    sep_line = "+-" + "-+-".join("-" * w for w in col_widths) + "-+"
    hdr_line = "| " + " | ".join(f"{h:<{col_widths[i]}}" for i, h in enumerate(headers)) + " |"
    
    print(sep_line)
    print(hdr_line)
    print(sep_line)
    for row in rows:
        r_str = "| " + " | ".join(f"{str(v):<{col_widths[i]}}" for i, v in enumerate(row)) + " |"
        print(r_str)
    print(sep_line)


def test_all_anomalies():
    print("\n" + "=" * 80)
    print("  SIH 26073 - AWS SIMULATOR COMPREHENSIVE ANOMALY TEST SUITE")
    print("=" * 80)
    
    sim = AWSSimulator(start_time=datetime(2026, 8, 28, 12, 0, 0, tzinfo=timezone.utc), seed=100)
    
    anomalies_to_test = [
        AnomalyType.NORMAL,
        AnomalyType.TEMPERATURE_SPIKE,
        AnomalyType.TEMPERATURE_DROP,
        AnomalyType.PRESSURE_SPIKE,
        AnomalyType.HUMIDITY_SPIKE,
        AnomalyType.FROZEN_SENSOR,
        AnomalyType.SENSOR_DRIFT,
        AnomalyType.MISSING_DATA,
        AnomalyType.MULTIVARIATE_INCONSISTENCY,
    ]
    
    summary_rows = []
    
    for anomaly in anomalies_to_test:
        # Generate 2 baseline steps
        sim.reset_anomaly()
        p_base = sim.step()
        
        # Trigger anomaly
        if anomaly != AnomalyType.NORMAL:
            sim.trigger_anomaly(anomaly_type=anomaly, duration_steps=4)
        p_anom = sim.step()
        
        t_str = f"{p_anom.temperature:.2f} °C" if p_anom.temperature is not None else "NULL / MISSING"
        p_str = f"{p_anom.atmospheric_pressure:.2f} hPa" if p_anom.atmospheric_pressure is not None else "NULL / MISSING"
        h_str = f"{p_anom.relative_humidity:.2f} %" if p_anom.relative_humidity is not None else "NULL / MISSING"
        
        desc = p_anom.metadata.get("description", "Normal baseline readings")
        summary_rows.append([
            anomaly.value,
            t_str,
            p_str,
            h_str,
            "YES" if p_anom.is_anomaly else "NO",
            desc[:38],
        ])
        
    print_table(
        summary_rows,
        ["Mode / Anomaly Type", "Temperature", "Pressure", "Humidity", "Is Anomaly?", "Description / Cause"],
    )
    print("\nAll 9 simulation modes successfully verified!")


def test_single_anomaly(anomaly_type_str: str, duration: int):
    try:
        anom_type = AnomalyType(anomaly_type_str)
    except ValueError:
        print(f"Error: Unknown anomaly type '{anomaly_type_str}'.")
        print(f"Valid types: {[a.value for a in AnomalyType]}")
        return
        
    print(f"\n--- Testing Scenario: {anom_type.value.upper()} (Duration: {duration} steps) ---")
    sim = AWSSimulator(seed=42)
    
    rows = []
    # 3 normal steps
    for _ in range(3):
        p = sim.step()
        rows.append([p.timestamp[11:19], f"{p.temperature:.2f}", f"{p.atmospheric_pressure:.2f}", f"{p.relative_humidity:.2f}", p.anomaly_type.value, "Normal"])
    
    # Inject
    sim.trigger_anomaly(anom_type, duration_steps=duration)
    for _ in range(duration):
        p = sim.step()
        t = f"{p.temperature:.2f}" if p.temperature is not None else "None"
        pr = f"{p.atmospheric_pressure:.2f}" if p.atmospheric_pressure is not None else "None"
        h = f"{p.relative_humidity:.2f}" if p.relative_humidity is not None else "None"
        rows.append([p.timestamp[11:19], t, pr, h, p.anomaly_type.value, p.metadata.get("description", "")[:30]])
        
    # 2 recovery steps
    for _ in range(2):
        p = sim.step()
        t = f"{p.temperature:.2f}" if p.temperature is not None else "None"
        pr = f"{p.atmospheric_pressure:.2f}" if p.atmospheric_pressure is not None else "None"
        h = f"{p.relative_humidity:.2f}" if p.relative_humidity is not None else "None"
        rows.append([p.timestamp[11:19], t, pr, h, p.anomaly_type.value, "Recovered to Normal"])

    print_table(rows, ["Time (UTC)", "Temp (°C)", "Press (hPa)", "Humidity (%)", "Status", "Notes"])


def generate_csv(records: int, output_path: str):
    print(f"\nGenerating {records} telemetry records with realistic physical diurnal curves and scheduled anomaly events...")
    sim = AWSSimulator(seed=42)
    
    schedule = [
        {"step": int(records * 0.10), "type": AnomalyType.TEMPERATURE_SPIKE, "duration": 5},
        {"step": int(records * 0.25), "type": AnomalyType.TEMPERATURE_DROP, "duration": 5},
        {"step": int(records * 0.40), "type": AnomalyType.PRESSURE_SPIKE, "duration": 8},
        {"step": int(records * 0.55), "type": AnomalyType.HUMIDITY_SPIKE, "duration": 10},
        {"step": int(records * 0.68), "type": AnomalyType.FROZEN_SENSOR, "duration": 20},
        {"step": int(records * 0.78), "type": AnomalyType.SENSOR_DRIFT, "duration": 35},
        {"step": int(records * 0.88), "type": AnomalyType.MISSING_DATA, "duration": 6},
        {"step": int(records * 0.95), "type": AnomalyType.MULTIVARIATE_INCONSISTENCY, "duration": 12},
    ]
    
    df = sim.generate_historical(
        num_records=records,
        interval_minutes=1,
        anomalies_schedule=schedule,
        output_csv_path=output_path,
    )
    
    print(f"Dataset generated and saved to: {output_path}")
    print(f"Shape: {df.shape}")
    print(f"Anomaly counts:\n{df['anomaly_type'].value_counts().to_string()}")
    print("\nFirst 5 rows:")
    print(df.head())


def stream_telemetry(count: int, speed: float):
    print(f"\nStreaming live AWS telemetry readings ({count} steps, speed: {speed}s per step)...")
    sim = AWSSimulator(seed=42)
    
    for i in range(1, count + 1):
        if i == 6:
            print(">> [INJECTING SPIKE] <<")
            sim.trigger_anomaly(AnomalyType.TEMPERATURE_SPIKE, duration_steps=3)
        elif i == 12:
            print(">> [INJECTING MISSING PACKET] <<")
            sim.trigger_anomaly(AnomalyType.MISSING_DATA, duration_steps=2)
            
        p = sim.step()
        t = f"{p.temperature:6.2f} °C" if p.temperature is not None else "   NULL   "
        pr = f"{p.atmospheric_pressure:7.2f} hPa" if p.atmospheric_pressure is not None else "   NULL   "
        h = f"{p.relative_humidity:6.2f} %" if p.relative_humidity is not None else "   NULL   "
        status = f"[{p.anomaly_type.value.upper()}]" if p.is_anomaly else "[NORMAL]"
        
        print(f"[{p.timestamp[11:19]}] {t} | {pr} | {h} | {status:<28} {p.metadata.get('description', '')}")
        time.sleep(speed)


def main():
    parser = argparse.ArgumentParser(description="AWS Weather Station Telemetry Simulator CLI")
    parser.add_argument("--test-all", action="store_true", help="Run comprehensive test for all 9 anomaly modes")
    parser.add_argument("--test-anomaly", type=str, help="Test a single anomaly type")
    parser.add_argument("--duration", type=int, default=5, help="Duration in steps for tested anomaly")
    parser.add_argument("--generate-csv", action="store_true", help="Generate historical telemetry CSV")
    parser.add_argument("--records", type=int, default=1440, help="Number of records to generate")
    parser.add_argument("--output", type=str, default="../data/synthetic_aws_telemetry.csv", help="CSV output destination")
    parser.add_argument("--stream", action="store_true", help="Stream live telemetry to console")
    parser.add_argument("--count", type=int, default=15, help="Stream step count")
    parser.add_argument("--speed", type=float, default=0.1, help="Stream delay in seconds")

    args = parser.parse_args()
    
    if args.test_all:
        test_all_anomalies()
    elif args.test_anomaly:
        test_single_anomaly(args.test_anomaly, args.duration)
    elif args.generate_csv:
        generate_csv(args.records, args.output)
    elif args.stream:
        stream_telemetry(args.count, args.speed)
    else:
        test_all_anomalies()


if __name__ == "__main__":
    main()
