import React from "react";
import { Database, AlertTriangle, Percent, ShieldCheck } from "lucide-react";

export default function StatisticsCards({ statistics, sensorHealth }) {
  const totalRecords = statistics?.total_records ?? 0;
  const totalAnomalies = statistics?.total_anomalies ?? 0;
  const anomalyRate = statistics?.anomaly_rate_percent ?? 0;
  const overallHealth = sensorHealth?.overall_health ?? 100.0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
      
      {/* Total Records */}
      <div className="glass-panel" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{
          width: "42px",
          height: "42px",
          borderRadius: "10px",
          background: "rgba(56, 189, 248, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#38bdf8",
        }}>
          <Database size={20} />
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>
            Total Observations
          </div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: "#f8fafc", fontFamily: "var(--font-mono)" }}>
            {totalRecords.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Anomalies Detected */}
      <div className="glass-panel" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{
          width: "42px",
          height: "42px",
          borderRadius: "10px",
          background: "rgba(239, 68, 68, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#f87171",
        }}>
          <AlertTriangle size={20} />
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>
            Anomalies Detected
          </div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: "#f87171", fontFamily: "var(--font-mono)" }}>
            {totalAnomalies.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Anomaly Rate % */}
      <div className="glass-panel" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{
          width: "42px",
          height: "42px",
          borderRadius: "10px",
          background: "rgba(245, 158, 11, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fbbf24",
        }}>
          <Percent size={20} />
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>
            Anomaly Rate
          </div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: "#fbbf24", fontFamily: "var(--font-mono)" }}>
            {anomalyRate.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Health Rating */}
      <div className="glass-panel" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{
          width: "42px",
          height: "42px",
          borderRadius: "10px",
          background: "rgba(16, 185, 129, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#34d399",
        }}>
          <ShieldCheck size={20} />
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>
            Station Health Index
          </div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: overallHealth > 75 ? "#34d399" : "#fbbf24", fontFamily: "var(--font-mono)" }}>
            {overallHealth.toFixed(1)}%
          </div>
        </div>
      </div>

    </div>
  );
}
