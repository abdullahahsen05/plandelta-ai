from pathlib import Path

import pytest

from plandelta_vision.artifacts import ArtifactStore
from plandelta_vision.config import VisionSettings
from plandelta_vision.errors import VisionError
from plandelta_vision.image_io import read_reference
from plandelta_vision.models import HttpsReadReference, LocalReadReference


def settings(root: Path) -> VisionSettings:
    return VisionSettings(shared_root=root, temporary_directory=root / "tmp")


def test_local_reference_cannot_escape_shared_storage(tmp_path: Path) -> None:
    outside = tmp_path.parent / "outside.png"
    outside.write_bytes(b"outside")

    with pytest.raises(VisionError) as caught:
        read_reference(LocalReadReference(kind="local", path="../outside.png"), settings(tmp_path))

    assert caught.value.code == "INPUT_PATH_UNSAFE"


def test_signed_url_rejects_private_network_before_fetch(tmp_path: Path) -> None:
    with pytest.raises(VisionError) as caught:
        read_reference(
            HttpsReadReference(kind="https", url="https://127.0.0.1/private-plan.png"),
            settings(tmp_path),
        )

    assert caught.value.code == "SIGNED_URL_PRIVATE_NETWORK"


@pytest.mark.parametrize("prefix", ["../escape", "/absolute/path", "nested//empty"])
def test_artifact_prefix_cannot_escape_shared_storage(tmp_path: Path, prefix: str) -> None:
    with pytest.raises(VisionError) as caught:
        ArtifactStore(tmp_path, prefix)

    assert caught.value.code == "ARTIFACT_PATH_UNSAFE"
