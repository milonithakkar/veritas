"""
Audit Trail — every flag, block, and pass is logged here.
Immutable SQLite log with full reasoning trail.
"""

import json
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Text, DateTime, Float
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

DB_PATH = os.getenv("AUDIT_DB_PATH", "./audit.db")
engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)
Session = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    use_case = Column(String, nullable=False)
    model_name = Column(String, nullable=False)
    user_input = Column(Text, nullable=False)
    ai_response = Column(Text, nullable=False)
    verdict = Column(String, nullable=False)       # PASS, FLAG, BLOCK
    track = Column(String, nullable=True)          # FAST, DEEP, BOTH
    risk_dimension = Column(String, nullable=True) # PERFORMANCE, COST, RESPONSIBILITY
    flag_type = Column(String, nullable=True)      # e.g. PII_DETECTED, GROUNDING_FAILED
    confidence_score = Column(Float, nullable=True)
    reasoning = Column(Text, nullable=True)        # JSON string of reasoning trail
    source_reference = Column(Text, nullable=True) # Which doc was retrieved
    token_count = Column(Float, nullable=True)
    latency_ms = Column(Float, nullable=True)
    reviewer_action = Column(String, nullable=True) # APPROVED, EDITED, ESCALATED


Base.metadata.create_all(engine)


def log_event(
    event_id: str,
    use_case: str,
    model_name: str,
    user_input: str,
    ai_response: str,
    verdict: str,
    track: str = None,
    risk_dimension: str = None,
    flag_type: str = None,
    confidence_score: float = None,
    reasoning: dict = None,
    source_reference: str = None,
    token_count: float = None,
    latency_ms: float = None,
):
    session = Session()
    try:
        entry = AuditLog(
            id=event_id,
            use_case=use_case,
            model_name=model_name,
            user_input=user_input,
            ai_response=ai_response,
            verdict=verdict,
            track=track,
            risk_dimension=risk_dimension,
            flag_type=flag_type,
            confidence_score=confidence_score,
            reasoning=json.dumps(reasoning) if reasoning else None,
            source_reference=source_reference,
            token_count=token_count,
            latency_ms=latency_ms,
        )
        session.add(entry)
        session.commit()
    finally:
        session.close()


def get_recent_flags(limit: int = 50):
    session = Session()
    try:
        results = (
            session.query(AuditLog)
            .filter(AuditLog.verdict.in_(["FLAG", "BLOCK"]))
            .order_by(AuditLog.timestamp.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.id,
                "timestamp": r.timestamp.isoformat(),
                "use_case": r.use_case,
                "model_name": r.model_name,
                "verdict": r.verdict,
                "flag_type": r.flag_type,
                "risk_dimension": r.risk_dimension,
                "confidence_score": r.confidence_score,
                "reasoning": json.loads(r.reasoning) if r.reasoning else None,
                "source_reference": r.source_reference,
                "reviewer_action": r.reviewer_action,
            }
            for r in results
        ]
    finally:
        session.close()


def get_stats():
    session = Session()
    try:
        from sqlalchemy import func
        total = session.query(func.count(AuditLog.id)).scalar()
        flagged = session.query(func.count(AuditLog.id)).filter(AuditLog.verdict == "FLAG").scalar()
        blocked = session.query(func.count(AuditLog.id)).filter(AuditLog.verdict == "BLOCK").scalar()
        passed = session.query(func.count(AuditLog.id)).filter(AuditLog.verdict == "PASS").scalar()
        return {
            "total": total,
            "flagged": flagged,
            "blocked": blocked,
            "passed": passed,
            "pass_rate": round((passed / total * 100), 2) if total > 0 else 100.0,
        }
    finally:
        session.close()


def update_reviewer_action(event_id: str, action: str):
    session = Session()
    try:
        entry = session.query(AuditLog).filter(AuditLog.id == event_id).first()
        if entry:
            entry.reviewer_action = action
            session.commit()
    finally:
        session.close()
