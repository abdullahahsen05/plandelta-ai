import { Module } from "@nestjs/common";

import { SummaryModule } from "../summary/summary.module.js";
import { ReportsController } from "./reports.controller.js";
import { ReportsService } from "./reports.service.js";

@Module({
  imports: [SummaryModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
