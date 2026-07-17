import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LocalStorageProvider } from "../src/storage/local-storage.provider.js";

describe("LocalStorageProvider", () => {
  let root: string;
  let storage: LocalStorageProvider;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "plandelta-storage-"));
    process.env.LOCAL_STORAGE_ROOT = root;
    storage = new LocalStorageProvider();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    delete process.env.LOCAL_STORAGE_ROOT;
  });

  it("writes atomically beneath the configured root", async () => {
    const bytes = Buffer.from("blueprint evidence", "utf8");
    await expect(storage.write("owner/project/revision.png", bytes)).resolves.toEqual({
      key: "owner/project/revision.png",
      byteSize: bytes.byteLength,
    });
    await expect(readFile(join(root, "owner", "project", "revision.png"))).resolves.toEqual(bytes);
  });

  it("rejects traversal and absolute keys", async () => {
    await expect(storage.write("../outside.txt", Buffer.from("unsafe"))).rejects.toThrow(
      "Storage key is invalid",
    );
    await expect(storage.write("C:\\outside.txt", Buffer.from("unsafe"))).rejects.toThrow(
      "Storage key is invalid",
    );
  });
});
