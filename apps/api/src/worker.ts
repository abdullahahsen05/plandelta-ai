import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { loadEnvironment } from "./config/environment.js";
import { WorkerModule } from "./worker/worker.module.js";

async function bootstrap(): Promise<void> {
  const environment = loadEnvironment();
  if (environment.WORKER_CONCURRENCY !== 1)
    throw new Error("PlanDelta local and initial AWS deployments require WORKER_CONCURRENCY=1.");
  const context = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  context.useLogger(new Logger("PlanDeltaWorker"));
  context.enableShutdownHooks();
  Logger.log(`PlanDelta worker context ready in ${environment.APP_ENV}.`, "Bootstrap");
}

void bootstrap();
