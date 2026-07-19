import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module.js";
import { AnalysesModule } from "./analyses/analyses.module.js";
import { ArtifactsModule } from "./artifacts/artifacts.module.js";
import { CorrelationMiddleware } from "./common/correlation.middleware.js";
import { RequestPolicyMiddleware } from "./common/request-policy.middleware.js";
import { ChangesModule } from "./changes/changes.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { KnowledgeModule } from "./knowledge/knowledge.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { RevisionsModule } from "./revisions/revisions.module.js";
import { ReportsModule } from "./reports/reports.module.js";
import { StorageModule } from "./storage/storage.module.js";

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    AuthModule,
    ProjectsModule,
    RevisionsModule,
    AnalysesModule,
    ChangesModule,
    ArtifactsModule,
    ReportsModule,
    KnowledgeModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware, RequestPolicyMiddleware).forRoutes("*");
  }
}
