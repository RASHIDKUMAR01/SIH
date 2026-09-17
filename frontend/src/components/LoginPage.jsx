import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  Cpu,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { loginUser } from "../services/auth";

export default function LoginPage({ onLoginSuccess, initialErrorMessage = null }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialErrorMessage);
  const [clockStr, setClockStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClockStr(now.toUTCString().replace("GMT", "UTC"));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleQuickFill = () => {
    setUsername("admin");
    setPassword("SkyGuard@2026");
    setErrorMessage(null);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (isLoading) return;

    if (!username.trim() || !password) {
      setErrorMessage("PLEASE ENTER BOTH OPERATOR ID AND PASSWORD");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const authResult = await loginUser(username, password, rememberMe);
      if (onLoginSuccess) {
        onLoginSuccess(authResult);
      }
    } catch (err) {
      console.warn("Authentication failed:", err);
      setErrorMessage("INVALID CREDENTIALS");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      background: "radial-gradient(ellipse at 50% 20%, #0c1836 0%, #050811 75%, #020408 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      boxSizing: "border-box",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: "#f8fafc",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background Cybernetic Grid & Glow */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: "linear-gradient(rgba(56, 189, 248, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.03) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        pointerEvents: "none",
      }} />

      {/* Main Glassmorphic Login Card */}
      <div style={{
        width: "100%",
        maxWidth: "460px",
        background: "rgba(10, 16, 31, 0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(56, 189, 248, 0.28)",
        borderRadius: "14px",
        boxShadow: "0 10px 40px -10px rgba(0, 0, 0, 0.8), 0 0 30px rgba(14, 165, 233, 0.15)",
        padding: "32px 28px",
        position: "relative",
        zIndex: 10,
      }}>
        
        {/* Top Header Badge & Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: "24px" }}>
          
          {/* Logo Badge Icon */}
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #0284c7 0%, #3b82f6 50%, #4f46e5 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 25px rgba(56, 189, 248, 0.5)",
            marginBottom: "14px",
          }}>
            <ShieldCheck size={32} color="#ffffff" strokeWidth={2.2} />
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: "24px",
            fontWeight: "900",
            letterSpacing: "1.5px",
            color: "#ffffff",
            margin: "0 0 4px 0",
            fontFamily: "var(--font-mono, monospace)",
          }}>
            SKYGUARD <span style={{ color: "#38bdf8" }}>AI</span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: "12px",
            color: "#94a3b8",
            margin: "0 0 12px 0",
            letterSpacing: "0.4px",
            fontWeight: "500",
          }}>
            Intelligent AWS Anomaly Detection System
          </p>

          {/* Security Status Message Pill */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            borderRadius: "9999px",
            padding: "3px 12px",
            fontSize: "10px",
            fontWeight: "700",
            color: "#34d399",
            letterSpacing: "0.8px",
            textTransform: "uppercase",
            fontFamily: "var(--font-mono, monospace)",
          }}>
            <span style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#10b981",
              boxShadow: "0 0 8px #10b981",
              display: "inline-block",
            }} />
            SECURE CONTROL ROOM ACCESS
          </div>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div style={{
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: "8px",
            padding: "10px 14px",
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "#fca5a5",
            fontSize: "12px",
            fontWeight: "700",
            fontFamily: "var(--font-mono, monospace)",
            letterSpacing: "0.5px",
          }}>
            <AlertTriangle size={18} color="#f87171" style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Username / Operator ID Field */}
          <div>
            <label style={{
              display: "block",
              fontSize: "11px",
              fontWeight: "700",
              color: "#cbd5e1",
              marginBottom: "6px",
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              Operator ID / Username
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <User size={16} color="#64748b" style={{ position: "absolute", left: "12px", pointerEvents: "none" }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter operator ID (e.g. admin)"
                disabled={isLoading}
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 36px",
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(51, 65, 85, 0.8)",
                  borderRadius: "8px",
                  color: "#f8fafc",
                  fontSize: "13px",
                  fontFamily: "var(--font-mono, monospace)",
                  outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => e.target.style.borderColor = "#38bdf8"}
                onBlur={(e) => e.target.style.borderColor = "rgba(51, 65, 85, 0.8)"}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label style={{
              display: "block",
              fontSize: "11px",
              fontWeight: "700",
              color: "#cbd5e1",
              marginBottom: "6px",
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              Station Security Password
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Lock size={16} color="#64748b" style={{ position: "absolute", left: "12px", pointerEvents: "none" }} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter access password"
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "10px 38px 10px 36px",
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(51, 65, 85, 0.8)",
                  borderRadius: "8px",
                  color: "#f8fafc",
                  fontSize: "13px",
                  fontFamily: "var(--font-mono, monospace)",
                  outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => e.target.style.borderColor = "#38bdf8"}
                onBlur={(e) => e.target.style.borderColor = "rgba(51, 65, 85, 0.8)"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: "2px",
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Remember Me Option & Quick Demo Access */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "12px",
            color: "#94a3b8",
            marginTop: "2px",
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: "#0284c7", cursor: "pointer" }}
              />
              <span>Remember session</span>
            </label>

            <button
              type="button"
              onClick={handleQuickFill}
              style={{
                background: "transparent",
                border: "none",
                color: "#38bdf8",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              Demo Credentials ▾
            </button>
          </div>

          {/* Submit / Authenticate Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: "10px",
              padding: "12px 16px",
              background: isLoading ? "#0369a1" : "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              borderRadius: "8px",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: "800",
              letterSpacing: "0.8px",
              fontFamily: "var(--font-mono, monospace)",
              cursor: isLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 0 20px rgba(14, 165, 233, 0.3)",
              transition: "all 0.2s ease",
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
                <span>AUTHENTICATING...</span>
              </>
            ) : (
              <>
                <KeyRound size={16} />
                <span>AUTHENTICATE & ENTER</span>
              </>
            )}
          </button>
        </form>

        {/* Default Credential Helper Box */}
        <div style={{
          marginTop: "20px",
          padding: "10px 12px",
          background: "rgba(15, 23, 42, 0.6)",
          border: "1px dashed rgba(51, 65, 85, 0.7)",
          borderRadius: "6px",
          fontSize: "11px",
          color: "#94a3b8",
          fontFamily: "var(--font-mono, monospace)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ color: "#cbd5e1", fontWeight: "700" }}>OPERATOR ACCESS:</span>
            <span style={{ color: "#38bdf8" }}>DEFAULT DEMO</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>User: <strong style={{ color: "#f8fafc" }}>admin</strong></span>
            <span>Password: <strong style={{ color: "#f8fafc" }}>SkyGuard@2026</strong></span>
          </div>
        </div>

      </div>

      {/* Footer System Info */}
      <div style={{
        marginTop: "24px",
        textAlign: "center",
        fontSize: "11px",
        color: "#64748b",
        fontFamily: "var(--font-mono, monospace)",
        letterSpacing: "0.5px",
        zIndex: 10,
      }}>
        <div>SIH 26073 | AUTOMATIC WEATHER STATION TELEMETRY DEFENSE</div>
        <div style={{ marginTop: "4px", color: "#475569" }}>
          STATION NODE: AWS-001 | {clockStr || "UTC ACTIVE"}
        </div>
      </div>
    </div>
  );
}
