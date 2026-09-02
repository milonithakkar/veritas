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


def get_model_health():
    """
    Aggregate per-use-case health metrics from the audit log.
    Returns accuracy (pass rate), avg latency, avg confidence,
    flag breakdown, and recent trend data for each use case.
    """
    session = Session()
    try:
        from sqlalchemy import func

        # Get distinct use cases
        use_cases = [r[0] for r in session.query(AuditLog.use_case).distinct().all()]

        models = []
        for uc in use_cases:
            base_q = session.query(AuditLog).filter(AuditLog.use_case == uc)

            total = base_q.count()
            passed = base_q.filter(AuditLog.verdict == "PASS").count()
            flagged = base_q.filter(AuditLog.verdict == "FLAG").count()
            blocked = base_q.filter(AuditLog.verdict == "BLOCK").count()

            pass_rate = round((passed / total * 100), 1) if total > 0 else 100.0

            avg_latency = session.query(func.avg(AuditLog.latency_ms)).filter(
                AuditLog.use_case == uc
            ).scalar()
            avg_confidence = session.query(func.avg(AuditLog.confidence_score)).filter(
                AuditLog.use_case == uc
            ).scalar()

            # Get the model name from the most recent event
            latest = base_q.order_by(AuditLog.timestamp.desc()).first()
            model_name = latest.model_name if latest else "unknown"

            # Determine drift status based on pass rate
            if pass_rate >= 90:
                drift = "Low"
                tone = "safe"
            elif pass_rate >= 75:
                drift = "Medium"
                tone = "warning"
            else:
                drift = "High"
                tone = "critical"

            # Get recent events for sparkline (last 10 events, pass=1 fail=0)
            recent = base_q.order_by(AuditLog.timestamp.desc()).limit(10).all()
            sparkline = [1 if r.verdict == "PASS" else 0 for r in reversed(recent)]

            # Flag type breakdown
            flag_types = {}
            flagged_events = base_q.filter(AuditLog.verdict.in_(["FLAG", "BLOCK"])).all()
            for ev in flagged_events:
                ft = ev.flag_type or "UNKNOWN"
                flag_types[ft] = flag_types.get(ft, 0) + 1

            models.append({
                "use_case": uc,
                "model_name": model_name,
                "total_requests": total,
                "passed": passed,
                "flagged": flagged,
                "blocked": blocked,
                "pass_rate": pass_rate,
                "avg_latency_ms": round(avg_latency, 1) if avg_latency else 0,
                "avg_confidence": round(avg_confidence, 3) if avg_confidence else None,
                "drift": drift,
                "tone": tone,
                "sparkline": sparkline,
                "flag_types": flag_types,
                "pending_review": sum(
                    1 for r in flagged_events if not r.reviewer_action
                ),
            })

        # Sort by total requests descending
        models.sort(key=lambda m: m["total_requests"], reverse=True)
        return {"models": models}
    finally:
        session.close()


def get_cost_analytics():
    """
    Aggregate cost and token analytics from the audit log.
    Returns per-use-case breakdown and overall totals.
    """
    session = Session()
    try:
        from sqlalchemy import func

        # Overall totals
        total_tokens = session.query(func.sum(AuditLog.token_count)).scalar() or 0
        total_requests = session.query(func.count(AuditLog.id)).scalar() or 0
        avg_tokens_per_request = round(total_tokens / total_requests, 0) if total_requests > 0 else 0

        # Estimated total cost (using gpt-4o-mini pricing as baseline)
        # In production this would track actual costs per model
        estimated_cost = round(total_tokens * 0.0003 / 1000, 2)  # rough avg of input/output pricing

        # Per-use-case breakdown
        use_cases = [r[0] for r in session.query(AuditLog.use_case).distinct().all()]
        breakdown = []

        for uc in use_cases:
            base_q = session.query(AuditLog).filter(AuditLog.use_case == uc)
            requests = base_q.count()
            tokens = session.query(func.sum(AuditLog.token_count)).filter(
                AuditLog.use_case == uc
            ).scalar() or 0
            avg_tokens = round(tokens / requests, 0) if requests > 0 else 0
            cost = round(tokens * 0.0003 / 1000, 2)

            # Token trend (last 7 days, grouped by day)
            from datetime import timedelta
            now = datetime.utcnow()
            daily_tokens = []
            for day_offset in range(6, -1, -1):
                day_start = (now - timedelta(days=day_offset)).replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(days=1)
                day_total = session.query(func.sum(AuditLog.token_count)).filter(
                    AuditLog.use_case == uc,
                    AuditLog.timestamp >= day_start,
                    AuditLog.timestamp < day_end,
                ).scalar() or 0
                daily_tokens.append(int(day_total))

            breakdown.append({
                "use_case": uc,
                "requests": requests,
                "total_tokens": int(tokens),
                "avg_tokens": int(avg_tokens),
                "estimated_cost": cost,
                "daily_tokens": daily_tokens,
            })

        breakdown.sort(key=lambda b: b["estimated_cost"], reverse=True)

        # Overall daily token trend
        overall_daily = []
        from datetime import timedelta
        now = datetime.utcnow()
        for day_offset in range(6, -1, -1):
            day_start = (now - timedelta(days=day_offset)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            day_total = session.query(func.sum(AuditLog.token_count)).filter(
                AuditLog.timestamp >= day_start,
                AuditLog.timestamp < day_end,
            ).scalar() or 0
            overall_daily.append(int(day_total))

        return {
            "total_requests": total_requests,
            "total_tokens": int(total_tokens),
            "avg_tokens_per_request": int(avg_tokens_per_request),
            "estimated_total_cost": estimated_cost,
            "daily_token_trend": overall_daily,
            "by_use_case": breakdown,
        }
    finally:
        session.close()
