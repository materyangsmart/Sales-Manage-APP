import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsDateString,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ description: '组织ID (2=SalesCo)', example: 2 })
  @IsInt()
  @Min(1)
  orgId: number;

  @ApiProperty({ description: '客户ID', example: 123 })
  @IsInt()
  @Min(1)
  customerId: number;

  @ApiProperty({ description: '银行流水号', example: '20240111123456' })
  @IsString()
  @MaxLength(100)
  bankRef: string;

  @ApiProperty({ description: '收款金额(分)', example: 1130000 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ description: '收款日期 (YYYY-MM-DD)', example: '2024-01-11' })
  @IsDateString()
  paymentDate: string;

  @ApiProperty({ description: '收款方式', example: 'BANK_TRANSFER' })
  @IsString()
  @MaxLength(50)
  paymentMethod: string;

  @ApiProperty({
    description: '回单URL',
    example: 'https://oss.example.com/receipt/123.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptUrl?: string;

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiProperty({ description: '创建人ID', example: 888 })
  @IsInt()
  @Min(1)
  createdBy: number;
}
