import React from "react";
import { LayoutDashboard, Radio, Activity, ShieldCheck, ShieldAlert, Cpu, Layers } from "lucide-react";
import StatusBanner from "./StatusBanner";
import StatisticsCards from "./StatisticsCards";
import SensorCards from "./SensorCards";
import TelemetryCharts from "./TelemetryCharts";
import AnomalyPanel from "./AnomalyPanel";
import SensorHealth from "./SensorHealth";

export default function CommandCenter({
  currentTelemetry,
  sensorHealth,
  statistics,
  history,
  onNavigateToAI,
  onNavigateToTelemetry,
  onNavigateToHealth,
  onNavigateToLab
}) {
  const isAnomaly = currentTelemetry?.is_anomaly || false;
  const models = currentTelemetry?.models || {};
  const ifModel = models.isolation_forest || {};
  const lstmModel = models.lstm_autoencoder || {};
  const comparison = models.comparison || {};
  const isAgreement = comparison.agreement !== false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* SIMULATION MODE NOTICE BANNER */}
      <div style={{
        background: "rgba(15, 23, 42, 0.8)",
        border: "1px solid rgba(56, 189, 248, 0.3)",
        borderRadius: "10px",
        padding: "12px 18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
        fontSize: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            background: "rgba(56, 189, 248, 0.15)",
            color: "#38bdf8",
            padding: "3px 8px",
            borderRadius: "4px",
            fontWeight: "700",
            fontSize: "11px",
            textTransform: "uppercase",
          }}>
            SIMULATION MODE ACTIVE
          </span>
          <span style={{ color: "#cbd5e1" }}>
            High-Fidelity Synthetic Telemetry Pipeline @ 1.0 Hz | Dual ML Models (Isolation Forest + LSTM) in Parallel
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            background: isAgreement ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
            color: isAgreement ? "#34d399" : "#fbbf24",
            padding: "2px 8px",
            borderRadius: "4px",
            fontWeight: "700",
            fontSize: "11px",
          }}>
            {comparison.status || (isAgreement ? "MODEL AGREEMENT" : "MODEL DISAGREEMENT")}
          </span>
        </div>
      </div>

      {/* 1. Overall System Status Banner */}
      <StatusBanner
        currentTelemetry={currentTelemetry}
        sensorHealth={sensorHealth}
      />

      {/* 2. Key Metrics & Statistics Overview */}
      <StatisticsCards
        statistics={statistics}
        sensorHealth={sensorHealth}
      />

      {/* 3. Live Sensor Metric Cards (Temperature, Pressure, Humidity, Wind Speed) */}
      <SensorCards
        currentTelemetry={currentTelemetry}
        sensorHealth={sensorHealth}
        history={history}
      />

      {/* 4. Dual Center Section: Telemetry Charts & Dual AI Anomaly Panel */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
        <div style={{ minWidth: 0 }}>
          <TelemetryCharts history={history} />
        </div>
        <div style={{ minWidth: 0 }}>
          <AnomalyPanel currentTelemetry={currentTelemetry} />
        </div>
      </div>

      {/* 5. Sensor Health & Predictive Maintenance Summary */}
      <SensorHealth sensorHealth={sensorHealth} />

    </div>
  );
}
