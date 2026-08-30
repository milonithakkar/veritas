"""
Veritas API Gateway — FastAPI middleware that proxies requests
to any foundation model while intercepting responses for evaluation.

Usage:
    Instead of calling OpenAI directly, call Veritas:
    POST /evaluate  → evaluates an existing response
    POST /chat      → proxy: calls OpenAI, then evaluates the response
    GET  /flags     → recent flagged responses
    GET  /stats     → dashboard statistics
    POST /review    → human reviewer action (approve/edit/escalate)
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from openai import AsyncOpenAI
from dotenv import load_dotenv
from rich import print

from policy.policy_engine import load_policy, list_policies
from core.interceptor import evaluate_response
from core.audit import get_recent_flags, get_stats, update_reviewer_action

load_dotenv()

app = FastAPI(
    title="Veritas",
    description="Real-Time AI Oversight Across Performance, Cost & Responsibility",
    version="1.0.0",
)

# Allow frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)
PRIMARY_MODEL = os.getenv("PRIMARY_MODEL", "gpt-4o-mini")


# --- Request/Response Models ---

class ChatRequest(BaseModel):
    use_case: str                          # e.g. "customer_support"
    user_input: str
    system_prompt: Optional[str] = None


class EvaluateRequest(BaseModel):
    use_case: str
    user_input: str
    ai_response: str
    input_tokens: Optional[int] = 0
    output_tokens: Optional[int] = 0


class ReviewAction(BaseModel):
    event_id: str
    action: str                            # APPROVED, EDITED, ESCALATED
    edited_response: Optional[str] = None  # If action is EDITED


# --- Endpoints ---

@app.get("/")
async def root():
    return {
        "service": "Veritas",
        "tagline": "Find it first.",
        "version": "1.0.0",
        "status": "running",
        "available_use_cases": list_policies(),
    }


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Proxy endpoint: routes user message to the foundation model,
    then runs Veritas evaluation on the response before returning it.
    This is the main integration point for enterprise AI applications.
    """
    # Load policy for this use case
    policy = load_policy(request.use_case)

    # Call the foundation model
    messages = []
    if request.system_prompt:
        messages.append({"role": "system", "content": request.system_prompt})
    messages.append({"role": "user", "content": request.user_input})

    llm_response = await client.chat.completions.create(
        model=policy.model_name,
        messages=messages,
        temperature=0.7,
        max_tokens=policy.max_tokens_per_response,
    )

    ai_response = llm_response.choices[0].message.content
    input_tokens = llm_response.usage.prompt_tokens
    output_tokens = llm_response.usage.completion_tokens

    # Run Veritas evaluation
    evaluation = await evaluate_response(
        user_input=request.user_input,
        ai_response=ai_response,
        use_case=request.use_case,
        policy=policy,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )

    verdict = evaluation["verdict"]

    # Return appropriate response based on verdict
    if verdict == "BLOCK":
        return {
            "verdict": "BLOCK",
            "response": None,
            "message": "Response blocked by Veritas. A human reviewer has been notified.",
            "event_id": evaluation["event_id"],
            "flags": evaluation["reasoning_trail"].get("flags", []),
            "latency_ms": evaluation["latency_ms"],
        }
    elif verdict == "FLAG":
        return {
            "verdict": "FLAG",
            "response": ai_response,  # Deliver but flag
            "message": "Response flagged for human review.",
            "event_id": evaluation["event_id"],
            "flags": evaluation["reasoning_trail"].get("flags", []),
            "latency_ms": evaluation["latency_ms"],
        }
    else:
        return {
            "verdict": "PASS",
            "response": ai_response,
            "message": "Response passed all Veritas checks.",
            "event_id": evaluation["event_id"],
            "flags": [],
            "latency_ms": evaluation["latency_ms"],
        }


@app.post("/evaluate")
async def evaluate(request: EvaluateRequest):
    """
    Evaluate an existing AI response without proxying.
    Use this if you already have an AI response and want Veritas to check it.
    """
    policy = load_policy(request.use_case)

    evaluation = await evaluate_response(
        user_input=request.user_input,
        ai_response=request.ai_response,
        use_case=request.use_case,
        policy=policy,
        input_tokens=request.input_tokens,
        output_tokens=request.output_tokens,
    )

    return evaluation


@app.get("/flags")
async def get_flags(limit: int = 50):
    """Get recent flagged/blocked responses for the Human Review Console."""
    return {"flags": get_recent_flags(limit=limit)}


@app.get("/stats")
async def get_dashboard_stats():
    """Get aggregate statistics for the dashboard."""
    return get_stats()


@app.post("/review")
async def submit_review(action: ReviewAction):
    """
    Submit a human reviewer's decision on a flagged response.
    Actions: APPROVED, EDITED, ESCALATED
    """
    valid_actions = ["APPROVED", "EDITED", "ESCALATED"]
    if action.action not in valid_actions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action. Must be one of: {valid_actions}"
        )

    update_reviewer_action(action.event_id, action.action)

    return {
        "success": True,
        "event_id": action.event_id,
        "action": action.action,
        "message": f"Reviewer action '{action.action}' recorded successfully.",
    }


@app.get("/policies")
async def get_policies():
    """List all available use case policies."""
    policies = []
    for use_case in list_policies():
        p = load_policy(use_case)
        policies.append({
            "use_case": p.use_case,
            "display_name": p.display_name,
            "geography": p.geography,
            "max_latency_ms": p.max_latency_ms,
            "pii_action": p.pii_action,
            "grounding_enabled": p.grounding_enabled,
            "require_human_review": p.require_human_review,
        })
    return {"policies": policies}


if __name__ == "__main__":
    import uvicorn
    print("[bold purple]Starting Veritas API Gateway...[/bold purple]")
    print("[purple]Find it first.[/purple]")
    uvicorn.run("core.gateway:app", host="0.0.0.0", port=8000, reload=True)
