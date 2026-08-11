"""ECI Pipeline API — the HTTP surface the SENTINEL console talks to.

Run it with:
    uvicorn api.main:app --reload --port 8000

The console reads this service when `ECI_DATA_SOURCE=api`; otherwise it keeps
serving its offline dataset, so the zero-setup laptop demo still works.
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from api import schemas, service
from utils.db import SessionLocal, init_db

VALID_STAGES = [
    "seed", "scrape", "diff", "embed", "graph", "triage", "coordinate", "report",
]
DEFAULT_STAGES = ["scrape", "diff", "embed", "graph", "triage", "coordinate"]

# In-process run registry. Single-worker by design: the pipeline is a batch job
# that must not run concurrently against the same database.
_RUNS: Dict[str, dict] = {}

app = FastAPI(
    title="ECI Pipeline API",
    version="1.0.0",
    description="Ecosystem Change Intelligence — sources, changes, tickets, graph.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        o.strip()
        for o in os.environ.get(
            "ECI_CORS_ORIGINS", "http://localhost:3000,http://localhost:4123"
        ).split(",")
        if o.strip()
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    init_db()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Health ────────────────────────────────────────────────────────

@app.get("/health", response_model=schemas.Health, tags=["ops"])
def health(db: Session = Depends(get_db)):
    try:
        stats = service.get_stats(db)
        return {"status": "ok", "database": "up", "changes": stats["totalChanges"]}
    except Exception as exc:  # noqa: BLE001 — health must never raise
        return {
            "status": "degraded",
            "database": "down",
            "changes": 0,
            "detail": str(exc),
        }


# ── Reads ─────────────────────────────────────────────────────────

@app.get("/api/stats", response_model=schemas.Stats, tags=["intelligence"])
def stats(db: Session = Depends(get_db)):
    return service.get_stats(db)


@app.get("/api/sources", response_model=List[schemas.Source], tags=["intelligence"])
def sources(db: Session = Depends(get_db)):
    return service.get_sources(db)


@app.get("/api/changes", response_model=List[schemas.Change], tags=["intelligence"])
def changes(limit: int = 200, db: Session = Depends(get_db)):
    if not 1 <= limit <= 1000:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 1000")
    return service.get_changes(db, limit=limit)


@app.get("/api/tickets", response_model=List[schemas.Ticket], tags=["intelligence"])
def tickets(db: Session = Depends(get_db)):
    return service.get_tickets(db)


@app.post("/api/evidence", response_model=List[schemas.EvidenceItem], tags=["intelligence"])
def evidence(payload: schemas.EvidenceRequest, db: Session = Depends(get_db)):
    return service.get_evidence(db, payload.chunkIds)


@app.get("/api/graph", response_model=schemas.Graph, tags=["intelligence"])
def graph():
    return service.get_graph()


@app.get("/api/benchmarks", tags=["intelligence"])
def benchmarks():
    return service.get_benchmarks()


@app.get("/api/chat-context", response_model=schemas.ChatContext, tags=["intelligence"])
def chat_context(db: Session = Depends(get_db)):
    return service.get_chat_context(db)


# ── Pipeline control ──────────────────────────────────────────────

def _execute(run_id: str, stages: List[str]):
    """Run stages in order. Heavy deps are imported here, not at app start."""
    import main as orchestrator

    stage_map = {
        "seed": orchestrator.stage_seed,
        "scrape": orchestrator.stage_scrape,
        "diff": orchestrator.stage_diff,
        "embed": orchestrator.stage_embed,
        "graph": orchestrator.stage_graph,
        "triage": orchestrator.stage_triage,
        "coordinate": orchestrator.stage_coordinate,
        "report": orchestrator.stage_report,
    }
    try:
        for stage in stages:
            stage_map[stage]()
        _RUNS[run_id]["status"] = "succeeded"
    except Exception as exc:  # noqa: BLE001 — surface failure on the run record
        _RUNS[run_id]["status"] = "failed"
        _RUNS[run_id]["error"] = str(exc)
    finally:
        _RUNS[run_id]["finished_at"] = datetime.now(timezone.utc)


@app.post("/api/pipeline/run", response_model=schemas.PipelineRun, tags=["pipeline"])
def run_pipeline(payload: schemas.PipelineRunRequest, background: BackgroundTasks):
    stages = payload.stages or DEFAULT_STAGES
    unknown = [s for s in stages if s not in VALID_STAGES]
    if unknown:
        raise HTTPException(
            status_code=422,
            detail="unknown stage(s): {}. valid: {}".format(
                ", ".join(unknown), ", ".join(VALID_STAGES)
            ),
        )
    if any(r["status"] == "running" for r in _RUNS.values()):
        raise HTTPException(status_code=409, detail="a pipeline run is already in progress")

    run_id = uuid.uuid4().hex[:12]
    _RUNS[run_id] = {
        "run_id": run_id,
        "status": "running",
        "stages": stages,
        "started_at": datetime.now(timezone.utc),
        "finished_at": None,
        "error": None,
    }
    background.add_task(_execute, run_id, stages)
    return _RUNS[run_id]


@app.get("/api/pipeline/runs", response_model=List[schemas.PipelineRun], tags=["pipeline"])
def list_runs():
    return sorted(_RUNS.values(), key=lambda r: r["started_at"], reverse=True)


@app.get("/api/pipeline/runs/{run_id}", response_model=schemas.PipelineRun, tags=["pipeline"])
def get_run(run_id: str):
    run = _RUNS.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="unknown run id")
    return run
