# Backend Service - SIH 26073 AWS Anomaly Detection

## Structure
- `app/api/`: FastAPI routers and request/response schemas
- `app/ml/`: Feature engineering, statistical detectors, Isolation Forest model, and explainability
- `app/database/`: SQLite database models, session management, and CRUD helpers
- `app/simulator/`: Realistic physics-based AWS telemetry generator and anomaly injector
- `app/services/`: Pipeline orchestrator, anomaly detection service, sensor health engine
