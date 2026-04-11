"""Database models using SQLAlchemy — works with both SQLite and PostgreSQL."""
import hashlib
from datetime import datetime, timezone
from sqlalchemy import (
    create_engine, Column, String, Text, Integer, Float, Boolean,
    DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from config.settings import DATABASE_URL, USE_SUPABASE

Base = declarative_base()


class Source(Base):
    __tablename__ = "sources"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    url = Column(String, unique=True, nullable=False)
    fetch_type = Column(String, default="html")  # html | json
    category = Column(String)  # security_bulletin, developer_docs, cve_feed, policy_update
    active = Column(Boolean, default=True)
    priority = Column(Integer, default=5)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    snapshots = relationship("Snapshot", back_populates="source")


class Snapshot(Base):
    __tablename__ = "snapshots"
    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=False)
    raw_text = Column(Text)
    clean_text = Column(Text)
    content_hash = Column(String(64))  # SHA-256
    fetched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    source = relationship("Source", back_populates="snapshots")

    def compute_hash(self):
        self.content_hash = hashlib.sha256(
            (self.clean_text or "").encode()
        ).hexdigest()
        return self.content_hash


class Change(Base):
    __tablename__ = "changes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=False)
    prev_snapshot_id = Column(Integer, ForeignKey("snapshots.id"))
    new_snapshot_id = Column(Integer, ForeignKey("snapshots.id"), nullable=False)
    diff_json = Column(JSON)  # {added: [...], deleted: [...], modified: [...]}
    diff_text = Column(Text)  # Human-readable diff summary
    status = Column(String, default="pending")  # pending | triaged | escalated | closed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    source = relationship("Source")
    prev_snapshot = relationship("Snapshot", foreign_keys=[prev_snapshot_id])
    new_snapshot = relationship("Snapshot", foreign_keys=[new_snapshot_id])


class AgentEvent(Base):
    """Sentinel and Coordinator outputs per change."""
    __tablename__ = "agent_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    change_id = Column(Integer, ForeignKey("changes.id"), nullable=False)
    agent_name = Column(String)  # sentinel | coordinator
    event_type = Column(String)  # triage | insight | recommendation
    title = Column(String)
    summary = Column(Text)
    tags = Column(JSON)
    relevance_score = Column(Float)
    local_risk_score = Column(Float)
    confidence = Column(Float)
    risk_domain = Column(String)
    recommended_actions = Column(JSON)
    evidence_ids = Column(JSON)  # chunk IDs used as evidence
    raw_output = Column(JSON)   # full LLM response for audit
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    change = relationship("Change")


class Recommendation(Base):
    """Final action tickets from the Coordinator."""
    __tablename__ = "recommendations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    change_id = Column(Integer, ForeignKey("changes.id"), nullable=False)
    agent_event_id = Column(Integer, ForeignKey("agent_events.id"))
    title = Column(String)
    priority = Column(String)  # critical | high | medium | low
    summary = Column(Text)
    recommended_actions = Column(JSON)
    owner_suggestion = Column(String)
    evidence_citations = Column(JSON)
    risk_score = Column(Float)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    change = relationship("Change")


# ── Database Initialization ───────────────────────────────────────

engine_kwargs = {}
if USE_SUPABASE:
    engine_kwargs["pool_pre_ping"] = True  # handle Supabase connection drops

engine = create_engine(DATABASE_URL, echo=False, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine)


def init_db():
    """Create all tables."""
    Base.metadata.create_all(engine)
    db_type = "Supabase PostgreSQL" if USE_SUPABASE else f"SQLite at {DATABASE_URL}"
    print(f"[DB] Initialized — {db_type}")


def get_session():
    """Get a new database session."""
    return SessionLocal()
