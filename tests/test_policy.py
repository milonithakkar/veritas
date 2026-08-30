"""Tests for policy engine."""

import pytest
from policy.policy_engine import load_policy, list_policies


def test_customer_support_policy_loads():
    policy = load_policy("customer_support")
    assert policy.use_case == "customer_support"
    assert policy.pii_action == "BLOCK"
    assert policy.grounding_enabled is True


def test_hr_policy_loads():
    policy = load_policy("hr_assistant")
    assert policy.use_case == "hr_assistant"
    assert policy.require_human_review is True


def test_financial_policy_loads():
    policy = load_policy("financial_tool")
    assert policy.use_case == "financial_tool"
    assert policy.grounding_action == "BLOCK"  # Financial: block ungrounded claims
    assert policy.confidence_threshold == 0.80  # Very strict


def test_policies_listed():
    policies = list_policies()
    assert "customer_support" in policies
    assert "hr_assistant" in policies
    assert "financial_tool" in policies


def test_unknown_policy_falls_back():
    # Should fall back to customer_support without crashing
    policy = load_policy("nonexistent_use_case")
    assert policy is not None
