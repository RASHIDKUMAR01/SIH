import React, { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, BarChart3, ShieldCheck, RefreshCw } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { uploadCsvDataset } from "../services/api";

export default function CsvUploader({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.name.toLowerCase().endsWith(".csv")) {
        setError("Please select a valid .csv file.");
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  const handleUpload = async (e) => {
    if (e) e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const res = await uploadCsvDataset(file, true);
      setResult(res);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      setError(err.message || "Failed to process CSV file");
    } finally {
      setLoading(false);
    }
  };

  const renderAnomalyDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload.is_anomaly) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={5}
          fill="#ef4444"
          stroke="#fee2e2"
          strokeWidth={1.5}
          key={`csv-dot-${payload.timestamp}`}
        />
      );
    }
    return <circle cx={cx} cy={cy} r={1.5} fill="#38bdf8" key={`csv-dot-${payload.timestamp}`} />;
  };

  return (
    <div className="glass-panel" style={{ padding: "20px", marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <UploadCloud size={22} color="#38bdf8" />
          <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
            AWS Historical Dataset Batch Ingestion & Analyzer (CSV)
          </h2>
        </div>
        <span style={{ fontSize: "12px", color: "#94a3b8" }}>
          Expected Columns: <strong style={{ color: "#cbd5e1" }}>timestamp, temperature, pressure, humidity</strong>
        </span>
      </div>

      {/* Upload Box */}
      <div style={{
        border: "2px dashed rgba(56, 189, 248, 0.3)",
        borderRadius: "12px",
        padding: "24px",
        textAlign: "center",
        background: "rgba(15, 23, 42, 0.5)",
        marginBottom: "18px",
      }}>
        <input
          type="file"
          accept=".csv"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <FileText size={36} color={file ? "#34d399" : "#64748b"} />
          <div>
            {file ? (
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#f8fafc" }}>
                Selected: <strong style={{ color: "#38bdf8" }}>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
              </span>
            ) : (
              <span style={{ fontSize: "13px", color: "#94a3b8" }}>
                Drag and drop your Automatic Weather Station CSV file here, or browse from disk
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-control"
              style={{ fontSize: "12px" }}
            >
              Browse CSV File
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="btn-control btn-primary"
              style={{ fontSize: "12px" }}
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <UploadCloud size={14} />}
              {loading ? "Running ML Pipeline..." : "Upload & Analyze Batch"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          background: "rgba(220, 38, 38, 0.15)",
          border: "1px solid rgba(239, 68, 68, 0.4)",
          borderRadius: "8px",
          padding: "10px 14px",
          color: "#f87171",
          fontSize: "12px",
          marginBottom: "16px",
        }}>
          ❌ {error}
        </div>
      )}

      {/* Uploaded Dataset Summary Results */}
      {result && (
        <div style={{ marginTop: "20px" }}>
          
          {/* Summary Metric Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "18px" }}>
            <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(51, 65, 85, 0.6)", borderRadius: "10px", padding: "12px 16px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase" }}>Processed Records</div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#f8fafc", fontFamily: "var(--font-mono)" }}>
                {result.total_records.toLocaleString()}
              </div>
            </div>

            <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(51, 65, 85, 0.6)", borderRadius: "10px", padding: "12px 16px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase" }}>Anomalies Detected</div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#f87171", fontFamily: "var(--font-mono)" }}>
                {result.total_anomalies.toLocaleString()}
              </div>
            </div>

            <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(51, 65, 85, 0.6)", borderRadius: "10px", padding: "12px 16px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase" }}>Anomaly Rate</div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#fbbf24", fontFamily: "var(--font-mono)" }}>
                {result.anomaly_percentage}%
              </div>
            </div>

            <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(51, 65, 85, 0.6)", borderRadius: "10px", padding: "12px 16px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase" }}>Final Station Health</div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#34d399", fontFamily: "var(--font-mono)" }}>
                {result.final_sensor_health?.overall_health?.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Anomaly Breakdown Pills */}
          <div style={{ marginBottom: "18px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600" }}>Detected Anomaly Classification Breakdown:</span>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
              {Object.entries(result.anomaly_types_breakdown || {}).map(([type, count]) => (
                <div key={type} style={{
                  background: type === "NORMAL" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  border: type === "NORMAL" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  color: type === "NORMAL" ? "#34d399" : "#fca5a5",
                }}>
                  <strong>{type}</strong>: {count}
                </div>
              ))}
            </div>
          </div>

          {/* Time Series Chart of Uploaded Batch */}
          {result.preview_records && result.preview_records.length > 0 && (
            <div style={{ marginBottom: "18px" }}>
              <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", marginBottom: "8px", display: "block" }}>
                Uploaded Batch Time-Series Visualization:
              </span>
              <div style={{ height: "260px", background: "rgba(15, 23, 42, 0.6)", borderRadius: "10px", padding: "10px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.preview_records}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.4)" />
                    <XAxis dataKey="timestamp" stroke="#64748b" fontSize={10} tickFormatter={(v) => v.slice(11, 19) || v} />
                    <YAxis yAxisId="temp" stroke="#fb923c" domain={["auto", "auto"]} fontSize={10} />
                    <YAxis yAxisId="press" orientation="right" stroke="#22d3ee" domain={["auto", "auto"]} fontSize={10} />
                    <Tooltip contentStyle={{ background: "rgba(15, 23, 42, 0.95)", border: "1px solid #38bdf8", fontSize: "12px" }} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#fb923c" strokeWidth={2} dot={renderAnomalyDot} isAnimationActive={false} />
                    <Line yAxisId="press" type="monotone" dataKey="pressure" name="Pressure (hPa)" stroke="#22d3ee" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    <Line yAxisId="temp" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Final Sensor Health Breakdown */}
          <div style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(51, 65, 85, 0.5)",
            borderRadius: "10px",
            padding: "14px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <ShieldCheck size={18} color="#34d399" />
              <strong style={{ color: "#f8fafc", fontSize: "13px" }}>Dataset Maintenance Audit:</strong>
            </div>
            <div style={{ display: "flex", gap: "20px", fontSize: "12px", color: "#cbd5e1", flexWrap: "wrap", marginBottom: "8px" }}>
              <span>Temp Health: <strong style={{ color: "#fb923c" }}>{result.final_sensor_health?.temperature_health?.toFixed(1)}%</strong></span>
              <span>Pressure Health: <strong style={{ color: "#22d3ee" }}>{result.final_sensor_health?.pressure_health?.toFixed(1)}%</strong></span>
              <span>Humidity Health: <strong style={{ color: "#60a5fa" }}>{result.final_sensor_health?.humidity_health?.toFixed(1)}%</strong></span>
            </div>
            {result.final_sensor_health?.recommendations?.map((rec, i) => (
              <div key={i} style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                • {rec}
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
