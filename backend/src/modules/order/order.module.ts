import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './controllers/order.controller';
import { OrderService } from './services/order.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Customer } from './entities/customer.entity';
import { Product } from './entities/product.entity';
import { ARInvoice } from '../ar/entities/ar-invoice.entity';
import { AuditLog } from '../../common/entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Customer, Product, ARInvoice, AuditLog]),
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
