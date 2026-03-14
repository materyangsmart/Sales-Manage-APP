import { Injectable, Logger } from '@nestjs/common';
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { DataScope } from '../entities/role.entity';
import { JwtPayload } from '../decorators/require-permissions.decorator';
import { RbacService } from './rbac.service';

/**
 * 数据隔离服务（DataScope Service）
 *
 * 核心职责：根据当前用户的 dataScope，动态向 QueryBuilder 追加 WHERE 条件
 *
 * 数据范围规则：
 * ┌─────────────────┬────────────────────────────────────────────────────────┐
 * │ DataScope       │ 追加的 WHERE 条件                                       │
 * ├─────────────────┼────────────────────────────────────────────────────────┤
 * │ ALL             │ 不追加（查全部）                                         │
 * │ DEPT_AND_SUB    │ WHERE org_id IN (本部门及所有子孙部门IDs)                │
 * │ DEPT            │ WHERE org_id = :orgId                                   │
 * │ SELF            │ WHERE sales_rep_id = :userId (orders)                   │
 * │                 │ WHERE created_by = :userId (其他表)                     │
 * └─────────────────┴────────────────────────────────────────────────────────┘
 */
@Injectable()
export class DataScopeService {
  private readonly logger = new Logger(DataScopeService.name);

  constructor(private readonly rbacService: RbacService) {}

  /**
   * 为 orders 表的 QueryBuilder 追加数据隔离条件
   *
   * @param qb       TypeORM QueryBuilder（alias 必须为 'order'）
   * @param user     当前登录用户的 JWT Payload
   * @param alias    表别名（默认 'order'）
   */
  async applyOrderScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    user: JwtPayload,
    alias = 'order',
  ): Promise<SelectQueryBuilder<T>> {
    const { dataScope, userId, orgId } = user;

    switch (dataScope) {
      case DataScope.ALL:
        // 全部数据，不追加任何条件
        this.logger.debug(`[DataScope] 用户 ${user.username} ALL 数据范围，不限制`);
        break;


      case DataScope.DEPT_AND_SUB: {
        // 本部门及所有子孙部门
        const orgIds = await this.rbacService.getOrgAndSubIds(orgId);
        this.logger.debug(
          `[DataScope] 用户 ${user.username} DEPT_AND_SUB，orgIds=${orgIds.join(',')}`,
        );
        if (orgIds.length === 0) {
          // 没有子部门，退化为本部门
          qb.andWhere(`${alias}.org_id = :scopeOrgId`, { scopeOrgId: orgId });
        } else {
          qb.andWhere(`${alias}.org_id IN (:...scopeOrgIds)`, { scopeOrgIds: orgIds });
        }
        break;
      }

      case DataScope.DEPT:
        // 仅本部门
        this.logger.debug(`[DataScope] 用户 ${user.username} DEPT，orgId=${orgId}`);
        qb.andWhere(`${alias}.org_id = :scopeOrgId`, { scopeOrgId: orgId });
        break;

      case DataScope.SELF:
      default:
        // 仅本人（orders 表用 sales_rep_id）
        this.logger.debug(`[DataScope] 用户 ${user.username} SELF，userId=${userId}`);
        qb.andWhere(`${alias}.sales_rep_id = :scopeUserId`, { scopeUserId: userId });
        break;
    }

    return qb;
  }

  /**
   * 为 customers 表的 QueryBuilder 追加数据隔离条件
   *
   * @param qb    TypeORM QueryBuilder（alias 必须为 'customer'）
   * @param user  当前登录用户的 JWT Payload
   * @param alias 表别名（默认 'customer'）
   */
  async applyCustomerScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    user: JwtPayload,
    alias = 'customer',
  ): Promise<SelectQueryBuilder<T>> {
    const { dataScope, userId, orgId } = user;

    switch (dataScope) {
      case DataScope.ALL:
        this.logger.debug(`[DataScope] 用户 ${user.username} ALL 数据范围，不限制客户`);
        break;

      case DataScope.DEPT_AND_SUB: {
        const orgIds = await this.rbacService.getOrgAndSubIds(orgId);
        this.logger.debug(
          `[DataScope] 用户 ${user.username} DEPT_AND_SUB 客户，orgIds=${orgIds.join(',')}`,
        );
        if (orgIds.length === 0) {
          qb.andWhere(`${alias}.org_id = :scopeOrgId`, { scopeOrgId: orgId });
        } else {
          qb.andWhere(`${alias}.org_id IN (:...scopeOrgIds)`, { scopeOrgIds: orgIds });
        }
        break;
      }

      case DataScope.DEPT:
        this.logger.debug(`[DataScope] 用户 ${user.username} DEPT 客户，orgId=${orgId}`);
        qb.andWhere(`${alias}.org_id = :scopeOrgId`, { scopeOrgId: orgId });
        break;

      case DataScope.SELF:
      default:
        // customers 表：SELF 模式限制为本部门（客户没有 created_by 字段）
        this.logger.debug(
          `[DataScope] 用户 ${user.username} SELF 客户，退化为 DEPT orgId=${orgId}`,
        );
        qb.andWhere(`${alias}.org_id = :scopeOrgId`, { scopeOrgId: orgId });
        break;
    }

    return qb;
  }

  /**
   * 通用数据隔离方法（适用于任意有 org_id 字段的表）
   *
   * @param qb         QueryBuilder
   * @param user       当前用户
   * @param alias      表别名
   * @param orgField   org_id 字段名（默认 'org_id'）
   * @param userField  用户字段名（SELF 模式，默认 'created_by'）
   */
  async applyGenericScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    user: JwtPayload,
    alias: string,
    orgField = 'org_id',
    userField = 'created_by',
  ): Promise<SelectQueryBuilder<T>> {
    const { dataScope, userId, orgId } = user;

    switch (dataScope) {
      case DataScope.ALL:
        break;

      case DataScope.DEPT_AND_SUB: {
        const orgIds = await this.rbacService.getOrgAndSubIds(orgId);
        if (orgIds.length === 0) {
          qb.andWhere(`${alias}.${orgField} = :scopeOrgId`, { scopeOrgId: orgId });
        } else {
          qb.andWhere(`${alias}.${orgField} IN (:...scopeOrgIds)`, { scopeOrgIds: orgIds });
        }
        break;
      }

      case DataScope.DEPT:
        qb.andWhere(`${alias}.${orgField} = :scopeOrgId`, { scopeOrgId: orgId });
        break;

      case DataScope.SELF:
      default:
        qb.andWhere(`${alias}.${userField} = :scopeUserId`, { scopeUserId: userId });
        break;
    }

    return qb;
  }

  /**
   * 生成数据隔离的 SQL 片段（用于日志和调试）
   */
  async describeScope(user: JwtPayload): Promise<string> {
    const { dataScope, userId, orgId, username } = user;

    switch (dataScope) {
      case DataScope.ALL:
        return `用户 ${username}: ALL（无限制，查全部数据）`;
      case DataScope.DEPT_AND_SUB: {
        const orgIds = await this.rbacService.getOrgAndSubIds(orgId);
        return `用户 ${username}: DEPT_AND_SUB（org_id IN [${orgIds.join(',')}]）`;
      }
      case DataScope.DEPT:
        return `用户 ${username}: DEPT（org_id = ${orgId}）`;
      case DataScope.SELF:
        return `用户 ${username}: SELF（sales_rep_id = ${userId}）`;
      default:
        return `用户 ${username}: UNKNOWN`;
    }
  }
}
