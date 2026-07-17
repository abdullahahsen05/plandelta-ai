import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import { Injectable } from "@nestjs/common";

import type { ObjectStorage, StoredObject } from "./storage.types.js";

function defaultLocalRoot() {
  const configured = process.env.LOCAL_STORAGE_ROOT ?? "data";
  if (process.platform === "win32" && configured.startsWith("/")) {
    return resolve(import.meta.dirname, "../../../../", configured.slice(1));
  }
  return resolve(configured);
}

@Injectable()
export class LocalStorageProvider implements ObjectStorage {
  private readonly root = defaultLocalRoot();

  private resolveKey(key: string) {
    if (
      !key ||
      isAbsolute(key) ||
      key.includes("\\") ||
      key.split("/").some((part) => part === ".." || !part)
    ) {
      throw new Error("Storage key is invalid.");
    }

    const target = resolve(this.root, ...key.split("/"));
    const relativePath = relative(this.root, target);
    if (relativePath.startsWith(`..${sep}`) || relativePath === ".." || isAbsolute(relativePath)) {
      throw new Error("Storage key escapes the configured root.");
    }
    return target;
  }

  async write(key: string, bytes: Uint8Array): Promise<StoredObject> {
    const target = this.resolveKey(key);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, bytes, { flag: "wx" });
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
    return { key, byteSize: bytes.byteLength };
  }

  read(key: string) {
    return readFile(this.resolveKey(key));
  }

  async delete(key: string) {
    await rm(this.resolveKey(key), { force: true });
  }

  async deletePrefix(prefix: string) {
    const directory = dirname(this.resolveKey(`${prefix}/.prefix-root`));
    await rm(directory, { recursive: true, force: true });
  }

  async exists(key: string) {
    try {
      await access(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }
}
