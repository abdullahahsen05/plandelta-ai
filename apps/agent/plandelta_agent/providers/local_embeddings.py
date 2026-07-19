from __future__ import annotations

import asyncio
import math
import threading
from collections.abc import Callable, Iterable
from typing import Protocol, cast

from plandelta_agent.providers.chat import SafeProviderError
from plandelta_agent.providers.embeddings import EmbeddingBatch, EmbeddingVector


class LocalEmbeddingModel(Protocol):
    def embed(self, documents: list[str]) -> Iterable[object]: ...


class VectorLike(Protocol):
    def tolist(self) -> list[float]: ...


EmbeddingModelFactory = Callable[[str], LocalEmbeddingModel]


def _default_model_factory(model_name: str) -> LocalEmbeddingModel:
    from fastembed import TextEmbedding

    return cast(LocalEmbeddingModel, TextEmbedding(model_name=model_name))


class LocalEmbeddingProvider:
    def __init__(
        self,
        *,
        model_name: str,
        dimension: int,
        timeout_seconds: float = 30,
        model_factory: EmbeddingModelFactory = _default_model_factory,
    ) -> None:
        if not model_name.strip():
            raise ValueError("An embedding model name is required.")
        if not 64 <= dimension <= 2048:
            raise ValueError("Embedding dimension is outside the supported range.")
        if timeout_seconds <= 0:
            raise ValueError("The embedding timeout must be positive.")
        self._model_name = model_name.strip()
        self._dimension = dimension
        self._timeout_seconds = timeout_seconds
        self._model_factory = model_factory
        self._model: LocalEmbeddingModel | None = None
        self._load_lock = threading.Lock()

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    async def embed(self, texts: list[str]) -> EmbeddingBatch:
        self._validate_texts(texts)
        try:
            async with asyncio.timeout(self._timeout_seconds):
                return await asyncio.to_thread(self._embed_sync, texts)
        except TimeoutError as error:
            raise SafeProviderError("KNOWLEDGE_EMBEDDING_TIMEOUT", retryable=True) from error
        except SafeProviderError:
            raise
        except Exception as error:
            raise SafeProviderError("KNOWLEDGE_EMBEDDING_FAILED", retryable=True) from error

    def _embed_sync(self, texts: list[str]) -> EmbeddingBatch:
        model = self._get_model()
        raw_vectors = list(model.embed(texts))
        if len(raw_vectors) != len(texts):
            raise SafeProviderError("KNOWLEDGE_EMBEDDING_FAILED", retryable=False)
        vectors = [EmbeddingVector(values=self._coerce_vector(vector)) for vector in raw_vectors]
        return EmbeddingBatch(
            model=self._model_name,
            dimension=self._dimension,
            vectors=vectors,
        )

    def _get_model(self) -> LocalEmbeddingModel:
        if self._model is not None:
            return self._model
        with self._load_lock:
            if self._model is None:
                self._model = self._model_factory(self._model_name)
        return self._model

    def _coerce_vector(self, vector: object) -> list[float]:
        if isinstance(vector, list | tuple):
            values = [float(value) for value in vector]
        elif hasattr(vector, "tolist"):
            values = [float(value) for value in cast(VectorLike, vector).tolist()]
        else:
            raise SafeProviderError("KNOWLEDGE_EMBEDDING_FAILED", retryable=False)
        if len(values) != self._dimension or not all(math.isfinite(value) for value in values):
            raise SafeProviderError("KNOWLEDGE_EMBEDDING_FAILED", retryable=False)
        return values

    @staticmethod
    def _validate_texts(texts: list[str]) -> None:
        if not 1 <= len(texts) <= 32:
            raise SafeProviderError("KNOWLEDGE_EMBEDDING_LIMIT", retryable=False)
        if any(not text.strip() or len(text) > 12_000 for text in texts):
            raise SafeProviderError("KNOWLEDGE_EMBEDDING_LIMIT", retryable=False)
