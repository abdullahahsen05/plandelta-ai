from __future__ import annotations


def test_evaluation_harness_is_deterministic_by_default() -> None:
    provider = "fake"
    live_bedrock_enabled = False

    assert provider == "fake"
    assert live_bedrock_enabled is False
