"""
Confidence Scorer — asks the LLM to self-evaluate its own response.
Simple but effective: models are reasonably calibrated about their own uncertainty.
"""

import os
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()
client = AsyncOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)
JUDGE_MODEL = os.getenv("JUDGE_MODEL", "gemini-2.5-flash")

CONFIDENCE_PROMPT = """You are a calibration assistant. Given an AI-generated response to a user query, 
rate your confidence that the response is factually accurate and appropriate.

User Query: {user_input}
AI Response: {ai_response}

Rate confidence on a scale of 0.0 to 1.0 where:
- 0.0-0.3: Very uncertain, likely contains errors or hallucinations
- 0.3-0.6: Somewhat uncertain, may contain inaccuracies
- 0.6-0.8: Reasonably confident, likely accurate
- 0.8-1.0: Highly confident, very likely accurate

Respond with ONLY a JSON object in this exact format:
{{
    "confidence_score": 0.0,
    "primary_concern": "brief description of main uncertainty if any",
    "reasoning": "one sentence explanation"
}}"""


async def score_confidence(user_input: str, ai_response: str) -> dict:
    try:
        response = await client.chat.completions.create(
            model=JUDGE_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": CONFIDENCE_PROMPT.format(
                        user_input=user_input,
                        ai_response=ai_response
                    )
                }
            ],
            temperature=0.0,
            max_tokens=150,
        )

        import json
        raw = response.choices[0].message.content.strip()
        # Strip markdown code blocks if Gemini wraps in ```json
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())
        return {
            "confidence_score": float(result.get("confidence_score", 0.5)),
            "primary_concern": result.get("primary_concern", "Unknown"),
            "reasoning": result.get("reasoning", "No reasoning provided"),
        }

    except Exception as e:
        return {
            "confidence_score": 0.5,
            "primary_concern": f"Confidence scorer error: {str(e)}",
            "reasoning": "Defaulting to uncertain due to scorer failure",
        }

def build_reasoning(confidence_result: dict, threshold: float) -> dict:
    score = confidence_result.get("confidence_score", 0)
    return {
        "step_1": "Confidence evaluation initiated",
        "step_2": f"LLM self-evaluated response confidence: {score}",
        "step_3": f"Policy threshold: {threshold}",
        "step_4": f"Score {'BELOW' if score < threshold else 'ABOVE'} threshold",
        "step_5": f"Primary concern: {confidence_result.get('primary_concern')}",
        "reasoning": confidence_result.get("reasoning"),
        "recommendation": "Response flagged for human review due to low confidence" if score < threshold else "Confidence check passed",
    }
