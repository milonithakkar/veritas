"""
Cost Monitor — tracks token usage and spend per response.
Flags responses that exceed per-use-case token budgets.
"""

# Approximate cost per 1K tokens (USD) for gpt-4o-mini
# Update these if OpenAI changes pricing
COST_PER_1K_INPUT_TOKENS = 0.00015
COST_PER_1K_OUTPUT_TOKENS = 0.00060


def estimate_cost(input_tokens: int, output_tokens: int, model: str = "gpt-4o-mini") -> float:
    """Estimate cost in USD for a single API call."""
    input_cost = (input_tokens / 1000) * COST_PER_1K_INPUT_TOKENS
    output_cost = (output_tokens / 1000) * COST_PER_1K_OUTPUT_TOKENS
    return round(input_cost + output_cost, 6)


def check_cost(
    response_text: str,
    input_tokens: int,
    output_tokens: int,
    max_tokens: int,
    model: str = "gpt-4o-mini"
) -> dict:
    """
    Check if a response exceeds token/cost thresholds.

    Returns:
        {
            "exceeded": bool,
            "input_tokens": int,
            "output_tokens": int,
            "total_tokens": int,
            "estimated_cost_usd": float,
            "max_tokens": int,
            "overage_pct": float
        }
    """
    total = input_tokens + output_tokens
    cost = estimate_cost(input_tokens, output_tokens, model)
    exceeded = output_tokens > max_tokens
    overage_pct = round(((output_tokens - max_tokens) / max_tokens) * 100, 1) if exceeded else 0.0

    return {
        "exceeded": exceeded,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total,
        "estimated_cost_usd": cost,
        "max_tokens": max_tokens,
        "overage_pct": overage_pct,
    }


def build_reasoning(cost_result: dict) -> dict:
    return {
        "step_1": "Token usage captured from API response metadata",
        "step_2": f"Output tokens: {cost_result['output_tokens']} (limit: {cost_result['max_tokens']})",
        "step_3": f"Overage: {cost_result['overage_pct']}% above policy threshold",
        "step_4": f"Estimated cost: ${cost_result['estimated_cost_usd']}",
        "step_5": "Flag generated: COST — TOKEN_BUDGET_EXCEEDED",
        "recommendation": "Review prompt for verbosity. Consider adding max_tokens constraint.",
    }
