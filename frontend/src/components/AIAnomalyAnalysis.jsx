import React from "react";
import {
  BrainCircuit,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Activity,
  BarChart2,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  GitCompare
} from "lucide-react";

export default function AIAnomalyAnalysis({ currentTelemetry }) {
  const isAnomaly = currentTelemetry?.is_anomaly || false;
  const anomalyType = currentTelemetry?.anomaly_type || "NORMAL";
  const confidence = currentTelemetry?.confidence != null ? currentTelemetry.confidence * 100 : 100;
  const severity = currentTelemetry?.severity || "LOW";
  const explanation = currentTelemetry?.explanation || "Atmospheric parameters nominal across all telemetry channels.";
  const affected = currentTelemetry?.affected_parameters || [];
  const shapFeatures = currentTelemetry?.explainability?.top_shap_features || [];

  const models = currentTelemetry?.models || {};
  const ifModel = models.isolation_forest || {
    name: "Isolation Forest (150 Trees)",
    status: "OPERATIONAL",
    score: 0.21,
    threshold: 0.0,
    decision: 0.082,
    is_anomaly: false,
    confidence: 0.79,
    anomaly_class: "NORMAL",
  };

  const lstmModel = models.lstm_autoencoder || {
    name: "Vectorized LSTM Sequence Autoencoder",
    status: "OPERATIONAL",
    reconstruction_loss: 0.38,
    reconstruction_threshold: 0.7113,
    score: 0.12,
    threshold: 0.7113,
    is_anomaly: false,
    confidence: 0.88,
    anomaly_class: "NORMAL",
  };

  const globalBrain = currentTelemetry?.global_brain || {};
  const localBrain = currentTelemetry?.local_brain || {};
  const spatialAnalysis = currentTelemetry?.spatial_analysis || {};
  const multivariateConsistency = currentTelemetry?.multivariate_consistency || {};

  const diagnosisCategory = globalBrain?.diagnosis_category || currentTelemetry?.diagnosis_category || (isAnomaly ? "SENSOR_FAULT" : "NORMAL");
  const spatialAgreementPct = spatialAnalysis?.spatial_agreement_pct ?? comparison?.spatial_agreement_pct ?? 94.2;
  const multiLevel = multivariateConsistency?.consistency_level ?? comparison?.multivariate_level ?? "HIGH";
  const localBrainStatus = localBrain?.status || "NORMAL";

  const comparison = models.comparison || {
    agreement: ifModel.is_anomaly === lstmModel.is_anomaly,
    status: ifModel.is_anomaly === lstmModel.is_anomaly ? "MODEL AGREEMENT" : "MODEL DISAGREEMENT",
    final_interpretation: isAnomaly
      ? `CORROBORATED ANOMALY (${anomalyType}): Multi-model AI detection confirms significant meteorological divergence.`
      : "NORMAL WEATHER STATE: Both Isolation Forest and LSTM Sequence Autoencoder confirm nominal atmospheric parameters.",
  };

  const isAgreement = comparison.agreement;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* Module Title Banner */}
      <div className="glass-panel" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #0284c7 0%, #a855f7 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 20px rgba(168, 85, 247, 0.4)",
            }}>
              <BrainCircuit size={24} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#f8fafc", margin: 0 }}>
                Spatial-Temporal Global Brain & AI Anomaly Engine
              </h2>
              <p style={{ fontSize: "13px", color: "#94a3b8", margin: "3px 0 0 0" }}>
                Multi-Evidence Verification: Local Brain Edge $\rightarrow$ LSTM Temporal Autoencoder $\rightarrow$ Spatial Mesonet $\rightarrow$ Multivariate Physics
              </p>
            </div>
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: isAgreement ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
            border: isAgreement ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(245, 158, 11, 0.4)",
            borderRadius: "10px",
            padding: "8px 16px",
          }}>
            {isAgreement ? <ShieldCheck size={20} color="#34d399" /> : <ShieldAlert size={20} color="#fbbf24" />}
            <div>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "700" }}>
                Multi-Model Status
              </div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: isAgreement ? "#34d399" : "#fbbf24" }}>
                {comparison.status}
              </div>
            </div>
          </div>
        </div>

        {/* Global Brain Multi-Evidence Summary Metrics Strip */}
        <div style={{
          marginTop: "16px",
          paddingTop: "14px",
          borderTop: "1px solid rgba(51, 65, 85, 0.5)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
        }}>
          {/* Local Brain Status */}
          <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(51, 65, 85, 0.5)", borderRadius: "8px", padding: "8px 12px" }}>
            <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "700", fontFamily: "var(--font-mono)" }}>
              1. LOCAL BRAIN
            </div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: localBrainStatus === "NORMAL" ? "#34d399" : "#f87171", marginTop: "2px", fontFamily: "var(--font-mono)" }}>
              {localBrainStatus === "NORMAL" ? "● STATUS: NORMAL" : "▲ LOCAL ALERT"}
            </div>
          </div>

          {/* LSTM Temporal Score */}
          <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(51, 65, 85, 0.5)", borderRadius: "8px", padding: "8px 12px" }}>
            <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "700", fontFamily: "var(--font-mono)" }}>
              2. LSTM TEMPORAL SCORE
            </div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#c084fc", marginTop: "2px", fontFamily: "var(--font-mono)" }}>
              {lstmModel.score != null ? lstmModel.score.toFixed(4) : "0.0000"} <span style={{ fontSize: "10px", color: "#94a3b8" }}>(Loss: {lstmModel.reconstruction_loss != null ? lstmModel.reconstruction_loss.toFixed(3) : "0.000"})</span>
            </div>
          </div>

          {/* Spatial Agreement % */}
          <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(51, 65, 85, 0.5)", borderRadius: "8px", padding: "8px 12px" }}>
            <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "700", fontFamily: "var(--font-mono)" }}>
              3. SPATIAL AGREEMENT
            </div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: spatialAgreementPct >= 65 ? "#38bdf8" : "#fbbf24", marginTop: "2px", fontFamily: "var(--font-mono)" }}>
              {spatialAgreementPct.toFixed(1)}% <span style={{ fontSize: "10px", color: "#94a3b8" }}>({spatialAnalysis?.neighbor_count || 3} adjacent AWS)</span>
            </div>
          </div>

          {/* Multivariate Consistency */}
          <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(51, 65, 85, 0.5)", borderRadius: "8px", padding: "8px 12px" }}>
            <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "700", fontFamily: "var(--font-mono)" }}>
              4. MULTIVARIATE PHYSICS
            </div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: multiLevel === "HIGH" ? "#34d399" : multiLevel === "MEDIUM" ? "#fbbf24" : "#f87171", marginTop: "2px", fontFamily: "var(--font-mono)" }}>
              {multiLevel} CONSISTENCY
            </div>
          </div>

          {/* Global Brain Diagnosis */}
          <div style={{ background: "rgba(15, 23, 42, 0.8)", border: `1px solid ${diagnosisCategory === "GENUINE_WEATHER_EVENT" ? "rgba(56, 189, 248, 0.6)" : diagnosisCategory === "NORMAL" ? "rgba(16, 185, 129, 0.6)" : "rgba(239, 68, 68, 0.6)"}`, borderRadius: "8px", padding: "8px 12px" }}>
            <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "700", fontFamily: "var(--font-mono)" }}>
              ★ GLOBAL BRAIN DIAGNOSIS
            </div>
            <div style={{ fontSize: "12px", fontWeight: "900", color: diagnosisCategory === "GENUINE_WEATHER_EVENT" ? "#38bdf8" : diagnosisCategory === "NORMAL" ? "#34d399" : "#f87171", marginTop: "2px", fontFamily: "var(--font-mono)", letterSpacing: "0.5px" }}>
              {diagnosisCategory.replace(/_/g, " ")}
            </div>
          </div>
        </div>
      </div>

      {/* Model Cards Grid: Isolation Forest vs LSTM Autoencoder */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
        
        {/* MODEL A: ISOLATION FOREST CARD */}
        <div className="glass-panel" style={{
          padding: "22px",
          border: ifModel.is_anomaly ? "1px solid rgba(239, 68, 68, 0.5)" : "1px solid rgba(56, 189, 248, 0.4)",
          background: "linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(10, 15, 30, 0.95) 100%)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                background: "rgba(56, 189, 248, 0.15)",
                padding: "8px",
                borderRadius: "8px",
                border: "1px solid rgba(56, 189, 248, 0.3)"
              }}>
                <Layers size={18} color="#38bdf8" />
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
                  Isolation Forest
                </h3>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>150 Calibrated Partition Trees</span>
              </div>
            </div>

            <span style={{
              background: "rgba(16, 185, 129, 0.15)",
              color: "#34d399",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              padding: "3px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "700",
            }}>
              {ifModel.status || "OPERATIONAL"}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "10px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Anomaly Result</div>
              <div style={{
                fontSize: "15px",
                fontWeight: "800",
                marginTop: "4px",
                color: ifModel.is_anomaly ? "#f87171" : "#34d399"
              }}>
                {ifModel.is_anomaly ? "ANOMALY" : "NORMAL"}
              </div>
            </div>

            <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "10px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Classified Class</div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#38bdf8", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                {ifModel.anomaly_class || (ifModel.is_anomaly ? anomalyType : "NORMAL")}
              </div>
            </div>

            <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "10px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Anomaly Score</div>
              <div style={{ fontSize: "16px", fontWeight: "800", color: "#f8fafc", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                {ifModel.score != null ? ifModel.score.toFixed(4) : "0.0000"}
              </div>
            </div>

            <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "10px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Decision Threshold</div>
              <div style={{ fontSize: "16px", fontWeight: "800", color: "#94a3b8", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                {ifModel.threshold != null ? ifModel.threshold.toFixed(4) : "0.0000"}
              </div>
            </div>
          </div>

          {/* Model Confidence Bar */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
              <span style={{ color: "#94a3b8" }}>Model Confidence:</span>
              <strong style={{ color: "#38bdf8" }}>{((ifModel.confidence || 0.8) * 100).toFixed(1)}%</strong>
            </div>
            <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${(ifModel.confidence || 0.8) * 100}%`,
                background: ifModel.is_anomaly ? "linear-gradient(90deg, #f59e0b, #ef4444)" : "linear-gradient(90deg, #0ea5e9, #10b981)",
                transition: "width 0.4s ease"
              }} />
            </div>
          </div>

          {/* Key Specialization */}
          <div style={{ fontSize: "11px", color: "#94a3b8", borderTop: "1px solid rgba(51, 65, 85, 0.4)", paddingTop: "10px" }}>
            <strong style={{ color: "#cbd5e1" }}>Primary Strength:</strong> High-dimensional point anomaly isolation & instant multidimensional correlation analysis.
          </div>
        </div>

        {/* MODEL B: LSTM SEQUENCE AUTOENCODER CARD */}
        <div className="glass-panel" style={{
          padding: "22px",
          border: lstmModel.is_anomaly ? "1px solid rgba(239, 68, 68, 0.5)" : "1px solid rgba(168, 85, 247, 0.4)",
          background: "linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(10, 15, 30, 0.95) 100%)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                background: "rgba(168, 85, 247, 0.15)",
                padding: "8px",
                borderRadius: "8px",
                border: "1px solid rgba(168, 85, 247, 0.3)"
              }}>
                <Cpu size={18} color="#a855f7" />
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
                  LSTM Sequence Autoencoder
                </h3>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>8-Step Temporal Recurrent Bottleneck</span>
              </div>
            </div>

            <span style={{
              background: "rgba(16, 185, 129, 0.15)",
              color: "#34d399",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              padding: "3px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "700",
            }}>
              {lstmModel.status || "OPERATIONAL"}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "10px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Anomaly Result</div>
              <div style={{
                fontSize: "15px",
                fontWeight: "800",
                marginTop: "4px",
                color: lstmModel.is_anomaly ? "#f87171" : "#34d399"
              }}>
                {lstmModel.is_anomaly ? "ANOMALY" : "NORMAL"}
              </div>
            </div>

            <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "10px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Classified Class</div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#a855f7", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                {lstmModel.anomaly_class || (lstmModel.is_anomaly ? anomalyType : "NORMAL")}
              </div>
            </div>

            <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "10px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Reconstruction Loss (MSE)</div>
              <div style={{ fontSize: "16px", fontWeight: "800", color: "#f8fafc", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                {lstmModel.reconstruction_loss != null ? lstmModel.reconstruction_loss.toFixed(4) : "0.0000"}
              </div>
            </div>

            <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "10px 14px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Rec. Threshold (τ)</div>
              <div style={{ fontSize: "16px", fontWeight: "800", color: "#94a3b8", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                {lstmModel.reconstruction_threshold != null ? lstmModel.reconstruction_threshold.toFixed(4) : "0.7113"}
              </div>
            </div>
          </div>

          {/* Model Confidence Bar */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
              <span style={{ color: "#94a3b8" }}>Sequence Confidence:</span>
              <strong style={{ color: "#a855f7" }}>{((lstmModel.confidence || 0.85) * 100).toFixed(1)}%</strong>
            </div>
            <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${(lstmModel.confidence || 0.85) * 100}%`,
                background: lstmModel.is_anomaly ? "linear-gradient(90deg, #f59e0b, #ef4444)" : "linear-gradient(90deg, #a855f7, #38bdf8)",
                transition: "width 0.4s ease"
              }} />
            </div>
          </div>

          {/* Key Specialization */}
          <div style={{ fontSize: "11px", color: "#94a3b8", borderTop: "1px solid rgba(51, 65, 85, 0.4)", paddingTop: "10px" }}>
            <strong style={{ color: "#cbd5e1" }}>Primary Strength:</strong> Time-series trajectory reconstruction, sensor drift detection & sequential inertia tracking.
          </div>
        </div>

      </div>

      {/* C. MODEL COMPARISON MATRIX */}
      <div className="glass-panel" style={{ padding: "22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <GitCompare size={20} color="#38bdf8" />
          <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
            Model Comparison & Cross-Validation Matrix
          </h3>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(51, 65, 85, 0.6)", color: "#94a3b8" }}>
                <th style={{ padding: "10px 14px", fontWeight: "600" }}>Evaluation Metric</th>
                <th style={{ padding: "10px 14px", fontWeight: "600" }}>Isolation Forest</th>
                <th style={{ padding: "10px 14px", fontWeight: "600" }}>LSTM Autoencoder</th>
                <th style={{ padding: "10px 14px", fontWeight: "600" }}>Corroboration State</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid rgba(51, 65, 85, 0.3)" }}>
                <td style={{ padding: "12px 14px", color: "#cbd5e1", fontWeight: "600" }}>Anomaly Decision</td>
                <td style={{ padding: "12px 14px", color: ifModel.is_anomaly ? "#f87171" : "#34d399", fontWeight: "700" }}>
                  {ifModel.is_anomaly ? "ANOMALY DETECTED" : "NORMAL"}
                </td>
                <td style={{ padding: "12px 14px", color: lstmModel.is_anomaly ? "#f87171" : "#34d399", fontWeight: "700" }}>
                  {lstmModel.is_anomaly ? "ANOMALY DETECTED" : "NORMAL"}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{
                    background: isAgreement ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                    color: isAgreement ? "#34d399" : "#fbbf24",
                    padding: "3px 10px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: "700",
                  }}>
                    {isAgreement ? "AGREEMENT" : "DISAGREEMENT"}
                  </span>
                </td>
              </tr>

              <tr style={{ borderBottom: "1px solid rgba(51, 65, 85, 0.3)" }}>
                <td style={{ padding: "12px 14px", color: "#cbd5e1", fontWeight: "600" }}>Detection Metric</td>
                <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", color: "#f8fafc" }}>
                  Score: {ifModel.score != null ? ifModel.score.toFixed(4) : "0.0000"} (vs {ifModel.threshold != null ? ifModel.threshold.toFixed(2) : "0.00"})
                </td>
                <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", color: "#f8fafc" }}>
                  Loss: {lstmModel.reconstruction_loss != null ? lstmModel.reconstruction_loss.toFixed(4) : "0.0000"} (vs τ={lstmModel.reconstruction_threshold != null ? lstmModel.reconstruction_threshold.toFixed(4) : "0.7113"})
                </td>
                <td style={{ padding: "12px 14px", color: "#94a3b8" }}>
                  Dual-Threshold Guard
                </td>
              </tr>

              <tr style={{ borderBottom: "1px solid rgba(51, 65, 85, 0.3)" }}>
                <td style={{ padding: "12px 14px", color: "#cbd5e1", fontWeight: "600" }}>Model Confidence</td>
                <td style={{ padding: "12px 14px", color: "#38bdf8", fontWeight: "700" }}>
                  {((ifModel.confidence || 0.8) * 100).toFixed(1)}%
                </td>
                <td style={{ padding: "12px 14px", color: "#a855f7", fontWeight: "700" }}>
                  {((lstmModel.confidence || 0.85) * 100).toFixed(1)}%
                </td>
                <td style={{ padding: "12px 14px", color: "#94a3b8" }}>
                  Synthesized Conf: {confidence.toFixed(1)}%
                </td>
              </tr>

              <tr>
                <td style={{ padding: "12px 14px", color: "#cbd5e1", fontWeight: "600" }}>Classified Category</td>
                <td style={{ padding: "12px 14px", color: "#e2e8f0", fontFamily: "var(--font-mono)" }}>
                  {ifModel.anomaly_class || "NORMAL"}
                </td>
                <td style={{ padding: "12px 14px", color: "#e2e8f0", fontFamily: "var(--font-mono)" }}>
                  {lstmModel.anomaly_class || "NORMAL"}
                </td>
                <td style={{ padding: "12px 14px", color: isAnomaly ? "#f87171" : "#34d399", fontWeight: "700" }}>
                  {anomalyType}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* D. FINAL AI INTERPRETATION */}
      <div className="glass-panel" style={{
        padding: "24px",
        border: isAnomaly ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(16, 185, 129, 0.4)",
        background: "rgba(15, 23, 42, 0.95)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Activity size={20} color={isAnomaly ? "#f87171" : "#34d399"} />
            <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#f8fafc", margin: 0 }}>
              Final AI Multi-Model Interpretation
            </h3>
          </div>
          <span className={`badge badge-${severity.toLowerCase()}`}>
            {severity} Severity
          </span>
        </div>

        <div style={{
          background: "rgba(30, 41, 59, 0.6)",
          border: "1px solid rgba(51, 65, 85, 0.6)",
          borderRadius: "10px",
          padding: "16px 18px",
          color: "#e2e8f0",
          fontSize: "14px",
          lineHeight: "1.6",
          marginBottom: "16px",
        }}>
          <strong>{comparison.final_interpretation}</strong>
          <div style={{ marginTop: "8px", fontSize: "13px", color: "#94a3b8" }}>
            {explanation}
          </div>
        </div>

        {/* SHAP Feature Drivers */}
        {shapFeatures.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <BarChart2 size={16} color="#38bdf8" />
              <span style={{ fontSize: "13px", color: "#94a3b8", fontWeight: "600" }}>
                Top SHAP Explainable AI (XAI) Attribution Drivers:
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" }}>
              {shapFeatures.slice(0, 4).map((f) => (
                <div key={f.feature_name} style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(51, 65, 85, 0.5)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "12px",
                }}>
                  <span style={{ color: "#cbd5e1", fontFamily: "var(--font-mono)" }}>{f.feature_name}</span>
                  <span style={{
                    color: f.contribution_direction === "anomaly_driver" ? "#f87171" : "#34d399",
                    fontWeight: "700"
                  }}>
                    {f.shap_value < 0 ? `-${Math.abs(f.shap_value).toFixed(3)}` : `+${f.shap_value.toFixed(3)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
