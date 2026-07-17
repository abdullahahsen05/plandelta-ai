export type StoredObject = {
  key: string;
  byteSize: number;
};

export interface ObjectStorage {
  write(key: string, bytes: Uint8Array): Promise<StoredObject>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");
