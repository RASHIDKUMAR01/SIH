/**
 * Frontend API & Real-Time WebSocket Service for SkyGuard AI.
 */
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function getWsBase() {
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
      return "ws://127.0.0.1:8000/api/ws/telemetry";
    }
    return `${proto}//${window.location.host}/api/ws/telemetry`;
  }
  return "ws://127.0.0.1:8000/api/ws/telemetry";
}


export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

export async function fetchCurrentTelemetry() {
  const res = await fetch(`${API_BASE}/current`);
  if (!res.ok) throw new Error("Failed to fetch current telemetry");
  return res.json();
}

export async function fetchHistory(limit = 60) {
  const res = await fetch(`${API_BASE}/history?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function fetchAnomalies(limit = 30, severity = null, type = null) {
  let url = `${API_BASE}/anomalies?limit=${limit}`;
  if (severity && severity !== "ALL") url += `&severity=${severity}`;
  if (type && type !== "ALL") url += `&anomaly_type=${type}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch anomalies");
  return res.json();
}

export async function fetchSensorHealth() {
  const res = await fetch(`${API_BASE}/sensor-health`);
  if (!res.ok) throw new Error("Failed to fetch sensor health");
  return res.json();
}

export async function fetchStatistics() {
  const res = await fetch(`${API_BASE}/statistics`);
  if (!res.ok) throw new Error("Failed to fetch statistics");
  return res.json();
}

export async function startSimulator(intervalSeconds = 1.0) {
  const res = await fetch(`${API_BASE}/simulator/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interval_seconds: intervalSeconds }),
  });
  if (!res.ok) throw new Error("Failed to start simulator");
  return res.json();
}

export async function stopSimulator() {
  const res = await fetch(`${API_BASE}/simulator/stop`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to stop simulator");
  return res.json();
}

export async function injectAnomaly(anomalyType, duration = 10, params = {}) {
  const res = await fetch(`${API_BASE}/simulator/inject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      anomaly_type: anomalyType,
      duration: duration,
      params: params,
    }),
  });
  if (!res.ok) throw new Error("Failed to inject anomaly");
  return res.json();
}

export async function analyzeCustomReading(payload) {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to analyze reading");
  return res.json();
}

export async function uploadCsvDataset(file, persist = true) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/data/upload?persist=${persist}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to upload CSV file");
  }
  return res.json();
}

export async function triggerModelRetrain(records = 5000, contamination = 0.05) {
  const res = await fetch(`${API_BASE}/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records, contamination }),
  });
  if (!res.ok) throw new Error("Failed to trigger retrain");
  return res.json();
}

export function connectTelemetryWebSocket(onTelemetry, onOpen, onError, onClose) {
  let socket = null;
  let isClosedExplicitly = false;
  let reconnectTimeout = null;

  function connect() {
    try {
      socket = new WebSocket(getWsBase());


      socket.onopen = () => {
        if (onOpen) onOpen();
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.data && onTelemetry) {
            onTelemetry(payload.data);
          }
        } catch (e) {
          console.error("Malformed WebSocket message:", e);
        }
      };

      socket.onerror = (err) => {
        if (onError) onError(err);
      };

      socket.onclose = () => {
        if (onClose) onClose();
        if (!isClosedExplicitly) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    } catch (err) {
      if (onError) onError(err);
      if (!isClosedExplicitly) {
        reconnectTimeout = setTimeout(connect, 3000);
      }
    }
  }

  connect();

  return {
    close: () => {
      isClosedExplicitly = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) socket.close();
    },
    send: (msg) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(typeof msg === "string" ? msg : JSON.stringify(msg));
      }
    }
  };
}

export async function selectAIModel(modelName) {
  const res = await fetch(`${API_BASE}/model/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelName }),
  });
  if (!res.ok) throw new Error("Failed to switch AI model");
  return res.json();
}

export async function fetchModelStatus() {
  const res = await fetch(`${API_BASE}/model/status`);
  if (!res.ok) throw new Error("Failed to fetch model status");
  return res.json();
}

