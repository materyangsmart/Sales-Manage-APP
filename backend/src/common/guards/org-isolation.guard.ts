import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Org隔离守卫
 * 确保所有操作都在同一个组织内进行，防止跨组织数据访问
 */
@Injectable()
export class OrgIsolationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // 从登录态获取用户的orgId（这里暂时模拟，实际应从JWT或Session中获取）
    const userOrgId = request.user?.orgId || request.headers['x-org-id'];

    // 从请求体或查询参数中获取操作的orgId
    const requestOrgId = request.body?.orgId || request.query?.orgId;

    if (!userOrgId) {
      throw new ForbiddenException('未找到用户组织信息');
    }

    if (!requestOrgId) {
      throw new ForbiddenException('请求中未包含组织ID');
    }

    // 验证用户的orgId与请求的orgId一致
    if (parseInt(userOrgId) !== parseInt(requestOrgId)) {
      throw new ForbiddenException('禁止跨组织操作');
    }

    return true;
  }
}

/**
 * 辅助函数：在Service层二次校验实体的orgId
 * @param entity 实体对象
 * @param expectedOrgId 期望的orgId
 * @throws ForbiddenException 如果orgId不匹配
 */
export function assertSameOrg(
  entity: { orgId: number } | null | undefined,
  expectedOrgId: number,
): void {
  if (!entity) {
    throw new ForbiddenException('实体不存在');
  }

  if (entity.orgId !== expectedOrgId) {
    throw new ForbiddenException(
      `组织ID不匹配：期望 ${expectedOrgId}，实际 ${entity.orgId}`,
    );
  }
}
