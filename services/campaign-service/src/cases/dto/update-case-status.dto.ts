import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { CaseStatusEnum } from '@prisma/client';

export class UpdateCaseStatusDto {
  @IsEnum(CaseStatusEnum, { message: 'Geçersiz vaka statüsü' })
  @IsNotEmpty({ message: 'Yeni statü zorunludur' })
  status: CaseStatusEnum;

  @IsString()
  @IsOptional()
  note?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  conversionLift?: number;
}
