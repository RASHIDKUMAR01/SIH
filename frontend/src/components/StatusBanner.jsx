import React from "react";
import { ShieldCheck, AlertTriangle, AlertOctagon, HeartPulse, Zap } from "lucide-react";

export default function StatusBanner({ currentTelemetry, sensorHealth }) {
  const isAnomaly = currentTelemetry?.is_anomaly || false;
  const severity = currentTelemetry?.severity || "LOW";
  const overallHealth = sensorHealth?.overall_health ?? 100.0;
  
  let systemStatus = "NORMAL";
  if (severity === "CRITICAL" || overallHealth < 50) {
    systemStatus = "CRITICAL";
  } else if (isAnomaly || severity === "HIGH" || severity === "MEDIUM" || overallHealth < 75) {
    systemStatus = "WARNING";
  }

  const getStatusStyles = () => {
    switch (systemStatus) {
      case "CRITICAL":
        return {
          bg: "rgba(220, 38, 38, 0.12)",
          border: "rgba(239, 68, 68, 0.4)",
          text: "#f87171",
          icon: <AlertOctagon size={24} color="#f87171" />,
          title: "CRITICAL SYSTEM ALERT",
          desc: currentTelemetry?.explanation || "Severe anomaly or sensor failure detected. Immediate maintenance recommended.",
        };
      case "WARNING":
        return {
          bg: "rgba(245, 158, 11, 0.12)",
          border: "rgba(245, 158, 11, 0.4)",
          text: "#fbbf24",
          icon: <AlertTriangle size={24} color="#fbbf24" />,
          title: "SYSTEM WARNING",
          desc: currentTelemetry?.explanation || "Transient anomaly or moderate sensor calibration drift identified.",
        };
      default:
        return {
          bg: "rgba(16, 185, 129, 0.10)",
          border: "rgba(16, 185, 129, 0.3)",
          text: "#34d399",
          icon: <ShieldCheck size={24} color="#34d399" />,
          title: "SYSTEM NOMINAL",
          desc: "All meteorological sensors (Temperature, Barometric Pressure, Humidity) operating within expected physical and statistical bounds.",
        };
    }
  };

  const statusInfo = getStatusStyles();

  return (
    <div
      className="glass-panel"
      style={{
        background: statusInfo.bg,
        borderColor: statusInfo.border,
        padding: "16px 20px",
        marginBottom: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: "280px" }}>
        {statusInfo.icon}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: statusInfo.text, margin: 0 }}>
              {statusInfo.title}
            </h3>
            {isAnomaly && (
              <span className={`badge badge-${severity.toLowerCase()}`}>
                {currentTelemetry?.anomaly_type || "ANOMALY"}
              </span>
            )}
          </div>
          <p style={{ fontSize: "13px", color: "#cbd5e1", margin: "3px 0 0 0", lineHeight: "1.4" }}>
            {statusInfo.desc}
          </p>
        </div>
      </div>

      {/* Health Metric Mini Gauge */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        background: "rgba(15, 23, 42, 0.7)",
        padding: "8px 16px",
        borderRadius: "10px",
        border: "1px solid rgba(51, 65, 85, 0.5)",
      }}>
        <HeartPulse size={20} color={overallHealth > 75 ? "#34d399" : overallHealth > 50 ? "#fbbf24" : "#f87171"} />
        <div>
          <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>
            Station Health
          </div>
          <div style={{ fontSize: "18px", fontWeight: "800", color: overallHealth > 75 ? "#34d399" : overallHealth > 50 ? "#fbbf24" : "#f87171" }}>
            {overallHealth.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}
