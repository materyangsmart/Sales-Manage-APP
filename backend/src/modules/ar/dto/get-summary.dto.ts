import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetSummaryDto {
  @ApiProperty({ description: '组织ID (2=SalesCo)', example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orgId: number;

  @ApiProperty({
    description: '客户ID (可选，不传则查询全部客户)',
    example: 123,
    required: false,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  customerId?: number;
}
