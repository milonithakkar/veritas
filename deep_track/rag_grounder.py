"""
RAG Grounder — the core differentiator.
Retrieves source documents and verifies whether
the AI response is grounded in organizational truth.
"""

import os
from typing import Optional
#from langchain_community.vectorstores import Chroma
#from langchain_openai import OpenAIEmbeddings
#from langchain_google_genai import GoogleGenerativeAIEmbeddings
#from langchain_huggingface import HuggingFaceEmbeddings
#from langchain.text_splitter import RecursiveCharacterTextSplitter
#from langchain_community.document_loaders import TextLoader
#from dotenv import load_dotenv

#load_dotenv()

#CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")
#embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")


from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv

load_dotenv()

CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

def get_vectorstore(use_case: str) -> Chroma:
    """Load the vector store for a given use case."""
    collection_name = f"veritas_{use_case}"
    return Chroma(
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory=CHROMA_DB_PATH,
    )


def retrieve_relevant_docs(query: str, use_case: str, k: int = 3) -> list:
    """
    Retrieve the top-k most relevant source documents
    for a given query from the use case's knowledge base.
    """
    try:
        vectorstore = get_vectorstore(use_case)
        docs = vectorstore.similarity_search_with_relevance_scores(query, k=k)
        return [
            {
                "content": doc.page_content,
                "source": doc.metadata.get("source", "unknown"),
                "relevance_score": round(score, 3),
            }
            for doc, score in docs
        ]
    except Exception as e:
        return []


async def verify_grounding(
    user_input: str,
    ai_response: str,
    use_case: str,
    similarity_threshold: float = 0.75,
) -> dict:
    """
    Verify whether the AI response is grounded in source documents.

    This is the core RAG verification mechanism:
    1. Retrieve relevant source docs for the user query
    2. Use LLM-as-judge to compare AI response against source docs
    3. Return grounding verdict with reasoning trail

    Returns:
        {
            "grounded": bool,
            "contradiction_detected": bool,
            "retrieved_docs": list,
            "highest_relevance": float,
            "judge_verdict": str,
            "judge_reasoning": str,
            "source_reference": str
        }
    """
    # Step 1: Retrieve relevant source documents
    retrieved_docs = retrieve_relevant_docs(user_input, use_case)

    if not retrieved_docs:
        # No source docs found — can't verify grounding
        return {
            "grounded": None,  # Unknown, not False
            "contradiction_detected": False,
            "retrieved_docs": [],
            "highest_relevance": 0.0,
            "judge_verdict": "UNVERIFIABLE",
            "judge_reasoning": "No relevant source documents found in knowledge base for this query.",
            "source_reference": None,
        }

    highest_relevance = max(d["relevance_score"] for d in retrieved_docs)

    if highest_relevance < 0.4:
        # Low relevance — source docs don't really match the query
        return {
            "grounded": None,
            "contradiction_detected": False,
            "retrieved_docs": retrieved_docs,
            "highest_relevance": highest_relevance,
            "judge_verdict": "LOW_RELEVANCE",
            "judge_reasoning": "Retrieved source documents have low relevance to the query. Cannot verify grounding.",
            "source_reference": retrieved_docs[0]["source"] if retrieved_docs else None,
        }

    # Step 2: Use LLM-as-judge to compare response against source docs
    from deep_track.judge import judge_grounding
    judge_result = await judge_grounding(
        user_input=user_input,
        ai_response=ai_response,
        source_docs=retrieved_docs,
    )

    return {
        "grounded": judge_result.get("verdict") == "GROUNDED",
        "contradiction_detected": judge_result.get("verdict") == "CONTRADICTION",
        "retrieved_docs": retrieved_docs,
        "highest_relevance": highest_relevance,
        "judge_verdict": judge_result.get("verdict"),
        "judge_reasoning": judge_result.get("reasoning"),
        "source_reference": retrieved_docs[0]["source"] if retrieved_docs else None,
    }


def build_reasoning(grounding_result: dict, threshold: float) -> dict:
    docs = grounding_result.get("retrieved_docs", [])
    return {
        "step_1": "Claim extraction initiated from AI response",
        "step_2": f"RAG retrieval: {len(docs)} source document(s) retrieved",
        "step_3": f"Highest relevance score: {grounding_result.get('highest_relevance')} (threshold: {threshold})",
        "step_4": f"LLM-as-judge verdict: {grounding_result.get('judge_verdict')}",
        "step_5": f"Judge reasoning: {grounding_result.get('judge_reasoning')}",
        "source_reference": grounding_result.get("source_reference"),
        "recommendation": (
            "Response contradicts source documents. Flag for human review."
            if grounding_result.get("contradiction_detected")
            else "Response is grounded in source documents."
        ),
    }
