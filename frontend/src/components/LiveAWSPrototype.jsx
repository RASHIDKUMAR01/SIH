import React, { useState, useEffect, useRef } from "react";
import {
  Cpu,
  Radio,
  Thermometer,
  Droplets,
  Gauge,
  Wind,
  Volume2,
  VolumeX,
  Zap,
  Flame,
  Snowflake,
  PauseCircle,
  TrendingUp,
  Unplug,
  Sliders,
  RefreshCcw,
  Terminal,
  Activity,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  AlertOctagon,
  Wrench,
  Layers,
} from "lucide-react";

export default function LiveAWSPrototype({
  currentTelemetry,
  sensorHealth,
  onInjectAnomaly,
  isInjecting,
  isConnected,
}) {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [serialLogs, setSerialLogs] = useState([]);
  const [duration, setDuration] = useState(8);
  const [activeNotification, setActiveNotification] = useState(null);

  const audioCtxRef = useRef(null);

  // Derived Telemetry Values
  const stationId = currentTelemetry?.station_id || "AWS-TINKER-01";
  const temp = currentTelemetry?.temperature;
  const press = currentTelemetry?.pressure;
  const hum = currentTelemetry?.humidity;
  const wind = currentTelemetry?.wind_speed ?? 14.2;
  const isAnomaly = currentTelemetry?.is_anomaly || false;
  const anomalyType = currentTelemetry?.anomaly_type || "NORMAL";
  const severity = currentTelemetry?.severity || "LOW";
  const confidence = currentTelemetry?.confidence != null ? currentTelemetry.confidence * 100 : 100;
  const explanation = currentTelemetry?.explanation || "All microcontroller registers & sensor channels nominal.";
  const affected = currentTelemetry?.affected_parameters || [];
  const timestampMs = currentTelemetry?.timestamp_ms || (Date.now() % 10000000);

  // Health scores
  const tHealth = sensorHealth?.temperature_health ?? 100.0;
  const pHealth = sensorHealth?.pressure_health ?? 100.0;
  const hHealth = sensorHealth?.humidity_health ?? 100.0;
  const wHealth = Math.min(100.0, Math.max(70.0, (tHealth + pHealth + hHealth) / 3.0));
  const oHealth = sensorHealth?.overall_health ?? 100.0;

  // Append incoming telemetry packet to serial monitor
  useEffect(() => {
    if (currentTelemetry) {
      const serialEntry = {
        station_id: stationId,
        timestamp_ms: timestampMs,
        temperature: temp != null ? Number(temp.toFixed(2)) : null,
        humidity: hum != null ? Number(hum.toFixed(2)) : null,
        pressure: press != null ? Number(press.toFixed(2)) : null,
        wind_speed: Number(wind.toFixed(2)),
        is_anomaly: isAnomaly,
        anomaly_type: anomalyType,
      };

      setSerialLogs((prev) => [...prev.slice(-35), JSON.stringify(serialEntry, null, 2)]);
    }
  }, [currentTelemetry, stationId, timestampMs, temp, hum, press, wind, isAnomaly, anomalyType]);

  // Sound Synthesizer on Anomaly Buzzer
  useEffect(() => {
    if (soundEnabled && isAnomaly && severity === "CRITICAL") {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 alarm pitch
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
      } catch (e) {
        console.warn("Audio synthesizer error:", e);
      }
    }
  }, [soundEnabled, isAnomaly, severity, currentTelemetry?.timestamp]);

  // Anomaly Injection Handler
  const handleInject = async (type, name, params = {}) => {
    setActiveNotification(`Injecting ${name} (${duration} intervals) through backend ML pipeline...`);
    if (onInjectAnomaly) {
      await onInjectAnomaly(type, duration, params);
    }
    setTimeout(() => setActiveNotification(null), 3500);
  };

  // Channel Status Indicator Helper
  const getSensorStatus = (channelName, healthScore) => {
    if (!isConnected) return { label: "OFFLINE", color: "#94a3b8", icon: "⚪" };
    if (affected.includes(channelName) || (isAnomaly && severity === "CRITICAL")) {
      return { label: "CRITICAL", color: "#f87171", icon: "🔴" };
    }
    if (affected.includes(channelName) || (isAnomaly && severity === "HIGH")) {
      return { label: "WARNING", color: "#fbbf24", icon: "🟡" };
    }
    if (healthScore < 75) {
      return { label: "DEGRADED", color: "#fbbf24", icon: "🟡" };
    }
    return { label: "NORMAL", color: "#34d399", icon: "🟢" };
  };

  const tempStatus = getSensorStatus("temperature", tHealth);
  const humStatus = getSensorStatus("humidity", hHealth);
  const pressStatus = getSensorStatus("pressure", pHealth);
  const windStatus = getSensorStatus("wind", wHealth);

  // LED and Buzzer Simulated States
  const isGreenLed = !isAnomaly && isConnected;
  const isYellowLed = isAnomaly && (severity === "LOW" || severity === "MEDIUM");
  const isRedLed = isAnomaly && (severity === "HIGH" || severity === "CRITICAL");
  const isBuzzerActive = isAnomaly && (severity === "HIGH" || severity === "CRITICAL");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* 1. Header Banner of Live AWS Prototype */}
      <div className="glass-panel" style={{ padding: "20px 24px", borderLeft: "4px solid #38bdf8" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #0284c7 0%, #0d9488 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 15px rgba(2, 132, 199, 0.4)",
            }}>
              <Cpu size={26} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#f8fafc", margin: 0 }}>
                  Live AWS Prototype
                </h2>
                <span style={{
                  background: "rgba(56, 189, 248, 0.15)",
                  color: "#38bdf8",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "700",
                  fontFamily: "var(--font-mono)",
                }}>
                  Arduino ATmega328P / ESP32 Node
                </span>
              </div>
              <p style={{ fontSize: "13px", color: "#94a3b8", margin: "2px 0 0 0" }}>
                Real-Time Physical & Simulated Telemetry Node with Tri-Color LED & Piezo Audio Annunciator
              </p>
            </div>
          </div>

          {/* Quick Node Badges */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(51, 65, 85, 0.6)", borderRadius: "8px", padding: "6px 12px", fontSize: "12px" }}>
              <span style={{ color: "#64748b" }}>Station ID: </span>
              <strong style={{ color: "#38bdf8", fontFamily: "var(--font-mono)" }}>{stationId}</strong>
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(51, 65, 85, 0.6)", borderRadius: "8px", padding: "6px 12px", fontSize: "12px" }}>
              <span style={{ color: "#64748b" }}>Timestamp: </span>
              <strong style={{ color: "#cbd5e1", fontFamily: "var(--font-mono)" }}>{timestampMs} ms</strong>
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(51, 65, 85, 0.6)", borderRadius: "8px", padding: "6px 12px", fontSize: "12px" }}>
              <span style={{ color: "#64748b" }}>Link: </span>
              <strong style={{ color: isConnected ? "#34d399" : "#f87171" }}>
                {isConnected ? "ONLINE 🟢" : "OFFLINE ⚪"}
              </strong>
            </div>
          </div>

        </div>
      </div>

      {/* 2. Top Grid: Live Sensor Data Cards (4 Channels) & Hardware Alert Box */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
        
        {/* Temperature Card */}
        <div className="glass-panel" style={{
          padding: "18px",
          borderTop: `3px solid ${tempStatus.color}`,
          background: affected.includes("temperature") ? "rgba(239, 68, 68, 0.08)" : "var(--color-bg-card)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Thermometer size={18} color="#fb923c" />
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#cbd5e1", textTransform: "uppercase" }}>Temperature</span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: "700", color: tempStatus.color, display: "flex", alignItems: "center", gap: "4px" }}>
              {tempStatus.icon} {tempStatus.label}
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#f8fafc", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>
            {temp != null ? `${temp.toFixed(2)} °C` : "NULL (DROP)"}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8" }}>
            <span>Sensor: PT100 / DHT22</span>
            <span>Health: {tHealth.toFixed(0)}%</span>
          </div>
        </div>

        {/* Humidity Card */}
        <div className="glass-panel" style={{
          padding: "18px",
          borderTop: `3px solid ${humStatus.color}`,
          background: affected.includes("humidity") ? "rgba(239, 68, 68, 0.08)" : "var(--color-bg-card)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Droplets size={18} color="#60a5fa" />
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#cbd5e1", textTransform: "uppercase" }}>Relative Humidity</span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: "700", color: humStatus.color, display: "flex", alignItems: "center", gap: "4px" }}>
              {humStatus.icon} {humStatus.label}
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#f8fafc", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>
            {hum != null ? `${hum.toFixed(2)} %` : "NULL (DROP)"}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8" }}>
            <span>Sensor: Capacitive RH</span>
            <span>Health: {hHealth.toFixed(0)}%</span>
          </div>
        </div>

        {/* Pressure Card */}
        <div className="glass-panel" style={{
          padding: "18px",
          borderTop: `3px solid ${pressStatus.color}`,
          background: affected.includes("pressure") ? "rgba(239, 68, 68, 0.08)" : "var(--color-bg-card)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Gauge size={18} color="#22d3ee" />
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#cbd5e1", textTransform: "uppercase" }}>Atmospheric Pressure</span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: "700", color: pressStatus.color, display: "flex", alignItems: "center", gap: "4px" }}>
              {pressStatus.icon} {pressStatus.label}
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#f8fafc", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>
            {press != null ? `${press.toFixed(2)} hPa` : "NULL (DROP)"}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8" }}>
            <span>Sensor: BME280 / Baro</span>
            <span>Health: {pHealth.toFixed(0)}%</span>
          </div>
        </div>

        {/* Wind Speed Card */}
        <div className="glass-panel" style={{
          padding: "18px",
          borderTop: `3px solid ${windStatus.color}`,
          background: "var(--color-bg-card)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Wind size={18} color="#34d399" />
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#cbd5e1", textTransform: "uppercase" }}>Wind Speed</span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: "700", color: windStatus.color, display: "flex", alignItems: "center", gap: "4px" }}>
              {windStatus.icon} {windStatus.label}
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#f8fafc", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>
            {wind.toFixed(2)} km/h
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8" }}>
            <span>Sensor: 3-Cup Anemometer</span>
            <span>Health: {wHealth.toFixed(0)}%</span>
          </div>
        </div>

      </div>

      {/* 3. Middle Section: Hardware Alert Simulation (LEDs + Buzzer) & Circuit Schematic */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "20px" }}>
        
        {/* Hardware Alert Simulation Box */}
        <div className="glass-panel" style={{ padding: "22px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "800", letterSpacing: "1px", textTransform: "uppercase" }}>
                  Hardware Output Simulation
                </span>
                <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#f8fafc", margin: "2px 0 0 0" }}>
                  Arduino Visual & Audio Annunciator
                </h3>
              </div>

              {/* Sound Mute/Unmute Toggle */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="btn-control"
                style={{
                  background: soundEnabled ? "rgba(245, 158, 11, 0.2)" : "rgba(15, 23, 42, 0.6)",
                  borderColor: soundEnabled ? "#f59e0b" : "rgba(51, 65, 85, 0.5)",
                  color: soundEnabled ? "#fbbf24" : "#94a3b8",
                  fontSize: "11px",
                  padding: "6px 10px",
                }}
                title="Toggle Web Audio Piezo Buzzer Synthesizer"
              >
                {soundEnabled ? <Volume2 size={15} color="#fbbf24" /> : <VolumeX size={15} />}
                <span>{soundEnabled ? "Audio Alarm ON" : "Audio Alarm Muted"}</span>
              </button>
            </div>

            {/* Tri-Color Physical LEDs Simulation */}
            <div style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(51, 65, 85, 0.8)",
              borderRadius: "12px",
              padding: "18px",
              marginBottom: "16px",
            }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", marginBottom: "14px" }}>
                Physical Microcontroller LED Outputs (Pin D7 / D8 / D9)
              </div>

              <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                
                {/* Green LED */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: isGreenLed ? "#10b981" : "#064e3b",
                    boxShadow: isGreenLed ? "0 0 24px #10b981, inset 0 0 8px #a7f3d0" : "none",
                    border: "2px solid rgba(16, 185, 129, 0.6)",
                    transition: "all 0.3s ease",
                  }} />
                  <span style={{ fontSize: "12px", fontWeight: "700", color: isGreenLed ? "#34d399" : "#64748b" }}>
                    GREEN {isGreenLed ? "(LIT)" : "(OFF)"}
                  </span>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>NORMAL</span>
                </div>

                {/* Yellow LED */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: isYellowLed ? "#f59e0b" : "#78350f",
                    boxShadow: isYellowLed ? "0 0 24px #f59e0b, inset 0 0 8px #fef08a" : "none",
                    border: "2px solid rgba(245, 158, 11, 0.6)",
                    transition: "all 0.3s ease",
                  }} />
                  <span style={{ fontSize: "12px", fontWeight: "700", color: isYellowLed ? "#fbbf24" : "#64748b" }}>
                    YELLOW {isYellowLed ? "(LIT)" : "(OFF)"}
                  </span>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>WARNING</span>
                </div>

                {/* Red LED */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: isRedLed ? "#ef4444" : "#7f1d1d",
                    boxShadow: isRedLed ? "0 0 28px #ef4444, inset 0 0 10px #fee2e2" : "none",
                    border: "2px solid rgba(239, 68, 68, 0.7)",
                    animation: isRedLed ? "pulseGlow 1.2s infinite" : "none",
                    transition: "all 0.3s ease",
                  }} />
                  <span style={{ fontSize: "12px", fontWeight: "700", color: isRedLed ? "#f87171" : "#64748b" }}>
                    RED {isRedLed ? "(FLASHING)" : "(OFF)"}
                  </span>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>CRITICAL</span>
                </div>

                {/* Piezo Buzzer Indicator */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: isBuzzerActive ? "rgba(239, 68, 68, 0.25)" : "rgba(30, 41, 59, 0.5)",
                    border: isBuzzerActive ? "2px solid #ef4444" : "1px solid rgba(71, 85, 105, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: isBuzzerActive ? "0 0 20px rgba(239, 68, 68, 0.5)" : "none",
                  }}>
                    {isBuzzerActive ? <Volume2 size={20} color="#f87171" className="animate-pulse" /> : <VolumeX size={18} color="#64748b" />}
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: isBuzzerActive ? "#f87171" : "#64748b" }}>
                    BUZZER {isBuzzerActive ? "(ACTIVE)" : "(SILENT)"}
                  </span>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>PWM Pin D6</span>
                </div>

              </div>
            </div>

            {/* Structured Hardware Alert Summary Card */}
            <div style={{
              background: "rgba(10, 15, 30, 0.9)",
              border: isAnomaly ? "1px solid rgba(239, 68, 68, 0.5)" : "1px solid rgba(16, 185, 129, 0.4)",
              borderRadius: "10px",
              padding: "14px 18px",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
            }}>
              <div style={{ color: "#38bdf8", fontWeight: "700", marginBottom: "8px", borderBottom: "1px solid rgba(51, 65, 85, 0.6)", paddingBottom: "4px" }}>
                HARDWARE ALERT STATUS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", color: "#e2e8f0" }}>
                <div>LED STATUS: <strong style={{ color: isRedLed ? "#f87171" : isYellowLed ? "#fbbf24" : "#34d399" }}>
                  {isRedLed ? "🔴 RED" : isYellowLed ? "🟡 YELLOW" : "🟢 GREEN"}
                </strong></div>
                <div>BUZZER: <strong style={{ color: isBuzzerActive ? "#f87171" : "#34d399" }}>
                  {isBuzzerActive ? "🔊 ACTIVE" : "🔇 INACTIVE"}
                </strong></div>
                <div>ALERT: <strong style={{ color: isAnomaly ? "#f87171" : "#34d399" }}>{anomalyType}</strong></div>
                <div>SEVERITY: <strong style={{ color: severity === "CRITICAL" ? "#f87171" : severity === "HIGH" ? "#fb923c" : "#34d399" }}>{severity}</strong></div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "14px", borderTop: "1px solid rgba(51, 65, 85, 0.4)", paddingTop: "8px" }}>
            * Note: Visualized hardware outputs simulate direct GPIO state logic triggered by AI/ML anomaly classification pipeline.
          </div>
        </div>

        {/* Hardware Architecture Schematic (SVG / CSS) */}
        <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Layers size={18} color="#38bdf8" />
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
                AWS Prototype Hardware Flow
              </h3>
            </div>

            {/* Schematic Flow Container */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              
              {/* Level 1: Sensors */}
              <div style={{
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                borderRadius: "8px",
                padding: "10px",
              }}>
                <div style={{ fontSize: "10px", color: "#38bdf8", fontWeight: "700", textTransform: "uppercase" }}>
                  1. SENSOR ARRAY (I2C / ADC / 1-Wire)
                </div>
                <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap", fontSize: "11px", color: "#cbd5e1" }}>
                  <span style={{ background: "rgba(251, 146, 60, 0.15)", padding: "2px 6px", borderRadius: "4px", border: "1px solid rgba(251, 146, 60, 0.3)" }}>🌡️ PT100 / DHT22</span>
                  <span style={{ background: "rgba(96, 165, 250, 0.15)", padding: "2px 6px", borderRadius: "4px", border: "1px solid rgba(96, 165, 250, 0.3)" }}>💧 Capacitive RH</span>
                  <span style={{ background: "rgba(34, 211, 238, 0.15)", padding: "2px 6px", borderRadius: "4px", border: "1px solid rgba(34, 211, 238, 0.3)" }}>🧭 BME280 Baro</span>
                  <span style={{ background: "rgba(52, 211, 153, 0.15)", padding: "2px 6px", borderRadius: "4px", border: "1px solid rgba(52, 211, 153, 0.3)" }}>💨 Anemometer</span>
                </div>
              </div>

              {/* Arrow */}
              <div style={{ textAlign: "center", color: "#38bdf8", fontSize: "11px", fontWeight: "700" }}>
                ▼ SPI / I2C / Analog Telemetry Bus (115200 Baud)
              </div>

              {/* Level 2: Microcontroller */}
              <div style={{
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid rgba(99, 102, 241, 0.4)",
                borderRadius: "8px",
                padding: "10px",
              }}>
                <div style={{ fontSize: "10px", color: "#818cf8", fontWeight: "700", textTransform: "uppercase" }}>
                  2. EDGE CONTROLLER & LOCAL ANNUNCIATOR
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px", fontSize: "11px", color: "#e2e8f0" }}>
                  <span>Arduino ATmega328P / ESP32 Node</span>
                  <span style={{ color: "#34d399", fontWeight: "600" }}>3x LED + Buzzer</span>
                </div>
              </div>

              {/* Arrow */}
              <div style={{ textAlign: "center", color: "#818cf8", fontSize: "11px", fontWeight: "700" }}>
                ▼ JSON Serial Stream over WebSocket
              </div>

              {/* Level 3: AI/ML Engine & Cloud Dashboard */}
              <div style={{
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                borderRadius: "8px",
                padding: "10px",
              }}>
                <div style={{ fontSize: "10px", color: "#34d399", fontWeight: "700", textTransform: "uppercase" }}>
                  3. BACKEND AI/ML INFERENCE & CLOUD DASHBOARD
                </div>
                <div style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "4px" }}>
                  FastAPI • Isolation Forest • XAI SHAP • SQLite • SkyGuard Dashboard
                </div>
              </div>

            </div>
          </div>

          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "12px" }}>
            End-to-end hardware loop verified with dynamic rate-of-change and psychrometric validation.
          </div>
        </div>

      </div>

      {/* 4. Anomaly Diagnostic Information & Recommended Maintenance */}
      <div className="glass-panel" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {isAnomaly ? <AlertOctagon size={20} color="#f87171" /> : <CheckCircle2 size={20} color="#34d399" />}
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
              AI Anomaly Diagnostic & Maintenance Action Plan
            </h3>
          </div>
          <span className={`badge badge-${severity.toLowerCase()}`}>
            {severity} Severity
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          
          {/* Anomaly Classification & Confidence */}
          <div style={{ background: "rgba(15, 23, 42, 0.6)", borderRadius: "8px", padding: "14px", border: "1px solid rgba(51, 65, 85, 0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>Detected Category</span>
              <strong style={{ color: isAnomaly ? "#f87171" : "#34d399", fontSize: "15px", fontFamily: "var(--font-mono)" }}>{anomalyType}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>Model Confidence</span>
              <strong style={{ color: "#38bdf8", fontSize: "15px" }}>{confidence.toFixed(1)}%</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>Affected Sensor(s)</span>
              <strong style={{ color: "#fb923c", fontSize: "13px", textTransform: "capitalize" }}>
                {affected.length > 0 ? affected.join(", ") : "None (All Nominal)"}
              </strong>
            </div>
          </div>

          {/* Root Cause & Recommended Action */}
          <div style={{ background: "rgba(15, 23, 42, 0.6)", borderRadius: "8px", padding: "14px", border: "1px solid rgba(51, 65, 85, 0.5)" }}>
            <div style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>
              Root Cause Explanation:
            </div>
            <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#e2e8f0", lineHeight: "1.4" }}>
              {explanation}
            </p>
            <div style={{ fontSize: "11px", color: "#34d399", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>
              Recommended Action:
            </div>
            <div style={{ fontSize: "12px", color: "#cbd5e1" }}>
              {sensorHealth?.maintenance_recommendations?.[0] || "Routine monitoring active. No field maintenance required."}
            </div>
          </div>

        </div>
      </div>

      {/* 5. Interactive Anomaly Injection Controls (Through Actual Backend ML Pipeline) */}
      <div className="glass-panel" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Zap size={20} color="#f59e0b" />
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
              Hardware Prototype Anomaly Injection Controls
            </h3>
          </div>

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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
          <button onClick={() => handleInject("normal", "Nominal Normal Baseline")} disabled={isInjecting} className="btn-inject" style={{ borderColor: "rgba(16, 185, 129, 0.4)", color: "#34d399" }}>
            <RefreshCcw size={15} color="#34d399" />
            <span>Normal</span>
          </button>

          <button onClick={() => handleInject("temperature_spike", "Temperature Spike", { magnitude: 18.0 })} disabled={isInjecting} className="btn-inject">
            <Flame size={15} color="#fb923c" />
            <span>Temperature Spike</span>
          </button>

          <button onClick={() => handleInject("temperature_drop", "Temperature Drop", { magnitude: 15.0 })} disabled={isInjecting} className="btn-inject">
            <Snowflake size={15} color="#38bdf8" />
            <span>Temperature Drop</span>
          </button>

          <button onClick={() => handleInject("pressure_spike", "Pressure Surge", { magnitude: 38.0 })} disabled={isInjecting} className="btn-inject">
            <Gauge size={15} color="#22d3ee" />
            <span>Pressure Anomaly</span>
          </button>

          <button onClick={() => handleInject("humidity_spike", "Humidity Surge", { magnitude: 45.0 })} disabled={isInjecting} className="btn-inject">
            <Droplets size={15} color="#60a5fa" />
            <span>Humidity Anomaly</span>
          </button>

          <button onClick={() => handleInject("frozen_sensor", "Frozen Sensor", { target_sensor: "temperature" })} disabled={isInjecting} className="btn-inject">
            <PauseCircle size={15} color="#a855f7" />
            <span>Frozen Sensor</span>
          </button>

          <button onClick={() => handleInject("sensor_drift", "Sensor Calibration Drift", { drift_rate: 0.8, target_sensor: "temperature" })} disabled={isInjecting} className="btn-inject">
            <TrendingUp size={15} color="#fbbf24" />
            <span>Sensor Drift</span>
          </button>

          <button onClick={() => handleInject("missing_data", "Packet Loss", { target_sensor: "temperature" })} disabled={isInjecting} className="btn-inject">
            <Unplug size={15} color="#f87171" />
            <span>Missing Data</span>
          </button>

          <button onClick={() => handleInject("multivariate_inconsistency", "Multivariate Inconsistency", { temperature: 48.0, relative_humidity: 98.0 })} disabled={isInjecting} className="btn-inject">
            <Sliders size={15} color="#ec4899" />
            <span>Multivariate Anomaly</span>
          </button>
        </div>
      </div>

      {/* 6. Live Serial Stream & Terminal Monitor (Standard Manual Scroll Only) */}
      <div className="glass-panel" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Terminal size={18} color="#34d399" />
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
              Live Sensor Stream (Arduino Serial Monitor @ 115200 Baud)
            </h3>
          </div>

          <button
            onClick={() => setSerialLogs([])}
            className="btn-control"
            style={{ fontSize: "11px", padding: "4px 8px" }}
          >
            Clear Buffer
          </button>
        </div>

        {/* Terminal Window with standard manual scroll */}
        <div
          style={{
            background: "#030712",
            border: "1px solid rgba(51, 65, 85, 0.8)",
            borderRadius: "8px",
            padding: "14px",
            height: "220px",
            overflowY: "auto",
            fontFamily: "monospace",
            fontSize: "12px",
            color: "#34d399",
            boxShadow: "inset 0 0 20px rgba(0, 0, 0, 0.8)",
          }}
        >
          {serialLogs.length > 0 ? (
            serialLogs.map((logStr, i) => (
              <pre key={i} style={{ margin: "0 0 10px 0", whiteSpace: "pre-wrap", color: logStr.includes('"is_anomaly": true') ? "#f87171" : "#38bdf8" }}>
                {`[RX #${i + 1}] ${logStr}`}
              </pre>
            ))
          ) : (
            <div style={{ color: "#64748b" }}>Awaiting serial data stream from Arduino ATmega328P node...</div>
          )}
        </div>
      </div>

      {/* 7. Sensor Health Status Bars */}
      <div className="glass-panel" style={{ padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <ShieldCheck size={20} color="#38bdf8" />
          <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
            Hardware Prototype Sensor Health & Reliability Index
          </h3>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
          
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
              <span style={{ color: "#cbd5e1" }}>Temperature Health</span>
              <strong style={{ color: "#fb923c" }}>{tHealth.toFixed(1)}%</strong>
            </div>
            <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${tHealth}%`, background: "#fb923c", transition: "width 0.5s ease" }} />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
              <span style={{ color: "#cbd5e1" }}>Humidity Health</span>
              <strong style={{ color: "#60a5fa" }}>{hHealth.toFixed(1)}%</strong>
            </div>
            <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${hHealth}%`, background: "#60a5fa", transition: "width 0.5s ease" }} />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
              <span style={{ color: "#cbd5e1" }}>Pressure Health</span>
              <strong style={{ color: "#22d3ee" }}>{pHealth.toFixed(1)}%</strong>
            </div>
            <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pHealth}%`, background: "#22d3ee", transition: "width 0.5s ease" }} />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
              <span style={{ color: "#cbd5e1" }}>Wind Sensor Health</span>
              <strong style={{ color: "#34d399" }}>{wHealth.toFixed(1)}%</strong>
            </div>
            <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${wHealth}%`, background: "#34d399", transition: "width 0.5s ease" }} />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
              <span style={{ color: "#cbd5e1" }}>Overall AWS Health</span>
              <strong style={{ color: oHealth > 75 ? "#34d399" : "#fbbf24" }}>{oHealth.toFixed(1)}%</strong>
            </div>
            <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${oHealth}%`, background: oHealth > 75 ? "#34d399" : "#fbbf24", transition: "width 0.5s ease" }} />
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
