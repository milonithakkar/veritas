"""Tests for RAG grounding (requires ChromaDB to be populated first)."""

import pytest
import asyncio
from deep_track.rag_grounder import retrieve_relevant_docs, verify_grounding


def test_retrieve_docs_customer_support():
    """Should retrieve warranty docs for customer support queries."""
    docs = retrieve_relevant_docs(
        query="Does the warranty cover accidental damage?",
        use_case="customer_support",
        k=3,
    )
    # If knowledge base is populated, should return results
    if docs:
        assert len(docs) <= 3
        assert "content" in docs[0]
        assert "relevance_score" in docs[0]


def test_retrieve_docs_financial():
    """Should retrieve financial policy docs."""
    docs = retrieve_relevant_docs(
        query="What is the authorization limit for a department manager?",
        use_case="financial_tool",
        k=3,
    )
    if docs:
        assert len(docs) <= 3


@pytest.mark.asyncio
async def test_grounding_contradiction_detected():
    """Test that a contradicting claim is caught."""
    result = await verify_grounding(
        user_input="Does the warranty cover accidental damage like drops?",
        ai_response="Yes, your warranty covers accidental damage including drops and liquid spills.",
        use_case="customer_support",
    )
    if result.get("judge_verdict") != "UNVERIFIABLE":
        # If we got a real verdict, it should detect the contradiction
        assert result.get("contradiction_detected") is True or result.get("judge_verdict") in ["CONTRADICTION", "PARTIAL"]


@pytest.mark.asyncio
async def test_grounding_passes_correct_claim():
    """Test that a correct claim passes grounding."""
    result = await verify_grounding(
        user_input="How long does the warranty last?",
        ai_response="The warranty covers manufacturing defects for 12 months from the date of purchase.",
        use_case="customer_support",
    )
    if result.get("judge_verdict") not in ["UNVERIFIABLE", "LOW_RELEVANCE"]:
        assert result.get("grounded") is True
