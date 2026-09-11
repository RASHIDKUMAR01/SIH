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
  ExternalLink,
  ChevronRight,
  Clock,
  Play,
  Pause,
} from "lucide-react";

import CommandCenter from "./CommandCenter";
import LiveTelemetry from "./LiveTelemetry";
import AIAnomalyAnalysis from "./AIAnomalyAnalysis";
import WeatherIntelligence from "./WeatherIntelligence";
import SystemHardware from "./SystemHardware";
import SimulationLab from "./SimulationLab";
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
  const [initialLoading, setInitialLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [timeStr, setTimeStr] = useState("");

  const [currentTelemetry, setCurrentTelemetry] = useState(null);
  const [history, setHistory] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [sensorHealth, setSensorHealth] = useState(null);
  const [statistics, setStatistics] = useState(null);

  const [activeAlert, setActiveAlert] = useState(null);
  const lastAnomalyTimeRef = useRef(null);

  // Real-time UTC clock updater
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toUTCString().replace("GMT", "UTC"));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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
    { id: "command_center", label: "Command Center", subtitle: "Executive Overview & System Matrix", icon: LayoutDashboard },
    { id: "live_telemetry", label: "Live Telemetry", subtitle: "6-Channel High-Speed Ingestion", icon: Activity },
    { id: "ai_analysis", label: "AI Anomaly Analysis", subtitle: "Isolation Forest + LSTM Sequence Autoencoder", icon: BrainCircuit },
    { id: "sensor_health", label: "Sensor Health", subtitle: "Hardware Diagnostics & Predictive Maintenance", icon: HeartPulse },
    { id: "weather_intelligence", label: "Weather Intelligence", subtitle: "Dew Point, Density & Barometric Trends", icon: CloudRain },
    { id: "anomaly_history", label: "Anomaly History", subtitle: "Audit Records & Multi-Model Corroboration", icon: HistoryIcon },
    { id: "system_hardware", label: "System & Hardware", subtitle: "UART Terminal, GPIO & Firmware Blueprint", icon: Cpu },
    { id: "simulation_lab", label: "Simulation Lab", subtitle: "9 Fault Scenarios, Ad-Hoc & CSV Evaluator", icon: FlaskConical },
  ];

  const currentModuleObj = modules.find((m) => m.id === activeModule) || modules[0];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0e17", color: "#f8fafc" }}>
      
      {/* ============================================================ */}
      {/* 1. LEFT NAVIGATION SIDEBAR (CONTROL ROOM COCKPIT) */}
      {/* ============================================================ */}
      <aside style={{
        width: "280px",
        minWidth: "280px",
        background: "linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 14, 23, 0.98) 100%)",
        borderRight: "1px solid rgba(51, 65, 85, 0.5)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
        zIndex: 50,
      }}>
        
        {/* Sidebar Header: Logo & Branding */}
        <div style={{ padding: "20px 18px 16px 18px", borderBottom: "1px solid rgba(51, 65, 85, 0.4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 16px rgba(14, 165, 233, 0.4)",
              flexShrink: 0
            }}>
              <CloudRain size={24} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px", fontWeight: "800", letterSpacing: "-0.5px", color: "#f8fafc" }}>
                  SkyGuard <span style={{ color: "#38bdf8" }}>AI</span>
                </span>
                <span style={{
                  background: "rgba(14, 165, 233, 0.15)",
                  color: "#38bdf8",
                  border: "1px solid rgba(14, 165, 233, 0.3)",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: "700",
                }}>
                  SIH 26073
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                AWS Intelligent Anomaly System
              </div>
            </div>
          </div>

          {/* Station Identification & Hardware Status Badges */}
          <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{
              background: "rgba(30, 41, 59, 0.7)",
              border: "1px solid rgba(51, 65, 85, 0.6)",
              borderRadius: "6px",
              padding: "5px 10px",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{ color: "#94a3b8" }}>Active Node:</span>
              <strong style={{ color: "#38bdf8", fontFamily: "var(--font-mono)" }}>AWS-TINKER-01</strong>
            </div>

            <div style={{
              background: isSimulatorRunning ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
              border: isSimulatorRunning ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "6px",
              padding: "5px 10px",
              fontSize: "10px",
              fontWeight: "700",
              letterSpacing: "0.4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: isSimulatorRunning ? "#34d399" : "#fbbf24"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: isSimulatorRunning ? "#10b981" : "#f59e0b",
                  boxShadow: isSimulatorRunning ? "0 0 8px #10b981" : "none"
                }} />
                <span>{isSimulatorRunning ? "SIMULATION STREAM ACTIVE" : "STREAM PAUSED"}</span>
              </div>
              <span style={{ color: "#94a3b8", fontWeight: "normal", fontSize: "9px" }}>1 Hz</span>
            </div>

            <div style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(51, 65, 85, 0.4)",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "9.5px",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#64748b" }} />
              <span>HARDWARE: STANDBY FOR SERIAL</span>
            </div>
          </div>
        </div>

        {/* Sidebar Nav: 8 Core Modules */}
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "#64748b", padding: "6px 8px 4px 8px", letterSpacing: "0.5px" }}>
            Navigation Modules (8)
          </div>

          {modules.map((m) => {
            const Icon = m.icon;
            const isActive = activeModule === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setActiveModule(m.id)}
                style={{
                  background: isActive ? "linear-gradient(90deg, rgba(2, 132, 199, 0.3) 0%, rgba(2, 132, 199, 0.08) 100%)" : "transparent",
                  borderLeft: isActive ? "3px solid #38bdf8" : "3px solid transparent",
                  borderTop: "1px solid transparent",
                  borderRight: "1px solid transparent",
                  borderBottom: "1px solid transparent",
                  borderRadius: "0 8px 8px 0",
                  padding: "9px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  textAlign: "left",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(30, 41, 59, 0.5)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Icon
                    size={17}
                    color={isActive ? "#38bdf8" : "#94a3b8"}
                    style={{ flexShrink: 0 }}
                  />
                  <div>
                    <div style={{
                      fontSize: "13px",
                      fontWeight: isActive ? "700" : "500",
                      color: isActive ? "#ffffff" : "#cbd5e1"
                    }}>
                      {m.label}
                    </div>
                  </div>
                </div>
                {isActive && <ChevronRight size={14} color="#38bdf8" />}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Quick Controls & Switch to Legacy */}
        <div style={{
          padding: "14px 16px",
          borderTop: "1px solid rgba(51, 65, 85, 0.4)",
          background: "rgba(10, 14, 23, 0.6)",
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}>
          {/* Quick Stream & Retrain Controls */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <button
              onClick={handleToggleSimulator}
              className={`btn-control ${isSimulatorRunning ? "btn-danger" : "btn-primary"}`}
              style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center" }}
              title="Pause or resume synthetic telemetry stream"
            >
              {isSimulatorRunning ? <Pause size={12} /> : <Play size={12} />}
              {isSimulatorRunning ? "Pause Stream" : "Resume"}
            </button>

            <button
              onClick={handleRetrain}
              disabled={isRetraining}
              className="btn-control"
              style={{
                fontSize: "11px",
                padding: "6px 8px",
                justifyContent: "center",
                borderColor: "#a855f7",
                color: "#d8b4fe"
              }}
              title="Calibrate Isolation Forest + LSTM models"
            >
              <RefreshCw size={12} className={isRetraining ? "animate-spin" : ""} />
              {isRetraining ? "Training..." : "Retrain ML"}
            </button>
          </div>

          {/* Switch to Original Dashboard Button */}
          <button
            onClick={onNavigateToLegacy}
            style={{
              background: "linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              borderRadius: "8px",
              padding: "9px 12px",
              color: "#38bdf8",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(2, 132, 199, 0.2) 0%, rgba(30, 41, 59, 0.9) 100%)";
              e.currentTarget.style.borderColor = "#38bdf8";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)";
              e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.4)";
              e.currentTarget.style.transform = "none";
            }}
          >
            <HistoryIcon size={14} />
            <span>⚡ Original Dashboard</span>
            <ExternalLink size={12} />
          </button>
        </div>

      </aside>

      {/* ============================================================ */}
      {/* 2. MAIN CONTENT AREA (ACTIVE MODULE RENDERER) */}
      {/* ============================================================ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto", height: "100vh" }}>
        
        {/* Top Control Bar */}
        <header style={{
          padding: "14px 24px",
          background: "rgba(15, 23, 42, 0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(51, 65, 85, 0.5)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", textTransform: "uppercase", color: "#38bdf8", fontWeight: "700", letterSpacing: "0.5px" }}>
                SkyGuard Control Room
              </span>
              <span style={{ color: "#64748b" }}>/</span>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>{currentModuleObj.label}</span>
            </div>
            <h1 style={{ fontSize: "19px", fontWeight: "800", color: "#f8fafc", margin: "2px 0 0 0" }}>
              {currentModuleObj.label}
            </h1>
          </div>

          {/* Top Bar Stats & Telemetry Pill */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            
            {/* Real-Time UTC Timestamp */}
            <div style={{
              background: "rgba(15, 23, 42, 0.7)",
              border: "1px solid rgba(51, 65, 85, 0.5)",
              borderRadius: "6px",
              padding: "5px 10px",
              fontSize: "11px",
              color: "#94a3b8",
              fontFamily: "var(--font-mono)",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <Clock size={12} color="#64748b" />
              <span>{timeStr || "UTC Syncing..."}</span>
            </div>

            {/* Model Architecture Indicator */}
            <div style={{
              background: "rgba(14, 165, 233, 0.1)",
              border: "1px solid rgba(14, 165, 233, 0.3)",
              borderRadius: "6px",
              padding: "5px 10px",
              fontSize: "11px",
              color: "#38bdf8",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <BrainCircuit size={13} />
              <span>Isolation Forest + LSTM Parallel</span>
            </div>

            {/* Backend Connection Indicator */}
            <div style={{
              background: isConnected ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
              border: isConnected ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "6px",
              padding: "5px 10px",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <div className={isConnected ? "live-indicator" : "live-indicator-danger"} style={{ width: "8px", height: "8px" }} />
              <span style={{ color: isConnected ? "#34d399" : "#f87171", fontWeight: "700" }}>
                {isConnected ? "FASTAPI LIVE" : "DISCONNECTED"}
              </span>
            </div>

          </div>
        </header>

        {/* Main Body Content Container */}
        <main style={{ padding: "24px", maxWidth: "1500px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          
          {/* Disconnection Warning */}
          {!isConnected && (
            <div style={{
              background: "rgba(220, 38, 38, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.5)",
              borderRadius: "10px",
              padding: "12px 18px",
              marginBottom: "20px",
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

          {/* Dynamic Module Rendering */}
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

          {activeModule === "live_telemetry" && (
            <LiveTelemetry
              currentTelemetry={currentTelemetry}
              history={history}
            />
          )}

          {activeModule === "ai_analysis" && (
            <AIAnomalyAnalysis currentTelemetry={currentTelemetry} />
          )}

          {activeModule === "sensor_health" && (
            <SensorHealth sensorHealth={sensorHealth} />
          )}

          {activeModule === "weather_intelligence" && (
            <WeatherIntelligence
              currentTelemetry={currentTelemetry}
              history={history}
            />
          )}

          {activeModule === "anomaly_history" && (
            <AnomalyHistory
              anomalies={anomalies}
              onFilterChange={handleFilterChange}
            />
          )}

          {activeModule === "system_hardware" && (
            <SystemHardware
              currentTelemetry={currentTelemetry}
              isConnected={isConnected}
            />
          )}

          {activeModule === "simulation_lab" && (
            <SimulationLab
              onInjectAnomaly={handleInjectAnomaly}
              isInjecting={isInjecting}
              onUploadSuccess={loadInitialData}
              onAnalysisComplete={handleIncomingTelemetry}
            />
          )}

          {/* Module-Level Footer */}
          <footer style={{
            textAlign: "center",
            padding: "28px 0 16px 0",
            color: "#64748b",
            fontSize: "12px",
            borderTop: "1px solid rgba(51, 65, 85, 0.4)",
            marginTop: "36px",
          }}>
            <div>Smart India Hackathon (SIH 26073) | Automatic Weather Station Intelligent AI/ML Anomaly Detection System</div>
            <div style={{ marginTop: "4px", color: "#475569" }}>
              Dual Model Pipeline: Isolation Forest (150 Trees) + Vectorized LSTM Sequence Autoencoder + SHAP Analysis | Hardware Node: AWS-TINKER-01
            </div>
          </footer>

        </main>
      </div>

    </div>
  );
}
