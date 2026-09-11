import React, { useState, useEffect } from "react";
import NewDashboard from "./components/NewDashboard";
import LegacyDashboard from "./components/LegacyDashboard";

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

  if (route === "legacy") {
    return <LegacyDashboard onNavigateToNew={navigateToNew} />;
  }

  return <NewDashboard onNavigateToLegacy={navigateToLegacy} />;
}
