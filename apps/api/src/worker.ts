import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { loadEnvironment } from "./config/environment.js";

async function bootstrapWorker(): Promise<void> {
  loadEnvironment();
  const context = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const logger = new Logger("Worker");
  const keepAlive = setInterval(() => undefined, 60_000);

  logger.log("Worker process ready; durable queue modules load in Phase 3");

  const shutdown = async (): Promise<void> => {
    clearInterval(keepAlive);
    await context.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

void bootstrapWorker();
