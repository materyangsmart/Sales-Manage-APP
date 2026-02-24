import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, JobPosition, POSITION_ROLE_MAP } from '../entities/user.entity';
import { CreateUserDto } from '../dto/user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 获取员工列表
   */
  async findAll(params: {
    orgId?: number;
    page?: number;
    pageSize?: number;
  }) {
    const { orgId, page = 1, pageSize = 100 } = params;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (orgId) {
      queryBuilder.where('user.orgId = :orgId', { orgId });
    }

    queryBuilder.orderBy('user.createdAt', 'DESC');

    const skip = (page - 1) * pageSize;
    queryBuilder.skip(skip).take(pageSize);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取职位模板列表
   * 返回所有职位及其自动映射的角色
   */
  getJobPositions() {
    return Object.entries(POSITION_ROLE_MAP).map(([position, roles]) => ({
      code: position,
      name: this.getPositionLabel(position as JobPosition),
      roles,
    }));
  }

  /**
   * 创建员工（含RBAC自动赋权）
   * 根据职位模板自动注入角色，无需人工勾选权限点
   */
  async create(dto: CreateUserDto): Promise<User> {
    // 检查用户名唯一性
    const existing = await this.userRepository.findOne({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException(`Username "${dto.username}" already exists`);
    }

    // 根据职位自动映射角色
    const autoRoles = POSITION_ROLE_MAP[dto.jobPosition];
    if (!autoRoles) {
      throw new ConflictException(`Unknown job position: ${dto.jobPosition}`);
    }

    const user = this.userRepository.create({
      orgId: dto.orgId,
      username: dto.username,
      realName: dto.realName,
      phone: dto.phone || null,
      jobPosition: dto.jobPosition,
      roles: autoRoles as string[],
      status: 'ACTIVE',
    } as Partial<User>);

    return this.userRepository.save(user) as Promise<User>;
  }

  /**
   * 删除员工
   */
  async remove(id: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.userRepository.delete(id);
  }

  /**
   * 根据ID获取员工
   */
  async findOne(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * 职位代码 → 中文名称
   */
  private getPositionLabel(position: JobPosition): string {
    const labels: Record<JobPosition, string> = {
      [JobPosition.CEO]: '总经理',
      [JobPosition.SALES_DIRECTOR]: '销售总监',
      [JobPosition.SALES_MANAGER]: '片区经理',
      [JobPosition.SALES_REP]: '销售代表',
      [JobPosition.FINANCE_SUPERVISOR]: '财务主管',
      [JobPosition.FINANCE_CLERK]: '财务文员',
      [JobPosition.LOGISTICS_MANAGER]: '物流经理',
      [JobPosition.WAREHOUSE_CLERK]: '仓库管理员',
    };
    return labels[position] || position;
  }
}
