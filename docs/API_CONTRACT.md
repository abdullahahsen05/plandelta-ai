# API Contract

All payloads are JSON unless an upload endpoint specifies multipart form data.
Public routes use /v1. Internal vision routes use /internal/v1.

## Common behavior

- Bearer JWT required except public health and documented demo routes.
- X-Correlation-Id accepted and returned; generated when absent.
- Validation errors return stable machine-readable codes.
- Timestamps use ISO 8601 UTC.
- List endpoints use cursor pagination.
- Signed URLs never persist in the database or logs.

Error shape:

~~~json
{
  "error": {
    "code": "REVISION_NOT_READY",
    "message": "Both revisions must finish uploading before analysis.",
    "details": {},
    "correlationId": "..."
  }
}
~~~

## Public NestJS routes

### Health

- GET /health/live
- GET /health/ready

### Projects

- POST /v1/projects
- GET /v1/projects
- GET /v1/projects/:projectId
- PATCH /v1/projects/:projectId
- DELETE /v1/projects/:projectId

Create body: name, optional projectCode, optional description.

### Revisions

- POST /v1/projects/:projectId/revisions using multipart upload
- GET /v1/projects/:projectId/revisions
- GET /v1/revisions/:revisionId
- PATCH /v1/revisions/:revisionId
- DELETE /v1/revisions/:revisionId
- GET /v1/revisions/:revisionId/preview

Upload fields: file, label, role, optional revisionCode, optional selectedPage.
Return revision metadata and upload status, never a raw internal storage path.

When S3 is enabled, direct upload may add:

- POST /v1/projects/:projectId/revisions/upload-intent
- POST /v1/revisions/:revisionId/upload-complete

### Analyses

- POST /v1/projects/:projectId/analyses
- GET /v1/projects/:projectId/analyses
- GET /v1/analyses/:analysisId
- POST /v1/analyses/:analysisId/retry
- DELETE /v1/analyses/:analysisId

Create body:

~~~json
{
  "baselineRevisionId": "uuid",
  "candidateRevisionId": "uuid",
  "configuration": {
    "page": 1,
    "sensitivity": "balanced",
    "ocrEnabled": true,
    "classifier": "auto"
  }
}
~~~

Status response includes status, progress, currentStage, attempts, timestamps,
warnings, safe error fields, and links to results when complete.

### Changes and artifacts

- GET /v1/analyses/:analysisId/changes
- GET /v1/analyses/:analysisId/artifacts
- GET /v1/artifacts/:artifactId/download

Change filters: type, category, minimumConfidence, affectedTrade, cursor.

### Reports

- GET /v1/analyses/:analysisId/report
- POST /v1/analyses/:analysisId/report/regenerate
- GET /v1/analyses/:analysisId/report/print

Regeneration cannot rerun CV. It changes only the summary provider/output.

### Demo

- POST /v1/demo/analyses or an equivalent protected rate-limited sample action.

The demo must be clearly labelled. It may return a committed precomputed
analysis for reliability, but Run fresh analysis must invoke the real pipeline
when backend capacity exists.

## Internal FastAPI routes

### GET /health/live

Process health only.

### GET /health/ready

Checks model/OCR readiness and writable temporary directory without processing
a full drawing.

### GET /internal/v1/engine

Returns schema version, engine version, OpenCV version, OCR engine/model, ONNX
model version, and supported formats.

### POST /internal/v1/analyses

Authenticated with an internal service secret or network/IAM boundary. Accepts:

- analysisId
- correlationId
- baseline read reference
- candidate read reference
- selected page
- processing configuration
- artifact output strategy

Read references support a tagged union:

- local path restricted to the configured shared root
- short-lived HTTPS signed URL restricted by size/time/network validation

Result:

~~~json
{
  "schemaVersion": "1.0",
  "engineVersion": "semver-or-git-sha",
  "analysisId": "uuid",
  "alignment": {
    "method": "ORB_HOMOGRAPHY",
    "confidence": 0.91,
    "reprojectionError": 1.8
  },
  "metrics": {
    "durationMs": 8300,
    "changedAreaRatio": 0.032,
    "regionCount": 7
  },
  "warnings": [],
  "artifacts": [],
  "changes": []
}
~~~

Each change includes sequence, change type, category, source, normalized box,
optional polygon, confidence, old/new OCR, affected trades, impact, and evidence
artifact metadata.

## Timeouts and retry

- Browser-to-API requests must not remain open for the full analysis.
- Analysis creation returns 202 Accepted and a durable analysis ID.
- Worker-to-vision timeout is configurable and longer than the browser timeout.
- Retry only timeout, temporary storage, and service-unavailable failures.
- Invalid input and unsafe alignment are permanent until user input changes.
- Idempotency key is the analysis ID plus engine version.
