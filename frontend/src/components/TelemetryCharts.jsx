import React, { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceArea,
  Dot,
} from "recharts";
import { LineChart as ChartIcon, Layers, Thermometer, Gauge, Droplets, HeartPulse } from "lucide-react";

export default function TelemetryCharts({ history }) {
  const [activeTab, setActiveTab] = useState("combined");

  // Format timestamp for chart X-axis
  const formattedData = (history || []).map((d) => {
    let timeLabel = "";
    try {
      const dt = new Date(d.timestamp);
      timeLabel = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      timeLabel = d.timestamp;
    }

    return {
      ...d,
      timeLabel,
      temp_val: d.temperature,
      press_val: d.pressure,
      hum_val: d.humidity,
      temp_health: d.sensor_health?.temperature ?? 100,
      press_health: d.sensor_health?.pressure ?? 100,
      hum_health: d.sensor_health?.humidity ?? 100,
      overall_health: d.sensor_health?.overall ?? 100,
    };
  });

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div style={{
          background: "rgba(15, 23, 42, 0.95)",
          border: "1px solid rgba(56, 189, 248, 0.4)",
          borderRadius: "8px",
          padding: "10px 14px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
          fontSize: "12px",
        }}>
          <div style={{ color: "#94a3b8", marginBottom: "6px", fontFamily: "var(--font-mono)" }}>
            🕒 {dataPoint.timeLabel} ({dataPoint.timestamp})
          </div>
          {payload.map((entry, index) => (
            <div key={`item-${index}`} style={{ color: entry.color, display: "flex", justifyContent: "space-between", gap: "16px", margin: "2px 0" }}>
              <span>{entry.name}:</span>
              <strong>{typeof entry.value === "number" ? entry.value.toFixed(2) : entry.value}</strong>
            </div>
          ))}
          {dataPoint.is_anomaly && (
            <div style={{ marginTop: "8px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "6px" }}>
              <span className={`badge badge-${(dataPoint.severity || "medium").toLowerCase()}`}>
                ⚠️ {dataPoint.anomaly_type} ({((dataPoint.confidence || 0) * 100).toFixed(0)}%)
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Customized Anomaly Dot Render
  const renderAnomalyDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload.is_anomaly) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill="#ef4444"
          stroke="#fee2e2"
          strokeWidth={2}
          key={`dot-${payload.timestamp}`}
        />
      );
    }
    return <circle cx={cx} cy={cy} r={2} fill="#38bdf8" key={`dot-${payload.timestamp}`} />;
  };

  return (
    <div className="glass-panel" style={{ padding: "20px", marginBottom: "24px" }}>
      {/* Tab Switcher & Chart Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ChartIcon size={20} color="#38bdf8" />
          <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
            Live Telemetry Time-Series
          </h2>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            ({formattedData.length} records in buffer)
          </span>
        </div>

        {/* View Selection Tabs */}
        <div style={{ display: "flex", gap: "6px", background: "rgba(15, 23, 42, 0.7)", padding: "4px", borderRadius: "8px", border: "1px solid rgba(51, 65, 85, 0.5)" }}>
          <button
            onClick={() => setActiveTab("combined")}
            className="btn-control"
            style={{
              background: activeTab === "combined" ? "#0284c7" : "transparent",
              border: "none",
              color: activeTab === "combined" ? "#fff" : "#94a3b8",
              fontSize: "12px",
              padding: "6px 12px",
            }}
          >
            <Layers size={13} /> Tri-Sensor
          </button>
          <button
            onClick={() => setActiveTab("temperature")}
            className="btn-control"
            style={{
              background: activeTab === "temperature" ? "#ea580c" : "transparent",
              border: "none",
              color: activeTab === "temperature" ? "#fff" : "#94a3b8",
              fontSize: "12px",
              padding: "6px 12px",
            }}
          >
            <Thermometer size={13} /> Temp (°C)
          </button>
          <button
            onClick={() => setActiveTab("pressure")}
            className="btn-control"
            style={{
              background: activeTab === "pressure" ? "#0891b2" : "transparent",
              border: "none",
              color: activeTab === "pressure" ? "#fff" : "#94a3b8",
              fontSize: "12px",
              padding: "6px 12px",
            }}
          >
            <Gauge size={13} /> Pressure (hPa)
          </button>
          <button
            onClick={() => setActiveTab("humidity")}
            className="btn-control"
            style={{
              background: activeTab === "humidity" ? "#2563eb" : "transparent",
              border: "none",
              color: activeTab === "humidity" ? "#fff" : "#94a3b8",
              fontSize: "12px",
              padding: "6px 12px",
            }}
          >
            <Droplets size={13} /> Humidity (%)
          </button>
          <button
            onClick={() => setActiveTab("health")}
            className="btn-control"
            style={{
              background: activeTab === "health" ? "#059669" : "transparent",
              border: "none",
              color: activeTab === "health" ? "#fff" : "#94a3b8",
              fontSize: "12px",
              padding: "6px 12px",
            }}
          >
            <HeartPulse size={13} /> Health (%)
          </button>
        </div>
      </div>

      {/* Recharts Canvas */}
      <div style={{ width: "100%", height: "320px" }}>
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === "combined" && (
            <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.4)" />
              <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={11} />
              <YAxis yAxisId="temp" orientation="left" stroke="#fb923c" domain={["auto", "auto"]} fontSize={11} />
              <YAxis yAxisId="press" orientation="right" stroke="#22d3ee" domain={["auto", "auto"]} fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
              <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#fb923c" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line yAxisId="press" type="monotone" dataKey="pressure" name="Pressure (hPa)" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line yAxisId="temp" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            </LineChart>
          )}

          {activeTab === "temperature" && (
            <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.4)" />
              <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#fb923c" domain={["auto", "auto"]} fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="temperature" name="Temperature (°C)" stroke="#fb923c" strokeWidth={2.5} dot={renderAnomalyDot} isAnimationActive={false} />
            </LineChart>
          )}

          {activeTab === "pressure" && (
            <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.4)" />
              <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#22d3ee" domain={["auto", "auto"]} fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="pressure" name="Barometric Pressure (hPa)" stroke="#22d3ee" strokeWidth={2.5} dot={renderAnomalyDot} isAnimationActive={false} />
            </LineChart>
          )}

          {activeTab === "humidity" && (
            <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.4)" />
              <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#60a5fa" domain={[0, 100]} fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="humidity" name="Relative Humidity (%)" stroke="#60a5fa" strokeWidth={2.5} dot={renderAnomalyDot} isAnimationActive={false} />
            </LineChart>
          )}

          {activeTab === "health" && (
            <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.4)" />
              <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#34d399" domain={[0, 100]} fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="overall_health" name="Station Overall Health (%)" stroke="#34d399" strokeWidth={3} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="temp_health" name="Temp Sensor (%)" stroke="#fb923c" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="press_health" name="Pressure Sensor (%)" stroke="#22d3ee" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="hum_health" name="Humidity Sensor (%)" stroke="#60a5fa" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
