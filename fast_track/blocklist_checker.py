"""
Blocklist Checker — catches known harmful patterns instantly.
Rule-based, no LLM needed, effectively zero latency.
"""

import re
from typing import Optional

# Patterns that should never appear in enterprise AI outputs
BLOCKLIST_PATTERNS = [
    # Prompt injection attempts
    (r"ignore\s+(previous|prior|above|all)\s+instructions", "PROMPT_INJECTION"),
    (r"you\s+are\s+now\s+(?:in\s+)?(?:DAN|developer\s+mode|jailbreak)", "JAILBREAK_ATTEMPT"),
    (r"act\s+as\s+if\s+you\s+have\s+no\s+restrictions", "JAILBREAK_ATTEMPT"),

    # Data exfiltration patterns
    (r"system\s*prompt\s*:?\s*[\[{<]", "SYSTEM_PROMPT_LEAK"),
    (r"(?:password|secret|api.?key|token)\s*[:=]\s*\S+", "CREDENTIAL_LEAK"),

    # Harmful content
    (r"\b(?:how\s+to\s+(?:make|build|create)\s+(?:bomb|weapon|malware))", "HARMFUL_CONTENT"),

    # Internal path/infrastructure exposure
    (r"(?:/etc/passwd|/etc/shadow|\.env\b)", "INTERNAL_PATH_EXPOSURE"),
    (r"(?:SELECT|INSERT|UPDATE|DELETE|DROP)\s+.+\s+(?:FROM|INTO|TABLE)", "SQL_INJECTION_PATTERN"),
]


def check_blocklist(text: str) -> dict:
    """
    Check text against known harmful patterns.

    Returns:
        {
            "blocked": bool,
            "pattern_matched": str or None,
            "pattern_type": str or None,
            "matched_text": str or None
        }
    """
    text_lower = text.lower()

    for pattern, pattern_type in BLOCKLIST_PATTERNS:
        match = re.search(pattern, text_lower, re.IGNORECASE)
        if match:
            return {
                "blocked": True,
                "pattern_matched": pattern,
                "pattern_type": pattern_type,
                "matched_text": text[match.start():match.end()],
            }

    return {
        "blocked": False,
        "pattern_matched": None,
        "pattern_type": None,
        "matched_text": None,
    }


def build_reasoning(blocklist_result: dict) -> dict:
    return {
        "step_1": "Blocklist pattern matching initiated",
        "step_2": f"Matched pattern type: {blocklist_result.get('pattern_type')}",
        "step_3": f"Matched text fragment: '{blocklist_result.get('matched_text')}'",
        "step_4": "Pattern is on enterprise security blocklist",
        "step_5": "Flag generated: RESPONSIBILITY — BLOCKLIST_MATCH",
        "recommendation": "Response blocked. Escalate to security team.",
    }

