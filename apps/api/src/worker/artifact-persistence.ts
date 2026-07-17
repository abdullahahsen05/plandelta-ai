import type { LocalStorageProvider } from "../storage/local-storage.provider.js";
import type { ObjectStorage } from "../storage/storage.types.js";
import type { JsonValue, VisionResult } from "./vision-client.js";

function remapJsonValue(value: JsonValue, keys: ReadonlyMap<string, string>): JsonValue {
  if (typeof value === "string") return keys.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => remapJsonValue(item, keys));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [name, remapJsonValue(item, keys)]),
    );
  }
  return value;
}

export async function persistVisionArtifacts(
  result: VisionResult,
  analysisId: string,
  scratchPrefix: string,
  storage: ObjectStorage,
  localStorage: LocalStorageProvider,
): Promise<VisionResult> {
  if (storage.provider === "LOCAL") return result;

  const finalPrefix = `analyses/${analysisId}`;
  const keyMap = new Map<string, string>();
  try {
    for (const artifact of result.artifacts) {
      if (!artifact.storageKey.startsWith(`${scratchPrefix}/`)) {
        throw new Error("Vision artifact escaped its assigned scratch prefix.");
      }
      const filename = artifact.storageKey.slice(scratchPrefix.length + 1);
      if (!filename || filename.includes("/") || filename.includes("\\")) {
        throw new Error("Vision artifact returned an invalid filename.");
      }
      const finalKey = `${finalPrefix}/${filename}`;
      await storage.write(finalKey, await localStorage.read(artifact.storageKey));
      keyMap.set(artifact.storageKey, finalKey);
    }
    return {
      ...result,
      artifacts: result.artifacts.map((artifact) => ({
        ...artifact,
        storageKey: keyMap.get(artifact.storageKey) ?? artifact.storageKey,
      })),
      changes: result.changes.map((change) => ({
        ...change,
        evidence: remapJsonValue(change.evidence, keyMap) as Record<string, JsonValue>,
      })),
    };
  } catch (error) {
    await storage.deletePrefix(finalPrefix).catch(() => undefined);
    throw error;
  } finally {
    await localStorage.deletePrefix(scratchPrefix).catch(() => undefined);
  }
}
