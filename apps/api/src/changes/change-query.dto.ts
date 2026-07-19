import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

const categories = [
  "WALL_LINEWORK",
  "DOOR",
  "WINDOW",
  "FIXTURE_SYMBOL",
  "DIMENSION",
  "TEXT_NOTE",
  "ROOM_LABEL",
  "COMPONENT",
  "CONNECTION_LINE",
  "LABEL",
  "NOTE",
  "UNKNOWN",
] as const;

export class ChangeListQueryDto {
  @ApiPropertyOptional({ enum: ["ADDED", "REMOVED", "MODIFIED", "TEXT_CHANGED"] })
  @IsOptional()
  @IsIn(["ADDED", "REMOVED", "MODIFIED", "TEXT_CHANGED"])
  type?: "ADDED" | "REMOVED" | "MODIFIED" | "TEXT_CHANGED";

  @ApiPropertyOptional({ enum: categories })
  @IsOptional()
  @IsIn(categories)
  category?: (typeof categories)[number];

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minimumConfidence?: number;

  @ApiPropertyOptional({ example: "electrical" })
  @IsOptional()
  @IsString()
  affectedTrade?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cursor?: number;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
