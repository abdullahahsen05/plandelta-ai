from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field


class VisionSettings(BaseModel):
    """Validated non-secret settings used by the service foundation."""

    port: int = Field(default=8000, gt=0, le=65535)
    shared_root: Path = Path("data")
    schema_version: str = "1.0"
    engine_version: str = "dev"


def load_settings() -> VisionSettings:
    return VisionSettings(
        port=int(os.getenv("VISION_PORT", "8000")),
        shared_root=Path(os.getenv("VISION_SHARED_ROOT", "data")),
        schema_version=os.getenv("VISION_SCHEMA_VERSION", "1.0"),
        engine_version=os.getenv("VISION_ENGINE_VERSION", "dev"),
    )
