import { IsString, IsOptional, IsEnum, IsNumber, Min, Max, IsDateString } from 'class-validator';
import { CampaignTypeEnum, TargetSegmentEnum, CampaignStatusEnum } from '@prisma/client';

export class UpdateCampaignDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CampaignTypeEnum)
  @IsOptional()
  type?: CampaignTypeEnum;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  discountPercent?: number;

  @IsEnum(TargetSegmentEnum)
  @IsOptional()
  targetSegment?: TargetSegmentEnum;

  @IsEnum(CampaignStatusEnum)
  @IsOptional()
  status?: CampaignStatusEnum;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
