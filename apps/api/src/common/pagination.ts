import { z } from "zod";

const cursorSchema = z.object({
  timestamp: z.string().datetime(),
  id: z.string().uuid(),
});

export type TimestampCursor = z.infer<typeof cursorSchema>;

export function encodeCursor(cursor: TimestampCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(value: string): TimestampCursor | null {
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}
