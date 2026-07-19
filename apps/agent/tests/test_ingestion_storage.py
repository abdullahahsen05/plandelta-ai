from __future__ import annotations

import asyncio
from io import BytesIO
from pathlib import Path

import pytest

from plandelta_agent.ingestion import LocalStorageReader, S3StorageReader, SafeIngestionError


def test_local_reader_is_bounded_to_its_root(tmp_path: Path) -> None:
    root = tmp_path
    target = root / "owner" / "project" / "source.txt"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"private source")
    reader = LocalStorageReader(root=str(root), max_bytes=100)

    assert asyncio.run(reader.read("owner/project/source.txt")) == b"private source"
    with pytest.raises(SafeIngestionError, match="KNOWLEDGE_STORAGE_KEY_INVALID"):
        asyncio.run(reader.read("../outside.txt"))


class FakeS3Client:
    def __init__(self, body: bytes) -> None:
        self.body = body
        self.calls: list[dict[str, object]] = []

    def get_object(self, **kwargs: object) -> dict[str, object]:
        self.calls.append(kwargs)
        return {"ContentLength": len(self.body), "Body": BytesIO(self.body)}


def test_s3_reader_applies_the_server_owned_prefix() -> None:
    client = FakeS3Client(b"private source")
    reader = S3StorageReader(
        bucket="private-bucket",
        prefix="plandelta",
        region="us-east-1",
        max_bytes=100,
        client=client,
    )

    assert asyncio.run(reader.read("owner/project/source.txt")) == b"private source"
    assert client.calls == [
        {"Bucket": "private-bucket", "Key": "plandelta/owner/project/source.txt"}
    ]
