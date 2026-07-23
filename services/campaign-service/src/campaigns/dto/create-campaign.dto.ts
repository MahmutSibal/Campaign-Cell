import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, Min, Max, IsDateString } from 'class-validator';
import { CampaignTypeEnum, TargetSegmentEnum } from '@prisma/client';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty({ message: 'Kampanya adı zorunludur' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CampaignTypeEnum, { message: 'Geçersiz kampanya türü' })
  @IsNotEmpty({ message: 'Kampanya türü zorunludur' })
  type: CampaignTypeEnum;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  discountPercent?: number;

  @IsEnum(TargetSegmentEnum, { message: 'Geçersiz hedef segment' })
  @IsOptional()
  targetSegment?: TargetSegmentEnum;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
