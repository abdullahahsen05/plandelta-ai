import "reflect-metadata";

import { BadRequestException, RequestMethod, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module.js";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { JsonResponseInterceptor } from "./common/json-response.interceptor.js";
import { loadEnvironment } from "./config/environment.js";

async function bootstrap(): Promise<void> {
  const environment = loadEnvironment();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.setGlobalPrefix("v1", {
    exclude: [
      { path: "health/live", method: RequestMethod.GET },
      { path: "health/ready", method: RequestMethod.GET },
    ],
  });
  app.enableCors({
    credentials: true,
    origin: environment.WEB_ORIGINS.split(",").map((origin) => origin.trim()),
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new JsonResponseInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: "VALIDATION_ERROR",
          message: "One or more fields are invalid.",
          details: {
            issues: errors.map((error) => ({
              field: error.property,
              constraints: error.constraints ?? {},
            })),
          },
        }),
    }),
  );
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle("PlanDelta API")
    .setDescription("Evidence-based construction blueprint revision analysis API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(environment.API_PORT, "0.0.0.0");
}

void bootstrap();
