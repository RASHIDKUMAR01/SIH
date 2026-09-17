import React, { useState, useEffect, useCallback, useRef } from "react";
import { AlertTriangle, WifiOff, RefreshCw, Bell, X, ArrowLeft, CloudRain, Activity } from "lucide-react";
import Header from "./Header";
import LiveAWSPrototype from "./LiveAWSPrototype";
import StatusBanner from "./StatusBanner";
import SensorCards from "./SensorCards";
import TelemetryCharts from "./TelemetryCharts";
import AnomalyPanel from "./AnomalyPanel";
import SensorHealth from "./SensorHealth";
import AnomalyHistory from "./AnomalyHistory";
import StatisticsCards from "./StatisticsCards";
import SimulatorControls from "./SimulatorControls";
import AdHocAnalyzer from "./AdHocAnalyzer";
import CsvUploader from "./CsvUploader";

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

export default function LegacyDashboard({ onNavigateToNew, onLogout, user }) {
  const [activeView, setActiveView] = useState("dashboard"); // "dashboard", "prototype", "combined"
  const [isConnected, setIsConnected] = useState(false);
  const [isSimulatorRunning, setIsSimulatorRunning] = useState(true);
  const [isRetraining, setIsRetraining] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [timeStr, setTimeStr] = useState("");

  const [currentTelemetry, setCurrentTelemetry] = useState(null);
  const [history, setHistory] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [sensorHealth, setSensorHealth] = useState(null);
  const [statistics, setStatistics] = useState(null);

  const [activeAlert, setActiveAlert] = useState(null);
  const lastAnomalyTimeRef = useRef(null);

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
      console.error("Legacy initial load failed:", err);
      setIsConnected(false);
      setErrorMsg("Unable to connect to FastAPI backend. Retrying...");
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

  if (initialLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
        <RefreshCw size={36} color="#38bdf8" className="animate-spin" />
        <h2 style={{ fontSize: "18px", color: "#f8fafc", fontWeight: "700" }}>Loading Original SkyGuard AI Dashboard...</h2>
        <p style={{ fontSize: "13px", color: "#94a3b8" }}>Connecting to backend telemetry stream</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1480px", margin: "0 auto", padding: "20px" }}>
      
      {/* Top Banner Navigation back to New Dashboard */}
      <div style={{
        background: "rgba(15, 23, 42, 0.8)",
        border: "1px solid rgba(56, 189, 248, 0.3)",
        borderRadius: "8px",
        padding: "8px 16px",
        marginBottom: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8" }}>
          <span style={{
            background: "rgba(245, 158, 11, 0.2)",
            color: "#fbbf24",
            padding: "2px 8px",
            borderRadius: "4px",
            fontWeight: "700",
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}>
            Original Dashboard View
          </span>
          <span>Viewing the original Cloud Telemetry & Anomaly Detection interface</span>
        </div>

        <button
          onClick={onNavigateToNew}
          style={{
            background: "#0284c7",
            color: "#ffffff",
            border: "none",
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
          onMouseEnter={(e) => (e.currentTarget.style.background = "#0369a1")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#0284c7")}
        >
          <ArrowLeft size={13} /> Return to New Dashboard
        </button>
      </div>

      {/* Disconnection Banner */}
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
              <strong>Backend Disconnected:</strong> {errorMsg || "Attempting automatic reconnection to FastAPI server..."}
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

      {/* ORIGINAL HEADER WITH 3-WAY VIEW SWITCHER */}
      <Header
        isConnected={isConnected}
        isSimulatorRunning={isSimulatorRunning}
        onToggleSimulator={handleToggleSimulator}
        onRetrain={handleRetrain}
        isRetraining={isRetraining}
        activeView={activeView}
        onViewChange={setActiveView}
        onLogout={onLogout}
        user={user}
      />

      {/* VIEW 1: TELEMETRY DASHBOARD */}
      {(activeView === "dashboard" || activeView === "combined") && (
        <section style={{ marginBottom: activeView === "combined" ? "32px" : "0" }}>
          {/* 1. Overall System Status Banner */}
          <StatusBanner
            currentTelemetry={currentTelemetry}
            sensorHealth={sensorHealth}
          />

          {/* 2. Statistics Overview Bar */}
          <StatisticsCards
            statistics={statistics}
            sensorHealth={sensorHealth}
          />

          {/* 3. Current Sensor Readings Cards (Temp, Press, Humidity) */}
          <SensorCards
            currentTelemetry={currentTelemetry}
            sensorHealth={sensorHealth}
            history={history}
          />

          {/* 4. Main Center Section: Live Time-Series Charts & Real-Time Anomaly Panel */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "24px" }}>
            <div style={{ minWidth: 0 }}>
              <TelemetryCharts history={history} />
            </div>
            <div style={{ minWidth: 0 }}>
              <AnomalyPanel currentTelemetry={currentTelemetry} />
            </div>
          </div>

          {/* 5. Sensor Health & Predictive Maintenance Advisory */}
          <SensorHealth sensorHealth={sensorHealth} />

          {/* 6. Anomaly Testing & Injection Controls */}
          <SimulatorControls
            onInjectAnomaly={handleInjectAnomaly}
            isInjecting={isInjecting}
          />

          {/* 7. AWS CSV Batch Dataset Ingestion & Visualizer */}
          <CsvUploader onUploadSuccess={loadInitialData} />

          {/* 8. Recent Anomaly Incident Log */}
          <AnomalyHistory
            anomalies={anomalies}
            onFilterChange={handleFilterChange}
          />

          {/* 9. Interactive Ad-Hoc Analyzer (Examiner Live Test Mode) */}
          <AdHocAnalyzer onAnalysisComplete={handleIncomingTelemetry} />
        </section>
      )}

      {/* VIEW 2: LIVE AWS PROTOTYPE (LED LIGHTS, BUZZER & SERIAL TERMINAL) */}
      {(activeView === "prototype" || activeView === "combined") && (
        <section>
          <LiveAWSPrototype
            currentTelemetry={currentTelemetry}
            sensorHealth={sensorHealth}
            onInjectAnomaly={handleInjectAnomaly}
            isInjecting={isInjecting}
            isConnected={isConnected}
          />
        </section>
      )}

      {/* ORIGINAL FOOTER */}
      <footer style={{
        textAlign: "center",
        padding: "24px 0 10px 0",
        color: "#64748b",
        fontSize: "12px",
        borderTop: "1px solid rgba(51, 65, 85, 0.4)",
        marginTop: "30px",
      }}>
        <div>Smart India Hackathon (SIH 26073) | Automatic Weather Station Intelligent AI/ML Anomaly Detection System</div>
        <div style={{ marginTop: "4px", color: "#475569" }}>Architecture: FastAPI • Isolation Forest • SHAP • RobustScaler • React • Recharts • SQLite</div>
      </footer>

    </div>
  );
}
