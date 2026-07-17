import { describe, expect, it, vi } from "vitest";

import type { LocalStorageProvider } from "../src/storage/local-storage.provider.js";
import type { ObjectStorage } from "../src/storage/storage.types.js";
import { persistVisionArtifacts } from "../src/worker/artifact-persistence.js";
import type { VisionResult } from "../src/worker/vision-client.js";

function resultFixture(): VisionResult {
  return {
    schemaVersion: "1.0",
    engineVersion: "test",
    analysisId: "11111111-1111-4111-8111-111111111111",
    alignment: { method: "IDENTITY", confidence: 1, reprojectionError: 0 },
    metrics: {},
    warnings: [],
    artifacts: [
      {
        kind: "EVIDENCE_CROP",
        storageKey: "scratch/analysis/correlation/evidence.png",
        mimeType: "image/png",
        widthPx: 10,
        heightPx: 10,
        byteSize: 8,
        checksumSha256: null,
        metadata: { sequence: 1 },
      },
    ],
    changes: [
      {
        sequence: 1,
        changeType: "ADDED",
        category: "WALL_LINEWORK",
        source: "RULES",
        box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
        polygon: null,
        confidence: 0.8,
        oldText: null,
        newText: null,
        textConfidence: null,
        affectedTrades: ["architectural"],
        quantityDelta: null,
        unit: null,
        impact: "Review wall coordination.",
        evidence: {
          artifactStorageKey: "scratch/analysis/correlation/evidence.png",
        },
      },
    ],
  };
}

function providers(write = vi.fn().mockResolvedValue({ key: "unused", byteSize: 8 })) {
  const deletePrefix = vi.fn().mockResolvedValue(undefined);
  const storage = {
    provider: "S3",
    write,
    read: vi.fn(),
    delete: vi.fn(),
    deletePrefix,
    exists: vi.fn(),
    createReadReference: vi.fn(),
  } satisfies ObjectStorage;
  const localDeletePrefix = vi.fn().mockResolvedValue(undefined);
  const localStorage = {
    read: vi.fn().mockResolvedValue(Buffer.from("evidence")),
    deletePrefix: localDeletePrefix,
  } as unknown as LocalStorageProvider;
  return { storage, localStorage, write, deletePrefix, localDeletePrefix };
}

describe("persistVisionArtifacts", () => {
  it("promotes private scratch artifacts and remaps evidence references", async () => {
    const { storage, localStorage, write, localDeletePrefix } = providers();

    const result = await persistVisionArtifacts(
      resultFixture(),
      "11111111-1111-4111-8111-111111111111",
      "scratch/analysis/correlation",
      storage,
      localStorage,
    );

    expect(write).toHaveBeenCalledWith(
      "analyses/11111111-1111-4111-8111-111111111111/evidence.png",
      Buffer.from("evidence"),
    );
    expect(result.artifacts[0]?.storageKey).toBe(
      "analyses/11111111-1111-4111-8111-111111111111/evidence.png",
    );
    expect(result.changes[0]?.evidence.artifactStorageKey).toBe(
      "analyses/11111111-1111-4111-8111-111111111111/evidence.png",
    );
    expect(localDeletePrefix).toHaveBeenCalledWith("scratch/analysis/correlation");
  });

  it("removes the final prefix when promotion fails", async () => {
    const { storage, localStorage, deletePrefix, localDeletePrefix } = providers(
      vi.fn().mockRejectedValue(new Error("S3 failed")),
    );

    await expect(
      persistVisionArtifacts(
        resultFixture(),
        "11111111-1111-4111-8111-111111111111",
        "scratch/analysis/correlation",
        storage,
        localStorage,
      ),
    ).rejects.toThrow("S3 failed");

    expect(deletePrefix).toHaveBeenCalledWith("analyses/11111111-1111-4111-8111-111111111111");
    expect(localDeletePrefix).toHaveBeenCalledWith("scratch/analysis/correlation");
  });
});
