"""
LLM-as-Judge — secondary model evaluates primary model's response
against retrieved source documents.
"""

import os
import json
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

# Gemini via OpenAI-compatible endpoint
client = AsyncOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)
JUDGE_MODEL = os.getenv("JUDGE_MODEL", "gemini-2.5-flash")
JUDGE_PROMPT = """You are a factual accuracy judge for an enterprise AI oversight system.

Your job is to determine whether an AI-generated response is grounded in, contradicts, or 
is unrelated to the provided source documents.

USER QUERY:
{user_input}

AI RESPONSE TO EVALUATE:
{ai_response}

SOURCE DOCUMENTS (ground truth):
{source_docs}

Evaluate carefully and respond with ONLY a JSON object in this exact format:
{{
    "verdict": "GROUNDED" | "CONTRADICTION" | "UNVERIFIABLE" | "PARTIAL",
    "confidence": 0.0,
    "reasoning": "One clear sentence explaining your verdict",
    "specific_issue": "If CONTRADICTION or PARTIAL, quote the exact conflicting claim. Otherwise null.",
    "source_used": "Which source document was most relevant to your verdict"
}}

Verdict definitions:
- GROUNDED: The AI response is consistent with and supported by the source documents
- CONTRADICTION: The AI response makes claims that directly contradict the source documents  
- PARTIAL: Parts of the response are grounded, but other parts cannot be verified or conflict
- UNVERIFIABLE: Source documents don't contain enough information to verify the response"""

async def judge_grounding(
    user_input: str,
    ai_response: str,
    source_docs: list,
) -> dict:
    formatted_docs = "\n\n".join([
        f"[Source {i+1}: {doc['source']} | Relevance: {doc['relevance_score']}]\n{doc['content']}"
        for i, doc in enumerate(source_docs)
    ])

    try:
        response = await client.chat.completions.create(
            model=JUDGE_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a precise factual accuracy judge. Always respond with valid JSON only. No markdown, no code blocks."
                },
                {
                    "role": "user",
                    "content": JUDGE_PROMPT.format(
                        user_input=user_input,
                        ai_response=ai_response,
                        source_docs=formatted_docs,
                    )
                }
            ],
            temperature=0.0,
            max_tokens=300,
        )

        raw = response.choices[0].message.content.strip()
        # Strip markdown code blocks if Gemini wraps in ```json
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())
        return {
            "verdict": result.get("verdict", "UNVERIFIABLE"),
            "confidence": float(result.get("confidence", 0.5)),
            "reasoning": result.get("reasoning", "No reasoning provided"),
            "specific_issue": result.get("specific_issue"),
            "source_used": result.get("source_used"),
        }

    except Exception as e:
        return {
            "verdict": "UNVERIFIABLE",
            "confidence": 0.0,
            "reasoning": f"Judge evaluation failed: {str(e)}",
            "specific_issue": None,
            "source_used": None,
        }
