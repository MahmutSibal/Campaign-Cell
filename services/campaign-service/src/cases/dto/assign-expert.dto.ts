import { IsUUID, IsNotEmpty, IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { AssignedByEnum } from '@prisma/client';

export class AssignExpertDto {
  @IsUUID('4', { message: 'Geçersiz uzman UUID' })
  @IsNotEmpty({ message: 'Uzman ID zorunludur' })
  expertId: string;

  @IsEnum(AssignedByEnum, { message: 'Geçersiz atama türü' })
  @IsNotEmpty({ message: 'Atayan kişi/sistem belirtilmelidir (AI veya SUPERVISOR)' })
  assignedBy: AssignedByEnum;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  assignmentScore?: number;
}
