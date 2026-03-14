import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  /**
   * 获取客户列表
   */
  async findAll(params: {
    orgId: number;
    createdAfter?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { orgId, createdAfter, page = 1, pageSize = 100 } = params;

    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.orgId = :orgId', { orgId });

    // 如果指定了createdAfter，过滤创建时间
    if (createdAfter) {
      const afterDate = new Date(createdAfter);
      queryBuilder.andWhere('customer.createdAt >= :afterDate', { afterDate });
    }

    // 分页
    const skip = (page - 1) * pageSize;
    queryBuilder.skip(skip).take(pageSize);

    // 排序
    queryBuilder.orderBy('customer.createdAt', 'DESC');

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 统计客户数量
   */
  async count(params: {
    orgId: number;
    createdAfter?: string;
  }): Promise<number> {
    const { orgId, createdAfter } = params;

    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.orgId = :orgId', { orgId });

    if (createdAfter) {
      const afterDate = new Date(createdAfter);
      queryBuilder.andWhere('customer.createdAt >= :afterDate', { afterDate });
    }

    return queryBuilder.getCount();
  }

  /**
   * 根据ID获取客户
   */
  async findOne(id: number): Promise<Customer | null> {
    return this.customerRepository.findOne({ where: { id } });
  }

  /**
   * 创建客户
   */
  async create(customerData: Partial<Customer>): Promise<Customer> {
    const customer = this.customerRepository.create(customerData);
    return this.customerRepository.save(customer);
  }

  /**
   * 更新客户
   */
  async update(id: number, customerData: Partial<Customer>): Promise<Customer> {
    await this.customerRepository.update(id, customerData);
    const customer = await this.findOne(id);
    if (!customer) {
      throw new Error(`Customer with ID ${id} not found after update`);
    }
    return customer;
  }

  /**
   * 删除客户
   */
  async remove(id: number): Promise<void> {
    await this.customerRepository.delete(id);
  }
}
