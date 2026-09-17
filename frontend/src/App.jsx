import React, { useState, useEffect, useCallback, Component } from "react";
import NewDashboard from "./components/NewDashboard";
import LegacyDashboard from "./components/LegacyDashboard";
import LoginPage from "./components/LoginPage";
import { getAuthToken, getAuthUser, verifySession, logoutUser } from "./services/auth";

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
                Reload Application
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.pathname = "/login";
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
                Return to Login
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
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAuthToken()));
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState(getAuthUser);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState(null);
  const [targetRedirect, setTargetRedirect] = useState(null);

  const getCleanRoute = () => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if (path.includes("/legacy") || hash.includes("legacy")) {
        return "legacy";
      }
      if (path.includes("/login") || hash.includes("login")) {
        return "login";
      }
    }
    return "new";
  };

  const [route, setRoute] = useState(getCleanRoute);

  // Initial Auth Verification
  useEffect(() => {
    let isMounted = true;
    async function checkCurrentSession() {
      const token = getAuthToken();
      if (!token) {
        if (isMounted) {
          setIsAuthenticated(false);
          setIsCheckingAuth(false);
        }
        return;
      }

      const res = await verifySession();
      if (isMounted) {
        if (res.valid) {
          setIsAuthenticated(true);
          setCurrentUser(res.user || getAuthUser());
        } else {
          setIsAuthenticated(false);
          setCurrentUser(null);
          setSessionExpiredMsg("SESSION EXPIRED — PLEASE LOGIN AGAIN");
        }
        setIsCheckingAuth(false);
      }
    }

    checkCurrentSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // Location / Route Listener
  useEffect(() => {
    const handleLocationChange = () => {
      const current = getCleanRoute();
      setRoute(current);
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  const handleLoginSuccess = (authData) => {
    setIsAuthenticated(true);
    setCurrentUser(authData?.user || { username: "admin", role: "ADMIN_OPERATOR" });
    setSessionExpiredMsg(null);

    // Redirect to requested protected route if available, or default to '/'
    const dest = targetRedirect === "legacy" ? "/legacy" : "/";
    try {
      window.history.pushState({}, "", dest);
    } catch {
      window.location.hash = dest;
    }
    setRoute(targetRedirect === "legacy" ? "legacy" : "new");
    setTargetRedirect(null);
  };

  const handleLogout = async () => {
    await logoutUser();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setSessionExpiredMsg(null);
    try {
      window.history.pushState({}, "", "/login");
    } catch {
      window.location.hash = "/login";
    }
    setRoute("login");
  };

  const navigateToLegacy = () => {
    if (!isAuthenticated) {
      setTargetRedirect("legacy");
      setRoute("login");
      return;
    }
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
    if (!isAuthenticated) {
      setTargetRedirect("new");
      setRoute("login");
      return;
    }
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

  // If still checking initial authentication status
  if (isCheckingAuth) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#050811",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#38bdf8",
        fontFamily: "monospace",
        fontSize: "14px",
      }}>
        INITIALIZING SECURE SESSION...
      </div>
    );
  }

  // If unauthenticated: always show LoginPage
  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          initialErrorMessage={sessionExpiredMsg}
        />
      </ErrorBoundary>
    );
  }

  // If authenticated: render protected routes
  return (
    <ErrorBoundary>
      {route === "legacy" ? (
        <LegacyDashboard
          onNavigateToNew={navigateToNew}
          onLogout={handleLogout}
          user={currentUser}
        />
      ) : (
        <NewDashboard
          onNavigateToLegacy={navigateToLegacy}
          onLogout={handleLogout}
          user={currentUser}
        />
      )}
    </ErrorBoundary>
  );
}
