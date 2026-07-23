import { IsUUID, IsNotEmpty, IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { FeedbackResponseEnum } from '@prisma/client';

export class CreateFeedbackDto {
  @IsUUID('4', { message: 'Geçersiz kampanya UUID' })
  @IsNotEmpty({ message: 'Kampanya ID zorunludur' })
  campaignId: string;

  @IsEnum(FeedbackResponseEnum, { message: 'Yanıt ACCEPTED veya REJECTED olmalıdır' })
  @IsNotEmpty({ message: 'Yanıt zorunludur' })
  response: FeedbackResponseEnum;

  @IsString()
  @IsOptional()
  rejectionReason?: string;

  @IsInt({ message: 'Değerlendirme 1 ile 5 arasında bir tam sayı olmalıdır' })
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;
}
