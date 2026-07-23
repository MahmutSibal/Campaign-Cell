import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignTypeEnum, TargetSegmentEnum, CampaignStatusEnum } from '@prisma/client';

export class QueryCampaignDto {
  @IsOptional()
  @IsEnum(CampaignTypeEnum)
  type?: CampaignTypeEnum;

  @IsOptional()
  @IsEnum(TargetSegmentEnum)
  targetSegment?: TargetSegmentEnum;

  @IsOptional()
  @IsEnum(CampaignStatusEnum)
  status?: CampaignStatusEnum;

  @IsOptional()
  @IsString()
  search?: string;

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
