import React, { useState, useEffect, useRef } from "react";
import {
  Cpu,
  Terminal,
  Radio,
  Volume2,
  VolumeX,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Zap,
  Info,
  Database,
  Server,
  Activity,
  CheckCircle2,
  XCircle
} from "lucide-react";

export default function SystemHardware({ currentTelemetry, isConnected }) {
  const [buzzerMuted, setBuzzerMuted] = useState(false);
  const [serialLogs, setSerialLogs] = useState([]);
  const terminalRef = useRef(null);

  const isAnomaly = currentTelemetry?.is_anomaly || false;
  const severity = currentTelemetry?.severity || "LOW";
  const temp = currentTelemetry?.temperature ?? 24.78;
  const press = currentTelemetry?.pressure ?? 1013.25;
  const hum = currentTelemetry?.humidity ?? 60.0;
  const wind = currentTelemetry?.wind_speed ?? 14.5;
  const rain = currentTelemetry?.rainfall ?? 0.0;
  const battery = currentTelemetry?.battery_voltage ?? 4.12;
  const stationId = currentTelemetry?.station_id || "AWS-TINKER-01";
  const timestampMs = currentTelemetry?.timestamp_ms || Date.now() % 100000000;

  // Append exact Arduino-formatted serial packets
  useEffect(() => {
    if (!currentTelemetry) return;
    const packet = {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString(),
      text: JSON.stringify({
        station_id: stationId,
        timestamp_ms: timestampMs,
        temperature: Number(temp.toFixed(2)),
        humidity: Number(hum.toFixed(2)),
        pressure: Number(press.toFixed(2)),
        wind_speed: Number(wind.toFixed(2)),
        rainfall: Number(rain.toFixed(2)),
        battery_voltage: Number(battery.toFixed(2)),
      }),
    };
    setSerialLogs((prev) => [...prev.slice(-30), packet]);
  }, [currentTelemetry]);

  // Determine virtual LED pin states
  const ledGreen = !isAnomaly;
  const ledYellow = isAnomaly && severity === "MEDIUM";
  const ledRed = isAnomaly && (severity === "HIGH" || severity === "CRITICAL");
  const buzzerActive = isAnomaly && (severity === "HIGH" || severity === "CRITICAL") && !buzzerMuted;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* 1. PHYSICAL HARDWARE VS SIMULATION BANNER */}
      <div className="glass-panel" style={{
        padding: "18px 24px",
        background: "linear-gradient(90deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)",
        border: "1px solid rgba(56, 189, 248, 0.4)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              background: "rgba(239, 68, 68, 0.15)",
              color: "#f87171",
              padding: "6px 12px",
              borderRadius: "8px",
              fontWeight: "800",
              fontSize: "12px",
              letterSpacing: "0.5px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              textTransform: "uppercase",
            }}>
              PHYSICAL HARDWARE: NOT CONNECTED
            </div>
            <div>
              <div style={{ color: "#f8fafc", fontWeight: "700", fontSize: "14px" }}>
                System Operating in High-Fidelity Meteorological Simulation Mode
              </div>
              <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                Arduino / ESP32 physical serial bridge is in standby. When connected, the serial reader directly streams into this exact pipeline.
              </div>
            </div>
          </div>

          <div style={{
            background: "rgba(16, 185, 129, 0.15)",
            color: "#34d399",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            padding: "6px 14px",
            borderRadius: "8px",
            fontWeight: "700",
            fontSize: "12px",
          }}>
            SIMULATION ENGINE: AVAILABLE & STREAMING (1.0 Hz)
          </div>
        </div>
      </div>

      {/* 2. SYSTEM STATUS METRIC CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        
        {/* Physical Hardware */}
        <div className="glass-panel" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              Physical Hardware
            </span>
            <XCircle size={16} color="#f87171" />
          </div>
          <div style={{ fontSize: "16px", fontWeight: "800", color: "#f87171" }}>
            NOT CONNECTED
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>Arduino Standby (COM/UART)</span>
        </div>

        {/* Simulation Status */}
        <div className="glass-panel" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              Simulation Engine
            </span>
            <CheckCircle2 size={16} color="#34d399" />
          </div>
          <div style={{ fontSize: "16px", fontWeight: "800", color: "#34d399" }}>
            AVAILABLE & ACTIVE
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>1.0 Hz Physics Generator</span>
        </div>

        {/* Backend API */}
        <div className="glass-panel" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              Backend API Status
            </span>
            <Server size={16} color="#38bdf8" />
          </div>
          <div style={{ fontSize: "16px", fontWeight: "800", color: isConnected ? "#34d399" : "#f87171" }}>
            {isConnected ? "ONLINE (FastAPI)" : "OFFLINE"}
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>REST + WebSocket Stream</span>
        </div>

        {/* SQLite Database */}
        <div className="glass-panel" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              Database Status
            </span>
            <Database size={16} color="#a855f7" />
          </div>
          <div style={{ fontSize: "16px", fontWeight: "800", color: "#a855f7" }}>
            CONNECTED
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>SQLite (aws_telemetry.db)</span>
        </div>

      </div>

      {/* 3. VIRTUAL MICROCONTROLLER BOARD & LIVE SERIAL MONITOR */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "20px" }}>
        
        {/* Virtual Arduino Output Actuators */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Cpu size={18} color="#38bdf8" />
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
                Arduino Prototype Actuator Indicators
              </h3>
            </div>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>Node: {stationId}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
            
            {/* Green LED Pin D7 */}
            <div style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: ledGreen ? "1px solid #10b981" : "1px solid rgba(51, 65, 85, 0.4)",
              borderRadius: "8px",
              padding: "12px",
              textAlign: "center",
              boxShadow: ledGreen ? "0 0 15px rgba(16, 185, 129, 0.3)" : "none",
            }}>
              <div style={{
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: ledGreen ? "#10b981" : "#1e293b",
                margin: "0 auto 8px auto",
                boxShadow: ledGreen ? "0 0 10px #10b981" : "none",
              }} />
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#f8fafc" }}>Pin D7 (Green)</div>
              <div style={{ fontSize: "10px", color: ledGreen ? "#34d399" : "#64748b" }}>
                {ledGreen ? "ACTIVE (NOMINAL)" : "OFF"}
              </div>
            </div>

            {/* Yellow LED Pin D8 */}
            <div style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: ledYellow ? "1px solid #f59e0b" : "1px solid rgba(51, 65, 85, 0.4)",
              borderRadius: "8px",
              padding: "12px",
              textAlign: "center",
              boxShadow: ledYellow ? "0 0 15px rgba(245, 158, 11, 0.3)" : "none",
            }}>
              <div style={{
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: ledYellow ? "#f59e0b" : "#1e293b",
                margin: "0 auto 8px auto",
                boxShadow: ledYellow ? "0 0 10px #f59e0b" : "none",
              }} />
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#f8fafc" }}>Pin D8 (Yellow)</div>
              <div style={{ fontSize: "10px", color: ledYellow ? "#fbbf24" : "#64748b" }}>
                {ledYellow ? "WARNING" : "OFF"}
              </div>
            </div>

            {/* Red LED Pin D9 */}
            <div style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: ledRed ? "1px solid #ef4444" : "1px solid rgba(51, 65, 85, 0.4)",
              borderRadius: "8px",
              padding: "12px",
              textAlign: "center",
              boxShadow: ledRed ? "0 0 15px rgba(239, 68, 68, 0.4)" : "none",
            }}>
              <div style={{
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: ledRed ? "#ef4444" : "#1e293b",
                margin: "0 auto 8px auto",
                boxShadow: ledRed ? "0 0 10px #ef4444" : "none",
              }} />
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#f8fafc" }}>Pin D9 (Red)</div>
              <div style={{ fontSize: "10px", color: ledRed ? "#f87171" : "#64748b" }}>
                {ledRed ? "CRITICAL ALERT" : "OFF"}
              </div>
            </div>

          </div>

          {/* Piezo Buzzer Actuator */}
          <div style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(51, 65, 85, 0.5)",
            borderRadius: "8px",
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Volume2 size={18} color={buzzerActive ? "#ef4444" : "#94a3b8"} />
              <div>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#f8fafc" }}>Pin D10 Piezo Alarm Buzzer</div>
                <div style={{ fontSize: "11px", color: buzzerActive ? "#f87171" : "#64748b" }}>
                  {buzzerActive ? "ALARM TRIGGERED (2.4 kHz Pulse)" : "STANDBY (Silent)"}
                </div>
              </div>
            </div>

            <button
              onClick={() => setBuzzerMuted(!buzzerMuted)}
              style={{
                background: buzzerMuted ? "#475569" : "rgba(56, 189, 248, 0.2)",
                color: "#f8fafc",
                border: "none",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              {buzzerMuted ? "Unmute Audio" : "Mute Audio"}
            </button>
          </div>
        </div>

        {/* Live Serial Packet Terminal */}
        <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Terminal size={18} color="#10b981" />
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
                Live UART Serial Telemetry Stream
              </h3>
            </div>
            <span style={{ fontSize: "11px", color: "#10b981", fontFamily: "var(--font-mono)" }}>115200 BAUD</span>
          </div>

          <div
            ref={terminalRef}
            style={{
              flex: 1,
              minHeight: "180px",
              maxHeight: "220px",
              background: "#030712",
              border: "1px solid rgba(51, 65, 85, 0.7)",
              borderRadius: "8px",
              padding: "10px 14px",
              overflowY: "auto",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "#34d399",
              lineHeight: "1.6",
            }}
          >
            {serialLogs.map((log) => (
              <div key={log.id}>
                <span style={{ color: "#64748b" }}>[{log.time}] </span>
                <span>{log.text}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 4. PLANNED ARDUINO WEATHER-STATION HARDWARE ARCHITECTURE DIAGRAM */}
      <div className="glass-panel" style={{ padding: "22px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", marginBottom: "14px" }}>
          Planned Arduino Weather Station Hardware Architecture
        </h3>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
          textAlign: "center",
        }}>
          <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px", borderRadius: "8px", border: "1px solid rgba(51, 65, 85, 0.5)" }}>
            <div style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "700", textTransform: "uppercase" }}>Hardware Stage 1</div>
            <div style={{ fontWeight: "700", color: "#f8fafc", marginTop: "4px" }}>Sensors & Transducers</div>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>DHT22, BMP280, Anemometer, Rain Gauge</div>
          </div>

          <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px", borderRadius: "8px", border: "1px solid rgba(51, 65, 85, 0.5)" }}>
            <div style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "700", textTransform: "uppercase" }}>Hardware Stage 2</div>
            <div style={{ fontWeight: "700", color: "#f8fafc", marginTop: "4px" }}>Arduino Edge Controller</div>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>ATmega328P ADC & Serial JSON Framer</div>
          </div>

          <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px", borderRadius: "8px", border: "1px solid rgba(51, 65, 85, 0.5)" }}>
            <div style={{ fontSize: "11px", color: "#a855f7", fontWeight: "700", textTransform: "uppercase" }}>Cloud Stage 3</div>
            <div style={{ fontWeight: "700", color: "#f8fafc", marginTop: "4px" }}>Dual-Model AI Core</div>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>Isolation Forest + LSTM Autoencoder</div>
          </div>

          <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px", borderRadius: "8px", border: "1px solid rgba(51, 65, 85, 0.5)" }}>
            <div style={{ fontSize: "11px", color: "#10b981", fontWeight: "700", textTransform: "uppercase" }}>Action Stage 4</div>
            <div style={{ fontWeight: "700", color: "#f8fafc", marginTop: "4px" }}>Actuators & Control UI</div>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>LED Pins D7-D9, Alarm D10, WebSocket UI</div>
          </div>
        </div>
      </div>

    </div>
  );
}
