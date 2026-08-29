"""
Main FastAPI Application Entrypoint for SIH 26073 AWS Anomaly Detection.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.database.session import init_db
from app.api.routes import router as api_router
from app.services.streaming_worker import simulator_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize SQLite DB tables
    init_db()
    # Optionally start simulator worker by default
    simulator_worker.start(interval_seconds=2.0)
    yield
    # Shutdown: Stop background simulator worker
    simulator_worker.stop()


app = FastAPI(
    title="SIH 26073: AI/ML-Based AWS Anomaly Detection API",
    description=(
        "Production-grade REST API for real-time and historical Automatic Weather Station (AWS) "
        "anomaly detection, multi-modal classification, SHAP explainability, and predictive sensor health monitoring."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Enable CORS for React/Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routes
app.include_router(api_router)


@app.get("/", include_in_schema=False)
def root():
    return {
        "title": "SIH 26073: Intelligent AWS Anomaly Detection Platform",
        "status": "online",
        "documentation": "/docs",
        "api_endpoints": "/api",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
