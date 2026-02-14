import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsIn, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class ListPaymentsDto {
  @ApiProperty({
    description: '组织ID',
    example: 2,
    required: true,
  })
  @IsInt()
  @Type(() => Number)
  orgId: number;

  @ApiProperty({
    description: '收款状态',
    enum: ['UNAPPLIED', 'PARTIAL', 'CLOSED'],
    required: false,
    example: 'UNAPPLIED',
  })
  @IsOptional()
  @IsIn(['UNAPPLIED', 'PARTIAL', 'CLOSED'])
  status?: string;

  @ApiProperty({
    description: '客户ID',
    required: false,
    example: 123,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  customerId?: number;

  @ApiProperty({
    description: '开始日期（ISO8601格式，UTC时区）',
    required: false,
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({
    description: '结束日期（ISO8601格式，UTC时区）',
    required: false,
    example: '2024-01-31',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({
    description: '支付方式',
    enum: ['BANK_TRANSFER', 'CHECK', 'CASH', 'OTHER'],
    required: false,
    example: 'BANK_TRANSFER',
  })
  @IsOptional()
  @IsIn(['BANK_TRANSFER', 'CHECK', 'CASH', 'OTHER'])
  method?: string;

  @ApiProperty({
    description: '页码（从1开始）',
    required: false,
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({
    description: '每页数量',
    required: false,
    example: 20,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  pageSize?: number = 20;
}
