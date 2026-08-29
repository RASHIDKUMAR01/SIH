import React, { useState } from "react";
import { PlayCircle, Send, CheckCircle2, AlertOctagon, Terminal } from "lucide-react";
import { analyzeCustomReading } from "../services/api";

export default function AdHocAnalyzer({ onAnalysisComplete }) {
  const [temp, setTemp] = useState("48.5");
  const [press, setPress] = useState("1013.2");
  const [hum, setHum] = useState("60.0");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        temperature: temp !== "" ? parseFloat(temp) : null,
        pressure: press !== "" ? parseFloat(press) : null,
        humidity: hum !== "" ? parseFloat(hum) : null,
      };

      const res = await analyzeCustomReading(payload);
      setResult(res);
      if (onAnalysisComplete) onAnalysisComplete(res);
    } catch (err) {
      setError(err.message || "Failed to analyze telemetry reading");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: "20px", marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
        <Terminal size={20} color="#a855f7" />
        <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
          Interactive Ad-Hoc Telemetry Analyzer (Examiner Mode)
        </h2>
      </div>

      <form onSubmit={handleAnalyze} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", alignItems: "flex-end" }}>
        {/* Temperature Input */}
        <div>
          <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
            Temperature (°C):
          </label>
          <input
            type="number"
            step="0.1"
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            placeholder="e.g. 48.5"
            style={{
              width: "100%",
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(51, 65, 85, 0.8)",
              borderRadius: "8px",
              padding: "8px 12px",
              color: "#f8fafc",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>

        {/* Pressure Input */}
        <div>
          <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
            Pressure (hPa):
          </label>
          <input
            type="number"
            step="0.1"
            value={press}
            onChange={(e) => setPress(e.target.value)}
            placeholder="e.g. 1013.2"
            style={{
              width: "100%",
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(51, 65, 85, 0.8)",
              borderRadius: "8px",
              padding: "8px 12px",
              color: "#f8fafc",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>

        {/* Humidity Input */}
        <div>
          <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
            Humidity (%):
          </label>
          <input
            type="number"
            step="0.1"
            value={hum}
            onChange={(e) => setHum(e.target.value)}
            placeholder="e.g. 60.0"
            style={{
              width: "100%",
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(51, 65, 85, 0.8)",
              borderRadius: "8px",
              padding: "8px 12px",
              color: "#f8fafc",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={loading}
            className="btn-control btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "10px 16px" }}
          >
            <Send size={14} />
            {loading ? "Analyzing..." : "Evaluate Anomaly"}
          </button>
        </div>
      </form>

      {error && (
        <div style={{ marginTop: "12px", color: "#f87171", fontSize: "12px" }}>
          ❌ {error}
        </div>
      )}

      {result && (
        <div style={{
          marginTop: "16px",
          background: "rgba(15, 23, 42, 0.8)",
          border: result.is_anomaly ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(16, 185, 129, 0.4)",
          borderRadius: "8px",
          padding: "14px",
          fontSize: "13px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {result.is_anomaly ? <AlertOctagon size={18} color="#f87171" /> : <CheckCircle2 size={18} color="#34d399" />}
              <strong style={{ color: result.is_anomaly ? "#f87171" : "#34d399" }}>
                {result.anomaly_type}
              </strong>
              <span className={`badge badge-${result.severity.toLowerCase()}`}>
                {result.severity}
              </span>
            </div>

            <span style={{ color: "#38bdf8", fontWeight: "700" }}>
              Confidence: {(result.confidence * 100).toFixed(1)}%
            </span>
          </div>

          <p style={{ margin: "4px 0", color: "#cbd5e1", lineHeight: "1.4" }}>
            {result.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
