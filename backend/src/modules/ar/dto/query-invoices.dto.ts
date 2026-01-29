import { IsOptional, IsInt, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryInvoicesDto {
  @IsInt()
  @Type(() => Number)
  orgId: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  customerId?: number;

  @IsOptional()
  @IsEnum(['OPEN', 'PARTIAL', 'CLOSED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  orderId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  pageSize?: number = 20;
}
