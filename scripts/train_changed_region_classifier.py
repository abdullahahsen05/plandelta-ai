from __future__ import annotations

import hashlib
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from typing import Any, cast

import cv2
import numpy as np
import onnx
import onnxruntime as ort
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
VISION_ROOT = REPOSITORY_ROOT / "apps" / "vision"
if str(VISION_ROOT) not in sys.path:
    sys.path.insert(0, str(VISION_ROOT))

from plandelta_vision.classify import Category, classify_region  # noqa: E402
from plandelta_vision.differ import PixelRegion  # noqa: E402

SPEC_PATH = REPOSITORY_ROOT / "samples" / "classifier" / "spec.json"
MANIFEST_PATH = REPOSITORY_ROOT / "samples" / "classifier" / "manifest.jsonl"
MODEL_PATH = VISION_ROOT / "models" / "changed-region-classifier.onnx"
METADATA_PATH = MODEL_PATH.with_suffix(".json")
MODEL_VERSION = "changed-region-cnn-v1"


@dataclass(frozen=True)
class Example:
    identifier: str
    split: str
    label: Category
    label_index: int
    seed: int


class ChangedRegionDataset(Dataset[tuple[torch.Tensor, torch.Tensor]]):
    def __init__(self, examples: list[Example], input_size: int) -> None:
        self.examples = examples
        self.input_size = input_size

    def __len__(self) -> int:
        return len(self.examples)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, torch.Tensor]:
        example = self.examples[index]
        image = render_example(example.label, example.seed, self.input_size)
        return torch.from_numpy(image[np.newaxis, :, :]), torch.tensor(example.label_index)


class TinyChangedRegionClassifier(nn.Module):
    def __init__(self, class_count: int) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 8, kernel_size=5, padding=2),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(8, 16, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 24, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(24 * 8 * 8, 64),
            nn.ReLU(),
            nn.Linear(64, class_count),
        )

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.features(inputs))


def _canonical_json(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def _load_spec() -> dict[str, Any]:
    return cast(dict[str, Any], json.loads(SPEC_PATH.read_text(encoding="utf-8")))


def _examples(spec: dict[str, Any]) -> list[Example]:
    labels = cast(list[Category], spec["labels"])
    generation = cast(dict[str, int], spec["generation"])
    examples: list[Example] = []
    for split, count_key, seed_key in [
        ("train", "trainPerClass", "trainSeed"),
        ("validation", "validationPerClass", "validationSeed"),
    ]:
        per_class = generation[count_key]
        base_seed = generation[seed_key]
        for label_index, label in enumerate(labels):
            for index in range(per_class):
                seed = base_seed + label_index * 10_000 + index
                examples.append(
                    Example(
                        identifier=f"{split}-{label.lower()}-{index:03d}",
                        split=split,
                        label=label,
                        label_index=label_index,
                        seed=seed,
                    )
                )
    return examples


def _draw_arrow(image: np.ndarray, start: tuple[int, int], end: tuple[int, int]) -> None:
    cv2.arrowedLine(image, start, end, 255, 1, cv2.LINE_AA, tipLength=0.18)


def render_example(label: Category, seed: int, size: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    image = np.zeros((size, size), dtype=np.uint8)
    center = size // 2
    offset_x = int(rng.integers(-4, 5))
    offset_y = int(rng.integers(-4, 5))
    thickness = int(rng.integers(1, 3))

    if label == "WALL_LINEWORK":
        if seed % 2:
            cv2.line(
                image,
                (5, center + offset_y),
                (size - 6, center + offset_y),
                255,
                thickness + 1,
                cv2.LINE_AA,
            )
        else:
            cv2.line(
                image,
                (center + offset_x, 5),
                (center + offset_x, size - 6),
                255,
                thickness + 1,
                cv2.LINE_AA,
            )
    elif label == "DOOR":
        origin = (15 + offset_x, 49 + offset_y)
        cv2.line(image, origin, (origin[0], 15 + offset_y), 255, thickness, cv2.LINE_AA)
        cv2.line(image, origin, (48 + offset_x, origin[1]), 255, thickness, cv2.LINE_AA)
        cv2.ellipse(
            image,
            origin,
            (33, 33),
            0,
            270,
            360,
            255,
            thickness,
            cv2.LINE_AA,
        )
    elif label == "WINDOW":
        y0 = center - 7 + offset_y
        y1 = center + 7 + offset_y
        cv2.line(image, (6, y0), (size - 7, y0), 255, thickness, cv2.LINE_AA)
        cv2.line(image, (6, y1), (size - 7, y1), 255, thickness, cv2.LINE_AA)
        for x in [12, center + offset_x, size - 13]:
            cv2.line(image, (x, y0 - 3), (x, y1 + 3), 255, 1, cv2.LINE_AA)
    elif label == "FIXTURE_SYMBOL":
        radius = int(rng.integers(12, 17))
        position = (center + offset_x, center + offset_y)
        cv2.circle(image, position, radius, 255, thickness, cv2.LINE_AA)
        cv2.line(
            image,
            (position[0] - radius, position[1]),
            (position[0] + radius, position[1]),
            255,
            1,
            cv2.LINE_AA,
        )
        cv2.line(
            image,
            (position[0], position[1] - radius),
            (position[0], position[1] + radius),
            255,
            1,
            cv2.LINE_AA,
        )
    elif label == "DIMENSION":
        y = 43 + offset_y
        _draw_arrow(image, (7, y), (27, y))
        _draw_arrow(image, (size - 8, y), (37, y))
        cv2.putText(
            image,
            f"{int(rng.integers(8, 36))}'",
            (20 + offset_x, 29 + offset_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            255,
            1,
            cv2.LINE_AA,
        )
    elif label == "TEXT_NOTE":
        value = ["NOTE", "TYP", "VERIFY"][seed % 3]
        cv2.putText(
            image,
            value,
            (5 + offset_x, center + 5 + offset_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            255,
            1,
            cv2.LINE_AA,
        )
        cv2.line(image, (6, 47 + offset_y), (45, 47 + offset_y), 255, 1, cv2.LINE_AA)
    elif label == "ROOM_LABEL":
        value = ["RM", "OFF", "LOB"][seed % 3]
        cv2.rectangle(image, (7, 13), (size - 8, 51), 255, 1, cv2.LINE_AA)
        cv2.putText(
            image,
            value,
            (10 + offset_x, center + 8 + offset_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            255,
            2,
            cv2.LINE_AA,
        )
    else:
        points = np.array(
            [
                [center + offset_x, 8 + offset_y],
                [8 + offset_x, size - 10 + offset_y],
                [size - 9 + offset_x, size - 15 + offset_y],
            ],
            dtype=np.int32,
        )
        cv2.polylines(image, [points], True, 255, thickness + 1, cv2.LINE_AA)
        cv2.circle(image, (center + offset_x, center + offset_y), 3, 255, -1, cv2.LINE_AA)

    angle = float(rng.uniform(-5.0, 5.0))
    scale = float(rng.uniform(0.94, 1.06))
    matrix = cv2.getRotationMatrix2D((center, center), angle, scale)
    image = cv2.warpAffine(image, matrix, (size, size), flags=cv2.INTER_LINEAR)
    noise_count = int(rng.integers(2, 8))
    ys = rng.integers(0, size, noise_count)
    xs = rng.integers(0, size, noise_count)
    image[ys, xs] = rng.integers(20, 90, noise_count, dtype=np.uint8)
    return image.astype(np.float32) / 255.0


def _write_manifest(spec: dict[str, Any], examples: list[Example]) -> str:
    records = [
        {
            "id": item.identifier,
            "split": item.split,
            "label": item.label,
            "labelIndex": item.label_index,
            "seed": item.seed,
        }
        for item in examples
    ]
    records_sha256 = hashlib.sha256(_canonical_json(records)).hexdigest()
    MANIFEST_PATH.write_text(
        "".join(json.dumps(record, sort_keys=True) + "\n" for record in records),
        encoding="utf-8",
    )
    return records_sha256


def _metrics(actual: list[int], predicted: list[int], labels: list[Category]) -> dict[str, Any]:
    class_count = len(labels)
    confusion = [[0 for _ in labels] for _ in labels]
    for truth, guess in zip(actual, predicted, strict=True):
        confusion[truth][guess] += 1
    per_class: dict[str, dict[str, float | int]] = {}
    f1_values: list[float] = []
    for index, label in enumerate(labels):
        true_positive = confusion[index][index]
        false_positive = sum(confusion[row][index] for row in range(class_count)) - true_positive
        false_negative = sum(confusion[index]) - true_positive
        precision = true_positive / max(1, true_positive + false_positive)
        recall = true_positive / max(1, true_positive + false_negative)
        f1 = 2 * precision * recall / max(1e-12, precision + recall)
        f1_values.append(f1)
        per_class[label] = {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "support": sum(confusion[index]),
        }
    accuracy = sum(int(a == b) for a, b in zip(actual, predicted, strict=True)) / len(actual)
    return {
        "accuracy": round(accuracy, 4),
        "macroF1": round(sum(f1_values) / len(f1_values), 4),
        "perClass": per_class,
        "confusionMatrix": confusion,
    }


def _rule_prediction(label: Category, labels: list[Category]) -> int:
    geometry: dict[Category, tuple[int, int, str | None]] = {
        "WALL_LINEWORK": (56, 7, None),
        "DOOR": (40, 40, None),
        "WINDOW": (50, 20, None),
        "FIXTURE_SYMBOL": (22, 22, None),
        "DIMENSION": (46, 14, "12'-0\""),
        "TEXT_NOTE": (42, 14, "VERIFY FINISH"),
        "ROOM_LABEL": (42, 20, "OFFICE"),
        "UNKNOWN": (22, 22, None),
    }
    width, height, text = geometry[label]
    category, _, _ = classify_region(
        PixelRegion(0, 0, width, height, "ADDED", 1.0),
        None,
        text,
    )
    return labels.index(category)


def _percentile(values: list[float], percentile: float) -> float:
    ordered = sorted(values)
    index = min(len(ordered) - 1, math.ceil(percentile * len(ordered)) - 1)
    return ordered[index]


def main() -> None:
    spec = _load_spec()
    labels = cast(list[Category], spec["labels"])
    input_size = int(spec["inputSize"])
    examples = _examples(spec)
    dataset_sha256 = _write_manifest(spec, examples)
    training = cast(dict[str, int | float], spec["training"])
    training_seed = int(training["seed"])

    torch.manual_seed(training_seed)
    np.random.seed(training_seed)
    torch.use_deterministic_algorithms(True)
    torch.set_num_threads(1)
    train_examples = [item for item in examples if item.split == "train"]
    validation_examples = [item for item in examples if item.split == "validation"]
    generator = torch.Generator().manual_seed(training_seed)
    loader = DataLoader(
        ChangedRegionDataset(train_examples, input_size),
        batch_size=int(training["batchSize"]),
        shuffle=True,
        generator=generator,
        num_workers=0,
    )
    model = TinyChangedRegionClassifier(len(labels))
    parameter_count = sum(parameter.numel() for parameter in model.parameters())
    optimizer = torch.optim.Adam(model.parameters(), lr=float(training["learningRate"]))
    loss_function = nn.CrossEntropyLoss()
    model.train()
    final_loss = 0.0
    for _ in range(int(training["epochs"])):
        for inputs, targets in loader:
            optimizer.zero_grad(set_to_none=True)
            loss = loss_function(model(inputs), targets)
            loss.backward()
            optimizer.step()
            final_loss = float(loss.item())

    validation_inputs = torch.stack(
        [
            torch.from_numpy(render_example(item.label, item.seed, input_size)[np.newaxis, :, :])
            for item in validation_examples
        ]
    )
    actual = [item.label_index for item in validation_examples]
    model.eval()
    with torch.inference_mode():
        pytorch_logits = model(validation_inputs).numpy()
    pytorch_predictions = np.argmax(pytorch_logits, axis=1).astype(int).tolist()
    pytorch_metrics = _metrics(actual, pytorch_predictions, labels)
    rules_predictions = [_rule_prediction(item.label, labels) for item in validation_examples]
    rules_metrics = _metrics(actual, rules_predictions, labels)

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    dummy = torch.zeros((1, 1, input_size, input_size), dtype=torch.float32)
    torch.onnx.export(
        model,
        dummy,
        MODEL_PATH,
        input_names=["change_crop"],
        output_names=["logits"],
        dynamic_axes={"change_crop": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
        dynamo=False,
    )
    exported = onnx.load(MODEL_PATH)
    onnx.checker.check_model(exported)
    session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
    onnx_logits = cast(
        np.ndarray,
        session.run(None, {"change_crop": validation_inputs.numpy()})[0],
    )
    onnx_predictions = np.argmax(onnx_logits, axis=1).astype(int).tolist()
    onnx_metrics = _metrics(actual, onnx_predictions, labels)
    parity_max_error = float(np.max(np.abs(pytorch_logits - onnx_logits)))
    if pytorch_predictions != onnx_predictions or parity_max_error > 1e-4:
        raise RuntimeError(f"PyTorch/ONNX parity failed: max error {parity_max_error:.8f}")

    sample = validation_inputs[:1].numpy()
    for _ in range(10):
        session.run(None, {"change_crop": sample})
    latencies: list[float] = []
    for _ in range(200):
        started = perf_counter()
        session.run(None, {"change_crop": sample})
        latencies.append((perf_counter() - started) * 1000)

    selected_by_default = (
        float(onnx_metrics["accuracy"]) > float(rules_metrics["accuracy"])
        and float(onnx_metrics["macroF1"]) > float(rules_metrics["macroF1"])
    )
    model_sha256 = hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest()
    metadata = {
        "schemaVersion": "1.0",
        "modelVersion": MODEL_VERSION,
        "task": "Classify an already-detected 64x64 blueprint change-difference crop.",
        "labels": labels,
        "inputSize": input_size,
        "inputTensor": "float32 NCHW in the range 0..1",
        "preprocessing": "Absolute grayscale baseline/candidate crop difference, area resize.",
        "architecture": (
            f"Three-convolution CPU CNN with {parameter_count:,} trainable parameters."
        ),
        "trainingSeed": training_seed,
        "trainingEpochs": int(training["epochs"]),
        "finalTrainingLoss": round(final_loss, 6),
        "datasetManifestSha256": dataset_sha256,
        "validationSamples": len(validation_examples),
        "rulesBaseline": rules_metrics,
        "pytorchValidation": pytorch_metrics,
        "onnxValidation": onnx_metrics,
        "parityMaxAbsoluteLogitError": round(parity_max_error, 8),
        "onnxCpuLatencyMs": {
            "runs": len(latencies),
            "p50": round(_percentile(latencies, 0.5), 4),
            "p95": round(_percentile(latencies, 0.95), 4),
        },
        "selectedByDefault": selected_by_default,
        "modelSha256": model_sha256,
        "limitations": [
            "Training and validation evidence is synthetic and seed-generated.",
            "The model classifies detected crops; it does not detect drawing changes.",
            "Low-confidence or failed inference falls back to deterministic rules.",
        ],
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "result": "passed",
                "model": str(MODEL_PATH.relative_to(REPOSITORY_ROOT)),
                "validationAccuracy": onnx_metrics["accuracy"],
                "rulesAccuracy": rules_metrics["accuracy"],
                "macroF1": onnx_metrics["macroF1"],
                "parityMaxError": round(parity_max_error, 8),
                "selectedByDefault": selected_by_default,
                "p95LatencyMs": metadata["onnxCpuLatencyMs"]["p95"],
            }
        )
    )


if __name__ == "__main__":
    main()
