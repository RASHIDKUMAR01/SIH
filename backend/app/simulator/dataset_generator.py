"""
Comprehensive AWS Weather Dataset Generation Pipeline.
Generates large-scale, realistic multi-day time-series telemetry with subtle and moderate
labeled anomalies, multi-day synoptic weather shifts, and chronological train/val/test splits.
"""
import os
import json
import math
import random
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import pandas as pd

from app.simulator.schemas import AnomalyType


class RealisticAWSDataGenerator:
    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = np.random.default_rng(seed)
        random.seed(seed)

    def generate_full_dataset(
        self,
        start_time: datetime = datetime(2026, 7, 1, 0, 0, 0, tzinfo=timezone.utc),
        num_records: int = 25000,
        interval_minutes: int = 1,
    ) -> pd.DataFrame:
        base_temp_mean = 26.0
        base_press_mean = 1012.0
        base_hum_mean = 65.0
        
        ou_temp = 0.0
        ou_press = 0.0
        ou_hum = 0.0
        theta = 0.05
        sigma_t = 0.08
        sigma_p = 0.05
        sigma_h = 0.20

        anomaly_schedule = self._build_anomaly_schedule(num_records)
        
        records = []
        active_anomaly = None
        active_remaining = 0
        current_step_in_anomaly = 0
        frozen_state = {}
        
        current_time = start_time
        
        for step in range(num_records):
            current_time += timedelta(minutes=interval_minutes)
            hour = current_time.hour + current_time.minute / 60.0
            day_fraction = (step * interval_minutes) / (24 * 60.0)
            
            # Synoptic weather evolution (3-5 day weather front waves)
            synoptic_temp_shift = 3.0 * math.sin(2.0 * math.pi * day_fraction / 4.2)
            synoptic_press_shift = 6.0 * math.sin(2.0 * math.pi * day_fraction / 5.5 + 1.2)
            synoptic_hum_shift = -8.0 * math.sin(2.0 * math.pi * day_fraction / 4.2)
            
            # Diurnal components
            t_phase = (hour - 8.5) * (2.0 * math.pi / 24.0)
            temp_diurnal = (base_temp_mean + synoptic_temp_shift) + 7.0 * math.sin(t_phase)
            hum_diurnal = (base_hum_mean + synoptic_hum_shift) - 22.0 * math.sin(t_phase)
            p_semi_phase = (hour - 3.5) * (2.0 * math.pi / 12.0)
            press_tide = (base_press_mean + synoptic_press_shift) + 1.8 * math.sin(p_semi_phase)
            
            # Stochastic micro-variations
            ou_temp += -theta * ou_temp + sigma_t * self.rng.normal()
            ou_press += -theta * ou_press + sigma_p * self.rng.normal()
            ou_hum += -theta * ou_hum + sigma_h * self.rng.normal()
            
            clean_temp = round(float(temp_diurnal + ou_temp), 2)
            clean_press = round(float(press_tide + ou_press), 2)
            clean_hum = round(float(np.clip(hum_diurnal + ou_hum, 8.0, 99.0)), 2)
            
            # Check for new anomaly trigger
            if step in anomaly_schedule:
                active_anomaly = anomaly_schedule[step]
                active_remaining = active_anomaly["duration"]
                current_step_in_anomaly = 0
                frozen_state = {
                    "temp": clean_temp,
                    "press": clean_press,
                    "hum": clean_hum,
                }
                
            is_anomaly = 0
            anomaly_type = "normal"
            final_temp = clean_temp
            final_press = clean_press
            final_hum = clean_hum
            
            if active_remaining > 0 and active_anomaly is not None:
                is_anomaly = 1
                current_step_in_anomaly += 1
                active_remaining -= 1
                anomaly_type = active_anomaly["type"]
                subtlety = active_anomaly.get("subtlety", "moderate")
                
                if anomaly_type == AnomalyType.TEMPERATURE_SPIKE.value:
                    mag = self.rng.uniform(3.0, 5.2) if subtlety == "subtle" else self.rng.uniform(8.5, 15.0)
                    final_temp = round(clean_temp + mag, 2)
                    
                elif anomaly_type == AnomalyType.TEMPERATURE_DROP.value:
                    mag = self.rng.uniform(3.2, 5.5) if subtlety == "subtle" else self.rng.uniform(9.0, 16.0)
                    final_temp = round(clean_temp - mag, 2)
                    
                elif anomaly_type == AnomalyType.PRESSURE_SPIKE.value:
                    mag = self.rng.uniform(3.5, 7.0) if subtlety == "subtle" else self.rng.uniform(18.0, 36.0)
                    sign = 1 if self.rng.random() > 0.3 else -1
                    final_press = round(clean_press + sign * mag, 2)
                    
                elif anomaly_type == AnomalyType.HUMIDITY_SPIKE.value:
                    mag = self.rng.uniform(14.0, 22.0) if subtlety == "subtle" else self.rng.uniform(32.0, 50.0)
                    final_hum = round(float(np.clip(clean_hum + mag, 0.0, 100.0)), 2)
                    
                elif anomaly_type == AnomalyType.FROZEN_SENSOR.value:
                    target_sensor = active_anomaly.get("target_sensor", "all")
                    if target_sensor in ("all", "temperature"):
                        final_temp = frozen_state["temp"]
                    if target_sensor in ("all", "pressure"):
                        final_press = frozen_state["press"]
                    if target_sensor in ("all", "humidity"):
                        final_hum = frozen_state["hum"]
                        
                elif anomaly_type == AnomalyType.SENSOR_DRIFT.value:
                    rate = 0.08 if subtlety == "subtle" else 0.28
                    drift_offset = round(rate * current_step_in_anomaly, 2)
                    target_sensor = active_anomaly.get("target_sensor", "temperature")
                    if target_sensor == "temperature":
                        final_temp = round(clean_temp + drift_offset, 2)
                    elif target_sensor == "pressure":
                        final_press = round(clean_press + drift_offset, 2)
                    elif target_sensor == "humidity":
                        final_hum = round(float(np.clip(clean_hum + drift_offset, 0.0, 100.0)), 2)
                        
                elif anomaly_type == AnomalyType.MISSING_DATA.value:
                    target_sensor = active_anomaly.get("target_sensor", "all")
                    if target_sensor == "all":
                        final_temp, final_press, final_hum = None, None, None
                    elif target_sensor == "temperature":
                        final_temp = None
                    elif target_sensor == "pressure":
                        final_press = None
                    elif target_sensor == "humidity":
                        final_hum = None
                        
                elif anomaly_type == AnomalyType.MULTIVARIATE_INCONSISTENCY.value:
                    if subtlety == "subtle":
                        final_temp = round(clean_temp + 4.2, 2)
                        final_hum = round(float(np.clip(clean_hum + 26.0, 10.0, 98.0)), 2)
                    else:
                        final_temp = round(44.5 + self.rng.uniform(0.5, 3.0), 2)
                        final_hum = round(float(np.clip(94.0 + self.rng.uniform(0.5, 5.0), 0.0, 100.0)), 2)
                        final_press = round(1042.0 + self.rng.uniform(0.5, 5.0), 2)
            
            records.append({
                "timestamp": current_time.isoformat(),
                "temperature": final_temp,
                "pressure": final_press,
                "humidity": final_hum,
                "anomaly": is_anomaly,
                "anomaly_type": anomaly_type,
            })
            
        return pd.DataFrame(records)

    def _build_anomaly_schedule(self, num_records: int) -> Dict[int, Dict[str, Any]]:
        """
        Builds a comprehensive anomaly schedule cycling through all 8 anomaly types
        across all splits (train, validation, test) to ensure complete representation.
        """
        schedule = {}
        all_anomaly_types = [
            AnomalyType.TEMPERATURE_SPIKE.value,
            AnomalyType.TEMPERATURE_DROP.value,
            AnomalyType.PRESSURE_SPIKE.value,
            AnomalyType.HUMIDITY_SPIKE.value,
            AnomalyType.FROZEN_SENSOR.value,
            AnomalyType.SENSOR_DRIFT.value,
            AnomalyType.MISSING_DATA.value,
            AnomalyType.MULTIVARIATE_INCONSISTENCY.value,
        ]
        
        # We ensure round-robin rotation with randomized intervals
        anom_pool = []
        
        step = 300
        while step < num_records - 100:
            if not anom_pool:
                anom_pool = all_anomaly_types.copy()
                self.rng.shuffle(anom_pool)
                
            anom = anom_pool.pop()
            subtlety = "subtle" if self.rng.random() < 0.45 else "moderate"
            
            if anom in (AnomalyType.TEMPERATURE_SPIKE.value, AnomalyType.TEMPERATURE_DROP.value):
                duration = int(self.rng.integers(3, 7))
            elif anom in (AnomalyType.PRESSURE_SPIKE.value, AnomalyType.HUMIDITY_SPIKE.value):
                duration = int(self.rng.integers(4, 10))
            elif anom == AnomalyType.FROZEN_SENSOR.value:
                duration = int(self.rng.integers(10, 25))
            elif anom == AnomalyType.SENSOR_DRIFT.value:
                duration = int(self.rng.integers(18, 35))
            elif anom == AnomalyType.MISSING_DATA.value:
                duration = int(self.rng.integers(3, 8))
            elif anom == AnomalyType.MULTIVARIATE_INCONSISTENCY.value:
                duration = int(self.rng.integers(5, 12))
            else:
                duration = 5
                
            target_sensor = self.rng.choice(["temperature", "pressure", "humidity", "all"])
            
            schedule[step] = {
                "type": anom,
                "duration": duration,
                "subtlety": subtlety,
                "target_sensor": target_sensor,
            }
            
            # Step forward by duration + random normal gap
            gap = int(self.rng.integers(120, 260))
            step += duration + gap
            
        return schedule


def split_and_save_datasets(
    df: pd.DataFrame,
    output_dir: str,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
) -> Dict[str, Any]:
    os.makedirs(output_dir, exist_ok=True)
    n = len(df)
    n_train = int(n * train_ratio)
    n_val = int(n * val_ratio)
    
    train_df = df.iloc[:n_train].copy()
    val_df = df.iloc[n_train:n_train + n_val].copy()
    test_df = df.iloc[n_train + n_val:].copy()
    
    full_path = os.path.join(output_dir, "aws_dataset_full.csv")
    train_path = os.path.join(output_dir, "train.csv")
    val_path = os.path.join(output_dir, "val.csv")
    test_path = os.path.join(output_dir, "test.csv")
    
    df.to_csv(full_path, index=False)
    train_df.to_csv(train_path, index=False)
    val_df.to_csv(val_path, index=False)
    test_df.to_csv(test_path, index=False)
    
    def get_stats(subset_df: pd.DataFrame, name: str) -> Dict[str, Any]:
        return {
            "name": name,
            "row_count": len(subset_df),
            "missing_values": {
                "temperature": int(subset_df["temperature"].isna().sum()),
                "pressure": int(subset_df["pressure"].isna().sum()),
                "humidity": int(subset_df["humidity"].isna().sum()),
            },
            "anomaly_distribution": {
                "normal_count": int((subset_df["anomaly"] == 0).sum()),
                "anomaly_count": int((subset_df["anomaly"] == 1).sum()),
                "anomaly_percentage": round(float((subset_df["anomaly"] == 1).mean() * 100.0), 2),
            },
            "class_distribution": {k: int(v) for k, v in subset_df["anomaly_type"].value_counts().items()},
        }
        
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": n,
        "splits": {
            "full": get_stats(df, "full"),
            "train": get_stats(train_df, "train"),
            "val": get_stats(val_df, "val"),
            "test": get_stats(test_df, "test"),
        },
        "file_paths": {
            "full": full_path,
            "train": train_path,
            "val": val_path,
            "test": test_path,
        },
    }
    
    summary_path = os.path.join(output_dir, "dataset_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
        
    return summary


def main():
    import argparse
    parser = argparse.ArgumentParser(description="AWS Synthetic Dataset Generator")
    parser.add_argument("--records", type=int, default=25000, help="Total number of 1-min records to generate (~17.3 days)")
    parser.add_argument("--output-dir", type=str, default="../data", help="Output directory for CSV files")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    
    args = parser.parse_args()
    
    print(f"Generating realistic AWS dataset with {args.records} records (Seed: {args.seed})...")
    generator = RealisticAWSDataGenerator(seed=args.seed)
    df = generator.generate_full_dataset(num_records=args.records)
    
    print("Splitting into train (70%), val (15%), test (15%)...")
    summary = split_and_save_datasets(df, args.output_dir)
    
    print("\n" + "=" * 75)
    print("                 AWS DATASET GENERATION SUMMARY")
    print("=" * 75)
    print(f"Total Rows Generated : {summary['total_records']}")
    print(f"Saved Locations      :\n  - Full : {summary['file_paths']['full']}\n  - Train: {summary['file_paths']['train']}\n  - Val  : {summary['file_paths']['val']}\n  - Test : {summary['file_paths']['test']}")
    print("-" * 75)
    
    for split_key in ["full", "train", "val", "test"]:
        s = summary["splits"][split_key]
        print(f"\n[{split_key.upper()} SET] -> Rows: {s['row_count']} | Anomalies: {s['anomaly_distribution']['anomaly_count']} ({s['anomaly_distribution']['anomaly_percentage']}%)")
        print(f"  Missing: T={s['missing_values']['temperature']}, P={s['missing_values']['pressure']}, RH={s['missing_values']['humidity']}")
        print("  Class breakdown:")
        for cls_name, count in s["class_distribution"].items():
            print(f"    - {cls_name:<28}: {count:>5}")
            
    print("=" * 75)


if __name__ == "__main__":
    main()
