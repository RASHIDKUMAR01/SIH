import React, { useState } from "react";
import {
  Radio,
  Wifi,
  WifiOff,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Battery,
  Sun,
  Wind,
  Droplets,
  Gauge,
  Thermometer,
  MapPin,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Zap,
  Activity,
  ChevronRight,
  TrendingUp,
  Layers,
} from "lucide-react";
import { triggerScenario, selectPrimaryStation } from "../services/api";

export default function MultiStationNetwork({
  stations = [],
  activeScenario = "SCENARIO_E_NOMINAL",
  primaryStationId = "AWS-01",
  networkHealth = 100.0,
  spatialTopology = [],
  onSelectStation,
}) {
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioMsg, setScenarioMsg] = useState(null);

  const handleRunScenario = async (scenarioKey, duration = 30) => {
    setScenarioLoading(true);
    try {
      const res = await triggerScenario(scenarioKey, duration);
      setScenarioMsg(`Triggered ${scenarioKey}: ${res.status}`);
      setTimeout(() => setScenarioMsg(null), 4000);
    } catch (err) {
      console.error("Error triggering scenario:", err);
      setScenarioMsg(`Failed: ${err.message}`);
    } finally {
      setScenarioLoading(false);
    }
  };

  const handleStationClick = async (stationId) => {
    if (onSelectStation) {
      onSelectStation(stationId);
    }
    try {
      await selectPrimaryStation(stationId);
    } catch (err) {
      console.error("Error selecting primary station:", err);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status) => {
    switch (status) {
      case "NORMAL":
        return {
          label: "NORMAL",
          bg: "rgba(16, 185, 129, 0.15)",
          border: "rgba(16, 185, 129, 0.4)",
          color: "#34d399",
          icon: ShieldCheck,
        };
      case "WARNING":
        return {
          label: "WARNING",
          bg: "rgba(245, 158, 11, 0.15)",
          border: "rgba(245, 158, 11, 0.4)",
          color: "#fbbf24",
          icon: AlertTriangle,
        };
      case "ANOMALY":
        return {
          label: "ANOMALY",
          bg: "rgba(239, 68, 68, 0.2)",
          border: "rgba(239, 68, 68, 0.5)",
          color: "#f87171",
          icon: ShieldAlert,
        };
      case "OFFLINE":
      default:
        return {
          label: "OFFLINE",
          bg: "rgba(100, 116, 139, 0.2)",
          border: "rgba(100, 116, 139, 0.4)",
          color: "#94a3b8",
          icon: WifiOff,
        };
    }
  };

  // Coordinates min/max for 2D network map projection
  const lats = stations.map((s) => s.latitude).filter(Boolean);
  const lons = stations.map((s) => s.longitude).filter(Boolean);
  const minLat = lats.length ? Math.min(...lats) : 12.85;
  const maxLat = lats.length ? Math.max(...lats) : 13.25;
  const minLon = lons.length ? Math.min(...lons) : 79.05;
  const maxLon = lons.length ? Math.max(...lons) : 79.40;

  const latRange = Math.max(0.05, maxLat - minLat);
  const lonRange = Math.max(0.05, maxLon - minLon);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* ============================================================ */}
      {/* 1. HEADER & FLEET HEALTH BANNER */}
      {/* ============================================================ */}
      <div
        className="glass-panel"
        style={{
          padding: "18px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(10, 14, 23, 0.95) 100%)",
          border: "1px solid rgba(56, 189, 248, 0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              background: "rgba(56, 189, 248, 0.15)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              borderRadius: "10px",
              padding: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Radio size={24} color="#38bdf8" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#f8fafc", margin: 0, letterSpacing: "0.5px" }}>
                AWS NETWORK / MULTI-STATION MONITORING
              </h2>
              <span
                style={{
                  background: "rgba(56, 189, 248, 0.2)",
                  border: "1px solid rgba(56, 189, 248, 0.5)",
                  color: "#38bdf8",
                  fontSize: "10px",
                  fontWeight: "700",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                }}
              >
                V4 Local Brain Mesonet
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0 0" }}>
              Real-time edge transducer intelligence across {stations.length} coordinated automatic weather stations.
            </p>
          </div>
        </div>

        {/* Fleet Metrics Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(51, 65, 85, 0.6)",
              borderRadius: "8px",
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Activity size={16} color="#38bdf8" />
            <div>
              <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "600" }}>NETWORK HEALTH</div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: networkHealth >= 80 ? "#34d399" : "#f87171" }}>
                {networkHealth.toFixed(1)}%
              </div>
            </div>
          </div>

          <div
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(51, 65, 85, 0.6)",
              borderRadius: "8px",
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Wifi size={16} color="#34d399" />
            <div>
              <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "600" }}>ONLINE STATIONS</div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "#f8fafc" }}>
                {stations.filter((s) => s.is_reporting).length} / {stations.length}
              </div>
            </div>
          </div>

          <div
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(51, 65, 85, 0.6)",
              borderRadius: "8px",
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Shield size={16} color="#38bdf8" />
            <div>
              <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "600" }}>ACTIVE CONTEXT</div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "#38bdf8" }}>
                {primaryStationId}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. MULTI-STATION DEMONSTRATION SCENARIOS TOOLBAR */}
      {/* ============================================================ */}
      <div
        className="glass-panel"
        style={{
          padding: "16px 20px",
          background: "rgba(15, 23, 42, 0.6)",
          border: "1px solid rgba(56, 189, 248, 0.2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Zap size={16} color="#f59e0b" />
            <span style={{ fontSize: "13px", fontWeight: "700", color: "#f8fafc" }}>
              Multi-Station Demonstration Scenarios
            </span>
            <span
              style={{
                background: "rgba(245, 158, 11, 0.15)",
                border: "1px solid rgba(245, 158, 11, 0.4)",
                color: "#fbbf24",
                fontSize: "10px",
                fontWeight: "700",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              SIMULATION MODE
            </span>
          </div>
          {scenarioMsg && (
            <span style={{ fontSize: "11px", color: "#38bdf8", fontFamily: "var(--font-mono, monospace)" }}>
              {scenarioMsg}
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
          <button
            onClick={() => handleRunScenario("SCENARIO_A", 25)}
            disabled={scenarioLoading}
            style={{
              background: activeScenario.includes("SCENARIO_A") ? "rgba(239, 68, 68, 0.25)" : "rgba(30, 41, 59, 0.8)",
              border: `1px solid ${activeScenario.includes("SCENARIO_A") ? "#ef4444" : "rgba(51, 65, 85, 0.6)"}`,
              borderRadius: "8px",
              padding: "10px 12px",
              color: activeScenario.includes("SCENARIO_A") ? "#f87171" : "#cbd5e1",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: "700", color: "#f8fafc" }}>⚡ Scenario A</span>
              <span style={{ fontSize: "9px", color: "#ef4444" }}>SENSOR FAULT</span>
            </div>
            <div style={{ fontSize: "10px", color: "#94a3b8" }}>
              AWS-01 Spike (+18°C) while neighbors stay normal
            </div>
          </button>

          <button
            onClick={() => handleRunScenario("SCENARIO_B", 30)}
            disabled={scenarioLoading}
            style={{
              background: activeScenario.includes("SCENARIO_B") ? "rgba(56, 189, 248, 0.25)" : "rgba(30, 41, 59, 0.8)",
              border: `1px solid ${activeScenario.includes("SCENARIO_B") ? "#38bdf8" : "rgba(51, 65, 85, 0.6)"}`,
              borderRadius: "8px",
              padding: "10px 12px",
              color: activeScenario.includes("SCENARIO_B") ? "#38bdf8" : "#cbd5e1",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: "700", color: "#f8fafc" }}>🌪️ Scenario B</span>
              <span style={{ fontSize: "9px", color: "#38bdf8" }}>WEATHER EVENT</span>
            </div>
            <div style={{ fontSize: "10px", color: "#94a3b8" }}>
              Coordinated Storm Front across all mesonet stations
            </div>
          </button>

          <button
            onClick={() => handleRunScenario("SCENARIO_C", 30)}
            disabled={scenarioLoading}
            style={{
              background: activeScenario.includes("SCENARIO_C") ? "rgba(245, 158, 11, 0.25)" : "rgba(30, 41, 59, 0.8)",
              border: `1px solid ${activeScenario.includes("SCENARIO_C") ? "#f59e0b" : "rgba(51, 65, 85, 0.6)"}`,
              borderRadius: "8px",
              padding: "10px 12px",
              color: activeScenario.includes("SCENARIO_C") ? "#fbbf24" : "#cbd5e1",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: "700", color: "#f8fafc" }}>📈 Scenario C</span>
              <span style={{ fontSize: "9px", color: "#f59e0b" }}>SENSOR DRIFT</span>
            </div>
            <div style={{ fontSize: "10px", color: "#94a3b8" }}>
              AWS-03 gradual uncorroborated temperature drift
            </div>
          </button>

          <button
            onClick={() => handleRunScenario("SCENARIO_D", 30)}
            disabled={scenarioLoading}
            style={{
              background: activeScenario.includes("SCENARIO_D") ? "rgba(100, 116, 139, 0.3)" : "rgba(30, 41, 59, 0.8)",
              border: `1px solid ${activeScenario.includes("SCENARIO_D") ? "#94a3b8" : "rgba(51, 65, 85, 0.6)"}`,
              borderRadius: "8px",
              padding: "10px 12px",
              color: activeScenario.includes("SCENARIO_D") ? "#f8fafc" : "#cbd5e1",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: "700", color: "#f8fafc" }}>📡 Scenario D</span>
              <span style={{ fontSize: "9px", color: "#94a3b8" }}>COMM FAULT</span>
            </div>
            <div style={{ fontSize: "10px", color: "#94a3b8" }}>
              AWS-04 packet dropout & telemetry disconnection
            </div>
          </button>

          <button
            onClick={() => handleRunScenario("SCENARIO_E", 0)}
            disabled={scenarioLoading}
            style={{
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              borderRadius: "8px",
              padding: "10px 12px",
              color: "#34d399",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: "700", color: "#f8fafc" }}>🔄 Reset Fleet</span>
              <span style={{ fontSize: "9px", color: "#34d399" }}>NOMINAL</span>
            </div>
            <div style={{ fontSize: "10px", color: "#94a3b8" }}>
              Restore nominal baseline across all AWS stations
            </div>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. DYNAMIC MULTI-STATION GRID */}
      {/* ============================================================ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
        {stations.map((st) => {
          const isSelected = st.station_id === primaryStationId;
          const badge = getStatusBadge(st.local_status);
          const BadgeIcon = badge.icon;

          return (
            <div
              key={st.station_id}
              onClick={() => handleStationClick(st.station_id)}
              className="glass-panel"
              style={{
                padding: "16px",
                cursor: "pointer",
                border: isSelected ? "2px solid #38bdf8" : "1px solid rgba(51, 65, 85, 0.5)",
                background: isSelected
                  ? "linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)"
                  : "rgba(15, 23, 42, 0.7)",
                transition: "all 0.2s ease",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {isSelected && (
                <div
                  style={{
                    position: "absolute",
                    top: "0",
                    right: "0",
                    background: "#0284c7",
                    color: "#ffffff",
                    fontSize: "9px",
                    fontWeight: "800",
                    padding: "2px 8px",
                    borderBottomLeftRadius: "6px",
                    letterSpacing: "0.5px",
                  }}
                >
                  ACTIVE MONITOR
                </div>
              )}

              {/* Station Title & Status Badge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: "800", color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Radio size={14} color={isSelected ? "#38bdf8" : "#94a3b8"} />
                    <span>{st.station_id}</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                    {st.station_name}
                  </div>
                </div>

                <div
                  style={{
                    background: badge.bg,
                    border: `1px solid ${badge.border}`,
                    color: badge.color,
                    borderRadius: "6px",
                    padding: "3px 8px",
                    fontSize: "10px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <BadgeIcon size={12} />
                  <span>{badge.label}</span>
                </div>
              </div>

              {/* Coordinates & Elevation Tag */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "10px", color: "#64748b", marginBottom: "12px", fontFamily: "var(--font-mono, monospace)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                  <MapPin size={10} />
                  {st.latitude?.toFixed(4)}°N, {st.longitude?.toFixed(4)}°E
                </span>
                <span>|</span>
                <span>{st.elevation_m}m ASL</span>
              </div>

              {/* Telemetry Readouts */}
              {st.is_reporting ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                  <div style={{ background: "rgba(10, 14, 23, 0.6)", padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(51, 65, 85, 0.4)" }}>
                    <div style={{ fontSize: "9px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Thermometer size={10} color="#f87171" /> TEMP
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#f8fafc", fontFamily: "var(--font-mono, monospace)" }}>
                      {st.temperature != null ? `${st.temperature.toFixed(1)}°C` : "--"}
                    </div>
                  </div>

                  <div style={{ background: "rgba(10, 14, 23, 0.6)", padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(51, 65, 85, 0.4)" }}>
                    <div style={{ fontSize: "9px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Gauge size={10} color="#a855f7" /> PRESS
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#f8fafc", fontFamily: "var(--font-mono, monospace)" }}>
                      {st.pressure != null ? `${st.pressure.toFixed(1)} hPa` : "--"}
                    </div>
                  </div>

                  <div style={{ background: "rgba(10, 14, 23, 0.6)", padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(51, 65, 85, 0.4)" }}>
                    <div style={{ fontSize: "9px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Droplets size={10} color="#38bdf8" /> HUMIDITY
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#f8fafc", fontFamily: "var(--font-mono, monospace)" }}>
                      {st.humidity != null ? `${st.humidity.toFixed(1)}%` : "--"}
                    </div>
                  </div>

                  <div style={{ background: "rgba(10, 14, 23, 0.6)", padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(51, 65, 85, 0.4)" }}>
                    <div style={{ fontSize: "9px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Wind size={10} color="#34d399" /> WIND
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#f8fafc", fontFamily: "var(--font-mono, monospace)" }}>
                      {st.wind_speed != null ? `${st.wind_speed.toFixed(1)} m/s` : "--"}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px dashed rgba(239, 68, 68, 0.4)",
                    borderRadius: "6px",
                    padding: "16px 10px",
                    textAlign: "center",
                    marginBottom: "12px",
                    color: "#f87171",
                    fontSize: "11px",
                    fontWeight: "600",
                  }}
                >
                  <WifiOff size={18} style={{ margin: "0 auto 4px auto", display: "block" }} />
                  TELEMETRY DROPOUT (100% PACKET LOSS)
                </div>
              )}

              {/* Local Brain Diagnostics & Trust Score Bar */}
              <div style={{ borderTop: "1px solid rgba(51, 65, 85, 0.4)", paddingTop: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "4px" }}>
                  <span style={{ color: "#94a3b8" }}>Local Brain Trust:</span>
                  <strong style={{ color: st.trust_score >= 0.85 ? "#34d399" : st.trust_score >= 0.60 ? "#fbbf24" : "#f87171", fontFamily: "var(--font-mono, monospace)" }}>
                    {((st.trust_score || 0.98) * 100).toFixed(1)}%
                  </strong>
                </div>

                <div style={{ width: "100%", height: "4px", background: "rgba(30, 41, 59, 0.8)", borderRadius: "2px", overflow: "hidden", marginBottom: "8px" }}>
                  <div
                    style={{
                      width: `${(st.trust_score || 0.98) * 100}%`,
                      height: "100%",
                      background: st.trust_score >= 0.85 ? "#10b981" : st.trust_score >= 0.60 ? "#f59e0b" : "#ef4444",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px" }}>
                  <span style={{ color: "#64748b" }}>Fault: <strong style={{ color: "#cbd5e1" }}>{st.fault_type || "NOMINAL"}</strong></span>
                  <span style={{ color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Battery size={11} color={st.battery_voltage > 3.6 ? "#34d399" : "#f59e0b"} />
                    {st.battery_voltage?.toFixed(2)}V
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* 4. COMPACT 2D SPATIAL TOPOLOGY NETWORK MAP */}
      {/* ============================================================ */}
      <div
        className="glass-panel"
        style={{
          padding: "18px 24px",
          background: "rgba(10, 14, 23, 0.8)",
          border: "1px solid rgba(56, 189, 248, 0.2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <MapPin size={16} color="#38bdf8" />
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
              Mesonet Geographic Topology & Cross-Station Distances
            </h3>
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            Derived from Great-Circle Haversine Geodesic Coordinates
          </span>
        </div>

        {/* 2D Topology Canvas */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "240px",
            background: "radial-gradient(ellipse at center, rgba(15, 23, 42, 0.8) 0%, rgba(5, 8, 17, 0.95) 100%)",
            borderRadius: "10px",
            border: "1px solid rgba(51, 65, 85, 0.4)",
            overflow: "hidden",
          }}
        >
          {/* Subtle Grid Background */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "linear-gradient(to right, rgba(51, 65, 85, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(51, 65, 85, 0.1) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Render Connection Lines between stations */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            {spatialTopology.map((link, idx) => {
              const fromNode = stations.find((s) => s.station_id === link.from_station);
              const toNode = stations.find((s) => s.station_id === link.to_station);
              if (!fromNode || !toNode) return null;

              const x1 = ((fromNode.longitude - minLon) / lonRange) * 80 + 10;
              const y1 = 90 - (((fromNode.latitude - minLat) / latRange) * 80 + 10);
              const x2 = ((toNode.longitude - minLon) / lonRange) * 80 + 10;
              const y2 = 90 - (((toNode.latitude - minLat) / latRange) * 80 + 10);

              return (
                <g key={`link-${idx}`}>
                  <line
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke="rgba(56, 189, 248, 0.25)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  {/* Distance label midpoint */}
                  <text
                    x={`${(x1 + x2) / 2}%`}
                    y={`${(y1 + y2) / 2}%`}
                    fill="#64748b"
                    fontSize="9px"
                    textAnchor="middle"
                    dy="-3"
                    fontFamily="monospace"
                  >
                    {link.distance_km?.toFixed(1)} km
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Render Station Node Dots */}
          {stations.map((st) => {
            const x = ((st.longitude - minLon) / lonRange) * 80 + 10;
            const y = 90 - (((st.latitude - minLat) / latRange) * 80 + 10);
            const isSelected = st.station_id === primaryStationId;
            const badge = getStatusBadge(st.local_status);

            return (
              <div
                key={`node-${st.station_id}`}
                onClick={() => handleStationClick(st.station_id)}
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: "translate(-50%, -50%)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  zIndex: isSelected ? 10 : 5,
                }}
              >
                {/* Pulsating Ring for Primary */}
                {isSelected && (
                  <div
                    style={{
                      position: "absolute",
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      border: "2px solid #38bdf8",
                      animation: "pulseGlow 2s infinite",
                    }}
                  />
                )}

                {/* Node Pip */}
                <div
                  style={{
                    width: isSelected ? "18px" : "14px",
                    height: isSelected ? "18px" : "14px",
                    borderRadius: "50%",
                    background: badge.color,
                    border: "2px solid #0f172a",
                    boxShadow: `0 0 10px ${badge.color}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />

                {/* Station Tag */}
                <div
                  style={{
                    marginTop: "4px",
                    background: "rgba(15, 23, 42, 0.9)",
                    border: `1px solid ${isSelected ? "#38bdf8" : "rgba(51, 65, 85, 0.6)"}`,
                    borderRadius: "4px",
                    padding: "2px 6px",
                    fontSize: "10px",
                    fontWeight: "700",
                    color: isSelected ? "#38bdf8" : "#f8fafc",
                    whiteSpace: "nowrap",
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  {st.station_id} {st.is_reporting ? `(${st.temperature?.toFixed(1)}°C)` : "(OFFLINE)"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}