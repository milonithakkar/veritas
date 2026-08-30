"""
Policy Engine — loads per-use-case YAML configs and
applies the right risk tolerance rules for each deployment.
"""

import yaml
import os
from typing import Optional
from rich import print


POLICY_DIR = os.path.join(os.path.dirname(__file__))


class Policy:
    def __init__(self, config: dict):
        self.use_case = config.get("use_case", "unknown")
        self.display_name = config.get("display_name", "Unknown")
        self.model_name = config.get("model_name", "gpt-4o-mini")
        self.geography = config.get("geography", "EU")

        # Latency
        self.max_latency_ms = config.get("max_latency_ms", 500)

        # Fast Track thresholds
        fast = config.get("fast_track", {})
        self.pii_detection_enabled = fast.get("pii_detection", True)
        self.pii_action = fast.get("pii_action", "BLOCK")  # BLOCK or FLAG
        self.confidence_threshold = fast.get("confidence_threshold", 0.6)
        self.low_confidence_action = fast.get("low_confidence_action", "FLAG")
        self.max_tokens_per_response = fast.get("max_tokens_per_response", 1000)
        self.token_exceed_action = fast.get("token_exceed_action", "FLAG")
        self.blocklist_enabled = fast.get("blocklist_enabled", True)
        self.blocklist_action = fast.get("blocklist_action", "BLOCK")

        # Deep Track thresholds
        deep = config.get("deep_track", {})
        self.grounding_enabled = deep.get("grounding_enabled", True)
        self.grounding_similarity_threshold = deep.get("grounding_similarity_threshold", 0.75)
        self.grounding_action = deep.get("grounding_action", "FLAG")
        self.bias_detection_enabled = deep.get("bias_detection_enabled", True)
        self.bias_action = deep.get("bias_action", "FLAG")

        # Audit
        audit = config.get("audit", {})
        self.full_audit_enabled = audit.get("full_audit", True)
        self.require_human_review = audit.get("require_human_review", False)


def load_policy(use_case: str) -> Policy:
    """
    Load policy config for a given use case.
    Falls back to a safe default if config not found.
    """
    config_path = os.path.join(POLICY_DIR, f"{use_case}.yaml")
    if not os.path.exists(config_path):
        print(f"[yellow]Policy config not found for '{use_case}'. Using default.[/yellow]")
        config_path = os.path.join(POLICY_DIR, "customer_support.yaml")

    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    return Policy(config)


def list_policies() -> list:
    return [
        f.replace(".yaml", "")
        for f in os.listdir(POLICY_DIR)
        if f.endswith(".yaml")
    ]
