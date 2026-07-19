from __future__ import annotations

import json

from plandelta_agent.evaluation import DEFAULT_THRESHOLDS, evaluate, load_cases


def test_evaluation_harness_is_deterministic_and_meets_frozen_thresholds() -> None:
    thresholds = json.loads(DEFAULT_THRESHOLDS.read_text(encoding="utf-8"))
    result = evaluate(load_cases(), thresholds)

    assert result["mode"] == "deterministic_scripted"
    assert result["metrics"]["caseCount"] >= 30
    assert result["passed"] is True
