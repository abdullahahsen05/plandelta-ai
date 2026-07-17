import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { S3StorageProvider } from "../src/storage/s3-storage.provider.js";

describe("S3StorageProvider", () => {
  const send = vi.fn<(command: unknown) => Promise<unknown>>();

  beforeEach(() => {
    process.env.S3_BUCKET = "plandelta-private-test";
    process.env.S3_PREFIX = "plandelta";
    process.env.S3_SIGNED_URL_TTL_SECONDS = "300";
    process.env.S3_MAX_READ_BYTES = "1024";
    send.mockReset();
  });

  afterEach(() => {
    delete process.env.S3_BUCKET;
    delete process.env.S3_PREFIX;
    delete process.env.S3_SIGNED_URL_TTL_SECONDS;
    delete process.env.S3_MAX_READ_BYTES;
  });

  it("writes encrypted objects beneath the configured prefix", async () => {
    send.mockResolvedValue({});
    const storage = new S3StorageProvider({ send } as never);
    const bytes = Buffer.from("private drawing");

    await expect(storage.write("owner/project/drawing.png", bytes)).resolves.toEqual({
      key: "owner/project/drawing.png",
      byteSize: bytes.byteLength,
    });

    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    if (!(command instanceof PutObjectCommand)) throw new Error("Expected PutObjectCommand.");
    expect(command.input).toMatchObject({
      Bucket: "plandelta-private-test",
      Key: "plandelta/owner/project/drawing.png",
      ServerSideEncryption: "AES256",
    });
  });

  it("buffers bounded reads and distinguishes missing objects", async () => {
    send
      .mockResolvedValueOnce({
        ContentLength: 8,
        Body: { transformToByteArray: vi.fn().mockResolvedValue(Buffer.from("evidence")) },
      })
      .mockRejectedValueOnce({ name: "NotFound", $metadata: { httpStatusCode: 404 } });
    const storage = new S3StorageProvider({ send } as never);

    await expect(storage.read("analyses/one/evidence.png")).resolves.toEqual(
      Buffer.from("evidence"),
    );
    await expect(storage.exists("missing.png")).resolves.toBe(false);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(HeadObjectCommand);
  });

  it("deletes every paginated object under only the requested prefix", async () => {
    send.mockImplementation((command: unknown) => {
      if (command instanceof ListObjectsV2Command) {
        return command.input.ContinuationToken
          ? Promise.resolve({ Contents: [{ Key: "plandelta/analyses/one/b.png" }] })
          : Promise.resolve({
              Contents: [{ Key: "plandelta/analyses/one/a.png" }],
              IsTruncated: true,
              NextContinuationToken: "next",
            });
      }
      if (command instanceof DeleteObjectsCommand) return Promise.resolve({});
      throw new Error("Unexpected command");
    });
    const storage = new S3StorageProvider({ send } as never);

    await storage.deletePrefix("analyses/one");

    const deleteCommands = send.mock.calls
      .map(([command]) => command)
      .filter(
        (command): command is DeleteObjectsCommand => command instanceof DeleteObjectsCommand,
      );
    expect(deleteCommands).toHaveLength(2);
    expect(deleteCommands.flatMap((command) => command.input.Delete?.Objects ?? [])).toEqual([
      { Key: "plandelta/analyses/one/a.png" },
      { Key: "plandelta/analyses/one/b.png" },
    ]);
  });

  it("creates a short-lived HTTPS read reference without making a network request", async () => {
    const client = new S3Client({
      region: "us-east-1",
      credentials: { accessKeyId: "test-access", secretAccessKey: "test-secret" },
    });
    const storage = new S3StorageProvider(client);

    const reference = await storage.createReadReference("owner/revision.png", 120);

    expect(reference.kind).toBe("https");
    expect(reference.url).toContain("plandelta-private-test.s3.us-east-1.amazonaws.com");
    expect(reference.url).toContain("X-Amz-Expires=120");
    client.destroy();
  });

  it("rejects unsafe logical keys and excessive read bodies", async () => {
    const storage = new S3StorageProvider({ send } as never);
    await expect(storage.write("../outside", Buffer.from("unsafe"))).rejects.toThrow(
      "Storage key is invalid",
    );

    send.mockResolvedValue({
      ContentLength: 2048,
      Body: { transformToByteArray: vi.fn() },
    });
    await expect(storage.read("large.png")).rejects.toThrow("configured read limit");
  });
});
