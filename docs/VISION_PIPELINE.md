# Vision pipeline

PlanDelta's vision service performs deterministic CPU processing. User uploads
are never represented by random or hardcoded regions.

## Processing sequence

1. Resolve a local shared-volume path or bounded HTTPS reference and reject
   traversal, private-network URLs, redirects, unsupported signatures, byte
   limits, page limits, and pixel limits.
2. Render the selected PDF page with PyMuPDF or decode PNG/JPEG with Pillow.
3. Normalize orientation, grayscale, local contrast, and dimensions.
4. Align the candidate with ORB/RANSAC homography and an ECC Euclidean
   fallback. Identity alignment is retained for already registered revisions.
5. Reject low-confidence alignment instead of producing untrustworthy boxes.
6. Calculate directional added and removed ink masks, apply morphology, merge
   connected evidence, and normalize all coordinates to 0–1.
7. Run the PP-OCRv5 English mobile detector/recognizer on contextual crops when
   OCR is enabled. Preserve low confidence and never invent missing text.
8. Classify changed crops with the selected ONNX model when its confidence is
   at least `ONNX_CONFIDENCE_THRESHOLD`; otherwise retain deterministic
   geometry/text rules and add a visible processing warning.
9. Atomically save source renders, aligned candidate, masks, overlay, and paired
   evidence crops beneath the authorized output prefix.

## Changed-region classifier

The optional classifier receives an absolute grayscale difference of an
already-detected baseline/candidate crop, resized to 64×64. It does not detect
changes. `classifier=rules` always uses deterministic rules; `classifier=onnx`
requests ONNX inference; and `classifier=auto` uses the committed model only
when `ONNX_CLASSIFIER_ENABLED=true` and model metadata marks it as better than
the rules baseline.

The committed `changed-region-cnn-v1` artifact is 408 KiB and runs with ONNX
Runtime on CPU. On the 192-example seed-disjoint synthetic validation split it
measured 1.000 accuracy and macro-F1 versus 0.750 accuracy and 0.667 macro-F1
for the rules baseline. PyTorch and ONNX predictions were identical with a
maximum absolute logit difference of 0.00001144. These measurements describe
only the synthetic benchmark; they are not a claim about arbitrary customer
drawings. See `docs/MODEL_CARD.md`.

## Golden evidence

The committed `samples/vision` set covers identical, translated, rotated,
annotated, added-wall, removed-door, text-change, unrelated-sheet, malformed,
and multi-page PDF cases. `expected.json` stores tolerance-based region targets;
tests assert overlap and stable ordering rather than brittle raw matrices.

The local CPU benchmark in `benchmark.json` was measured on 2026-07-17 with
OCR enabled. Run it again with:

```powershell
node scripts/python.mjs scripts/benchmark_vision.py
```

Model files download to Paddle's user cache on first use. They are not stored in
Git. The initial AWS container build must prefetch the same named mobile models
so production processing does not depend on a runtime download.
