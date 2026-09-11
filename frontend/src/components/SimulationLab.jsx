import React from "react";
import { FlaskConical, Play, AlertTriangle, FileSpreadsheet, Sliders, Cpu } from "lucide-react";
import SimulatorControls from "./SimulatorControls";
import AdHocAnalyzer from "./AdHocAnalyzer";
import CsvUploader from "./CsvUploader";

export default function SimulationLab({ onInjectAnomaly, isInjecting, onUploadSuccess, onAnalysisComplete }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* Module Title Banner */}
      <div className="glass-panel" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 20px rgba(245, 158, 11, 0.4)",
          }}>
            <FlaskConical size={24} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#f8fafc", margin: 0 }}>
              Meteorological Simulation & Anomaly Injection Lab
            </h2>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "3px 0 0 0" }}>
              High-Fidelity Sensor Fault Injection, Ad-Hoc Parameter Synthesis, and CSV Batch Dataset Evaluation
            </p>
          </div>
        </div>
      </div>

      {/* 1. Real-Time Anomaly Injection Controls */}
      <SimulatorControls
        onInjectAnomaly={onInjectAnomaly}
        isInjecting={isInjecting}
      />

      {/* 2. Interactive Ad-Hoc Parameter Evaluator */}
      <AdHocAnalyzer onAnalysisComplete={onAnalysisComplete} />

      {/* 3. CSV Dataset Batch Ingestion & Analysis */}
      <CsvUploader onUploadSuccess={onUploadSuccess} />

    </div>
  );
}
