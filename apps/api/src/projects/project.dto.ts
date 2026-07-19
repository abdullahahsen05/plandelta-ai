import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateProjectDto {
  @ApiProperty({ example: "Riverside Medical Pavilion", maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: "RMP-024", maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  projectCode?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    enum: ["CONSTRUCTION_DRAWING", "ENGINEERING_SCHEMATIC"],
    default: "CONSTRUCTION_DRAWING",
  })
  @IsOptional()
  @IsIn(["CONSTRUCTION_DRAWING", "ENGINEERING_SCHEMATIC"])
  analysisProfile?: "CONSTRUCTION_DRAWING" | "ENGINEERING_SCHEMATIC";
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ maxLength: 64, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  projectCode?: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: ["ACTIVE", "ARCHIVED"] })
  @IsOptional()
  @IsIn(["ACTIVE", "ARCHIVED"])
  status?: "ACTIVE" | "ARCHIVED";

  @ApiPropertyOptional({ enum: ["CONSTRUCTION_DRAWING", "ENGINEERING_SCHEMATIC"] })
  @IsOptional()
  @IsIn(["CONSTRUCTION_DRAWING", "ENGINEERING_SCHEMATIC"])
  analysisProfile?: "CONSTRUCTION_DRAWING" | "ENGINEERING_SCHEMATIC";
}

export class ProjectListQueryDto {
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
