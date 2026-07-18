import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { Module } from "@nestjs/common";

import { BEDROCK_RUNTIME_CLIENT, BedrockSummaryProvider } from "./bedrock-summary.provider.js";
import { ConfiguredSummaryProvider } from "./configured-summary.provider.js";
import { DeterministicSummaryProvider } from "./deterministic-summary.provider.js";
import { SUMMARY_PROVIDER } from "./summary.types.js";

@Module({
  providers: [
    {
      provide: BEDROCK_RUNTIME_CLIENT,
      useFactory: () =>
        new BedrockRuntimeClient({
          region: process.env.BEDROCK_REGION ?? process.env.AWS_REGION ?? "us-east-1",
          maxAttempts: Number(process.env.BEDROCK_MAX_ATTEMPTS ?? 2),
        }),
    },
    DeterministicSummaryProvider,
    BedrockSummaryProvider,
    ConfiguredSummaryProvider,
    {
      provide: SUMMARY_PROVIDER,
      useExisting: ConfiguredSummaryProvider,
    },
  ],
  exports: [SUMMARY_PROVIDER],
})
export class SummaryModule {}
