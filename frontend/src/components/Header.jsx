import React, { useState, useEffect } from "react";
import { Activity, Radio, CloudRain, Cpu, RefreshCw, CheckCircle, AlertTriangle, LayoutDashboard, LogOut, UserCheck } from "lucide-react";

export default function Header({
  isConnected,
  isSimulatorRunning,
  onToggleSimulator,
  onRetrain,
  isRetraining,
  activeView = "dashboard",
  onViewChange,
  onLogout,
  user,
}) {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toUTCString().replace("GMT", "UTC"));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="glass-panel" style={{ padding: "16px 24px", marginBottom: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        
        {/* Logo & Problem Statement Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 20px rgba(14, 165, 233, 0.4)",
          }}>
            <CloudRain size={28} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1 style={{ fontSize: "24px", fontWeight: "800", letterSpacing: "-0.5px", color: "#f8fafc", margin: 0 }}>
                SkyGuard <span style={{ color: "#38bdf8" }}>AI</span>
              </h1>
              <span style={{
                background: "rgba(14, 165, 233, 0.15)",
                color: "#38bdf8",
                border: "1px solid rgba(14, 165, 233, 0.3)",
                padding: "2px 8px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "700",
                letterSpacing: "0.5px"
              }}>
                SIH 26073
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "2px 0 0 0" }}>
              Intelligent AWS Anomaly Detection & Predictive Health Platform
            </p>
          </div>
        </div>

        {/* View Switcher Navigation Tabs */}
        {onViewChange && (
          <div style={{
            display: "flex",
            gap: "6px",
            background: "rgba(15, 23, 42, 0.7)",
            padding: "4px",
            borderRadius: "10px",
            border: "1px solid rgba(51, 65, 85, 0.6)",
          }}>
            <button
              onClick={() => onViewChange("dashboard")}
              className="btn-control"
              style={{
                background: activeView === "dashboard" ? "#0284c7" : "transparent",
                border: "none",
                color: activeView === "dashboard" ? "#fff" : "#94a3b8",
                fontSize: "12px",
                padding: "6px 14px",
              }}
            >
              <LayoutDashboard size={14} /> Telemetry Dashboard
            </button>

            <button
              onClick={() => onViewChange("prototype")}
              className="btn-control"
              style={{
                background: activeView === "prototype" ? "#0284c7" : "transparent",
                border: "none",
                color: activeView === "prototype" ? "#fff" : "#94a3b8",
                fontSize: "12px",
                padding: "6px 14px",
              }}
            >
              <Cpu size={14} /> Live AWS Prototype
            </button>

            <button
              onClick={() => onViewChange("combined")}
              className="btn-control"
              style={{
                background: activeView === "combined" ? "#0284c7" : "transparent",
                border: "none",
                color: activeView === "combined" ? "#fff" : "#94a3b8",
                fontSize: "12px",
                padding: "6px 14px",
              }}
            >
              <Activity size={14} /> Combined View
            </button>
          </div>
        )}

        {/* Status Badges & Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          
          {/* Station Metadata */}
          <div style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(51, 65, 85, 0.5)",
            borderRadius: "8px",
            padding: "6px 12px",
            fontSize: "12px",
            color: "#cbd5e1"
          }}>
            <span style={{ color: "#64748b" }}>Node: </span>
            <strong style={{ color: "#e2e8f0" }}>AWS-TINKER-01</strong>
            <span style={{ margin: "0 6px", color: "#475569" }}>|</span>
            <span style={{ fontFamily: "monospace", color: "#94a3b8" }}>{timeStr}</span>
          </div>

          {/* Backend Connection Indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
            <div className={isConnected ? "live-indicator" : "live-indicator-danger"} />
            <span style={{ color: isConnected ? "#34d399" : "#f87171", fontWeight: "600" }}>
              {isConnected ? "API LIVE" : "DISCONNECTED"}
            </span>
          </div>

          {/* Simulator Stream Toggle */}
          <button
            onClick={onToggleSimulator}
            className={`btn-control ${isSimulatorRunning ? "btn-danger" : "btn-primary"}`}
            title="Toggle Background Synthetic Telemetry Stream"
          >
            <Activity size={15} />
            {isSimulatorRunning ? "Pause Stream" : "Start Stream"}
          </button>

          {/* Model Retrain Trigger */}
          <button
            onClick={onRetrain}
            disabled={isRetraining}
            className="btn-control"
            style={{ borderColor: "#a855f7", color: "#d8b4fe" }}
            title="Trigger Background Model Retraining with Calibrated Isolation Forest"
          >
            <RefreshCw size={14} className={isRetraining ? "animate-spin" : ""} />
            {isRetraining ? "Retraining..." : "Retrain ML"}
          </button>

          {/* Operator Profile Pill */}
          <div style={{
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid rgba(51, 65, 85, 0.7)",
            borderRadius: "6px",
            padding: "5px 10px",
            fontSize: "11px",
            color: "#cbd5e1",
            fontFamily: "var(--font-mono, monospace)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}>
            <UserCheck size={13} color="#38bdf8" />
            <span>{user?.username || "admin"}</span>
          </div>

          {/* Logout Button */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="btn-control btn-danger"
              style={{
                fontSize: "11px",
                padding: "5px 10px",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
              title="Logout & Secure Station Access"
            >
              <LogOut size={13} />
              <span>LOGOUT</span>
            </button>
          )}

        </div>

      </div>
    </header>
  );
}
