import React, { useState } from "react";
import { History, Filter, AlertCircle, Eye } from "lucide-react";

export default function AnomalyHistory({ anomalies, onFilterChange }) {
  const [selectedSeverity, setSelectedSeverity] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");
  const [expandedId, setExpandedId] = useState(null);

  const handleSeveritySelect = (sev) => {
    setSelectedSeverity(sev);
    onFilterChange(sev, selectedType);
  };

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    onFilterChange(selectedSeverity, type);
  };

  return (
    <div className="glass-panel" style={{ padding: "20px", marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <History size={20} color="#38bdf8" />
          <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
            Recent Anomaly Incident Log
          </h2>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            ({anomalies?.length || 0} incidents recorded)
          </span>
        </div>

        {/* Severity Filter Badges */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
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
      </div>

      {/* Anomalies Table / List */}
      <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
        {anomalies && anomalies.length > 0 ? (
          anomalies.map((anom) => {
            let timeStr = anom.timestamp;
            try {
              const dt = new Date(anom.timestamp);
              timeStr = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            } catch {}

            const isExpanded = expandedId === anom.id;

            return (
              <div
                key={anom.id}
                onClick={() => setExpandedId(isExpanded ? null : anom.id)}
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(51, 65, 85, 0.5)",
                  borderRadius: "8px",
                  padding: "10px 14px",
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
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      ({((anom.confidence || 0) * 100).toFixed(0)}% conf)
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "#94a3b8" }}>
                    <span>Channels: <strong style={{ color: "#cbd5e1" }}>{Array.isArray(anom.affected_parameters) ? anom.affected_parameters.join(", ") : "All"}</strong></span>
                    <span style={{ fontFamily: "monospace", color: "#64748b" }}>{timeStr}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{
                    marginTop: "10px",
                    paddingTop: "10px",
                    borderTop: "1px solid rgba(51, 65, 85, 0.5)",
                    fontSize: "12px",
                    color: "#cbd5e1",
                    lineHeight: "1.5",
                  }}>
                    <p style={{ margin: "0 0 6px 0" }}>{anom.explanation}</p>
                    <div style={{ display: "flex", gap: "16px", color: "#94a3b8", fontSize: "11px" }}>
                      <span>Temp: {anom.temperature != null ? `${anom.temperature.toFixed(1)}°C` : "N/A"}</span>
                      <span>Pressure: {anom.pressure != null ? `${anom.pressure.toFixed(1)} hPa` : "N/A"}</span>
                      <span>Humidity: {anom.humidity != null ? `${anom.humidity.toFixed(1)}%` : "N/A"}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: "center", padding: "30px", color: "#64748b", fontSize: "13px" }}>
            No anomaly incidents match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
