import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './controllers/order.controller';
import { ExternalOrderController } from './controllers/external-order.controller';
import { OrderService } from './services/order.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Customer } from './entities/customer.entity';
import { Product } from './entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Customer, Product]),
  ],
  controllers: [OrderController, ExternalOrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
