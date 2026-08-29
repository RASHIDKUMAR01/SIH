# SIH 26073: AI/ML-Based Intelligent Anomaly Detection for Automatic Weather Stations (AWS)

Production-grade Intelligent Anomaly Detection and Predictive Sensor Health Monitoring platform for AWS sensors.

## Parameters Monitored
- **Temperature (°C)**
- **Atmospheric Pressure (hPa)**
- **Relative Humidity (%)**

## Anomaly Signatures
1. **Sudden Spikes / Drops**
2. **Frozen Sensor Values**
3. **Sensor Drift**
4. **Missing / Packet Loss / Communication Failure**
5. **Multivariate Inconsistencies**

## Project Architecture
- `backend/`: FastAPI REST API, ML pipeline, SQLite persistence, AWS telemetry simulator
- `frontend/`: React + Vite + Tailwind CSS + Recharts interactive dashboard
- `data/`: Telemetry datasets & synthetic validation traces
- `models/`: Trained Isolation Forest models and feature scalers
- `docs/`: System documentation, API references, mathematical formulation
