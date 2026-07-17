import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class UploadRevisionDto {
  @ApiProperty({ example: "Issued for construction - Rev B", maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @ApiProperty({ enum: ["BASELINE", "CANDIDATE"] })
  @IsIn(["BASELINE", "CANDIDATE"])
  role!: "BASELINE" | "CANDIDATE";

  @ApiPropertyOptional({ maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  revisionCode?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  selectedPage?: number;
}

export class UpdateRevisionDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ maxLength: 32, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  revisionCode?: string;

  @ApiPropertyOptional({ enum: ["BASELINE", "CANDIDATE"] })
  @IsOptional()
  @IsIn(["BASELINE", "CANDIDATE"])
  role?: "BASELINE" | "CANDIDATE";

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  selectedPage?: number;
}
