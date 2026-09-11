import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard,
  Activity,
  BrainCircuit,
  HeartPulse,
  CloudRain,
  History as HistoryIcon,
  Cpu,
  FlaskConical,
  WifiOff,
  RefreshCw,
  Bell,
  X,
  ExternalLink
} from "lucide-react";

import Header from "./Header";
import CommandCenter from "./CommandCenter";
import AIAnomalyAnalysis from "./AIAnomalyAnalysis";
import WeatherIntelligence from "./WeatherIntelligence";
import SystemHardware from "./SystemHardware";
import SimulationLab from "./SimulationLab";
import TelemetryCharts from "./TelemetryCharts";
import SensorCards from "./SensorCards";
import SensorHealth from "./SensorHealth";
import AnomalyHistory from "./AnomalyHistory";

import {
  fetchHealth,
  fetchCurrentTelemetry,
  fetchHistory,
  fetchAnomalies,
  fetchSensorHealth,
  fetchStatistics,
  startSimulator,
  stopSimulator,
  injectAnomaly,
  triggerModelRetrain,
  connectTelemetryWebSocket,
} from "../services/api";

export default function NewDashboard({ onNavigateToLegacy }) {
  const [activeModule, setActiveModule] = useState("command_center"); // 8 modules
  const [isConnected, setIsConnected] = useState(false);
  const [isSimulatorRunning, setIsSimulatorRunning] = useState(true);
  const [isRetraining, setIsRetraining] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [currentTelemetry, setCurrentTelemetry] = useState(null);
  const [history, setHistory] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [sensorHealth, setSensorHealth] = useState(null);
  const [statistics, setStatistics] = useState(null);

  const [activeAlert, setActiveAlert] = useState(null);
  const lastAnomalyTimeRef = useRef(null);

  const handleIncomingTelemetry = useCallback((data) => {
    if (!data) return;
    setCurrentTelemetry(data);
    setIsConnected(true);
    setErrorMsg(null);

    setHistory((prev) => {
      const exists = prev.some((p) => p.timestamp === data.timestamp);
      if (exists) return prev;
      const updated = [...prev, data];
      return updated.slice(-80);
    });

    if (data.is_anomaly && data.timestamp !== lastAnomalyTimeRef.current) {
      lastAnomalyTimeRef.current = data.timestamp;
      
      const newAnomaly = {
        id: Date.now(),
        timestamp: data.timestamp,
        anomaly_type: data.anomaly_type,
        severity: data.severity,
        confidence: data.confidence,
        explanation: data.explanation,
        affected_parameters: data.affected_parameters,
        temperature: data.temperature,
        pressure: data.pressure,
        humidity: data.humidity,
        wind_speed: data.wind_speed,
      };

      setAnomalies((prev) => [newAnomaly, ...prev.slice(0, 40)]);
      setActiveAlert(newAnomaly);
      setTimeout(() => setActiveAlert(null), 6000);
    }

    if (data.health) {
      setSensorHealth(data.health);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      const [healthCheck, curr, hist, health, stats, anom] = await Promise.allSettled([
        fetchHealth(),
        fetchCurrentTelemetry(),
        fetchHistory(60),
        fetchSensorHealth(),
        fetchStatistics(),
        fetchAnomalies(30),
      ]);

      if (curr.status === "fulfilled" && curr.value?.data) {
        setCurrentTelemetry(curr.value.data);
        setIsSimulatorRunning(curr.value.simulator_active);
      }

      if (hist.status === "fulfilled" && hist.value?.records) {
        setHistory(hist.value.records);
      }

      if (health.status === "fulfilled" && health.value) {
        setSensorHealth(health.value);
      }

      if (stats.status === "fulfilled" && stats.value) {
        setStatistics(stats.value);
      }

      if (anom.status === "fulfilled" && anom.value?.anomalies) {
        setAnomalies(anom.value.anomalies);
      }

      setIsConnected(true);
      setErrorMsg(null);
    } catch (err) {
      console.error("New Dashboard initial load failed:", err);
      setIsConnected(false);
      setErrorMsg("Unable to connect to FastAPI backend at http://127.0.0.1:8000. Retrying...");
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();

    const ws = connectTelemetryWebSocket(
      (telemetryData) => {
        handleIncomingTelemetry(telemetryData);
      },
      () => setIsConnected(true),
      (err) => console.warn("WebSocket error, falling back to polling:", err),
      () => setIsConnected(false)
    );

    const syncInterval = setInterval(async () => {
      try {
        const [stats, health] = await Promise.all([
          fetchStatistics(),
          fetchSensorHealth(),
        ]);
        if (stats) setStatistics(stats);
        if (health) setSensorHealth(health);
      } catch {}
    }, 4000);

    return () => {
      ws.close();
      clearInterval(syncInterval);
    };
  }, [loadInitialData, handleIncomingTelemetry]);

  const handleToggleSimulator = async () => {
    try {
      if (isSimulatorRunning) {
        await stopSimulator();
        setIsSimulatorRunning(false);
      } else {
        await startSimulator(1.0);
        setIsSimulatorRunning(true);
      }
    } catch (err) {
      console.error("Error toggling simulator:", err);
    }
  };

  const handleInjectAnomaly = async (type, duration, params) => {
    setIsInjecting(true);
    try {
      await injectAnomaly(type, duration, params);
    } catch (err) {
      console.error("Error injecting anomaly:", err);
    } finally {
      setIsInjecting(false);
    }
  };

  const handleFilterChange = async (severity, type) => {
    try {
      const res = await fetchAnomalies(30, severity, type);
      if (res?.anomalies) {
        setAnomalies(res.anomalies);
      }
    } catch (err) {
      console.error("Error filtering anomalies:", err);
    }
  };

  const handleRetrain = async () => {
    setIsRetraining(true);
    try {
      await triggerModelRetrain(3000, 0.05);
      setTimeout(() => {
        setIsRetraining(false);
        loadInitialData();
      }, 4000);
    } catch (err) {
      console.error("Error retraining model:", err);
      setIsRetraining(false);
    }
  };

  const modules = [
    { id: "command_center", label: "Command Center", icon: LayoutDashboard },
    { id: "live_telemetry", label: "Live Telemetry", icon: Activity },
    { id: "ai_analysis", label: "AI Anomaly Analysis", icon: BrainCircuit },
    { id: "sensor_health", label: "Sensor Health", icon: HeartPulse },
    { id: "weather_intelligence", label: "Weather Intelligence", icon: CloudRain },
    { id: "anomaly_history", label: "Anomaly History", icon: HistoryIcon },
    { id: "system_hardware", label: "System & Hardware", icon: Cpu },
    { id: "simulation_lab", label: "Simulation Lab", icon: FlaskConical },
  ];

  if (initialLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
        <RefreshCw size={36} color="#38bdf8" className="animate-spin" />
        <h2 style={{ fontSize: "18px", color: "#f8fafc", fontWeight: "700" }}>Connecting to SkyGuard AI Platform...</h2>
        <p style={{ fontSize: "13px", color: "#94a3b8" }}>Initializing Dual AI Models (Isolation Forest + LSTM) & Telemetry Pipeline</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1520px", margin: "0 auto", padding: "18px" }}>
      
      {/* Top Header Bar */}
      <Header
        isConnected={isConnected}
        isSimulatorRunning={isSimulatorRunning}
        onToggleSimulator={handleToggleSimulator}
        onRetrain={handleRetrain}
        isRetraining={isRetraining}
      />

      {/* 8-Module Navigation Switcher & Legacy Link */}
      <div className="glass-panel" style={{
        padding: "8px 14px",
        marginBottom: "20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "10px",
      }}>
        {/* Module Tabs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {modules.map((m) => {
            const Icon = m.icon;
            const isActive = activeModule === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setActiveModule(m.id)}
                className="btn-control"
                style={{
                  background: isActive ? "#0284c7" : "transparent",
                  color: isActive ? "#ffffff" : "#94a3b8",
                  border: isActive ? "1px solid #38bdf8" : "1px solid transparent",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: isActive ? "700" : "500",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  borderRadius: "6px",
                }}
              >
                <Icon size={14} color={isActive ? "#ffffff" : "#64748b"} />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Link to Legacy Dashboard */}
        <button
          onClick={onNavigateToLegacy}
          style={{
            background: "rgba(15, 23, 42, 0.7)",
            color: "#94a3b8",
            border: "1px solid rgba(51, 65, 85, 0.6)",
            borderRadius: "6px",
            padding: "5px 12px",
            fontSize: "11px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#38bdf8";
            e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#94a3b8";
            e.currentTarget.style.borderColor = "rgba(51, 65, 85, 0.6)";
          }}
        >
          <HistoryIcon size={13} /> Original Dashboard <ExternalLink size={11} />
        </button>
      </div>

      {/* Disconnection Warning */}
      {!isConnected && (
        <div style={{
          background: "rgba(220, 38, 38, 0.2)",
          border: "1px solid rgba(239, 68, 68, 0.5)",
          borderRadius: "10px",
          padding: "12px 18px",
          marginBottom: "18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#f87171",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <WifiOff size={20} />
            <div>
              <strong>Backend Disconnected:</strong> {errorMsg || "Attempting automatic reconnection to FastAPI server at http://127.0.0.1:8000..."}
            </div>
          </div>
          <button onClick={loadInitialData} className="btn-control btn-danger" style={{ fontSize: "11px", padding: "4px 10px" }}>
            Retry Now
          </button>
        </div>
      )}

      {/* Live Anomaly Toast Alert */}
      {activeAlert && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          background: "rgba(15, 23, 42, 0.95)",
          border: "1px solid #ef4444",
          boxShadow: "0 10px 30px rgba(239, 68, 68, 0.3)",
          borderRadius: "12px",
          padding: "14px 18px",
          maxWidth: "380px",
          animation: "pulseGlow 2s infinite",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Bell size={18} color="#ef4444" />
              <strong style={{ color: "#f87171", fontSize: "14px" }}>
                {activeAlert.severity} ANOMALY DETECTED
              </strong>
            </div>
            <button onClick={() => setActiveAlert(null)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ fontSize: "12px", color: "#f8fafc", marginTop: "6px", fontWeight: "600" }}>
            {activeAlert.anomaly_type} ({((activeAlert.confidence || 0) * 100).toFixed(0)}% confidence)
          </div>
          <div style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "4px", lineHeight: "1.4" }}>
            {activeAlert.explanation}
          </div>
        </div>
      )}

      {/* MODULE RENDERER */}
      <main>
        {/* 1. Command Center */}
        {activeModule === "command_center" && (
          <CommandCenter
            currentTelemetry={currentTelemetry}
            sensorHealth={sensorHealth}
            statistics={statistics}
            history={history}
            onNavigateToAI={() => setActiveModule("ai_analysis")}
            onNavigateToTelemetry={() => setActiveModule("live_telemetry")}
            onNavigateToHealth={() => setActiveModule("sensor_health")}
            onNavigateToLab={() => setActiveModule("simulation_lab")}
          />
        )}

        {/* 2. Live Telemetry */}
        {activeModule === "live_telemetry" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <SensorCards
              currentTelemetry={currentTelemetry}
              sensorHealth={sensorHealth}
              history={history}
            />
            <TelemetryCharts history={history} />
          </div>
        )}

        {/* 3. AI Anomaly Analysis (Dedicated Dual-Model Comparison Engine) */}
        {activeModule === "ai_analysis" && (
          <AIAnomalyAnalysis currentTelemetry={currentTelemetry} />
        )}

        {/* 4. Sensor Health */}
        {activeModule === "sensor_health" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <SensorHealth sensorHealth={sensorHealth} />
          </div>
        )}

        {/* 5. Weather Intelligence */}
        {activeModule === "weather_intelligence" && (
          <WeatherIntelligence
            currentTelemetry={currentTelemetry}
            history={history}
          />
        )}

        {/* 6. Anomaly History */}
        {activeModule === "anomaly_history" && (
          <AnomalyHistory
            anomalies={anomalies}
            onFilterChange={handleFilterChange}
          />
        )}

        {/* 7. System & Hardware */}
        {activeModule === "system_hardware" && (
          <SystemHardware
            currentTelemetry={currentTelemetry}
            isConnected={isConnected}
          />
        )}

        {/* 8. Simulation Lab */}
        {activeModule === "simulation_lab" && (
          <SimulationLab
            onInjectAnomaly={handleInjectAnomaly}
            isInjecting={isInjecting}
            onUploadSuccess={loadInitialData}
            onAnalysisComplete={handleIncomingTelemetry}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: "center",
        padding: "24px 0 10px 0",
        color: "#64748b",
        fontSize: "12px",
        borderTop: "1px solid rgba(51, 65, 85, 0.4)",
        marginTop: "30px",
      }}>
        <div>Smart India Hackathon (SIH 26073) | Automatic Weather Station Intelligent AI/ML Anomaly Detection System</div>
        <div style={{ marginTop: "4px", color: "#475569" }}>
          Multi-Model Architecture: Isolation Forest (150 Trees) + Vectorized LSTM Sequence Autoencoder + SHAP Explainability + High-Fidelity Physics Simulator
        </div>
      </footer>

    </div>
  );
}
