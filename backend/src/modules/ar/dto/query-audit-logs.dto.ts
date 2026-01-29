import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAuditLogsDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  userId?: number;

  @IsOptional()
  @IsString()
  @IsIn(['CREATE', 'UPDATE', 'DELETE', 'APPLY', 'APPROVE', 'REJECT'])
  action?: string;

  @IsOptional()
  @IsString()
  @IsIn(['AR_PAYMENT', 'AR_INVOICE', 'AR_APPLY', 'ORDER', 'CUSTOMER'])
  resourceType?: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  startDate?: string; // ISO 8601 format

  @IsOptional()
  @IsString()
  endDate?: string; // ISO 8601 format

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number = 20;
}

export class TraceAuditLogsDto {
  @IsString()
  resourceType: string;

  @IsString()
  resourceId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  limit?: number = 100;
}
