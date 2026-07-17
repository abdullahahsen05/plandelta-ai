# Changed-region classifier dataset

This dataset is a deterministic, synthetic benchmark for the narrow task of classifying an
already-detected blueprint change crop. It is not a drawing detector and does not infer cost, code
compliance, or construction intent.

`spec.json` fixes the eight labels, image size, split sizes, and random seeds. `manifest.jsonl`
enumerates every generated training and validation example. The training script renders monochrome
difference evidence in memory from simple linework, opening, symbol, dimension, note, room-label,
and unknown primitives. No customer drawings or uploaded artifacts are used.

The committed validation split is seed-disjoint from training. It is synthetic and intentionally
limited; measured accuracy demonstrates reproducibility and ONNX parity, not performance on the full
diversity of real construction documents.

Reproduce the dataset, model, metrics, and ONNX artifact from the repository root:

```powershell
node scripts/python.mjs scripts/train_changed_region_classifier.py
```
