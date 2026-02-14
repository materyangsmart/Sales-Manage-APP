import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsArray,
  ValidateNested,
  Min,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ApplyItemDto {
  @ApiProperty({ description: '应收单ID', example: 789 })
  @IsInt()
  @Min(1)
  invoiceId: number;

  @ApiProperty({
    description: '核销金额（单位：分，例如 565000 表示 5650.00 元）',
    example: 565000,
  })
  @IsInt()
  @Min(1)
  appliedAmount: number;
}

export class ApplyPaymentDto {
  @ApiProperty({ description: '组织ID (2=SalesCo)', example: 2 })
  @IsInt()
  @Min(1)
  orgId: number;

  @ApiProperty({ description: '收款单ID', example: 456 })
  @IsInt()
  @Min(1)
  paymentId: number;

  @ApiProperty({ description: '核销明细', type: [ApplyItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyItemDto)
  applies: ApplyItemDto[];

  @ApiProperty({ description: '操作人ID', example: 888 })
  @IsInt()
  @Min(1)
  operatorId: number;

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}
