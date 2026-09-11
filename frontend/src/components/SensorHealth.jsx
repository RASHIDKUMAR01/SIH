import React from "react";
import {
  Wrench,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  Thermometer,
  Gauge,
  Droplets,
  Wind,
  CloudRain,
  BatteryCharging,
  Radio,
  Clock,
  ShieldAlert
} from "lucide-react";

export default function SensorHealth({ sensorHealth, currentTelemetry }) {
  const tHealth = sensorHealth?.temperature_health ?? 100.0;
  const pHealth = sensorHealth?.pressure_health ?? 100.0;
  const hHealth = sensorHealth?.humidity_health ?? 100.0;
  const oHealth = sensorHealth?.overall_health ?? 100.0;
  
  const isMaintenanceRequired = sensorHealth?.maintenance_required || false;
  const recommendations = sensorHealth?.maintenance_recommendations || sensorHealth?.recommendations || [];

  const temp = currentTelemetry?.temperature ?? 24.78;
  const press = currentTelemetry?.pressure ?? 1013.25;
  const hum = currentTelemetry?.humidity ?? 60.0;
  const wind = currentTelemetry?.wind_speed ?? 14.5;
  const rain = currentTelemetry?.rainfall ?? 0.0;
  const battery = currentTelemetry?.battery_voltage ?? 4.12;

  const getHealthColor = (score) => {
    if (score >= 85) return "#34d399";
    if (score >= 65) return "#fbbf24";
    return "#f87171";
  };

  const getHealthStatus = (score) => {
    if (score >= 85) return "HEALTHY";
    if (score >= 65) return "WARNING";
    if (score >= 45) return "ANOMALY";
    return "DEGRADED";
  };

  const channelList = [
    {
      sensor: "Ambient Temperature",
      transducer: "DHT22 / PT100 RTD",
      value: temp.toFixed(2),
      unit: "°C",
      health: tHealth,
      status: tHealth < 60 ? "ANOMALY" : tHealth < 85 ? "WARNING" : "HEALTHY",
      signal: "I2C / ADC Clean (10-bit)",
      lastUpdate: "Live (1s)",
    },
    {
      sensor: "Relative Humidity",
      transducer: "Capacitive Polymer",
      value: hum.toFixed(2),
      unit: "%",
      health: hHealth,
      status: hHealth < 60 ? "ANOMALY" : hHealth < 85 ? "WARNING" : "HEALTHY",
      signal: "I2C Calibrated (±2% RH)",
      lastUpdate: "Live (1s)",
    },
    {
      sensor: "Barometric Pressure",
      transducer: "BMP280 Piezoresistive",
      value: press.toFixed(2),
      unit: "hPa",
      health: pHealth,
      status: pHealth < 60 ? "ANOMALY" : pHealth < 85 ? "WARNING" : "HEALTHY",
      signal: "SPI / I2C Clean (±1 hPa)",
      lastUpdate: "Live (1s)",
    },
    {
      sensor: "Surface Wind Speed",
      transducer: "Optoelectronic Anemometer",
      value: wind.toFixed(2),
      unit: "m/s",
      health: 98.0,
      status: "HEALTHY",
      signal: "Pulse Frequency Output",
      lastUpdate: "Live (1s)",
    },
    {
      sensor: "Precipitation Gauge",
      transducer: "Tipping Bucket Pluviometer",
      value: rain.toFixed(2),
      unit: "mm",
      health: 100.0,
      status: "HEALTHY",
      signal: "Reed Switch Interrupt (0.2mm)",
      lastUpdate: "Live (1s)",
    },
    {
      sensor: "Power Management / Battery",
      transducer: "LiPo / Solar Buffer Divider",
      value: battery.toFixed(2),
      unit: "V",
      health: battery < 3.4 ? 60.0 : 100.0,
      status: battery < 3.4 ? "WARNING" : "HEALTHY",
      signal: "ADC Divider Clean",
      lastUpdate: "Live (1s)",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* HARDWARE STATUS NOTIFICATION BANNER */}
      <div className="glass-panel" style={{
        padding: "16px 22px",
        background: "rgba(15, 23, 42, 0.85)",
        border: "1px solid rgba(56, 189, 248, 0.4)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{
            background: "rgba(239, 68, 68, 0.15)",
            color: "#f87171",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            padding: "4px 10px",
            borderRadius: "6px",
            fontWeight: "700",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}>
            PHYSICAL HARDWARE: NOT CONNECTED
          </span>
          <span style={{ color: "#cbd5e1", fontSize: "13px" }}>
            All active channels are streaming from the high-fidelity <strong>SIMULATION ENGINE</strong>.
          </span>
        </div>

        <div style={{ fontSize: "12px", color: "#94a3b8" }}>
          Target MCU: <strong style={{ color: "#e2e8f0" }}>AWS-TINKER-01</strong> (Standby)
        </div>
      </div>

      {/* Overview Health Gauge Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        
        {/* Overall Health */}
        <div className="glass-panel" style={{
          padding: "16px",
          borderTop: `3px solid ${getHealthColor(oHealth)}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              AWS Station Health
            </span>
            <ShieldCheck size={16} color={getHealthColor(oHealth)} />
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: getHealthColor(oHealth), fontFamily: "var(--font-mono)" }}>
            {oHealth.toFixed(1)}%
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>Status: {getHealthStatus(oHealth)}</span>
        </div>

        {/* Temperature Health */}
        <div className="glass-panel" style={{
          padding: "16px",
          borderTop: `3px solid ${getHealthColor(tHealth)}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              Temperature Channel
            </span>
            <Thermometer size={16} color="#fb923c" />
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: getHealthColor(tHealth), fontFamily: "var(--font-mono)" }}>
            {tHealth.toFixed(1)}%
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>Status: {getHealthStatus(tHealth)}</span>
        </div>

        {/* Pressure Health */}
        <div className="glass-panel" style={{
          padding: "16px",
          borderTop: `3px solid ${getHealthColor(pHealth)}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              Pressure Transducer
            </span>
            <Gauge size={16} color="#22d3ee" />
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: getHealthColor(pHealth), fontFamily: "var(--font-mono)" }}>
            {pHealth.toFixed(1)}%
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>Status: {getHealthStatus(pHealth)}</span>
        </div>

        {/* Humidity Health */}
        <div className="glass-panel" style={{
          padding: "16px",
          borderTop: `3px solid ${getHealthColor(hHealth)}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              Humidity Sensor
            </span>
            <Droplets size={16} color="#60a5fa" />
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: getHealthColor(hHealth), fontFamily: "var(--font-mono)" }}>
            {hHealth.toFixed(1)}%
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>Status: {getHealthStatus(hHealth)}</span>
        </div>

      </div>

      {/* Comprehensive 6-Channel Telemetry Health Table */}
      <div className="glass-panel" style={{ padding: "20px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", marginBottom: "14px" }}>
          Telemetry Channel Diagnostics & Signal Condition Table
        </h3>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(51, 65, 85, 0.6)", color: "#94a3b8" }}>
                <th style={{ padding: "10px 12px", fontWeight: "600" }}>Sensor Channel</th>
                <th style={{ padding: "10px 12px", fontWeight: "600" }}>Transducer Type</th>
                <th style={{ padding: "10px 12px", fontWeight: "600" }}>Current Value</th>
                <th style={{ padding: "10px 12px", fontWeight: "600" }}>Health Status</th>
                <th style={{ padding: "10px 12px", fontWeight: "600" }}>Signal Condition</th>
                <th style={{ padding: "10px 12px", fontWeight: "600" }}>Last Update</th>
                <th style={{ padding: "10px 12px", fontWeight: "600" }}>Hardware State</th>
              </tr>
            </thead>
            <tbody>
              {channelList.map((ch) => (
                <tr key={ch.sensor} style={{ borderBottom: "1px solid rgba(51, 65, 85, 0.3)" }}>
                  <td style={{ padding: "12px", color: "#f8fafc", fontWeight: "600" }}>{ch.sensor}</td>
                  <td style={{ padding: "12px", color: "#94a3b8" }}>{ch.transducer}</td>
                  <td style={{ padding: "12px", fontFamily: "var(--font-mono)", color: "#38bdf8", fontWeight: "700" }}>
                    {ch.value} {ch.unit}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span style={{
                      background: ch.status === "HEALTHY" ? "rgba(16, 185, 129, 0.15)" : ch.status === "WARNING" ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: ch.status === "HEALTHY" ? "#34d399" : ch.status === "WARNING" ? "#fbbf24" : "#f87171",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "700",
                    }}>
                      {ch.status} ({ch.health.toFixed(0)}%)
                    </span>
                  </td>
                  <td style={{ padding: "12px", color: "#cbd5e1" }}>{ch.signal}</td>
                  <td style={{ padding: "12px", color: "#64748b" }}>{ch.lastUpdate}</td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ color: "#94a3b8", fontSize: "11px" }}>SIMULATED</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actionable Maintenance Advisory */}
      <div className="glass-panel" style={{ padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <Wrench size={18} color="#38bdf8" />
          <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
            Predictive Maintenance Recommendations
          </h3>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {recommendations.length > 0 ? (
            recommendations.map((rec, i) => (
              <div key={i} style={{
                background: "rgba(30, 41, 59, 0.6)",
                border: "1px solid rgba(71, 85, 105, 0.4)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "13px",
                color: "#e2e8f0",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}>
                <span style={{ color: isMaintenanceRequired ? "#f59e0b" : "#34d399", marginTop: "2px" }}>
                  {isMaintenanceRequired ? "⚠️" : "✓"}
                </span>
                <span>{rec}</span>
              </div>
            ))
          ) : (
            <div style={{ color: "#64748b", fontSize: "12px" }}>
              No immediate physical maintenance required. Scheduled quarterly acoustic/calibration audit nominal.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
