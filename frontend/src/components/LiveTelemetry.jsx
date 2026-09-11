import React from "react";
import {
  Thermometer,
  Droplets,
  Gauge,
  Wind,
  CloudRain,
  BatteryCharging,
  Radio,
  Clock,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import TelemetryCharts from "./TelemetryCharts";

export default function LiveTelemetry({ currentTelemetry, history }) {
  const temp = currentTelemetry?.temperature ?? 24.78;
  const hum = currentTelemetry?.humidity ?? 60.0;
  const press = currentTelemetry?.pressure ?? 1013.25;
  const wind = currentTelemetry?.wind_speed ?? 14.5;
  const rain = currentTelemetry?.rainfall ?? 0.0;
  const battery = currentTelemetry?.battery_voltage ?? 4.12;
  const stationId = currentTelemetry?.station_id || "AWS-TINKER-01";
  const timestamp = currentTelemetry?.timestamp || new Date().toISOString();
  const timestampMs = currentTelemetry?.timestamp_ms || Date.now() % 100000000;
  const isAnomaly = currentTelemetry?.is_anomaly || false;

  const cards = [
    {
      title: "Ambient Temperature",
      value: temp.toFixed(2),
      unit: "°C",
      icon: Thermometer,
      color: "#f87171",
      bg: "rgba(239, 68, 68, 0.1)",
      border: "rgba(239, 68, 68, 0.3)",
      nominal: "Nominal Range: -10°C to 50°C",
      status: temp < -10 || temp > 50 ? "ANOMALY" : "HEALTHY",
    },
    {
      title: "Relative Humidity",
      value: hum.toFixed(2),
      unit: "%",
      icon: Droplets,
      color: "#38bdf8",
      bg: "rgba(56, 189, 248, 0.1)",
      border: "rgba(56, 189, 248, 0.3)",
      nominal: "Nominal Range: 10% to 95%",
      status: hum < 5 || hum > 99 ? "ANOMALY" : "HEALTHY",
    },
    {
      title: "Atmospheric Pressure",
      value: press.toFixed(2),
      unit: "hPa",
      icon: Gauge,
      color: "#a855f7",
      bg: "rgba(168, 85, 247, 0.1)",
      border: "rgba(168, 85, 247, 0.3)",
      nominal: "Nominal Range: 950 to 1050 hPa",
      status: press < 900 || press > 1080 ? "ANOMALY" : "HEALTHY",
    },
    {
      title: "Surface Wind Speed",
      value: wind.toFixed(2),
      unit: "m/s",
      icon: Wind,
      color: "#10b981",
      bg: "rgba(16, 185, 129, 0.1)",
      border: "rgba(16, 185, 129, 0.3)",
      nominal: "Nominal Range: 0 to 45 m/s",
      status: wind > 40 ? "WARNING" : "HEALTHY",
    },
    {
      title: "Precipitation / Rainfall",
      value: rain.toFixed(2),
      unit: "mm",
      icon: CloudRain,
      color: "#0284c7",
      bg: "rgba(2, 132, 199, 0.1)",
      border: "rgba(2, 132, 199, 0.3)",
      nominal: "Pluviometer Rate (Tipping Bucket)",
      status: rain > 50 ? "WARNING" : "HEALTHY",
    },
    {
      title: "LiPo Battery Voltage",
      value: battery.toFixed(2),
      unit: "V",
      icon: BatteryCharging,
      color: "#fbbf24",
      bg: "rgba(245, 158, 11, 0.1)",
      border: "rgba(245, 158, 11, 0.3)",
      nominal: "Solar Buffer: 3.6V to 4.2V",
      status: battery < 3.4 ? "LOW" : "HEALTHY",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* Telemetry Header Bar with Station ID and Time Metadata */}
      <div className="glass-panel" style={{ padding: "18px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #0284c7 0%, #10b981 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 20px rgba(2, 132, 199, 0.4)",
            }}>
              <Activity size={24} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#f8fafc", margin: 0 }}>
                Live AWS Meteorological Telemetry
              </h2>
              <p style={{ fontSize: "13px", color: "#94a3b8", margin: "3px 0 0 0" }}>
                Continuous 1.0 Hz Sensor Channels with Rolling Baseline Envelopes
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {/* Station ID Card */}
            <div style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(51, 65, 85, 0.6)",
              borderRadius: "8px",
              padding: "6px 14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}>
              <Radio size={15} color="#38bdf8" />
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>Station ID:</span>
              <strong style={{ fontSize: "13px", color: "#f8fafc", fontFamily: "var(--font-mono)" }}>
                {stationId}
              </strong>
            </div>

            {/* Millisecond Counter */}
            <div style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(51, 65, 85, 0.6)",
              borderRadius: "8px",
              padding: "6px 14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}>
              <Clock size={15} color="#10b981" />
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>Tick (ms):</span>
              <strong style={{ fontSize: "13px", color: "#34d399", fontFamily: "var(--font-mono)" }}>
                {timestampMs}
              </strong>
            </div>

            {/* Simulated Data Badge */}
            <span style={{
              background: "rgba(56, 189, 248, 0.15)",
              color: "#38bdf8",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              padding: "5px 12px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "700",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}>
              SIMULATED TELEMETRY
            </span>
          </div>
        </div>
      </div>

      {/* 6-Channel Live Telemetry Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.title}
              className="glass-panel"
              style={{
                padding: "18px",
                border: `1px solid ${c.border}`,
                background: "linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(10, 15, 30, 0.95) 100%)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600" }}>{c.title}</span>
                  <div style={{ background: c.bg, padding: "6px", borderRadius: "8px" }}>
                    <Icon size={18} color={c.color} />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", margin: "8px 0" }}>
                  <span style={{ fontSize: "28px", fontWeight: "800", color: "#f8fafc", fontFamily: "var(--font-mono)" }}>
                    {c.value}
                  </span>
                  <span style={{ fontSize: "15px", fontWeight: "600", color: c.color }}>
                    {c.unit}
                  </span>
                </div>
              </div>

              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid rgba(51, 65, 85, 0.4)",
                paddingTop: "10px",
                marginTop: "10px",
                fontSize: "11px",
              }}>
                <span style={{ color: "#64748b" }}>{c.nominal}</span>
                <span style={{
                  color: c.status === "ANOMALY" ? "#f87171" : c.status === "WARNING" ? "#fbbf24" : "#34d399",
                  fontWeight: "700",
                }}>
                  {c.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Interactive Live Time-Series Charts */}
      <TelemetryCharts history={history} />

    </div>
  );
}
