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
  LogOut,
  UserCheck,
  ShieldCheck,
  Radio,
} from "lucide-react";

import CommandCenter from "./CommandCenter";
import LiveTelemetry from "./LiveTelemetry";
import AIAnomalyAnalysis from "./AIAnomalyAnalysis";
import WeatherIntelligence from "./WeatherIntelligence";
import SystemHardware from "./SystemHardware";
import SimulationLab from "./SimulationLab";
import SensorHealth from "./SensorHealth";
import AnomalyHistory from "./AnomalyHistory";
import MultiStationNetwork from "./MultiStationNetwork";

import {
  fetchHealth,
  fetchCurrentTelemetry,
  fetchHistory,
  fetchAnomalies,
  fetchSensorHealth,
  fetchStatistics,
  fetchStations,
  selectPrimaryStation,
  triggerScenario,
  startSimulator,
  stopSimulator,
  injectAnomaly,
  triggerModelRetrain,
  connectTelemetryWebSocket,
} from "../services/api";

export default function NewDashboard({ onNavigateToLegacy, onLogout, user }) {
  const [activeModule, setActiveModule] = useState("command_center"); // 9 modules
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

  // Multi-Station Mesonet State
  const [stations, setStations] = useState([]);
  const [activeScenario, setActiveScenario] = useState("SCENARIO_E_NOMINAL");
  const [primaryStationId, setPrimaryStationId] = useState("AWS-01");
  const [networkHealth, setNetworkHealth] = useState(100.0);
  const [spatialTopology, setSpatialTopology] = useState([]);
  const [stationDropdownOpen, setStationDropdownOpen] = useState(false);
  const [isScenarioRunning, setIsScenarioRunning] = useState(false);

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

    if (data.stations) setStations(data.stations);
    if (data.active_scenario) setActiveScenario(data.active_scenario);
    if (data.spatial_topology) setSpatialTopology(data.spatial_topology);
    if (data.network_health != null) setNetworkHealth(data.network_health);
    if (data.station_id) setPrimaryStationId(data.station_id);

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
      const [healthCheck, curr, hist, health, stats, anom, stList] = await Promise.allSettled([
        fetchHealth(),
        fetchCurrentTelemetry(),
        fetchHistory(60),
        fetchSensorHealth(),
        fetchStatistics(),
        fetchAnomalies(30),
        fetchStations(),
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

      if (stList.status === "fulfilled" && stList.value?.stations) {
        setStations(stList.value.stations);
        if (stList.value.primary_station_id) setPrimaryStationId(stList.value.primary_station_id);
        if (stList.value.network_health != null) setNetworkHealth(stList.value.network_health);
        if (stList.value.spatial_topology) setSpatialTopology(stList.value.spatial_topology);
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

  const handleSelectStation = async (stationId) => {
    try {
      setPrimaryStationId(stationId);
      setStationDropdownOpen(false);
      await selectPrimaryStation(stationId);
    } catch (err) {
      console.error("Failed to select primary station:", err);
    }
  };

  const handleTriggerScenario = async (scenarioKey) => {
    setIsScenarioRunning(true);
    try {
      await triggerScenario(scenarioKey);
    } catch (err) {
      console.error("Failed to trigger scenario:", err);
    } finally {
      setTimeout(() => setIsScenarioRunning(false), 1500);
    }
  };

  const modules = [
    { id: "command_center", label: "Command Center", subtitle: "Master Situation Deck", icon: LayoutDashboard },
    { id: "aws_network", label: "AWS Network / Fleet", subtitle: "Multi-Station Mesonet", badge: "MESONET", icon: Radio },
    { id: "live_telemetry", label: "Live Telemetry", subtitle: "4-Channel Oscilloscope", badge: "LIVE", icon: Activity },
    { id: "ai_analysis", label: "AI Anomaly Analysis", subtitle: "LSTM Temporal Neural Net...", badge: "LSTM", icon: BrainCircuit },
    { id: "sensor_health", label: "Sensor Health", subtitle: "Transducer Fleet Matrix", icon: HeartPulse },
    { id: "weather_intelligence", label: "Weather Intelligence", subtitle: "Synoptic Thermodynamics", icon: CloudRain },
    { id: "anomaly_history", label: "Anomaly History", subtitle: "SQLite Event Archive", icon: HistoryIcon },
    { id: "system_hardware", label: "System & Hardware", subtitle: "Topology & HW Bridge", icon: Cpu },
    { id: "simulation_lab", label: "Simulation Lab", subtitle: "9 Calibrated Scenarios", badge: "TESTBED", icon: FlaskConical },
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
          <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "#64748b", padding: "6px 8px 4px 8px", letterSpacing: "0.8px" }}>
            CONTROL MODULES
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
                  padding: "8px 10px",
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
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <Icon
                    size={17}
                    color={isActive ? "#38bdf8" : "#94a3b8"}
                    style={{ flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: "12.5px",
                      fontWeight: isActive ? "700" : "500",
                      color: isActive ? "#ffffff" : "#cbd5e1",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {m.label}
                    </div>
                    <div style={{
                      fontSize: "10px",
                      color: "#64748b",
                      marginTop: "1px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {m.subtitle}
                    </div>
                  </div>
                </div>

                {m.badge ? (
                  <span style={{
                    background: m.badge === "LIVE" ? "rgba(56, 189, 248, 0.2)" : m.badge === "LSTM" ? "rgba(168, 85, 247, 0.2)" : "rgba(100, 116, 139, 0.2)",
                    color: m.badge === "LIVE" ? "#38bdf8" : m.badge === "LSTM" ? "#c084fc" : "#94a3b8",
                    border: `1px solid ${m.badge === "LIVE" ? "rgba(56, 189, 248, 0.4)" : m.badge === "LSTM" ? "rgba(168, 85, 247, 0.4)" : "rgba(100, 116, 139, 0.4)"}`,
                    borderRadius: "4px",
                    padding: "1px 5px",
                    fontSize: "9px",
                    fontWeight: "800",
                    marginLeft: "6px",
                    flexShrink: 0,
                  }}>
                    {m.badge}
                  </span>
                ) : (
                  isActive && <ChevronRight size={13} color="#38bdf8" style={{ flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Active ML Model Card */}
        <div style={{
          background: "rgba(15, 23, 42, 0.7)",
          border: "1px solid rgba(51, 65, 85, 0.6)",
          borderRadius: "8px",
          padding: "10px 12px",
          margin: "0 10px 8px 10px",
          fontSize: "11px",
          fontFamily: "var(--font-mono, monospace)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#94a3b8", fontWeight: "700" }}>
              <BrainCircuit size={13} color="#38bdf8" />
              <span>ACTIVE ML MODEL</span>
            </div>
            <span style={{
              background: "rgba(56, 189, 248, 0.2)",
              color: "#38bdf8",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              borderRadius: "4px",
              padding: "1px 6px",
              fontSize: "10px",
              fontWeight: "700",
            }}>
              LSTM
            </span>
          </div>
          <div style={{ fontWeight: "700", color: "#f8fafc", fontSize: "11px", marginBottom: "2px" }}>
            Recurrent Neural Network
          </div>
          <div style={{ color: "#94a3b8", fontSize: "10px" }}>Role: Temporal Anomaly Detection</div>
          <div style={{ color: "#94a3b8", fontSize: "10px" }}>Window: 15 samples (15 min)</div>
          <div style={{ color: "#94a3b8", fontSize: "10px" }}>Threshold: 0.28959</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px", borderTop: "1px solid rgba(51, 65, 85, 0.4)", paddingTop: "4px" }}>
            <span style={{ color: "#cbd5e1", fontSize: "10px" }}>Production Baseline: Model A</span>
            <span style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399", padding: "1px 4px", borderRadius: "3px", fontSize: "9px", fontWeight: "700" }}>
              ACTIVE
            </span>
          </div>
        </div>

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
          padding: "10px 24px",
          background: "rgba(10, 14, 23, 0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(51, 65, 85, 0.5)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}>
          {/* Left: Station Node Dropdown */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setStationDropdownOpen(!stationDropdownOpen)}
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(51, 65, 85, 0.6)",
                borderRadius: "8px",
                padding: "6px 12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                fontFamily: "var(--font-mono, monospace)",
                color: "#38bdf8",
                cursor: "pointer",
              }}
            >
              <Radio size={14} color="#38bdf8" />
              <strong style={{ color: "#f8fafc" }}>
                {primaryStationId} ({stations.find(s => s.station_id === primaryStationId)?.name || "AWS Node"})
              </strong>
              <span style={{ color: "#64748b", fontSize: "10px" }}>{stationDropdownOpen ? "▲" : "▼"}</span>
            </button>

            {stationDropdownOpen && (
              <div style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: "6px",
                width: "290px",
                background: "#0f172a",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                borderRadius: "8px",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.6)",
                zIndex: 100,
                overflow: "hidden",
              }}>
                <div style={{ padding: "8px 12px", background: "rgba(30, 41, 59, 0.8)", borderBottom: "1px solid rgba(51, 65, 85, 0.6)", fontSize: "11px", fontWeight: "700", color: "#94a3b8" }}>
                  SELECT ACTIVE AWS MESONET NODE
                </div>
                <div style={{ maxHeight: "240px", overflowY: "auto" }}>
                  {stations.map((st) => (
                    <button
                      key={st.station_id}
                      onClick={() => handleSelectStation(st.station_id)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: st.station_id === primaryStationId ? "rgba(14, 165, 233, 0.15)" : "transparent",
                        border: "none",
                        borderBottom: "1px solid rgba(51, 65, 85, 0.3)",
                        cursor: "pointer",
                        textAlign: "left",
                        color: "#f8fafc",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(30, 41, 59, 0.5)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = st.station_id === primaryStationId ? "rgba(14, 165, 233, 0.15)" : "transparent"}
                    >
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: "700", color: st.station_id === primaryStationId ? "#38bdf8" : "#f8fafc" }}>
                          {st.station_id} - {st.name}
                        </div>
                        <div style={{ fontSize: "10px", color: "#64748b" }}>
                          Trust: {((st.trust_score || 1) * 100).toFixed(0)}% | {st.local_status || "NORMAL"}
                        </div>
                      </div>
                      <span style={{
                        fontSize: "9px",
                        fontWeight: "700",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: st.local_status === "ANOMALY" ? "rgba(239, 68, 68, 0.2)" : st.local_status === "OFFLINE" ? "rgba(100, 116, 139, 0.2)" : "rgba(16, 185, 129, 0.2)",
                        color: st.local_status === "ANOMALY" ? "#f87171" : st.local_status === "OFFLINE" ? "#94a3b8" : "#34d399",
                      }}>
                        {st.local_status || "NORMAL"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center: Dual UTC & Local Clock */}
          <div style={{
            background: "rgba(15, 23, 42, 0.7)",
            border: "1px solid rgba(51, 65, 85, 0.5)",
            borderRadius: "6px",
            padding: "5px 12px",
            fontSize: "11px",
            fontFamily: "var(--font-mono, monospace)",
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <Clock size={12} color="#64748b" />
            <span>UTC: <strong style={{ color: "#f8fafc" }}>{new Date().toUTCString().slice(17, 25)}</strong> UTC</span>
            <span style={{ color: "#475569" }}>|</span>
            <span>LOCAL: <strong style={{ color: "#38bdf8" }}>{new Date().toLocaleTimeString()}</strong></span>
          </div>

          {/* Right: Mode Switcher Pills & Health Status */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            
            {/* Mode Switcher Pills */}
            <div style={{
              display: "flex",
              background: "rgba(15, 23, 42, 0.8)",
              padding: "2px",
              borderRadius: "6px",
              border: "1px solid rgba(51, 65, 85, 0.6)",
            }}>
              <span style={{
                background: "#0284c7",
                color: "#ffffff",
                padding: "3px 8px",
                borderRadius: "4px",
                fontSize: "10.5px",
                fontWeight: "700",
                fontFamily: "var(--font-mono, monospace)",
              }}>
                PHYSICAL HW
              </span>
              <span style={{
                background: "transparent",
                color: "#94a3b8",
                padding: "3px 8px",
                borderRadius: "4px",
                fontSize: "10.5px",
                fontWeight: "600",
                fontFamily: "var(--font-mono, monospace)",
              }}>
                SIMULATION
              </span>
            </div>

            {/* HW: Not Connected Badge */}
            <div style={{
              background: "rgba(15, 23, 42, 0.7)",
              border: "1px solid rgba(51, 65, 85, 0.5)",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "10.5px",
              color: "#94a3b8",
              fontFamily: "var(--font-mono, monospace)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#64748b" }} />
              <span>HW: NOT CONNECTED</span>
            </div>

            {/* API: Online */}
            <div style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "10.5px",
              color: "#34d399",
              fontWeight: "700",
              fontFamily: "var(--font-mono, monospace)",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
              <span>API: ONLINE</span>
            </div>

            {/* ML: Online */}
            <div style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "10.5px",
              color: "#34d399",
              fontWeight: "700",
              fontFamily: "var(--font-mono, monospace)",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}>
              <BrainCircuit size={11} color="#34d399" />
              <span>ML: ONLINE</span>
            </div>

            {/* DB: Online */}
            <div style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "10.5px",
              color: "#34d399",
              fontWeight: "700",
              fontFamily: "var(--font-mono, monospace)",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}>
              <span>DB: ONLINE</span>
            </div>

            {/* Legacy View Link */}
            <button
              onClick={onNavigateToLegacy}
              style={{
                background: "rgba(30, 41, 59, 0.6)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                borderRadius: "6px",
                padding: "4px 8px",
                color: "#38bdf8",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span>Legacy View</span>
              <ExternalLink size={11} />
            </button>

            {/* Operator Profile Badge */}
            <div style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(51, 65, 85, 0.7)",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "11px",
              color: "#cbd5e1",
              fontFamily: "var(--font-mono, monospace)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}>
              <UserCheck size={12} color="#38bdf8" />
              <span>{user?.username || "admin"}</span>
            </div>

            {/* Logout Action */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  color: "#fca5a5",
                  fontSize: "11px",
                  fontWeight: "700",
                  fontFamily: "var(--font-mono, monospace)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)";
                  e.currentTarget.style.borderColor = "#f87171";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)";
                  e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
                }}
                title="Logout & Secure Station Access"
              >
                <LogOut size={12} />
                <span>LOGOUT</span>
              </button>
            )}


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
              stations={stations}
              networkHealth={networkHealth}
              spatialTopology={spatialTopology}
              onNavigateToAI={() => setActiveModule("ai_analysis")}
              onNavigateToTelemetry={() => setActiveModule("live_telemetry")}
              onNavigateToHealth={() => setActiveModule("sensor_health")}
              onNavigateToLab={() => setActiveModule("simulation_lab")}
              onNavigateToNetwork={() => setActiveModule("aws_network")}
              onTriggerScenario={handleTriggerScenario}
              onSelectStation={handleSelectStation}
              isScenarioRunning={isScenarioRunning}
            />
          )}

          {activeModule === "aws_network" && (
            <MultiStationNetwork
              stations={stations}
              primaryStationId={primaryStationId}
              networkHealth={networkHealth}
              spatialTopology={spatialTopology}
              onSelectStation={handleSelectStation}
              onTriggerScenario={handleTriggerScenario}
              isScenarioRunning={isScenarioRunning}
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
            padding: "20px 0 12px 0",
            color: "#64748b",
            fontSize: "12px",
            borderTop: "1px solid rgba(51, 65, 85, 0.4)",
            marginTop: "24px",
          }}>
            <div>Smart India Hackathon (SIH 26073) | Automatic Weather Station Intelligent AI/ML Anomaly Detection System</div>
            <div style={{ marginTop: "4px", color: "#475569" }}>
              Dual Model Pipeline: Isolation Forest (150 Trees) + Vectorized LSTM Sequence Autoencoder + SHAP Analysis | Hardware Node: {primaryStationId} (AWS)
            </div>
          </footer>

        </main>

        {/* Bottom Cockpit Status Bar */}
        <div style={{
          background: "#080c14",
          borderTop: "1px solid rgba(51, 65, 85, 0.6)",
          padding: "7px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
          fontFamily: "var(--font-mono, monospace)",
          color: "#94a3b8",
          flexWrap: "wrap",
          gap: "12px",
          position: "sticky",
          bottom: 0,
          zIndex: 30,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ color: "#38bdf8", fontWeight: "700" }}>⚡ AWS NODE: <strong>{primaryStationId}</strong></span>
            <span style={{ color: "#475569" }}>|</span>
            <span style={{ color: "#fbbf24", fontWeight: "700" }}>
              STATUS: <strong>PHYSICAL HW DISCONNECTED (SIMULATION STREAM ACTIVE)</strong>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span>📊 PERSISTED: <strong style={{ color: "#f8fafc" }}>{statistics?.total_readings ?? history.length}</strong></span>
            <span style={{ color: "#475569" }}>|</span>
            <span>⚡ SYNC: <strong style={{ color: "#34d399" }}>{new Date().toLocaleTimeString()}</strong></span>
          </div>
        </div>
      </div>

    </div>
  );
}
