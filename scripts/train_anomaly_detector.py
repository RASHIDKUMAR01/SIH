"""
Training and Evaluation Pipeline for AWS Isolation Forest Anomaly Detector.
Trains on training split, optimizes threshold on validation split, evaluates on test split,
and generates performance metrics.
"""
import os
import sys
import json
import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix, classification_report

# Add backend directory to sys.path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.insert(0, backend_dir)

from app.ml.anomaly_detector import IsolationForestAnomalyDetector


def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(root_dir, "data")
    model_dir = os.path.join(root_dir, "models")
    
    train_path = os.path.join(data_dir, "train.csv")
    val_path = os.path.join(data_dir, "val.csv")
    test_path = os.path.join(data_dir, "test.csv")
    model_save_path = os.path.join(model_dir, "isolation_forest.joblib")
    
    print("=" * 80)
    print("         SIH 26073 - ISOLATION FOREST ANOMALY DETECTOR TRAINING")
    print("=" * 80)
    print(f"Loading datasets from {data_dir}...")
    train_df = pd.read_csv(train_path)
    val_df = pd.read_csv(val_path)
    test_df = pd.read_csv(test_path)
    
    print(f"  • Train dataset: {train_df.shape[0]} rows ({int((train_df['anomaly'] == 0).sum())} normal baseline rows)")
    print(f"  • Val dataset  : {val_df.shape[0]} rows ({int((val_df['anomaly'] == 1).sum())} anomalies)")
    print(f"  • Test dataset : {test_df.shape[0]} rows ({int((test_df['anomaly'] == 1).sum())} anomalies)")
    
    # 1. Initialize and Fit Detector
    print("\nTraining Isolation Forest model on clean normal baseline...")
    detector = IsolationForestAnomalyDetector(
        contamination=0.05,
        n_estimators=150,
        random_state=42,
    )
    detector.fit(train_df=train_df, train_only_normal=True, val_df=val_df)
    
    # 2. Save Model
    print(f"Saving trained model artifact to {model_save_path}...")
    detector.save(model_save_path)
    
    # 3. Test Model Loading (round-trip validation)
    print("Verifying model deserialization...")
    loaded_detector = IsolationForestAnomalyDetector.load(model_save_path)
    
    # 4. Batch Inference on Test Dataset
    print(f"Running inference on Test Dataset ({len(test_df)} records)...")
    results_df = loaded_detector.predict_batch(test_df)
    
    # 5. Compute Exact Evaluation Metrics
    y_true = test_df["anomaly"].values
    y_pred = results_df["prediction"].values
    
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()
    
    print("\n" + "=" * 80)
    print("                     TEST DATASET EVALUATION RESULTS")
    print("=" * 80)
    print(f"Total Test Samples   : {len(test_df)}")
    print(f"Total True Anomalies : {int(np.sum(y_true == 1))} ({np.sum(y_true == 1)/len(test_df)*100:.2f}%)")
    print(f"Total Normal Samples : {int(np.sum(y_true == 0))} ({np.sum(y_true == 0)/len(test_df)*100:.2f}%)")
    print("-" * 80)
    print(f"Precision            : {prec * 100:.2f}%  (TP / (TP + FP))")
    print(f"Recall               : {rec * 100:.2f}%  (TP / (TP + FN))")
    print(f"F1 Score             : {f1 * 100:.2f}%")
    print("-" * 80)
    print("Confusion Matrix:")
    print(f"                  Predicted Normal    Predicted Anomaly")
    print(f"  Actual Normal       TN = {tn:<6}        FP = {fp:<6}")
    print(f"  Actual Anomaly      FN = {fn:<6}        TP = {tp:<6}")
    print("-" * 80)
    print(f"False Positives (FP) : {fp}")
    print(f"False Negatives (FN) : {fn}")
    print(f"True Positives  (TP) : {tp}")
    print(f"True Negatives  (TN) : {tn}")
    print("-" * 80)
    
    # 6. Detailed Breakdown Per Anomaly Class
    print("\nDetection Breakdown by Anomaly Category on Test Set:")
    breakdown_rows = []
    for category in test_df["anomaly_type"].unique():
        cat_mask = test_df["anomaly_type"] == category
        cat_total = int(np.sum(cat_mask))
        if category == "normal":
            cat_correct = int(np.sum(y_pred[cat_mask] == 0))
            cat_acc = (cat_correct / cat_total) * 100.0
            breakdown_rows.append((category, cat_total, cat_correct, cat_total - cat_correct, f"{cat_acc:.1f}% Specificity"))
        else:
            cat_detected = int(np.sum(y_pred[cat_mask] == 1))
            cat_recall = (cat_detected / cat_total) * 100.0
            breakdown_rows.append((category, cat_total, cat_detected, cat_total - cat_detected, f"{cat_recall:.1f}% Recall"))

    print(f"{'Anomaly Category':<28} | {'Total':<6} | {'Detected':<8} | {'Missed':<6} | {'Accuracy/Recall'}")
    print("-" * 75)
    for cat, total, det, missed, metric in breakdown_rows:
        print(f"{cat:<28} | {total:<6} | {det:<8} | {missed:<6} | {metric}")
    print("=" * 80)
    
    # 7. Real-Time Single-Reading Streaming Test
    print("\nDemonstrating Single-Reading Real-Time Streaming Inference:")
    print("-" * 75)
    # Feed 5 normal readings then 1 spike reading
    loaded_detector.streaming_preprocessor.clear()
    sample_normal = test_df[test_df["anomaly"] == 0].iloc[:5]
    for _, r in sample_normal.iterrows():
        out = loaded_detector.predict_single(r["timestamp"], r["temperature"], r["pressure"], r["humidity"])
    print("Normal Reading Stream Output:")
    print(json.dumps(out, indent=2))
    
    spike_out = loaded_detector.predict_single("2026-08-01T12:00:00Z", 49.5, 1013.2, 75.0)
    print("\nInjected Temperature Spike Stream Output:")
    print(json.dumps(spike_out, indent=2))
    print("=" * 80)
    
    # Save evaluation summary JSON
    eval_summary = {
        "precision": float(prec),
        "recall": float(rec),
        "f1_score": float(f1),
        "confusion_matrix": {
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp),
        },
        "false_positives": int(fp),
        "false_negatives": int(fn),
        "decision_threshold": float(loaded_detector.decision_threshold),
        "per_class_breakdown": {
            cat: {"total": total, "detected": det, "missed": missed, "metric": metric}
            for cat, total, det, missed, metric in breakdown_rows
        },
    }
    with open(os.path.join(model_dir, "evaluation_metrics.json"), "w", encoding="utf-8") as f:
        json.dump(eval_summary, f, indent=2)


if __name__ == "__main__":
    main()
