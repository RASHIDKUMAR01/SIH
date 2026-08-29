import React from "react";
import { Wrench, CheckCircle, AlertTriangle, ShieldCheck, Thermometer, Gauge, Droplets } from "lucide-react";

export default function SensorHealth({ sensorHealth }) {
  const tHealth = sensorHealth?.temperature_health ?? 100.0;
  const pHealth = sensorHealth?.pressure_health ?? 100.0;
  const hHealth = sensorHealth?.humidity_health ?? 100.0;
  const oHealth = sensorHealth?.overall_health ?? 100.0;
  
  const isMaintenanceRequired = sensorHealth?.maintenance_required || false;
  const recommendations = sensorHealth?.maintenance_recommendations || sensorHealth?.recommendations || [];

  const getHealthColor = (score) => {
    if (score >= 85) return "#34d399";
    if (score >= 65) return "#fbbf24";
    return "#f87171";
  };

  const getHealthStatus = (score) => {
    if (score >= 85) return "EXCELLENT";
    if (score >= 65) return "GOOD";
    if (score >= 45) return "DEGRADED";
    return "CRITICAL";
  };

  return (
    <div className="glass-panel" style={{ padding: "20px", marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Wrench size={20} color="#38bdf8" />
          <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
            Sensor Health & Predictive Maintenance Engine
          </h2>
        </div>

        {isMaintenanceRequired ? (
          <span className="badge badge-critical">
            ⚠️ Maintenance Required
          </span>
        ) : (
          <span className="badge badge-normal">
            ✓ System Optimal
          </span>
        )}
      </div>

      {/* 4 Health Meters Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        
        {/* Overall Health */}
        <div style={{
          background: "rgba(15, 23, 42, 0.7)",
          border: "1px solid rgba(51, 65, 85, 0.5)",
          borderRadius: "10px",
          padding: "12px 14px",
          borderTop: `3px solid ${getHealthColor(oHealth)}`
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              AWS Station Health
            </span>
            <ShieldCheck size={16} color={getHealthColor(oHealth)} />
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: getHealthColor(oHealth) }}>
            {oHealth.toFixed(1)}%
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>Status: {getHealthStatus(oHealth)}</span>
        </div>

        {/* Temperature Health */}
        <div style={{
          background: "rgba(15, 23, 42, 0.7)",
          border: "1px solid rgba(51, 65, 85, 0.5)",
          borderRadius: "10px",
          padding: "12px 14px",
          borderTop: `3px solid ${getHealthColor(tHealth)}`
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              Temperature Probe
            </span>
            <Thermometer size={16} color="#fb923c" />
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: getHealthColor(tHealth) }}>
            {tHealth.toFixed(1)}%
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>Status: {getHealthStatus(tHealth)}</span>
        </div>

        {/* Pressure Health */}
        <div style={{
          background: "rgba(15, 23, 42, 0.7)",
          border: "1px solid rgba(51, 65, 85, 0.5)",
          borderRadius: "10px",
          padding: "12px 14px",
          borderTop: `3px solid ${getHealthColor(pHealth)}`
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              Pressure Transducer
            </span>
            <Gauge size={16} color="#22d3ee" />
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: getHealthColor(pHealth) }}>
            {pHealth.toFixed(1)}%
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>Status: {getHealthStatus(pHealth)}</span>
        </div>

        {/* Humidity Health */}
        <div style={{
          background: "rgba(15, 23, 42, 0.7)",
          border: "1px solid rgba(51, 65, 85, 0.5)",
          borderRadius: "10px",
          padding: "12px 14px",
          borderTop: `3px solid ${getHealthColor(hHealth)}`
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              Humidity Sensor
            </span>
            <Droplets size={16} color="#60a5fa" />
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: getHealthColor(hHealth) }}>
            {hHealth.toFixed(1)}%
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>Status: {getHealthStatus(hHealth)}</span>
        </div>

      </div>

      {/* Actionable Maintenance Advisory */}
      <div>
        <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600" }}>
          Predictive Maintenance Recommendations:
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
          {recommendations.length > 0 ? (
            recommendations.map((rec, i) => (
              <div key={i} style={{
                background: "rgba(30, 41, 59, 0.6)",
                border: "1px solid rgba(71, 85, 105, 0.4)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "13px",
                color: "#e2e8f0",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}>
                <span style={{ color: isMaintenanceRequired ? "#f59e0b" : "#34d399", marginTop: "2px" }}>
                  {isMaintenanceRequired ? "⚠️" : "✓"}
                </span>
                <span>{rec}</span>
              </div>
            ))
          ) : (
            <div style={{ color: "#64748b", fontSize: "12px" }}>No maintenance needed. Scheduled periodic audit nominal.</div>
          )}
        </div>
      </div>
    </div>
  );
}
