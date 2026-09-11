import React, { useState } from "react";
import { History, Filter, AlertCircle, Eye, ShieldCheck, ShieldAlert, FileText, Download } from "lucide-react";

export default function AnomalyHistory({ anomalies, onFilterChange }) {
  const [selectedSeverity, setSelectedSeverity] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");
  const [expandedId, setExpandedId] = useState(null);

  const handleSeveritySelect = (sev) => {
    setSelectedSeverity(sev);
    if (onFilterChange) onFilterChange(sev, selectedType);
  };

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    if (onFilterChange) onFilterChange(selectedSeverity, type);
  };

  const exportCSV = () => {
    if (!anomalies || anomalies.length === 0) return;
    const headers = ["ID", "Timestamp", "Station", "Anomaly_Type", "Severity", "Confidence", "Temperature", "Pressure", "Humidity", "Wind", "Explanation"];
    const rows = anomalies.map((a) => [
      a.id,
      a.timestamp,
      a.station_id || "AWS-TINKER-01",
      a.anomaly_type,
      a.severity,
      ((a.confidence || 0) * 100).toFixed(1) + "%",
      a.temperature ?? "",
      a.pressure ?? "",
      a.humidity ?? "",
      a.wind_speed ?? "",
      `"${(a.explanation || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SkyGuard_Anomaly_History_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-panel" style={{ padding: "22px", marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <History size={22} color="#38bdf8" />
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
              Historical Anomaly & Multi-Model Incident Log
            </h2>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>
              Persistent SQLite Telemetry Audit ({anomalies?.length || 0} incidents recorded)
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Severity Filter Badges */}
          <div style={{ display: "flex", gap: "6px" }}>
            {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
              <button
                key={sev}
                onClick={() => handleSeveritySelect(sev)}
                className="btn-control"
                style={{
                  background: selectedSeverity === sev ? "rgba(56, 189, 248, 0.2)" : "rgba(15, 23, 42, 0.6)",
                  borderColor: selectedSeverity === sev ? "#38bdf8" : "rgba(51, 65, 85, 0.5)",
                  color: selectedSeverity === sev ? "#38bdf8" : "#94a3b8",
                  fontSize: "11px",
                  padding: "4px 10px",
                }}
              >
                {sev}
              </button>
            ))}
          </div>

          <button
            onClick={exportCSV}
            className="btn-control"
            style={{ fontSize: "11px", padding: "4px 10px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Anomalies Table / List */}
      <div style={{ maxHeight: "380px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
        {anomalies && anomalies.length > 0 ? (
          anomalies.map((anom) => {
            let timeStr = anom.timestamp;
            try {
              const dt = new Date(anom.timestamp);
              timeStr = dt.toUTCString().replace("GMT", "UTC");
            } catch {}

            const isExpanded = expandedId === anom.id;
            const models = anom.models || {};
            const ifRes = models.isolation_forest?.is_anomaly !== undefined ? (models.isolation_forest.is_anomaly ? "ANOMALY" : "NORMAL") : "ANOMALY";
            const lstmRes = models.lstm_autoencoder?.is_anomaly !== undefined ? (models.lstm_autoencoder.is_anomaly ? "ANOMALY" : "NORMAL") : "ANOMALY";
            const isAgreement = ifRes === lstmRes;

            return (
              <div
                key={anom.id}
                onClick={() => setExpandedId(isExpanded ? null : anom.id)}
                style={{
                  background: "rgba(15, 23, 42, 0.7)",
                  border: isExpanded ? "1px solid #38bdf8" : "1px solid rgba(51, 65, 85, 0.6)",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className={`badge badge-${(anom.severity || "medium").toLowerCase()}`}>
                      {anom.severity}
                    </span>
                    <strong style={{ color: "#f8fafc", fontSize: "13px", fontFamily: "var(--font-mono)" }}>
                      {anom.anomaly_type}
                    </strong>
                    <span style={{ fontSize: "11px", color: "#38bdf8" }}>
                      ({((anom.confidence || 0.8) * 100).toFixed(0)}% conf)
                    </span>
                  </div>

                  {/* Dual Model Result Indicators */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" }}>
                    <span style={{ color: "#94a3b8" }}>IF: <strong style={{ color: ifRes === "ANOMALY" ? "#f87171" : "#34d399" }}>{ifRes}</strong></span>
                    <span style={{ color: "#475569" }}>|</span>
                    <span style={{ color: "#94a3b8" }}>LSTM: <strong style={{ color: lstmRes === "ANOMALY" ? "#f87171" : "#34d399" }}>{lstmRes}</strong></span>
                    <span style={{ color: "#475569" }}>|</span>
                    <span style={{
                      background: isAgreement ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                      color: isAgreement ? "#34d399" : "#fbbf24",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: "700",
                    }}>
                      {isAgreement ? "AGREED" : "DISPUTE"}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", color: "#94a3b8" }}>
                    <span>Node: <strong style={{ color: "#cbd5e1" }}>{anom.station_id || "AWS-TINKER-01"}</strong></span>
                    <span style={{ fontFamily: "monospace", color: "#64748b" }}>{timeStr}</span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{
                    marginTop: "12px",
                    paddingTop: "12px",
                    borderTop: "1px solid rgba(51, 65, 85, 0.5)",
                    fontSize: "12px",
                    color: "#cbd5e1",
                    lineHeight: "1.5",
                  }}>
                    <div style={{ fontWeight: "600", color: "#f8fafc", marginBottom: "4px" }}>
                      Final AI Interpretation & Root Cause:
                    </div>
                    <p style={{ margin: "0 0 8px 0", color: "#e2e8f0" }}>{anom.explanation}</p>
                    <div style={{ display: "flex", gap: "16px", color: "#94a3b8", fontSize: "11px", flexWrap: "wrap" }}>
                      <span>Temperature: <strong style={{ color: "#cbd5e1" }}>{anom.temperature != null ? `${anom.temperature.toFixed(1)}°C` : "N/A"}</strong></span>
                      <span>Pressure: <strong style={{ color: "#cbd5e1" }}>{anom.pressure != null ? `${anom.pressure.toFixed(1)} hPa` : "N/A"}</strong></span>
                      <span>Humidity: <strong style={{ color: "#cbd5e1" }}>{anom.humidity != null ? `${anom.humidity.toFixed(1)}%` : "N/A"}</strong></span>
                      <span>Wind Speed: <strong style={{ color: "#cbd5e1" }}>{anom.wind_speed != null ? `${anom.wind_speed.toFixed(1)} m/s` : "N/A"}</strong></span>
                      <span>Affected Sensors: <strong style={{ color: "#f87171" }}>{Array.isArray(anom.affected_parameters) ? anom.affected_parameters.join(", ") : "None"}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: "center", padding: "36px", color: "#64748b", fontSize: "13px" }}>
            No anomaly incident records match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
