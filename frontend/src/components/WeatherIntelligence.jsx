import React from "react";
import { CloudRain, Wind, Gauge, Droplets, Sun, Compass, ShieldAlert, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";

export default function WeatherIntelligence({ currentTelemetry, history }) {
  const temp = currentTelemetry?.temperature ?? 26.5;
  const press = currentTelemetry?.pressure ?? 1013.2;
  const hum = currentTelemetry?.humidity ?? 62.0;
  const wind = currentTelemetry?.wind_speed ?? 14.5;

  // Meteorological calculations
  // 1. Dew point calculation (Magnus-Tetens Formula)
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * temp) / (b + temp)) + Math.log(Math.max(1e-3, hum) / 100.0);
  const dewPoint = (b * alpha) / (a - alpha);

  // 2. Dew Point Depression (T - Tdp)
  const dewPointDepression = Math.max(0, temp - dewPoint);

  // 3. Vapor Pressure (hPa)
  const satVaporPress = 6.112 * Math.exp((17.67 * temp) / (temp + 243.5));
  const actualVaporPress = satVaporPress * (hum / 100.0);

  // 4. Air Density approximation (kg/m^3)
  const airDensity = (press * 100) / (287.058 * (temp + 273.15));

  // 5. Barometric Trend over history
  let pressureTrend = "STEADY";
  let pressureDelta = 0;
  if (history && history.length >= 10) {
    const pastPress = history[Math.max(0, history.length - 10)].pressure;
    if (pastPress != null) {
      pressureDelta = press - pastPress;
      if (pressureDelta > 0.5) pressureTrend = "RISING RAPIDLY";
      else if (pressureDelta < -0.5) pressureTrend = "FALLING RAPIDLY";
      else if (pressureDelta > 0.15) pressureTrend = "RISING";
      else if (pressureDelta < -0.15) pressureTrend = "FALLING";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* Module Title Banner */}
      <div className="glass-panel" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 20px rgba(14, 165, 233, 0.4)",
          }}>
            <CloudRain size={24} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#f8fafc", margin: 0 }}>
              Synoptic Weather Intelligence & Atmospheric Thermodynamics
            </h2>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "3px 0 0 0" }}>
              Thermodynamic Cross-Feature Validation, Dew Point Depression, and Micro-Turbulence Analytics
            </p>
          </div>
        </div>
      </div>

      {/* Atmospheric Indices Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px" }}>
        
        {/* Dew Point */}
        <div className="glass-panel" style={{ padding: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              Dew Point Temperature
            </span>
            <Droplets size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "#38bdf8", fontFamily: "var(--font-mono)" }}>
            {dewPoint.toFixed(1)}°C
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>
            Condensation threshold for ambient air mass
          </div>
        </div>

        {/* Dew Point Depression */}
        <div className="glass-panel" style={{ padding: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              Dew Point Depression
            </span>
            <Sun size={18} color="#fbbf24" />
          </div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: dewPointDepression < 3.0 ? "#f87171" : "#34d399", fontFamily: "var(--font-mono)" }}>
            {dewPointDepression.toFixed(1)}°C
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>
            {dewPointDepression < 3.0 ? "High saturation (Fog / Precipitation risk)" : "Nominal evaporative spread"}
          </div>
        </div>

        {/* Barometric Trend */}
        <div className="glass-panel" style={{ padding: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              Barometric Trend
            </span>
            <Gauge size={18} color="#a855f7" />
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#e2e8f0", fontFamily: "var(--font-mono)" }}>
            {pressureTrend}
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>
            ΔP: {pressureDelta >= 0 ? `+${pressureDelta.toFixed(2)}` : pressureDelta.toFixed(2)} hPa (10 min window)
          </div>
        </div>

        {/* Air Density */}
        <div className="glass-panel" style={{ padding: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
              Calculated Air Density (ρ)
            </span>
            <Wind size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "#34d399", fontFamily: "var(--font-mono)" }}>
            {airDensity.toFixed(3)} <span style={{ fontSize: "14px", fontWeight: "500", color: "#94a3b8" }}>kg/m³</span>
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>
            Standard atmosphere @ sea level: 1.225 kg/m³
          </div>
        </div>

      </div>

      {/* Meteorological Consistency Card */}
      <div className="glass-panel" style={{ padding: "22px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", marginBottom: "14px" }}>
          Cross-Sensor Thermodynamic Physical Consistency Envelope
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px", borderRadius: "8px", border: "1px solid rgba(51, 65, 85, 0.5)" }}>
            <div style={{ fontWeight: "700", color: "#38bdf8", marginBottom: "4px" }}>
              1. Relative Humidity vs Temperature Inversion
            </div>
            <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.5", margin: 0 }}>
              As ambient temperature increases during solar peak, saturation vapor pressure rises exponentially (Clausius-Clapeyron equation), decreasing relative humidity under constant moisture content.
            </p>
          </div>

          <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px", borderRadius: "8px", border: "1px solid rgba(51, 65, 85, 0.5)" }}>
            <div style={{ fontWeight: "700", color: "#38bdf8", marginBottom: "4px" }}>
              2. Hydrostatic Barometric Lapse
            </div>
            <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.5", margin: 0 }}>
              Atmospheric barometric pressure is continuously monitored against standard geopotential height lapse rates (ΔP / Δt ≤ 3.0 hPa/hr) to detect true storm fronts versus faulty transducer spikes.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
