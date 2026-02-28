import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { User } from '../../user/entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { Role, DataScope } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { JwtPayload } from '../decorators/require-permissions.decorator';

/**
 * DataScope 优先级（数字越大权限越高）
 * 当用户有多个角色时，取最高优先级的 dataScope
 */
const DATA_SCOPE_PRIORITY: Record<DataScope, number> = {
  [DataScope.SELF]: 1,
  [DataScope.DEPT]: 2,
  [DataScope.DEPT_AND_SUB]: 3,
  [DataScope.CUSTOM]: 3,
  [DataScope.ALL]: 4,
};

/** 缓存 Key 前缀 */
const CACHE_KEYS = {
  userPermissions: (userId: number) => `rbac:user_permissions:${userId}`,
  orgTree: () => `rbac:org_tree`,
  orgSubIds: (orgId: number) => `rbac:org_sub_ids:${orgId}`,
};

/** 缓存 TTL（秒） */
const CACHE_TTL = {
  userPermissions: 300,   // 5 分钟
  orgTree: 600,           // 10 分钟
  orgSubIds: 600,         // 10 分钟
};

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  // ─── 登录与 JWT 签发 ──────────────────────────────────────────────────────

  /**
   * 用户名密码登录，返回 JWT Token
   */
  async login(username: string, password: string): Promise<{ token: string; user: JwtPayload }> {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(`账号已${user.status === 'DISABLED' ? '禁用' : '锁定'}，请联系管理员`);
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('账号未设置密码，请联系管理员');
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const payload = await this.buildJwtPayload(user);
    const token = this.signToken(payload);

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    this.logger.log(`[Login] 用户 ${user.username} 登录成功，dataScope=${payload.dataScope}`);
    return { token, user: payload };
  }

  /**
   * 构建 JWT Payload（核心：计算 permissions 和 dataScope）
   * 结果写入 Redis 缓存，TTL = 5 分钟
   */
  async buildJwtPayload(user: User): Promise<JwtPayload> {
    const cacheKey = CACHE_KEYS.userPermissions(user.id);

    // ─── 尝试从缓存读取 ────────────────────────────────────────────────
    const cached = await this.cacheManager.get<JwtPayload>(cacheKey);
    if (cached) {
      this.logger.debug(`[Cache HIT] 用户权限缓存命中: userId=${user.id}`);
      return cached;
    }
    this.logger.debug(`[Cache MISS] 用户权限缓存未命中，查询数据库: userId=${user.id}`);

    // ─── 查询数据库 ────────────────────────────────────────────────────
    const userRoles = await this.userRoleRepo.find({
      where: { userId: user.id },
      relations: ['role'],
    });

    const roles = userRoles.map((ur) => ur.role);
    const roleIds = roles.map((r) => r.id);
    const roleCodes = roles.map((r) => r.code);

    let permissions: string[] = [];
    if (roleIds.length > 0) {
      const rolesWithPerms = await this.roleRepo.find({
        where: { id: In(roleIds) },
        relations: ['permissions'],
      });
      const permSet = new Set<string>();
      for (const role of rolesWithPerms) {
        for (const perm of role.permissions || []) {
          permSet.add(perm.code);
        }
      }
      permissions = Array.from(permSet);
    }

    let maxDataScope = DataScope.SELF;
    for (const role of roles) {
      const priority = DATA_SCOPE_PRIORITY[role.dataScope] || 0;
      if (priority > DATA_SCOPE_PRIORITY[maxDataScope]) {
        maxDataScope = role.dataScope;
      }
    }

    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      realName: user.realName,
      orgId: user.orgId,
      roles: roleCodes,
      permissions,
      dataScope: maxDataScope,
    };

    // ─── 写入缓存 ──────────────────────────────────────────────────────
    await this.cacheManager.set(cacheKey, payload, CACHE_TTL.userPermissions * 1000);
    this.logger.debug(`[Cache SET] 用户权限已缓存: userId=${user.id}, TTL=${CACHE_TTL.userPermissions}s`);

    return payload;
  }

  /**
   * 签发 JWT Token（有效期 8 小时）
   */
  signToken(payload: JwtPayload): string {
    const secret = this.configService.get<string>('JWT_SECRET') || 'fallback-secret';
    return jwt.sign(payload, secret, { expiresIn: '8h' });
  }

  /**
   * 使用户权限缓存失效（权限变更时调用）
   */
  async invalidateUserPermissionsCache(userId: number): Promise<void> {
    const cacheKey = CACHE_KEYS.userPermissions(userId);
    await this.cacheManager.del(cacheKey);
    this.logger.log(`[Cache INVALIDATE] 用户权限缓存已失效: userId=${userId}`);
  }

  /**
   * 使组织树缓存失效（部门变更时调用）
   */
  async invalidateOrgTreeCache(): Promise<void> {
    await this.cacheManager.del(CACHE_KEYS.orgTree());
    this.logger.log(`[Cache INVALIDATE] 组织树缓存已失效`);
  }

  // ─── 组织架构查询 ──────────────────────────────────────────────────────────

  /**
   * 获取某组织及其所有子孙组织的 ID 列表
   * 结果写入 Redis 缓存，TTL = 10 分钟
   */
  async getOrgAndSubIds(orgId: number): Promise<number[]> {
    const cacheKey = CACHE_KEYS.orgSubIds(orgId);

    const cached = await this.cacheManager.get<number[]>(cacheKey);
    if (cached) {
      this.logger.debug(`[Cache HIT] 组织子树缓存命中: orgId=${orgId}`);
      return cached;
    }

    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) return [orgId];

    const subOrgs = await this.orgRepo
      .createQueryBuilder('org')
      .where('org.ancestor_path LIKE :path', { path: `%/${orgId}/%` })
      .orWhere('org.id = :id', { id: orgId })
      .select(['org.id'])
      .getMany();

    const ids = subOrgs.map((o) => o.id);
    await this.cacheManager.set(cacheKey, ids, CACHE_TTL.orgSubIds * 1000);
    this.logger.debug(`[Cache SET] 组织子树已缓存: orgId=${orgId}, count=${ids.length}`);
    return ids;
  }

  /**
   * 获取完整组织树（用于前端展示）
   * 结果写入 Redis 缓存，TTL = 10 分钟
   */
  async getOrgTree(): Promise<Organization[]> {
    const cacheKey = CACHE_KEYS.orgTree();

    const cached = await this.cacheManager.get<Organization[]>(cacheKey);
    if (cached) {
      this.logger.debug(`[Cache HIT] 组织树缓存命中`);
      return cached;
    }
    this.logger.debug(`[Cache MISS] 组织树缓存未命中，查询数据库`);

    const orgs = await this.orgRepo.find({
      where: { status: 'ACTIVE' },
      order: { level: 'ASC', sortOrder: 'ASC' },
    });

    await this.cacheManager.set(cacheKey, orgs, CACHE_TTL.orgTree * 1000);
    this.logger.debug(`[Cache SET] 组织树已缓存: count=${orgs.length}, TTL=${CACHE_TTL.orgTree}s`);
    return orgs;
  }

  // ─── 用户管理 ──────────────────────────────────────────────────────────────

  /**
   * 创建用户（含密码哈希）
   */
  async createUser(data: {
    username: string;
    realName: string;
    password: string;
    orgId: number;
    jobPosition: string;
    email?: string;
    phone?: string;
  }): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { username: data.username } });
    if (existing) {
      throw new BadRequestException(`用户名 ${data.username} 已存在`);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = this.userRepo.create({
      username: data.username,
      realName: data.realName,
      email: data.email ?? null,
      phone: data.phone ?? '',
      orgId: data.orgId,
      jobPosition: data.jobPosition as any,
      passwordHash,
      roles: [],
      status: 'ACTIVE',
      lastLoginAt: null,
    });

    return this.userRepo.save(user);
  }

  /**
   * 为用户分配角色
   * 分配后自动失效该用户的权限缓存
   */
  async assignRole(userId: number, roleId: number, orgId?: number): Promise<void> {
    const existing = await this.userRoleRepo.findOne({
      where: { userId, roleId, orgId: orgId ?? undefined } as any,
    });
    if (existing) return;

    const userRole = this.userRoleRepo.create({ userId, roleId, orgId: orgId ?? null });
    await this.userRoleRepo.save(userRole);

    // 自动失效权限缓存
    await this.invalidateUserPermissionsCache(userId);
  }

  /**
   * 获取用户的完整权限信息（用于测试验证）
   */
  async getUserPermissionInfo(userId: number): Promise<{
    user: User;
    roles: Role[];
    permissions: string[];
    dataScope: DataScope;
    orgIds: number[];
  }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('用户不存在');

    const payload = await this.buildJwtPayload(user);
    const roles = await this.roleRepo.find({
      where: { code: In(payload.roles) },
    });

    let orgIds: number[] = [];
    if (payload.dataScope === DataScope.ALL) {
      orgIds = [];
    } else if (payload.dataScope === DataScope.DEPT_AND_SUB) {
      orgIds = await this.getOrgAndSubIds(user.orgId);
    } else if (payload.dataScope === DataScope.DEPT) {
      orgIds = [user.orgId];
    } else {
      orgIds = [user.orgId];
    }

    return {
      user,
      roles,
      permissions: payload.permissions,
      dataScope: payload.dataScope,
      orgIds,
    };
  }
}
