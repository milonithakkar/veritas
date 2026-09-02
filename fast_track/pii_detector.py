"""
PII Detector using Microsoft Presidio.
Detects personally identifiable information in AI responses.
"""
from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
from presidio_analyzer.predefined_recognizers import PhoneRecognizer
from presidio_anonymizer import AnonymizerEngine
from typing import Optional

# Explicitly register PhoneRecognizer — built-in detection is unreliable without this
registry = RecognizerRegistry()
registry.load_predefined_recognizers()
registry.add_recognizer(PhoneRecognizer())

analyzer = AnalyzerEngine(registry=registry)
anonymizer = AnonymizerEngine()

# PII entity types to detect
PII_ENTITIES = [
    "PERSON",
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "CREDIT_CARD",
    "IBAN_CODE",
    "IP_ADDRESS",
    "US_SSN",
    "UK_NHS",
#    "DATE_TIME",
    "LOCATION",
    "NRP",  # Nationality, religious, political group
    "MEDICAL_LICENSE",
    "URL",
]


def detect_pii(text: str, language: str = "en") -> dict:
    """
    Detect PII in the given text.

    Returns:
        {
            "pii_detected": bool,
            "entities_found": list of dicts,
            "anonymized_text": str (text with PII masked),
            "highest_score": float
        }
    """
    if not text:
        return {
            "pii_detected": False,
            "entities_found": [],
            "anonymized_text": text or "",
            "highest_score": 0.0,
        }

    results = analyzer.analyze(
        text=text,
        entities=PII_ENTITIES,
        language=language
    )

    if not results:
        return {
            "pii_detected": False,
            "entities_found": [],
            "anonymized_text": text,
            "highest_score": 0.0,
        }

    # Filter to meaningful detections (score > 0.5)
    significant = [r for r in results if r.score > 0.5]

    if not significant:
        return {
            "pii_detected": False,
            "entities_found": [],
            "anonymized_text": text,
            "highest_score": 0.0,
        }

    entities_found = [
        {
            "entity_type": r.entity_type,
            "score": round(r.score, 3),
            "start": r.start,
            "end": r.end,
            "value": text[r.start:r.end],
        }
        for r in significant
    ]

    anonymized = anonymizer.anonymize(text=text, analyzer_results=significant)

    return {
        "pii_detected": True,
        "entities_found": entities_found,
        "anonymized_text": anonymized.text,
        "highest_score": round(max(r.score for r in significant), 3),
    }


def build_reasoning(pii_result: dict) -> dict:
    """Build a human-readable reasoning trail for a PII detection."""
    entities = pii_result.get("entities_found", [])
    return {
        "step_1": "PII scan initiated on AI response text",
        "step_2": f"Presidio analyzer detected {len(entities)} PII entity/entities",
        "step_3": f"Entity types found: {[e['entity_type'] for e in entities]}",
        "step_4": f"Highest confidence score: {pii_result.get('highest_score', 0)}",
        "step_5": "Flag generated: RESPONSIBILITY — PII_DETECTED",
        "recommendation": "Response blocked. Anonymized version available for review.",
    }
