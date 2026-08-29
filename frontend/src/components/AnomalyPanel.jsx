import React, { useState } from "react";
import { AlertTriangle, Cpu, HelpCircle, CheckCircle2, BarChart2, BrainCircuit, Activity } from "lucide-react";
import { selectAIModel } from "../services/api";

export default function AnomalyPanel({ currentTelemetry }) {
  const [selectedModel, setSelectedModel] = useState("ensemble");
  const [isSwitching, setIsSwitching] = useState(false);

  const isAnomaly = currentTelemetry?.is_anomaly || false;
  const anomalyType = currentTelemetry?.anomaly_type || "NORMAL";
  const confidence = currentTelemetry?.confidence != null ? currentTelemetry.confidence * 100 : 100;
  const severity = currentTelemetry?.severity || "LOW";
  const explanation = currentTelemetry?.explanation || "All parameters nominal.";
  const affected = currentTelemetry?.affected_parameters || [];
  const shapFeatures = currentTelemetry?.explainability?.top_shap_features || [];
  const modelDiag = currentTelemetry?.models || {};
  const activeModel = currentTelemetry?.active_model || selectedModel;

  const handleModelChange = async (newModel) => {
    setSelectedModel(newModel);
    setIsSwitching(true);
    try {
      await selectAIModel(newModel);
    } catch (e) {
      console.error("Failed to switch active model:", e);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: "20px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        {/* Title & Model Selector */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertTriangle size={20} color={isAnomaly ? "#f87171" : "#34d399"} />
            <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
              AI Anomaly & XAI Diagnostic Panel
            </h2>
          </div>
          <span className={`badge badge-${severity.toLowerCase()}`}>
            {severity} Severity
          </span>
        </div>

        {/* Model Architecture Selector Toggle */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(15, 23, 42, 0.8)",
          padding: "6px 10px",
          borderRadius: "8px",
          border: "1px solid rgba(51, 65, 85, 0.6)",
          marginBottom: "14px",
          fontSize: "11px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#94a3b8" }}>
            <BrainCircuit size={14} color="#38bdf8" />
            <span style={{ fontWeight: "700", textTransform: "uppercase" }}>Active AI Model:</span>
          </div>

          <div style={{ display: "flex", gap: "4px" }}>
            <button
              onClick={() => handleModelChange("ensemble")}
              disabled={isSwitching}
              style={{
                background: activeModel === "ensemble" ? "#0284c7" : "transparent",
                color: activeModel === "ensemble" ? "#fff" : "#94a3b8",
                border: "none",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Dual Ensemble
            </button>

            <button
              onClick={() => handleModelChange("isolation_forest")}
              disabled={isSwitching}
              style={{
                background: activeModel === "isolation_forest" ? "#0284c7" : "transparent",
                color: activeModel === "isolation_forest" ? "#fff" : "#94a3b8",
                border: "none",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Isolation Forest
            </button>

            <button
              onClick={() => handleModelChange("lstm")}
              disabled={isSwitching}
              style={{
                background: activeModel === "lstm" ? "#0284c7" : "transparent",
                color: activeModel === "lstm" ? "#fff" : "#94a3b8",
                border: "none",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              LSTM Autoencoder
            </button>
          </div>
        </div>

        {/* Anomaly Category & Confidence Metric */}
        <div style={{
          background: "rgba(15, 23, 42, 0.7)",
          border: isAnomaly ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(16, 185, 129, 0.3)",
          borderRadius: "10px",
          padding: "14px",
          marginBottom: "14px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div>
              <span style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>
                Classified Anomaly Category
              </span>
              <div style={{ fontSize: "16px", fontWeight: "800", color: isAnomaly ? "#f87171" : "#34d399", fontFamily: "var(--font-mono)" }}>
                {anomalyType}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>
                AI Confidence
              </span>
              <div style={{ fontSize: "16px", fontWeight: "800", color: "#38bdf8" }}>
                {confidence.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Confidence bar */}
          <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${confidence}%`,
              background: isAnomaly ? "linear-gradient(90deg, #f59e0b, #ef4444)" : "linear-gradient(90deg, #0ea5e9, #10b981)",
              transition: "width 0.5s ease"
            }} />
          </div>
        </div>

        {/* Dual-Model Diagnostics Strip (Isolation Forest Score + LSTM Reconstruction Loss) */}
        {modelDiag.lstm_autoencoder && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            background: "rgba(10, 15, 30, 0.7)",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(51, 65, 85, 0.5)",
            marginBottom: "14px",
            fontSize: "11px",
          }}>
            <div>
              <span style={{ color: "#94a3b8" }}>Isolation Forest Score: </span>
              <strong style={{ color: modelDiag.isolation_forest?.is_anomaly ? "#f87171" : "#34d399", fontFamily: "var(--font-mono)" }}>
                {modelDiag.isolation_forest?.score != null ? modelDiag.isolation_forest.score.toFixed(3) : "N/A"}
              </strong>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>LSTM Rec. Loss: </span>
              <strong style={{ color: modelDiag.lstm_autoencoder?.is_anomaly ? "#f87171" : "#38bdf8", fontFamily: "var(--font-mono)" }}>
                {modelDiag.lstm_autoencoder?.reconstruction_loss != null ? modelDiag.lstm_autoencoder.reconstruction_loss.toFixed(3) : "N/A"}
              </strong>
              <span style={{ color: "#64748b", fontSize: "10px" }}> (τ={modelDiag.lstm_autoencoder?.reconstruction_threshold})</span>
            </div>
          </div>
        )}

        {/* Affected Parameters */}
        <div style={{ marginBottom: "12px" }}>
          <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600" }}>Affected Sensor Channels:</span>
          <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
            {affected.length > 0 ? (
              affected.map((param) => (
                <span key={param} style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#fca5a5",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  padding: "3px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "600",
                  textTransform: "capitalize",
                }}>
                  {param}
                </span>
              ))
            ) : (
              <span style={{ color: "#64748b", fontSize: "12px" }}>None (Nominal operation)</span>
            )}
          </div>
        </div>

        {/* Explainable AI Natural Language Narrative */}
        <div style={{ marginBottom: "14px" }}>
          <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600" }}>Explainable AI (XAI) Root Cause:</span>
          <div style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(51, 65, 85, 0.6)",
            borderRadius: "8px",
            padding: "10px 12px",
            marginTop: "6px",
            fontSize: "12px",
            lineHeight: "1.4",
            color: "#e2e8f0",
          }}>
            {explanation}
          </div>
        </div>

        {/* SHAP Feature Importance Breakdown */}
        {shapFeatures.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <BarChart2 size={14} color="#38bdf8" />
              <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600" }}>
                Top SHAP Feature Attributions:
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {shapFeatures.slice(0, 3).map((f) => (
                <div key={f.feature_name} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(30, 41, 59, 0.5)",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                }}>
                  <span style={{ color: "#cbd5e1", fontFamily: "var(--font-mono)" }}>
                    {f.feature_name}
                  </span>
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

      <div style={{ fontSize: "11px", color: "#64748b", borderTop: "1px solid rgba(51, 65, 85, 0.4)", paddingTop: "8px", marginTop: "12px" }}>
        Multi-Model Pipeline: Isolation Forest (150 trees) + LSTM Sequence Autoencoder (8 steps) + SHAP XAI
      </div>
    </div>
  );
}
