import React, { useState, useEffect, useCallback, useRef } from "react";
import { AlertTriangle, WifiOff, RefreshCw, Bell, X } from "lucide-react";
import Header from "./components/Header";
import StatusBanner from "./components/StatusBanner";
import SensorCards from "./components/SensorCards";
import TelemetryCharts from "./components/TelemetryCharts";
import AnomalyPanel from "./components/AnomalyPanel";
import SensorHealth from "./components/SensorHealth";
import AnomalyHistory from "./components/AnomalyHistory";
import StatisticsCards from "./components/StatisticsCards";
import SimulatorControls from "./components/SimulatorControls";
import AdHocAnalyzer from "./components/AdHocAnalyzer";
import CsvUploader from "./components/CsvUploader";
import LiveAWSPrototype from "./components/LiveAWSPrototype";

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
} from "./services/api";

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSimulatorRunning, setIsSimulatorRunning] = useState(true);
  const [isRetraining, setIsRetraining] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeView, setActiveView] = useState("combined"); // 'combined', 'dashboard', 'prototype'

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
      console.error("Initial load failed:", err);
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

  if (initialLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
        <RefreshCw size={36} color="#38bdf8" className="animate-spin" />
        <h2 style={{ fontSize: "18px", color: "#f8fafc", fontWeight: "700" }}>Connecting to SkyGuard AI Backend...</h2>
        <p style={{ fontSize: "13px", color: "#94a3b8" }}>Initializing SQLite telemetry stream and ML isolation forest pipeline</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1480px", margin: "0 auto", padding: "20px" }}>
      
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

      {/* 1. Header with Navigation Tabs */}
      <Header
        isConnected={isConnected}
        isSimulatorRunning={isSimulatorRunning}
        onToggleSimulator={handleToggleSimulator}
        onRetrain={handleRetrain}
        isRetraining={isRetraining}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      {/* 2. LIVE AWS HARDWARE PROTOTYPE SECTION (Rendered on 'prototype' or 'combined') */}
      {(activeView === "prototype" || activeView === "combined") && (
        <section style={{ marginBottom: "28px" }}>
          <LiveAWSPrototype
            currentTelemetry={currentTelemetry}
            sensorHealth={sensorHealth}
            onInjectAnomaly={handleInjectAnomaly}
            isInjecting={isInjecting}
            isConnected={isConnected}
          />
        </section>
      )}

      {/* 3. CLOUD TELEMETRY & ML DASHBOARD SECTION (Rendered on 'dashboard' or 'combined') */}
      {(activeView === "dashboard" || activeView === "combined") && (
        <section>
          {activeView === "combined" && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              margin: "32px 0 16px 0",
              borderTop: "1px solid rgba(51, 65, 85, 0.5)",
              paddingTop: "20px"
            }}>
              <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#f8fafc", margin: 0 }}>
                Cloud Telemetry & Anomaly Detection Analytics
              </h2>
              <span style={{ fontSize: "12px", color: "#64748b" }}>(Isolation Forest ML Engine & Database Ingestion)</span>
            </div>
          )}

          {/* Overall System Status Banner */}
          <StatusBanner
            currentTelemetry={currentTelemetry}
            sensorHealth={sensorHealth}
          />

          {/* Statistics Overview Bar */}
          <StatisticsCards
            statistics={statistics}
            sensorHealth={sensorHealth}
          />

          {/* Current Sensor Readings Cards (Temp, Press, Humidity) */}
          <SensorCards
            currentTelemetry={currentTelemetry}
            sensorHealth={sensorHealth}
            history={history}
          />

          {/* Main Center Section: Live Time-Series Charts & Real-Time Anomaly Panel */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "24px" }}>
            <div style={{ minWidth: 0 }}>
              <TelemetryCharts history={history} />
            </div>
            <div style={{ minWidth: 0 }}>
              <AnomalyPanel currentTelemetry={currentTelemetry} />
            </div>
          </div>

          {/* Sensor Health & Predictive Maintenance Advisory */}
          <SensorHealth sensorHealth={sensorHealth} />

          {/* Anomaly Testing & Injection Controls */}
          {activeView === "dashboard" && (
            <SimulatorControls
              onInjectAnomaly={handleInjectAnomaly}
              isInjecting={isInjecting}
            />
          )}

          {/* AWS CSV Batch Dataset Ingestion & Visualizer */}
          <CsvUploader onUploadSuccess={loadInitialData} />

          {/* Recent Anomaly Incident Log */}
          <AnomalyHistory
            anomalies={anomalies}
            onFilterChange={handleFilterChange}
          />

          {/* Interactive Ad-Hoc Analyzer (Examiner Live Test Mode) */}
          <AdHocAnalyzer onAnalysisComplete={handleIncomingTelemetry} />
        </section>
      )}

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
        <div style={{ marginTop: "4px", color: "#475569" }}>Architecture: Arduino ATmega328P / ESP32 Node • FastAPI • Isolation Forest • SHAP • RobustScaler • React 19 • Recharts • SQLite</div>
      </footer>

    </div>
  );
}
