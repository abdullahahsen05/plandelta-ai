from pydantic import BaseModel


class HealthResponse(BaseModel):
    service: str
    status: str
    version: str


class ReadinessResponse(HealthResponse):
    writable_temporary_directory: bool


class EngineResponse(BaseModel):
    schema_version: str
    engine_version: str
    supported_formats: list[str]
