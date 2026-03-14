import { IsInt, IsString, IsOptional, IsArray, Min, Max } from 'class-validator';

export class CreateFeedbackDto {
  @IsInt()
  orderId: number;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;
}
