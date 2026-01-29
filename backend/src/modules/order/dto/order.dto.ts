import {
  IsInt,
  IsString,
  IsArray,
  IsOptional,
  IsIn,
  Min,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsInt()
  productId: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class CreateOrderDto {
  @IsInt()
  orgId: number;

  @IsInt()
  customerId: number;

  @IsDateString()
  orderDate: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  // createdBy 从 JWT token 中注入，不允许客户端传入
  createdBy?: number;
}

export class ReviewOrderDto {
  @IsInt()
  orderId: number;

  @IsString()
  @IsIn(['APPROVED', 'REJECTED'])
  action: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  comment?: string;

  // reviewedBy 从 JWT token 中注入，不允许客户端传入
  reviewedBy?: number;
}

export class QueryOrdersDto {
  @IsInt()
  orgId: number;

  @IsOptional()
  @IsInt()
  customerId?: number;

  @IsOptional()
  @IsString()
  @IsIn(['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

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
