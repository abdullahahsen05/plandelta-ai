import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class AnalysisConfigurationDto {
  @ApiProperty({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiProperty({ enum: ["conservative", "balanced", "sensitive"], default: "balanced" })
  @IsIn(["conservative", "balanced", "sensitive"])
  sensitivity: "conservative" | "balanced" | "sensitive" = "balanced";

  @ApiProperty({ default: true })
  @IsBoolean()
  ocrEnabled = true;

  @ApiProperty({ enum: ["auto", "rules", "onnx"], default: "auto" })
  @IsIn(["auto", "rules", "onnx"])
  classifier: "auto" | "rules" | "onnx" = "auto";
}

export class CreateAnalysisDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  baselineRevisionId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  candidateRevisionId!: string;

  @ApiPropertyOptional({ type: () => AnalysisConfigurationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AnalysisConfigurationDto)
  configuration = new AnalysisConfigurationDto();
}

export class AnalysisListQueryDto {
  @ApiPropertyOptional({ description: "Opaque cursor returned by the previous page." })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
