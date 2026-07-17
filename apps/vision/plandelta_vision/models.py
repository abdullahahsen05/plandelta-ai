from __future__ import annotations

from typing import Annotated, Literal

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ContractModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class HealthResponse(ContractModel):
    service: str
    status: str
    version: str


class ReadinessResponse(HealthResponse):
    writable_temporary_directory: bool
    opencv_ready: bool
    pdf_renderer_ready: bool
    ocr_runtime_ready: bool
    onnx_runtime_ready: bool


class EngineResponse(ContractModel):
    schema_version: str
    engine_version: str
    opencv_version: str
    pdf_renderer: str
    ocr_engine: str
    onnx_model_version: str | None
    supported_formats: list[str]


class LocalReadReference(ContractModel):
    kind: Literal["local"]
    path: str = Field(min_length=1, max_length=1024)


class HttpsReadReference(ContractModel):
    kind: Literal["https"]
    url: AnyHttpUrl

    @field_validator("url")
    @classmethod
    def require_https(cls, value: AnyHttpUrl) -> AnyHttpUrl:
        if value.scheme != "https":
            raise ValueError("Only HTTPS read references are accepted.")
        return value


ReadReference = Annotated[LocalReadReference | HttpsReadReference, Field(discriminator="kind")]


class LocalArtifactOutput(ContractModel):
    kind: Literal["local"]
    prefix: str = Field(min_length=1, max_length=512)


ArtifactOutput = Annotated[LocalArtifactOutput, Field(discriminator="kind")]


class ProcessingConfiguration(ContractModel):
    page: int | None = Field(default=None, ge=1)
    sensitivity: Literal["conservative", "balanced", "sensitive"] = "balanced"
    ocr_enabled: bool = True
    classifier: Literal["auto", "rules", "onnx"] = "auto"


class AnalysisRequest(ContractModel):
    analysis_id: str = Field(pattern=r"^[0-9a-fA-F-]{36}$")
    correlation_id: str = Field(min_length=1, max_length=100)
    baseline: ReadReference
    candidate: ReadReference
    selected_page: int = Field(default=1, ge=1)
    configuration: ProcessingConfiguration = Field(default_factory=ProcessingConfiguration)
    artifact_output: ArtifactOutput


class NormalizedPoint(ContractModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class NormalizedBox(ContractModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)


class AlignmentResult(ContractModel):
    method: Literal["IDENTITY", "ORB_HOMOGRAPHY", "ECC_EUCLIDEAN"]
    confidence: float = Field(ge=0, le=1)
    reprojection_error: float = Field(ge=0)


class AnalysisMetrics(ContractModel):
    duration_ms: int = Field(ge=0)
    changed_area_ratio: float = Field(ge=0, le=1)
    added_area_ratio: float = Field(ge=0, le=1)
    removed_area_ratio: float = Field(ge=0, le=1)
    region_count: int = Field(ge=0)
    baseline_width_px: int = Field(gt=0)
    baseline_height_px: int = Field(gt=0)


class ArtifactResult(ContractModel):
    kind: Literal[
        "BASELINE_RENDER",
        "CANDIDATE_RENDER",
        "ALIGNED_CANDIDATE",
        "OVERLAY",
        "ADDED_MASK",
        "REMOVED_MASK",
        "EVIDENCE_CROP",
        "REPORT",
    ]
    storage_key: str
    mime_type: str
    width_px: int | None = None
    height_px: int | None = None
    byte_size: int | None = None
    checksum_sha256: str | None = None
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class DetectedChangeResult(ContractModel):
    sequence: int = Field(gt=0)
    change_type: Literal["ADDED", "REMOVED", "MODIFIED", "TEXT_CHANGED"]
    category: Literal[
        "WALL_LINEWORK",
        "DOOR",
        "WINDOW",
        "FIXTURE_SYMBOL",
        "DIMENSION",
        "TEXT_NOTE",
        "ROOM_LABEL",
        "UNKNOWN",
    ]
    source: Literal["RULES", "ONNX", "OCR", "HYBRID"]
    box: NormalizedBox
    polygon: list[NormalizedPoint] | None = None
    confidence: float = Field(ge=0, le=1)
    old_text: str | None = None
    new_text: str | None = None
    text_confidence: float | None = Field(default=None, ge=0, le=1)
    affected_trades: list[str] = Field(default_factory=list)
    quantity_delta: float | None = None
    unit: str | None = None
    impact: str | None = None
    evidence: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class AnalysisResponse(ContractModel):
    schema_version: str
    engine_version: str
    analysis_id: str
    alignment: AlignmentResult
    metrics: AnalysisMetrics
    warnings: list[str]
    artifacts: list[ArtifactResult]
    changes: list[DetectedChangeResult]


class ErrorBody(ContractModel):
    code: str
    message: str
    correlation_id: str


class ErrorResponse(ContractModel):
    error: ErrorBody
