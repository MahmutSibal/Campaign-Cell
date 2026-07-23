import { IsOptional, IsEnum, IsUUID, IsBoolean, IsInt, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CaseStatusEnum, CasePriorityEnum } from '@prisma/client';

export class QueryCaseDto {
  @IsOptional()
  @IsEnum(CaseStatusEnum)
  status?: CaseStatusEnum;

  @IsOptional()
  @IsEnum(CasePriorityEnum)
  priority?: CasePriorityEnum;

  @IsOptional()
  @IsUUID('4')
  assignedExpertId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  slaBreached?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
