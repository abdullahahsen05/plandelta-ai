"""Deterministic, bounded supporting-document ingestion."""

from plandelta_agent.ingestion.chunking import KnowledgeChunkDraft, StructureAwareChunker
from plandelta_agent.ingestion.errors import SafeIngestionError
from plandelta_agent.ingestion.extraction import (
    DocumentExtractor,
    ExtractedDocument,
    ExtractedPage,
    OcrFallback,
)
from plandelta_agent.ingestion.processor import IngestionProcessor
from plandelta_agent.ingestion.repository import (
    EmbeddedChunk,
    IngestionSource,
    KnowledgeRepository,
    PostgresKnowledgeRepository,
    RetrievedKnowledge,
)
from plandelta_agent.ingestion.storage import LocalStorageReader, S3StorageReader, StorageReader
from plandelta_agent.ingestion.vision_ocr import VisionOcrFallback

__all__ = [
    "DocumentExtractor",
    "EmbeddedChunk",
    "ExtractedDocument",
    "ExtractedPage",
    "IngestionProcessor",
    "IngestionSource",
    "KnowledgeChunkDraft",
    "KnowledgeRepository",
    "LocalStorageReader",
    "OcrFallback",
    "PostgresKnowledgeRepository",
    "RetrievedKnowledge",
    "S3StorageReader",
    "SafeIngestionError",
    "StorageReader",
    "StructureAwareChunker",
    "VisionOcrFallback",
]
