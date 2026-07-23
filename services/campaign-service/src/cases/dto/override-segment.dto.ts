import { IsString, IsNotEmpty } from 'class-validator';

export class OverrideSegmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Yeni segment alanı zorunludur' })
  segment: string;

  @IsString()
  @IsNotEmpty({ message: 'Segment değişikliği nedeni zorunludur' })
  reason: string;
}
