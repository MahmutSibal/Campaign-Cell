import { IsUUID, IsNotEmpty, IsString, IsOptional, IsNumber, Min, Max, IsIn } from 'class-validator';

export class CreateAbTestDto {
  @IsUUID('4')
  @IsNotEmpty({ message: 'Vaka ID zorunludur' })
  caseId: string;

  @IsString()
  @IsNotEmpty({ message: 'Varyant A açıklaması zorunludur' })
  variantADesc: string;

  @IsString()
  @IsNotEmpty({ message: 'Varyant B açıklaması zorunludur' })
  variantBDesc: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  variantAConversion?: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  variantBConversion?: number;

  @IsIn(['A', 'B'])
  @IsOptional()
  winner?: string;
}
