import React, { useState, useEffect, Component } from "react";
import NewDashboard from "./components/NewDashboard";
import LegacyDashboard from "./components/LegacyDashboard";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Dashboard ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#0a0e17",
          color: "#f8fafc",
          textAlign: "center",
        }}>
          <div style={{
            background: "rgba(220, 38, 38, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "600px",
          }}>
            <h2 style={{ color: "#f87171", fontSize: "20px", marginBottom: "12px" }}>
              Application Render Warning
            </h2>
            <p style={{ color: "#cbd5e1", fontSize: "14px", marginBottom: "16px" }}>
              {this.state.error?.message || "An unexpected rendering issue occurred."}
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: "#0284c7",
                  color: "#fff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                Reload Dashboard
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.pathname = "/legacy";
                }}
                style={{
                  background: "rgba(51, 65, 85, 0.8)",
                  color: "#cbd5e1",
                  border: "1px solid rgba(71, 85, 105, 0.6)",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Open Original Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const getInitialRoute = () => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if (path.includes("/legacy") || hash.includes("legacy")) {
        return "legacy";
      }
    }
    return "new";
  };

  const [route, setRoute] = useState(getInitialRoute);

  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if (path.includes("/legacy") || hash.includes("legacy")) {
        setRoute("legacy");
      } else {
        setRoute("new");
      }
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  const navigateToLegacy = () => {
    if (typeof window !== "undefined") {
      try {
        window.history.pushState({}, "", "/legacy");
      } catch {
        window.location.hash = "/legacy";
      }
    }
    setRoute("legacy");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navigateToNew = () => {
    if (typeof window !== "undefined") {
      try {
        window.history.pushState({}, "", "/");
      } catch {
        window.location.hash = "/";
      }
    }
    setRoute("new");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <ErrorBoundary>
      {route === "legacy" ? (
        <LegacyDashboard onNavigateToNew={navigateToNew} />
      ) : (
        <NewDashboard onNavigateToLegacy={navigateToLegacy} />
      )}
    </ErrorBoundary>
  );
}
