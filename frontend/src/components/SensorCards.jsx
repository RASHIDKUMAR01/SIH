import React from "react";
import { Thermometer, Gauge, Droplets, ArrowUpRight, ArrowDownRight, Minus, AlertCircle } from "lucide-react";

export default function SensorCards({ currentTelemetry, sensorHealth, history }) {
  const temp = currentTelemetry?.temperature;
  const press = currentTelemetry?.pressure;
  const hum = currentTelemetry?.humidity;

  const affected = currentTelemetry?.affected_parameters || [];
  const anomalyType = currentTelemetry?.anomaly_type || "NORMAL";

  const tHealth = sensorHealth?.temperature_health ?? 100.0;
  const pHealth = sensorHealth?.pressure_health ?? 100.0;
  const hHealth = sensorHealth?.humidity_health ?? 100.0;

  // Calculate 1-step delta from history if available
  let tDiff = 0, pDiff = 0, hDiff = 0;
  if (history && history.length >= 2) {
    const curr = history[history.length - 1];
    const prev = history[history.length - 2];
    if (curr.temperature != null && prev.temperature != null) tDiff = curr.temperature - prev.temperature;
    if (curr.pressure != null && prev.pressure != null) pDiff = curr.pressure - prev.pressure;
    if (curr.humidity != null && prev.humidity != null) hDiff = curr.humidity - prev.humidity;
  }

  // Dew point approximation
  const calcDewPoint = (t, rh) => {
    if (t == null || rh == null || rh <= 0) return "--";
    const a = 17.27, b = 237.7;
    const alpha = ((a * t) / (b + t)) + Math.log(Math.min(100, Math.max(0.1, rh)) / 100);
    return ((b * alpha) / (a - alpha)).toFixed(1);
  };

  const dewPoint = calcDewPoint(temp, hum);

  const getDeltaIcon = (diff) => {
    if (Math.abs(diff) < 0.05) return <Minus size={14} color="#94a3b8" />;
    if (diff > 0) return <ArrowUpRight size={14} color="#f87171" />;
    return <ArrowDownRight size={14} color="#38bdf8" />;
  };

  const getHealthColor = (score) => {
    if (score >= 85) return "#34d399";
    if (score >= 65) return "#fbbf24";
    return "#f87171";
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "24px" }}>
      
      {/* 1. TEMPERATURE CARD */}
      <div className="glass-panel" style={{
        padding: "20px",
        position: "relative",
        overflow: "hidden",
        borderLeft: affected.includes("temperature") ? "4px solid #f87171" : "4px solid #f97316",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(249, 115, 22, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fb923c",
            }}>
              <Thermometer size={22} />
            </div>
            <div>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase" }}>
                Ambient Temperature
              </span>
              <div style={{ fontSize: "11px", color: "#64748b" }}>RTD Pt100 / Thermistor</div>
            </div>
          </div>

          <span className={`badge ${affected.includes("temperature") ? "badge-critical" : "badge-normal"}`}>
            {affected.includes("temperature") ? anomalyType : "Nominal"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", margin: "14px 0" }}>
          <span style={{ fontSize: "36px", fontWeight: "800", color: "#f8fafc", fontFamily: "var(--font-mono)" }}>
            {temp != null ? `${temp.toFixed(1)}` : "N/A"}
          </span>
          <span style={{ fontSize: "20px", fontWeight: "600", color: "#fb923c" }}>°C</span>
          
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#cbd5e1" }}>
            {getDeltaIcon(tDiff)}
            <span>{tDiff > 0 ? `+${tDiff.toFixed(2)}` : tDiff.toFixed(2)} °C/min</span>
          </div>
        </div>

        {/* Health Bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
            <span style={{ color: "#94a3b8" }}>Sensor Health</span>
            <span style={{ fontWeight: "700", color: getHealthColor(tHealth) }}>{tHealth.toFixed(1)}%</span>
          </div>
          <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${tHealth}%`, background: getHealthColor(tHealth), transition: "width 0.5s ease" }} />
          </div>
        </div>
      </div>

      {/* 2. ATMOSPHERIC PRESSURE CARD */}
      <div className="glass-panel" style={{
        padding: "20px",
        position: "relative",
        overflow: "hidden",
        borderLeft: affected.includes("pressure") ? "4px solid #f87171" : "4px solid #06b6d4",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(6, 182, 212, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#22d3ee",
            }}>
              <Gauge size={22} />
            </div>
            <div>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase" }}>
                Barometric Pressure
              </span>
              <div style={{ fontSize: "11px", color: "#64748b" }}>Piezoresistive Transducer</div>
            </div>
          </div>

          <span className={`badge ${affected.includes("pressure") ? "badge-critical" : "badge-normal"}`}>
            {affected.includes("pressure") ? anomalyType : "Nominal"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", margin: "14px 0" }}>
          <span style={{ fontSize: "36px", fontWeight: "800", color: "#f8fafc", fontFamily: "var(--font-mono)" }}>
            {press != null ? `${press.toFixed(1)}` : "N/A"}
          </span>
          <span style={{ fontSize: "18px", fontWeight: "600", color: "#22d3ee" }}>hPa</span>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#cbd5e1" }}>
            {getDeltaIcon(pDiff)}
            <span>{pDiff > 0 ? `+${pDiff.toFixed(2)}` : pDiff.toFixed(2)} hPa/min</span>
          </div>
        </div>

        {/* Health Bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
            <span style={{ color: "#94a3b8" }}>Sensor Health</span>
            <span style={{ fontWeight: "700", color: getHealthColor(pHealth) }}>{pHealth.toFixed(1)}%</span>
          </div>
          <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pHealth}%`, background: getHealthColor(pHealth), transition: "width 0.5s ease" }} />
          </div>
        </div>
      </div>

      {/* 3. RELATIVE HUMIDITY CARD */}
      <div className="glass-panel" style={{
        padding: "20px",
        position: "relative",
        overflow: "hidden",
        borderLeft: affected.includes("humidity") ? "4px solid #f87171" : "4px solid #3b82f6",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(59, 130, 246, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#60a5fa",
            }}>
              <Droplets size={22} />
            </div>
            <div>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase" }}>
                Relative Humidity
              </span>
              <div style={{ fontSize: "11px", color: "#64748b" }}>Capacitive Polymer Sensor</div>
            </div>
          </div>

          <span className={`badge ${affected.includes("humidity") ? "badge-critical" : "badge-normal"}`}>
            {affected.includes("humidity") ? anomalyType : "Nominal"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", margin: "14px 0" }}>
          <span style={{ fontSize: "36px", fontWeight: "800", color: "#f8fafc", fontFamily: "var(--font-mono)" }}>
            {hum != null ? `${hum.toFixed(1)}` : "N/A"}
          </span>
          <span style={{ fontSize: "20px", fontWeight: "600", color: "#60a5fa" }}>%</span>

          <div style={{ marginLeft: "auto", fontSize: "12px", color: "#cbd5e1" }}>
            <span style={{ color: "#94a3b8" }}>Dew Point: </span>
            <strong style={{ color: "#38bdf8" }}>{dewPoint} °C</strong>
          </div>
        </div>

        {/* Health Bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
            <span style={{ color: "#94a3b8" }}>Sensor Health</span>
            <span style={{ fontWeight: "700", color: getHealthColor(hHealth) }}>{hHealth.toFixed(1)}%</span>
          </div>
          <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${hHealth}%`, background: getHealthColor(hHealth), transition: "width 0.5s ease" }} />
          </div>
        </div>
      </div>

    </div>
  );
}
