"""
Interceptor — orchestrates Fast Track and Deep Track checks
on every AI response.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
import time
import uuid
from typing import Optional

from fast_track.pii_detector import detect_pii, build_reasoning as pii_reasoning
from fast_track.blocklist_checker import check_blocklist, build_reasoning as blocklist_reasoning
from fast_track.confidence_scorer import score_confidence, build_reasoning as confidence_reasoning
from fast_track.cost_monitor import check_cost, build_reasoning as cost_reasoning
from deep_track.rag_grounder import verify_grounding, build_reasoning as grounding_reasoning
from deep_track.bias_evaluator import evaluate_bias, build_reasoning as bias_reasoning
from deep_track.reasoning_trail import build_full_trail
from policy.policy_engine import Policy
from core.audit import log_event


async def run_fast_track(
    user_input: str,
    ai_response: str,
    input_tokens: int,
    output_tokens: int,
    policy: Policy,
) -> tuple[str, dict]:
    """
    Run all Fast Track checks synchronously.
    Returns (verdict, results_dict)
    verdict: PASS, FLAG, or BLOCK
    """
    results = {}
    verdict = "PASS"
    track_verdict = "PASS"

    # 1. Blocklist (fastest — no LLM)
    blocklist_result = check_blocklist(ai_response)
    results["blocklist"] = blocklist_result
    if blocklist_result["blocked"] and policy.blocklist_action == "BLOCK":
        return "BLOCK", results
    elif blocklist_result["blocked"]:
        track_verdict = "FLAG"

    # 2. PII Detection
    if policy.pii_detection_enabled:
        pii_result = detect_pii(ai_response)
        results["pii"] = pii_result
        if pii_result["pii_detected"]:
            if policy.pii_action == "BLOCK":
                return "BLOCK", results
            else:
                track_verdict = "FLAG"

    # 3. Cost Monitor
    cost_result = check_cost(
        response_text=ai_response,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        max_tokens=policy.max_tokens_per_response,
    )
    results["cost"] = cost_result
    if cost_result["exceeded"]:
        if policy.token_exceed_action == "BLOCK":
            return "BLOCK", results
        else:
            track_verdict = "FLAG"

    # 4. Confidence Scorer (async LLM call)
    confidence_result = await score_confidence(user_input, ai_response)
    results["confidence"] = confidence_result
    if confidence_result["confidence_score"] < policy.confidence_threshold:
        if policy.low_confidence_action == "BLOCK":
            return "BLOCK", results
        else:
            track_verdict = "FLAG"

    return track_verdict, results


async def run_deep_track(
    user_input: str,
    ai_response: str,
    use_case: str,
    policy: Policy,
) -> tuple[str, dict]:
    """
    Run all Deep Track checks asynchronously in parallel.
    Returns (verdict, results_dict)
    """
    results = {}
    track_verdict = "PASS"

    # Run grounding and bias checks in parallel
    tasks = []

    if policy.grounding_enabled:
        tasks.append(
            verify_grounding(
                user_input=user_input,
                ai_response=ai_response,
                use_case=use_case,
                similarity_threshold=policy.grounding_similarity_threshold,
            )
        )
    else:
        async def _no_grounding():
            return {}
        tasks.append(_no_grounding())

    if policy.bias_detection_enabled:
        tasks.append(
            evaluate_bias(
                user_input=user_input,
                ai_response=ai_response,
                use_case=use_case,
            )
        )
    else:
        async def _no_bias():
            return {}
        tasks.append(_no_bias())

    grounding_result, bias_result = await asyncio.gather(*tasks, return_exceptions=True)

    # Handle grounding
    if isinstance(grounding_result, dict) and grounding_result:
        results["grounding"] = grounding_result
        if grounding_result.get("contradiction_detected"):
            if policy.grounding_action == "BLOCK":
                track_verdict = "BLOCK"
            else:
                track_verdict = "FLAG"

    # Handle bias
    if isinstance(bias_result, dict) and bias_result:
        results["bias"] = bias_result
        if bias_result.get("bias_detected"):
            if policy.bias_action == "BLOCK":
                if track_verdict != "BLOCK":
                    track_verdict = "BLOCK"
            else:
                if track_verdict == "PASS":
                    track_verdict = "FLAG"

    return track_verdict, results


async def evaluate_response(
    user_input: str,
    ai_response: str,
    use_case: str,
    policy: Policy,
    input_tokens: int = 0,
    output_tokens: int = 0,
) -> dict:
    """
    Main evaluation function — runs Fast Track and Deep Track,
    assembles the reasoning trail, logs to audit DB.

    Returns the full Veritas evaluation result.
    """
    event_id = str(uuid.uuid4())
    start_time = time.time()

    # Run Fast Track and Deep Track concurrently
    fast_task = run_fast_track(
        user_input=user_input,
        ai_response=ai_response,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        policy=policy,
    )

    deep_task = run_deep_track(
        user_input=user_input,
        ai_response=ai_response,
        use_case=use_case,
        policy=policy,
    )

    (fast_verdict, fast_results), (deep_verdict, deep_results) = await asyncio.gather(
        fast_task, deep_task
    )

    # Final verdict: most severe wins
    if fast_verdict == "BLOCK" or deep_verdict == "BLOCK":
        final_verdict = "BLOCK"
    elif fast_verdict == "FLAG" or deep_verdict == "FLAG":
        final_verdict = "FLAG"
    else:
        final_verdict = "PASS"

    latency_ms = round((time.time() - start_time) * 1000, 2)

    # Build full reasoning trail
    trail = build_full_trail(
        event_id=event_id,
        use_case=use_case,
        model_name=policy.model_name,
        user_input=user_input,
        ai_response=ai_response,
        verdict=final_verdict,
        fast_track_results=fast_results,
        deep_track_results=deep_results,
        policy_applied=policy.use_case,
        latency_ms=latency_ms,
    )

    # Log to audit DB
    cost = fast_results.get("cost", {})
    grounding = deep_results.get("grounding", {})
    flags = trail.get("flags", [])
    primary_flag = flags[0] if flags else {}

    log_event(
        event_id=event_id,
        use_case=use_case,
        model_name=policy.model_name,
        user_input=user_input,
        ai_response=ai_response,
        verdict=final_verdict,
        track="BOTH",
        risk_dimension=primary_flag.get("dimension"),
        flag_type=primary_flag.get("type"),
        confidence_score=fast_results.get("confidence", {}).get("confidence_score"),
        reasoning=trail,
        source_reference=grounding.get("source_reference") if grounding else None,
        token_count=cost.get("total_tokens"),
        latency_ms=latency_ms,
    )

    return {
        "event_id": event_id,
        "verdict": final_verdict,
        "fast_track": fast_results,
        "deep_track": deep_results,
        "reasoning_trail": trail,
        "latency_ms": latency_ms,
    }
