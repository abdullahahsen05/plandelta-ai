import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable } from "@nestjs/common";

import type { ObjectStorage, StoredObject } from "./storage.types.js";

export const S3_CLIENT = Symbol("S3_CLIENT");

type S3ClientLike = Pick<S3Client, "send">;

function requiredEnvironment(name: "S3_BUCKET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when STORAGE_PROVIDER=s3.`);
  return value;
}

function validateSegments(value: string, label: string) {
  if (
    !value ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    value.includes("\\") ||
    value.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function isMissingObject(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };
  return candidate.name === "NotFound" || candidate.$metadata?.httpStatusCode === 404;
}

@Injectable()
export class S3StorageProvider implements ObjectStorage {
  readonly provider = "S3" as const;
  private readonly defaultSignedUrlSeconds = Number(process.env.S3_SIGNED_URL_TTL_SECONDS ?? 300);
  private readonly maxReadBytes = Number(process.env.S3_MAX_READ_BYTES ?? 50 * 1024 * 1024);

  constructor(@Inject(S3_CLIENT) private readonly client: S3ClientLike) {}

  private get bucket() {
    return requiredEnvironment("S3_BUCKET");
  }

  private get prefix() {
    return validateSegments(process.env.S3_PREFIX?.trim() || "plandelta", "S3_PREFIX");
  }

  private objectKey(key: string) {
    return `${this.prefix}/${validateSegments(key, "Storage key")}`;
  }

  async write(key: string, bytes: Uint8Array): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(key),
        Body: bytes,
        ContentLength: bytes.byteLength,
        ServerSideEncryption: "AES256",
      }),
    );
    return { key, byteSize: bytes.byteLength };
  }

  async read(key: string) {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }),
    );
    if (
      typeof result.ContentLength === "number" &&
      (result.ContentLength < 0 || result.ContentLength > this.maxReadBytes)
    ) {
      throw new Error("Stored object exceeds the configured read limit.");
    }
    if (!result.Body) throw new Error("Stored object returned no body.");
    const bytes = await result.Body.transformToByteArray();
    if (bytes.byteLength > this.maxReadBytes) {
      throw new Error("Stored object exceeds the configured read limit.");
    }
    return Buffer.from(bytes);
  }

  async delete(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }),
    );
  }

  async deletePrefix(prefix: string) {
    const objectPrefix = `${this.objectKey(prefix)}/`;
    let continuationToken: string | undefined;
    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: objectPrefix,
          ContinuationToken: continuationToken,
        }),
      );
      const objects = (listed.Contents ?? [])
        .map(({ Key }) => Key)
        .filter((Key): Key is string => Boolean(Key))
        .map((Key) => ({ Key }));
      if (objects.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: objects, Quiet: true },
          }),
        );
      }
      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  async exists(key: string) {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }),
      );
      return true;
    } catch (error) {
      if (isMissingObject(error)) return false;
      throw error;
    }
  }

  async createReadReference(key: string, expiresInSeconds = this.defaultSignedUrlSeconds) {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 30 || expiresInSeconds > 900) {
      throw new Error("Signed URL lifetime must be between 30 and 900 seconds.");
    }
    const url = await getSignedUrl(
      this.client as S3Client,
      new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }),
      { expiresIn: expiresInSeconds },
    );
    return { kind: "https" as const, url };
  }
}
