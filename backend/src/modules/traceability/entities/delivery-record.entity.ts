import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('delivery_records')
@Index(['orderId'])
@Index(['driverId'])
export class DeliveryRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', comment: '关联订单ID' })
  orderId: number;

  @Column({ name: 'driver_id', type: 'int', nullable: true, comment: '司机ID' })
  driverId: number;

  @Column({ name: 'driver_name', type: 'varchar', length: 50, comment: '司机姓名' })
  driverName: string;

  @Column({ name: 'vehicle_no', type: 'varchar', length: 20, nullable: true, comment: '车牌号' })
  vehicleNo: string;

  @Column({ name: 'departure_time', type: 'datetime', nullable: true, comment: '出发时间' })
  departureTime: Date;

  @Column({ name: 'arrival_time', type: 'datetime', nullable: true, comment: '到达时间' })
  arrivalTime: Date;

  @Column({ name: 'temperature', type: 'decimal', precision: 4, scale: 1, nullable: true, comment: '运输温度(℃)' })
  temperature: number;

  @Column({ name: 'status', type: 'enum', enum: ['PENDING', 'IN_TRANSIT', 'DELIVERED', 'EXCEPTION'], default: 'PENDING', comment: '配送状态' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
