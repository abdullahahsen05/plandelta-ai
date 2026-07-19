import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { KnowledgeDocumentType } from "../generated/prisma/enums.js";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UploadKnowledgeDocumentDto {
  @ApiProperty({ enum: KnowledgeDocumentType })
  @IsEnum(KnowledgeDocumentType)
  documentType!: (typeof KnowledgeDocumentType)[keyof typeof KnowledgeDocumentType];

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  revisionLabel?: string;

  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsDateString({ strict: true })
  effectiveDate?: string;
}
