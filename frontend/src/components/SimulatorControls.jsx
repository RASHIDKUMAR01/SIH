import React, { useState } from "react";
import { Zap, Flame, Snowflake, PauseCircle, TrendingUp, Unplug, RefreshCcw, Sliders } from "lucide-react";

export default function SimulatorControls({ onInjectAnomaly, isInjecting }) {
  const [duration, setDuration] = useState(8);
  const [activeNotification, setActiveNotification] = useState(null);

  const handleInject = async (type, name, params = {}) => {
    setActiveNotification(`Injecting ${name} (${duration} intervals)...`);
    await onInjectAnomaly(type, duration, params);
    setTimeout(() => setActiveNotification(null), 3500);
  };

  return (
    <div className="glass-panel" style={{ padding: "20px", marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Zap size={20} color="#f59e0b" />
          <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
            Live Anomaly Injection & Stress Testing Console
          </h2>
        </div>

        {/* Duration Slider */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: "#cbd5e1" }}>
          <span>Duration: <strong>{duration} steps</strong></span>
          <input
            type="range"
            min="2"
            max="30"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ width: "90px", accentColor: "#38bdf8", cursor: "pointer" }}
          />
        </div>
      </div>

      {activeNotification && (
        <div style={{
          background: "rgba(245, 158, 11, 0.15)",
          border: "1px solid rgba(245, 158, 11, 0.4)",
          borderRadius: "8px",
          padding: "8px 12px",
          fontSize: "12px",
          color: "#fef08a",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}>
          <Zap size={14} />
          {activeNotification}
        </div>
      )}

      {/* Buttons Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
        
        {/* Temperature Spike */}
        <button
          onClick={() => handleInject("temperature_spike", "Temperature Spike", { magnitude: 18.0 })}
          disabled={isInjecting}
          className="btn-inject"
        >
          <Flame size={16} color="#fb923c" />
          <span>Temp Spike (+18°C)</span>
        </button>

        {/* Temperature Drop */}
        <button
          onClick={() => handleInject("temperature_drop", "Temperature Drop", { magnitude: 15.0 })}
          disabled={isInjecting}
          className="btn-inject"
        >
          <Snowflake size={16} color="#38bdf8" />
          <span>Temp Drop (-15°C)</span>
        </button>

        {/* Frozen Sensor */}
        <button
          onClick={() => handleInject("frozen_sensor", "Frozen Sensor (Zero Variance)", { target_sensor: "temperature" })}
          disabled={isInjecting}
          className="btn-inject"
        >
          <PauseCircle size={16} color="#a855f7" />
          <span>Frozen Sensor</span>
        </button>

        {/* Sensor Drift */}
        <button
          onClick={() => handleInject("sensor_drift", "Sensor Calibration Drift", { drift_rate: 0.8, target_sensor: "temperature" })}
          disabled={isInjecting}
          className="btn-inject"
        >
          <TrendingUp size={16} color="#fbbf24" />
          <span>Sensor Drift</span>
        </button>

        {/* Missing Data */}
        <button
          onClick={() => handleInject("missing_data", "Telemetry Packet Dropout", { target_sensor: "temperature" })}
          disabled={isInjecting}
          className="btn-inject"
        >
          <Unplug size={16} color="#f87171" />
          <span>Missing Data</span>
        </button>

        {/* Multivariate Inconsistency */}
        <button
          onClick={() => handleInject("multivariate_inconsistency", "Multivariate Inconsistency (45°C + 95% RH)")}
          disabled={isInjecting}
          className="btn-inject"
        >
          <Sliders size={16} color="#ec4899" />
          <span>Multivariate Clash</span>
        </button>

        {/* Normal Baseline */}
        <button
          onClick={() => handleInject("normal", "Nominal Normal Baseline")}
          disabled={isInjecting}
          className="btn-inject"
          style={{ borderColor: "rgba(16, 185, 129, 0.4)", color: "#34d399" }}
        >
          <RefreshCcw size={16} color="#34d399" />
          <span>Reset to Normal</span>
        </button>

      </div>
    </div>
  );
}
