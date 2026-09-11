import React, { useState } from "react";
import {
  Activity,
  RotateCcw,
  Thermometer,
  Gauge,
  Droplets,
  Wind,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function LiveTelemetry({ currentTelemetry, history }) {
  const [bufferScope, setBufferScope] = useState(30); // 15, 30, 60, 100 pts
  const [clearedOffset, setClearedOffset] = useState(0);

  const temp = currentTelemetry?.temperature ?? 24.50;
  const press = currentTelemetry?.pressure ?? 1012.00;
  const hum = currentTelemetry?.humidity ?? 60.00;
  const wind = currentTelemetry?.wind_speed ?? 4.00;

  // Slice history according to selected bufferScope
  const rawData = (history || []).slice(clearedOffset);
  const slicedData = rawData.slice(-bufferScope);

  // If buffer is still filling up, format data with exact sample indices #0, #1, #2...
  const chartData = slicedData.map((d, idx) => ({
    ...d,
    sampleIdx: idx,
    indexLabel: `#${idx}`,
    temp_val: d.temperature != null ? Number(d.temperature.toFixed(2)) : null,
    press_val: d.pressure != null ? Number(d.pressure.toFixed(2)) : null,
    hum_val: d.humidity != null ? Number(d.humidity.toFixed(2)) : null,
    wind_val: d.wind_speed != null ? Number(d.wind_speed.toFixed(2)) : (d.wind != null ? Number(d.wind.toFixed(2)) : 4.0),
    is_anomaly: Boolean(d.is_anomaly),
    anomaly_type: d.anomaly_type || "NORMAL",
  }));

  // Handle reset/clear buffer
  const handleResetBuffer = () => {
    if (history && history.length > 0) {
      setClearedOffset(history.length);
    }
  };

  // Oscilloscope Custom Tooltip with crosshair dot and caret indicator
  const createOscilloscopeTooltip = (channelName, unit, color) => {
    return ({ active, payload }) => {
      if (active && payload && payload.length) {
        const point = payload[0].payload;
        const val = payload[0].value;
        return (
          <div style={{
            background: "rgba(10, 14, 23, 0.95)",
            border: `1px solid ${color}`,
            borderRadius: "6px",
            padding: "6px 12px",
            boxShadow: `0 0 15px rgba(0, 0, 0, 0.8), 0 0 8px ${color}40`,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "11px",
            color: "#f8fafc",
            pointerEvents: "none",
          }}>
            <div style={{ color: "#94a3b8", fontWeight: "700", marginBottom: "2px" }}>
              #{point.sampleIdx}
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={{ color: color, textTransform: "lowercase" }}>{channelName} :</span>
              <strong style={{ color: "#f8fafc" }}>
                {typeof val === "number" ? val.toFixed(2) : val} {unit}
              </strong>
            </div>
            {point.is_anomaly && (
              <div style={{
                color: "#f87171",
                fontWeight: "700",
                fontSize: "10px",
                marginTop: "4px",
                borderTop: "1px solid rgba(239, 68, 68, 0.3)",
                paddingTop: "2px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                ▲ ANOMALY: {point.anomaly_type}
              </div>
            )}
          </div>
        );
      }
      return null;
    };
  };

  // Customized dot rendering with caret marker for anomalies
  const renderAnomalyDot = (color) => {
    return (props) => {
      const { cx, cy, payload } = props;
      if (payload.is_anomaly) {
        return (
          <g key={`dot-${payload.sampleIdx}-${payload.timestamp}`}>
            <circle
              cx={cx}
              cy={cy}
              r={5}
              fill="#ffffff"
              stroke="#ef4444"
              strokeWidth={2.5}
            />
            {/* Red caret marker above anomaly peaks */}
            <text
              x={cx}
              y={cy - 10}
              textAnchor="middle"
              fill="#ef4444"
              fontSize="12"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              ▲
            </text>
          </g>
        );
      }
      return null;
    };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      
      {/* 1. TOP HEADER & BUFFER SCOPE CONTROLS */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
        padding: "4px 2px",
      }}>
        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Activity size={18} color="#38bdf8" />
          <h2 style={{
            fontSize: "13px",
            fontWeight: "800",
            color: "#f8fafc",
            letterSpacing: "0.8px",
            textTransform: "uppercase",
            margin: 0,
            fontFamily: "var(--font-mono, monospace)",
          }}>
            MULTI-CHANNEL SYNCHRONIZED OSCILLOSCOPE TELEMETRY
          </h2>
        </div>

        {/* Buffer Scope Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", fontFamily: "var(--font-mono, monospace)" }}>
            Buffer Scope:
          </span>

          <div style={{ display: "flex", gap: "4px", background: "rgba(15, 23, 42, 0.8)", padding: "3px", borderRadius: "6px", border: "1px solid rgba(51, 65, 85, 0.6)" }}>
            {[15, 30, 60, 100].map((pts) => {
              const isActive = bufferScope === pts;
              return (
                <button
                  key={pts}
                  type="button"
                  onClick={() => setBufferScope(pts)}
                  style={{
                    background: isActive ? "#0284c7" : "transparent",
                    color: isActive ? "#ffffff" : "#94a3b8",
                    border: "none",
                    borderRadius: "4px",
                    padding: "3px 10px",
                    fontSize: "11px",
                    fontWeight: isActive ? "700" : "500",
                    fontFamily: "var(--font-mono, monospace)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {pts} pts
                </button>
              );
            })}

            {/* Refresh / Reset buffer button */}
            <button
              type="button"
              onClick={handleResetBuffer}
              style={{
                background: "transparent",
                color: "#94a3b8",
                border: "none",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Reset Oscilloscope Buffer"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. 2x2 SYNCHRONIZED OSCILLOSCOPE CHANNELS GRID */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))",
        gap: "16px",
      }}>
        
        {/* ========================================================= */}
        {/* CHANNEL 1: TEMPERATURE (°C) */}
        {/* ========================================================= */}
        <div className="glass-panel" style={{
          padding: "16px 18px",
          background: "linear-gradient(180deg, rgba(13, 17, 28, 0.95) 0%, rgba(9, 13, 22, 0.98) 100%)",
          border: "1px solid rgba(51, 65, 85, 0.6)",
          borderRadius: "8px",
        }}>
          {/* Channel Header Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{
              fontSize: "12px",
              fontWeight: "800",
              color: "#fb7185",
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              CHANNEL 1: TEMPERATURE (°C)
            </span>
            <span style={{
              fontSize: "14px",
              fontWeight: "800",
              color: "#f8fafc",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              {temp.toFixed(2)} °C
            </span>
          </div>

          {/* Chart Canvas */}
          <div style={{ width: "100%", height: "200px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" />
                <XAxis
                  dataKey="indexLabel"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={{ stroke: "#475569" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  domain={[20, 100]}
                  ticks={[20, 40, 60, 80, 100]}
                  tickLine={{ stroke: "#475569" }}
                />
                <Tooltip
                  content={createOscilloscopeTooltip("temperature", "°C", "#fb7185")}
                  cursor={{ stroke: "rgba(255, 255, 255, 0.4)", strokeWidth: 1, strokeDasharray: "2 2" }}
                />
                <Line
                  type="monotone"
                  dataKey="temp_val"
                  stroke="#fb7185"
                  strokeWidth={2.2}
                  dot={renderAnomalyDot("#fb7185")}
                  activeDot={{ r: 5, fill: "#ffffff", stroke: "#fb7185", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CHANNEL 2: BAROMETRIC PRESSURE (hPa) */}
        {/* ========================================================= */}
        <div className="glass-panel" style={{
          padding: "16px 18px",
          background: "linear-gradient(180deg, rgba(13, 17, 28, 0.95) 0%, rgba(9, 13, 22, 0.98) 100%)",
          border: "1px solid rgba(51, 65, 85, 0.6)",
          borderRadius: "8px",
        }}>
          {/* Channel Header Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{
              fontSize: "12px",
              fontWeight: "800",
              color: "#38bdf8",
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              CHANNEL 2: BAROMETRIC PRESSURE (hPa)
            </span>
            <span style={{
              fontSize: "14px",
              fontWeight: "800",
              color: "#f8fafc",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              {press.toFixed(2)} hPa
            </span>
          </div>

          {/* Chart Canvas */}
          <div style={{ width: "100%", height: "200px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" />
                <XAxis
                  dataKey="indexLabel"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={{ stroke: "#475569" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  domain={[825, 1045]}
                  ticks={[825, 880, 935, 990, 1045]}
                  tickLine={{ stroke: "#475569" }}
                />
                <Tooltip
                  content={createOscilloscopeTooltip("pressure", "hPa", "#38bdf8")}
                  cursor={{ stroke: "rgba(255, 255, 255, 0.4)", strokeWidth: 1, strokeDasharray: "2 2" }}
                />
                <Line
                  type="monotone"
                  dataKey="press_val"
                  stroke="#38bdf8"
                  strokeWidth={2.2}
                  dot={renderAnomalyDot("#38bdf8")}
                  activeDot={{ r: 5, fill: "#ffffff", stroke: "#38bdf8", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CHANNEL 3: RELATIVE HUMIDITY (%) */}
        {/* ========================================================= */}
        <div className="glass-panel" style={{
          padding: "16px 18px",
          background: "linear-gradient(180deg, rgba(13, 17, 28, 0.95) 0%, rgba(9, 13, 22, 0.98) 100%)",
          border: "1px solid rgba(51, 65, 85, 0.6)",
          borderRadius: "8px",
        }}>
          {/* Channel Header Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{
              fontSize: "12px",
              fontWeight: "800",
              color: "#34d399",
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              CHANNEL 3: RELATIVE HUMIDITY (%)
            </span>
            <span style={{
              fontSize: "14px",
              fontWeight: "800",
              color: "#f8fafc",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              {hum.toFixed(2)} %
            </span>
          </div>

          {/* Chart Canvas */}
          <div style={{ width: "100%", height: "200px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" />
                <XAxis
                  dataKey="indexLabel"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={{ stroke: "#475569" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickLine={{ stroke: "#475569" }}
                />
                <Tooltip
                  content={createOscilloscopeTooltip("humidity", "%", "#34d399")}
                  cursor={{ stroke: "rgba(255, 255, 255, 0.4)", strokeWidth: 1, strokeDasharray: "2 2" }}
                />
                <Line
                  type="monotone"
                  dataKey="hum_val"
                  stroke="#34d399"
                  strokeWidth={2.2}
                  dot={renderAnomalyDot("#34d399")}
                  activeDot={{ r: 5, fill: "#ffffff", stroke: "#34d399", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CHANNEL 4: WIND SPEED (m/s) */}
        {/* ========================================================= */}
        <div className="glass-panel" style={{
          padding: "16px 18px",
          background: "linear-gradient(180deg, rgba(13, 17, 28, 0.95) 0%, rgba(9, 13, 22, 0.98) 100%)",
          border: "1px solid rgba(51, 65, 85, 0.6)",
          borderRadius: "8px",
        }}>
          {/* Channel Header Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{
              fontSize: "12px",
              fontWeight: "800",
              color: "#fbbf24",
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              CHANNEL 4: WIND SPEED (m/s)
            </span>
            <span style={{
              fontSize: "14px",
              fontWeight: "800",
              color: "#f8fafc",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              {wind.toFixed(2)} m/s
            </span>
          </div>

          {/* Chart Canvas */}
          <div style={{ width: "100%", height: "200px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" />
                <XAxis
                  dataKey="indexLabel"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={{ stroke: "#475569" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  domain={[0, 60]}
                  ticks={[0, 15, 30, 45, 60]}
                  tickLine={{ stroke: "#475569" }}
                />
                <Tooltip
                  content={createOscilloscopeTooltip("wind_speed", "m/s", "#fbbf24")}
                  cursor={{ stroke: "rgba(255, 255, 255, 0.4)", strokeWidth: 1, strokeDasharray: "2 2" }}
                />
                <Line
                  type="monotone"
                  dataKey="wind_val"
                  stroke="#fbbf24"
                  strokeWidth={2.2}
                  dot={renderAnomalyDot("#fbbf24")}
                  activeDot={{ r: 5, fill: "#ffffff", stroke: "#fbbf24", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
