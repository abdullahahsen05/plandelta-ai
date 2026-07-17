# PlanDelta changed-region classifier model card

## Intended use

`changed-region-cnn-v1` classifies a crop after PlanDelta's deterministic
OpenCV pipeline has already found a changed region. Its eight outputs are wall
or linework, door, window, fixture or symbol, dimension, text note, room label,
and unknown. It is decision support for revision triage, not a detector,
quantity takeoff, cost estimator, code-compliance system, or substitute for
reviewing the source drawings.

## Data

The dataset is entirely synthetic and CC0-1.0. The committed specification and
manifest contain 512 training and 192 validation examples at 64×64 pixels.
Each example is regenerated from a fixed seed using blueprint-like primitives.
Training and validation seeds do not overlap. Customer uploads, project
artifacts, and private drawings are never used.

This controlled set is useful for reproducibility and runtime integration but
does not represent drawing scans, discipline conventions, languages, symbol
libraries, line weights, or degradation found across real projects.

## Model and training

The model is a three-convolution CPU CNN with 103,744 trainable parameters. It
was trained for 24 epochs with Adam, a fixed seed of 260717, batch size 32, and
learning rate 0.003. The selected artifact is ONNX opset 17 and is approximately
408 KiB. The exact dataset and model SHA-256 values live beside the artifact in
`apps/vision/models/changed-region-classifier.json`.

Reproduce training, export, validation, parity, and the CPU benchmark:

```powershell
pnpm vision:install
node scripts/python.mjs scripts/train_changed_region_classifier.py
```

## Measured validation

On the committed 192-example synthetic validation split:

| Evaluator | Accuracy | Macro-F1 |
| --- | ---: | ---: |
| Deterministic rules | 0.7500 | 0.6667 |
| PyTorch CNN | 1.0000 | 1.0000 |
| ONNX Runtime | 1.0000 | 1.0000 |

PyTorch and ONNX selected identical classes. Their maximum absolute logit
difference was 0.00001144. A 200-run single-crop CPU benchmark on the development
machine measured 0.1697 ms p95; latency is hardware-specific and must be
remeasured for release infrastructure.

The perfect synthetic score is a property of this deliberately narrow
generated benchmark and must not be presented as real-world accuracy.

## Runtime safeguards

- `ONNX_CLASSIFIER_ENABLED` is a reversible feature flag.
- `ONNX_CONFIDENCE_THRESHOLD` defaults to 0.78.
- A missing model, invalid metadata, runtime error, or low-confidence prediction
  visibly falls back to deterministic rules.
- Every accepted ONNX result records classifier source, version, and confidence
  in evidence metadata.
- OCR and deterministic text rules remain available independently.

## Limitations and future validation

Before expanding model claims, evaluate on a licensed, de-identified,
discipline-balanced corpus with drawing-level split isolation and human-reviewed
labels. Report per-class errors, calibration, document-source leakage checks,
and performance on scans and non-English drawings. Until then, reviewers must
verify every finding against both source revisions.
