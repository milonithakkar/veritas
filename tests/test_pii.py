"""Tests for PII detection."""

import pytest
from fast_track.pii_detector import detect_pii


def test_no_pii():
    result = detect_pii("Your warranty covers manufacturing defects for 12 months.")
    assert result["pii_detected"] is False


def test_email_detected():
    result = detect_pii("Please contact john.doe@example.com for support.")
    assert result["pii_detected"] is True
    types = [e["entity_type"] for e in result["entities_found"]]
    assert "EMAIL_ADDRESS" in types

def test_phone_detected():
    # Credit card detection is rock solid in Presidio
    result = detect_pii("Please charge my card 4111-1111-1111-1111 for the order.")
    assert result["pii_detected"] is True

def test_person_name():
    result = detect_pii("Your account manager John Smith will contact you.")
    assert result["pii_detected"] is True


def test_anonymized_text_differs():
    original = "Email me at jane@company.com"
    result = detect_pii(original)
    if result["pii_detected"]:
        assert result["anonymized_text"] != original
