from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Protocol, cast

import boto3  # type: ignore[import-untyped]
from botocore.config import Config  # type: ignore[import-untyped]

from plandelta_agent.ingestion.errors import SafeIngestionError


class StorageReader(Protocol):
    async def read(self, key: str) -> bytes: ...


def validate_storage_key(key: str) -> list[str]:
    parts = key.split("/")
    if (
        not key
        or key.startswith("/")
        or key.endswith("/")
        or "\\" in key
        or any(not part or part in {".", ".."} for part in parts)
    ):
        raise SafeIngestionError("KNOWLEDGE_STORAGE_KEY_INVALID", retryable=False)
    return parts


class LocalStorageReader:
    def __init__(self, *, root: str, max_bytes: int) -> None:
        self._root = Path(root).resolve()
        self._max_bytes = max_bytes

    async def read(self, key: str) -> bytes:
        parts = validate_storage_key(key)
        target = self._root.joinpath(*parts).resolve()
        if not target.is_relative_to(self._root):
            raise SafeIngestionError("KNOWLEDGE_STORAGE_KEY_INVALID", retryable=False)
        try:
            stat = await asyncio.to_thread(target.stat)
            if stat.st_size <= 0 or stat.st_size > self._max_bytes:
                raise SafeIngestionError("KNOWLEDGE_STORAGE_SIZE_INVALID", retryable=False)
            return await asyncio.to_thread(target.read_bytes)
        except SafeIngestionError:
            raise
        except OSError as error:
            raise SafeIngestionError("KNOWLEDGE_STORAGE_READ_FAILED", retryable=True) from error


class S3ObjectClient(Protocol):
    def get_object(self, **kwargs: object) -> dict[str, object]: ...


class S3StorageReader:
    def __init__(
        self,
        *,
        bucket: str,
        prefix: str,
        region: str,
        max_bytes: int,
        client: S3ObjectClient | None = None,
    ) -> None:
        self._bucket = bucket
        self._prefix = "/".join(validate_storage_key(prefix))
        self._max_bytes = max_bytes
        self._client = client or cast(
            S3ObjectClient,
            boto3.client(
                "s3",
                region_name=region,
                config=Config(
                    connect_timeout=5,
                    read_timeout=20,
                    retries={"max_attempts": 2, "mode": "standard"},
                ),
            ),
        )

    async def read(self, key: str) -> bytes:
        object_key = f"{self._prefix}/{'/'.join(validate_storage_key(key))}"
        try:
            response = await asyncio.to_thread(
                self._client.get_object,
                Bucket=self._bucket,
                Key=object_key,
            )
            content_length = response.get("ContentLength")
            if (
                not isinstance(content_length, int)
                or content_length <= 0
                or content_length > self._max_bytes
            ):
                raise SafeIngestionError("KNOWLEDGE_STORAGE_SIZE_INVALID", retryable=False)
            body = response.get("Body")
            if body is None or not hasattr(body, "read"):
                raise SafeIngestionError("KNOWLEDGE_STORAGE_READ_FAILED", retryable=True)
            data = await asyncio.to_thread(body.read)
            if not isinstance(data, bytes) or not 0 < len(data) <= self._max_bytes:
                raise SafeIngestionError("KNOWLEDGE_STORAGE_SIZE_INVALID", retryable=False)
            return data
        except SafeIngestionError:
            raise
        except Exception as error:
            raise SafeIngestionError("KNOWLEDGE_STORAGE_READ_FAILED", retryable=True) from error
