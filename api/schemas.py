"""Pydantic request/response schemas for the ECI API.

The response shapes here intentionally mirror the contract the SENTINEL console
already consumes (`dashboard/lib/db.js`), so the frontend can switch between the
offline dataset and this API without touching a single component.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Reads ─────────────────────────────────────────────────────────

class Stats(BaseModel):
    sources: int
    totalChanges: int
    pending: int
    escalated: int
    triaged: int
    closed: int
    agentEvents: int
    actionTickets: int


class Source(BaseModel):
    id: int
    name: str
    url: str
    category: Optional[str] = None
    fetch_type: Optional[str] = None
    priority: Optional[int] = None
    active: bool = True
    snapshot_count: int = 0
    change_count: int = 0


class ChangeDiff(BaseModel):
    summary: Optional[str] = None
    change_ratio: Optional[float] = None
    added_lines: List[str] = Field(default_factory=list)
    deleted_lines: List[str] = Field(default_factory=list)


class Change(BaseModel):
    id: int
    source_id: int
    source_name: Optional[str] = None
    source_category: Optional[str] = None
    status: str
    diff_text: Optional[str] = None
    diff_json: ChangeDiff = Field(default_factory=ChangeDiff)
    tags: List[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    # Sentinel triage-agent output, flattened onto the change
    triage_title: Optional[str] = None
    triage_summary: Optional[str] = None
    relevance_score: Optional[float] = None
    local_risk_score: Optional[float] = None
    risk_domain: Optional[str] = None
    confidence: Optional[float] = None


class Ticket(BaseModel):
    """Coordinator action ticket. camelCase to match the console's contract."""
    id: int
    title: Optional[str] = None
    summary: Optional[str] = None
    priority: Optional[str] = None
    riskScore: Optional[float] = None
    sourceName: Optional[str] = None
    sourceCategory: Optional[str] = None
    changeId: Optional[int] = None
    recommendedActions: List[Dict[str, Any]] = Field(default_factory=list)
    ownerSuggestion: Optional[str] = None
    evidenceCitations: List[Any] = Field(default_factory=list)
    createdAt: Optional[datetime] = None


class EvidenceItem(BaseModel):
    changeId: int
    sourceName: Optional[str] = None
    sourceCategory: Optional[str] = None
    evidenceText: str
    addedCount: int
    deletedCount: int


class GraphNode(BaseModel):
    id: str
    node_type: str = "unknown"


class GraphEdge(BaseModel):
    source: str
    target: str
    relation: str = "unknown"


class Graph(BaseModel):
    """Raw graph. Colour/size styling stays in the frontend (lib/graph-style.js)."""
    nodes: List[GraphNode] = Field(default_factory=list)
    edges: List[GraphEdge] = Field(default_factory=list)


class ChatContext(BaseModel):
    stats: str
    ticketsText: str
    changesText: str


class Health(BaseModel):
    status: str
    database: str
    changes: int
    detail: Optional[str] = None


# ── Writes ────────────────────────────────────────────────────────

class EvidenceRequest(BaseModel):
    chunkIds: List[str] = Field(default_factory=list, max_length=200)


class PipelineRunRequest(BaseModel):
    """Which pipeline stages to run, in order. Empty means the full sequence."""
    stages: List[str] = Field(default_factory=list)


class PipelineRun(BaseModel):
    run_id: str
    status: str
    stages: List[str]
    started_at: datetime
    finished_at: Optional[datetime] = None
    error: Optional[str] = None
