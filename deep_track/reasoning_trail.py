"""
Reasoning Trail Builder — assembles the full human-readable
explanation for every Veritas decision.
This is the TrustLedger component — makes every flag traceable.
"""

from datetime import datetime
from typing import Optional


def build_full_trail(
    event_id: str,
    use_case: str,
    model_name: str,
    user_input: str,
    ai_response: str,
    verdict: str,
    fast_track_results: dict,
    deep_track_results: dict,
    policy_applied: str,
    latency_ms: float,
) -> dict:
    """
    Assemble the complete reasoning trail for a Veritas evaluation.
    This is what surfaces in the Human Review Console.
    """
    steps = []
    flags = []

    # --- FAST TRACK STEPS ---
    steps.append({
        "track": "FAST",
        "step": 1,
        "check": "Request Interception",
        "result": "AI response intercepted at output layer",
        "status": "COMPLETE",
    })

    # PII
    pii = fast_track_results.get("pii", {})
    if pii:
        steps.append({
            "track": "FAST",
            "step": 2,
            "check": "PII Detection (Presidio)",
            "result": f"{'PII DETECTED: ' + str([e['entity_type'] for e in pii.get('entities_found', [])]) if pii.get('pii_detected') else 'No PII detected'}",
            "status": "FLAGGED" if pii.get("pii_detected") else "PASSED",
        })
        if pii.get("pii_detected"):
            flags.append({
                "dimension": "RESPONSIBILITY",
                "type": "PII_DETECTED",
                "severity": "HIGH",
                "detail": f"Entities: {[e['entity_type'] for e in pii.get('entities_found', [])]}",
            })

    # Blocklist
    blocklist = fast_track_results.get("blocklist", {})
    if blocklist:
        steps.append({
            "track": "FAST",
            "step": 3,
            "check": "Blocklist Pattern Check",
            "result": f"{'MATCH: ' + blocklist.get('pattern_type', '') if blocklist.get('blocked') else 'No harmful patterns detected'}",
            "status": "BLOCKED" if blocklist.get("blocked") else "PASSED",
        })
        if blocklist.get("blocked"):
            flags.append({
                "dimension": "RESPONSIBILITY",
                "type": "BLOCKLIST_MATCH",
                "severity": "CRITICAL",
                "detail": f"Pattern: {blocklist.get('pattern_type')}",
            })

    # Confidence
    confidence = fast_track_results.get("confidence", {})
    if confidence:
        score = confidence.get("confidence_score", 1.0)
        steps.append({
            "track": "FAST",
            "step": 4,
            "check": "Confidence Score",
            "result": f"Score: {score} — {confidence.get('primary_concern', 'None')}",
            "status": "FLAGGED" if score < 0.6 else "PASSED",
        })
        if score < 0.6:
            flags.append({
                "dimension": "PERFORMANCE",
                "type": "LOW_CONFIDENCE",
                "severity": "MEDIUM",
                "detail": confidence.get("reasoning"),
            })

    # Cost
    cost = fast_track_results.get("cost", {})
    if cost:
        steps.append({
            "track": "FAST",
            "step": 5,
            "check": "Cost / Token Monitor",
            "result": f"Tokens: {cost.get('total_tokens')} | Cost: ${cost.get('estimated_cost_usd')} | {'EXCEEDED by ' + str(cost.get('overage_pct')) + '%' if cost.get('exceeded') else 'Within budget'}",
            "status": "FLAGGED" if cost.get("exceeded") else "PASSED",
        })
        if cost.get("exceeded"):
            flags.append({
                "dimension": "COST",
                "type": "TOKEN_BUDGET_EXCEEDED",
                "severity": "LOW",
                "detail": f"{cost.get('overage_pct')}% over policy limit",
            })

    # --- DEEP TRACK STEPS ---
    grounding = deep_track_results.get("grounding", {})
    if grounding:
        docs = grounding.get("retrieved_docs", [])
        steps.append({
            "track": "DEEP",
            "step": 6,
            "check": "RAG Source Retrieval",
            "result": f"{len(docs)} source document(s) retrieved. Highest relevance: {grounding.get('highest_relevance')}",
            "status": "COMPLETE",
        })
        steps.append({
            "track": "DEEP",
            "step": 7,
            "check": "LLM-as-Judge Grounding Verification",
            "result": f"Verdict: {grounding.get('judge_verdict')} — {grounding.get('judge_reasoning')}",
            "status": "FLAGGED" if grounding.get("contradiction_detected") else "PASSED",
        })
        if grounding.get("contradiction_detected"):
            flags.append({
                "dimension": "PERFORMANCE",
                "type": "GROUNDING_FAILED",
                "severity": "HIGH",
                "detail": f"Source: {grounding.get('source_reference')} | {grounding.get('judge_reasoning')}",
            })

    bias = deep_track_results.get("bias", {})
    if bias:
        steps.append({
            "track": "DEEP",
            "step": 8,
            "check": "Bias & Fairness Evaluation",
            "result": f"{'BIAS DETECTED: ' + bias.get('bias_type', '') + ' | Severity: ' + bias.get('severity', '') if bias.get('bias_detected') else 'No bias detected'}",
            "status": "FLAGGED" if bias.get("bias_detected") else "PASSED",
        })
        if bias.get("bias_detected"):
            flags.append({
                "dimension": "RESPONSIBILITY",
                "type": "BIAS_DETECTED",
                "severity": bias.get("severity", "MEDIUM"),
                "detail": bias.get("reasoning"),
            })

    return {
        "event_id": event_id,
        "timestamp": datetime.utcnow().isoformat(),
        "use_case": use_case,
        "model_name": model_name,
        "policy_applied": policy_applied,
        "verdict": verdict,
        "flags": flags,
        "flag_count": len(flags),
        "steps": steps,
        "latency_ms": latency_ms,
        "user_input_preview": user_input[:200] + "..." if len(user_input) > 200 else user_input,
        "response_preview": ai_response[:200] + "..." if len(ai_response) > 200 else ai_response,
        "human_action_required": len(flags) > 0,
        "available_actions": ["APPROVE", "EDIT", "ESCALATE"] if len(flags) > 0 else [],
    }
