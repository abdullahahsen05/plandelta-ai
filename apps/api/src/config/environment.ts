import { z } from "zod";

const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  APP_ENV: z.enum(["local", "test", "preview", "production"]).default("local"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  WEB_ORIGINS: z.string().default("http://localhost:3000"),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const names = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${names}`);
  }

  return result.data;
}
