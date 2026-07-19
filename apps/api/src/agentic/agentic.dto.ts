import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const agentRunStatuses = [
  "queued",
  "running",
  "verifying",
  "completed",
  "failed",
  "cancelled",
  "expired",
] as const;

const agentRunEventTypes = [
  "run.queued",
  "run.started",
  "run.status",
  "specialist.started",
  "specialist.completed",
  "tool.started",
  "tool.completed",
  "verification.started",
  "verification.repairing",
  "run.completed",
  "run.failed",
  "run.cancelled",
  "heartbeat",
] as const;

export class CreateConversationDto {
  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID()
  analysisId?: string | null;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;
}

export class CreateAgentMessageDto {
  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;

  @ApiProperty({
    description: "Client-generated key used to make retries safe.",
    format: "uuid",
  })
  @IsUUID()
  idempotencyKey!: string;
}

export class ExecuteAgentRunDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  runId!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  correlationId!: string;
}

export class IngestionProgressDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  jobId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  documentId!: string;

  @ApiProperty({
    enum: [
      "queued",
      "claimed",
      "extracting",
      "chunking",
      "embedding",
      "retrying",
      "completed",
      "failed",
      "cancelled",
    ],
  })
  @IsString()
  status!: string;

  @ApiProperty({ maximum: 100, minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(100)
  progress!: number;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  stage!: string;
}

export class CitationDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  id!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @ApiProperty({ enum: ["visual_change", "document_chunk"] })
  @IsIn(["visual_change", "document_chunk"])
  type!: "visual_change" | "document_chunk";

  @ApiProperty({
    additionalProperties: true,
    description:
      "Authorized visual-change or document-chunk target. Storage keys and provider URLs are never returned.",
    type: "object",
  })
  @IsObject()
  target!: Record<string, unknown>;

  @ApiProperty()
  @IsBoolean()
  verified!: boolean;
}

export class AgentRunEventDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  runId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  sequence!: number;

  @ApiProperty({ enum: agentRunEventTypes })
  @IsIn(agentRunEventTypes)
  type!: (typeof agentRunEventTypes)[number];

  @ApiProperty({ enum: agentRunStatuses })
  @IsIn(agentRunStatuses)
  status!: (typeof agentRunStatuses)[number];

  @ApiProperty({ maxLength: 240 })
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  message!: string;

  @ApiProperty({ format: "date-time" })
  @IsString()
  timestamp!: string;

  @ApiProperty({
    additionalProperties: {
      oneOf: [
        { type: "string" },
        { type: "number" },
        { type: "boolean" },
        { type: "null" },
      ],
    },
    type: "object",
  })
  @IsObject()
  metadata!: Record<string, boolean | null | number | string>;
}

export class VerifiedAgentAnswerDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  messageId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  runId!: string;

  @ApiProperty({ enum: ["verified", "conflicting_evidence", "insufficient_evidence"] })
  @IsString()
  status!: string;

  @ApiProperty({ maxLength: 12_000 })
  @IsString()
  answerMarkdown!: string;

  @ApiProperty({ enum: ["high", "medium", "low", "insufficient"] })
  @IsString()
  confidence!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  warnings!: string[];

  @ApiProperty({ type: () => [CitationDto] })
  @IsArray()
  citations!: CitationDto[];

  @ApiPropertyOptional({
    additionalProperties: true,
    description: "Structured draft requiring human review; never sent externally.",
    nullable: true,
    type: "object",
  })
  @IsOptional()
  @IsObject()
  rfiDraft?: Record<string, unknown> | null;

  @ApiProperty({ enum: ["bedrock", "deterministic"] })
  @IsString()
  provider!: string;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @IsString()
  modelId?: string | null;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  promptVersion!: string;
}
