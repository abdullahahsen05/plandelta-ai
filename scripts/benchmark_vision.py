from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from time import perf_counter

from plandelta_vision.config import VisionSettings
from plandelta_vision.models import AnalysisRequest
from plandelta_vision.pipeline import analyze

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "samples" / "vision"


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="plandelta-benchmark-") as temporary:
        shared_root = Path(temporary)
        shutil.copy2(FIXTURES / "baseline.png", shared_root / "baseline.png")
        shutil.copy2(FIXTURES / "added-wall.png", shared_root / "candidate.png")
        request = AnalysisRequest.model_validate(
            {
                "analysisId": "00000000-0000-4000-8000-000000000088",
                "correlationId": "cpu-benchmark",
                "baseline": {"kind": "local", "path": "baseline.png"},
                "candidate": {"kind": "local", "path": "candidate.png"},
                "selectedPage": 1,
                "configuration": {
                    "sensitivity": "balanced",
                    "ocrEnabled": True,
                    "classifier": "rules",
                },
                "artifactOutput": {"kind": "local", "prefix": "benchmark/result"},
            }
        )
        settings = VisionSettings(
            shared_root=shared_root,
            temporary_directory=shared_root / "tmp",
            engine_version="benchmark-local-cpu",
            ocr_enabled=True,
        )
        started = perf_counter()
        result = analyze(request, settings)
        wall_clock_ms = round((perf_counter() - started) * 1000)
        print(
            json.dumps(
                {
                    "fixture": "added-wall",
                    "ocrEnabled": True,
                    "wallClockMs": wall_clock_ms,
                    "pipelineDurationMs": result.metrics.duration_ms,
                    "alignmentMethod": result.alignment.method,
                    "alignmentConfidence": result.alignment.confidence,
                    "changedAreaRatio": result.metrics.changed_area_ratio,
                    "regionCount": result.metrics.region_count,
                },
                sort_keys=True,
            )
        )


if __name__ == "__main__":
    main()
