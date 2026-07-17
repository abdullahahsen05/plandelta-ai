export type StoredObject = {
  key: string;
  byteSize: number;
};

export type StorageProviderName = "LOCAL" | "S3";

export type StorageReadReference =
  | {
      kind: "local";
      path: string;
    }
  | {
      kind: "https";
      url: string;
    };

export interface ObjectStorage {
  readonly provider: StorageProviderName;
  write(key: string, bytes: Uint8Array): Promise<StoredObject>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  createReadReference(key: string, expiresInSeconds?: number): Promise<StorageReadReference>;
}

export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");
