import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { WorkflowService } from '../services/workflow.service';
import { ApprovalAction } from '../entities/approval-log.entity';
import { NodeType } from '../entities/workflow-node.entity';
import { JwtAuthGuard } from '../../rbac/guards/jwt-auth.guard';
import { CurrentUser } from '../../rbac/decorators/require-permissions.decorator';
import type { JwtPayload } from '../../rbac/decorators/require-permissions.decorator';

/**
 * 工作流 Controller
 * 所有接口均需要 JWT 认证
 *
 * 路由前缀：/api/internal/workflow
 */
@Controller('api/internal/workflow')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name);

  constructor(private readonly workflowService: WorkflowService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // 【流程定义管理】（管理员使用）
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 创建流程定义
   * POST /api/internal/workflow/definitions
   */
  @Post('definitions')
  @HttpCode(HttpStatus.CREATED)
  async createDefinition(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string;
      businessType: string;
      triggerCondition?: string;
      nodes: Array<{
        stepOrder: number;
        nodeName: string;
        nodeType: NodeType;
        roleId?: number;
        allowResubmit?: boolean;
        timeoutHours?: number;
        remark?: string;
      }>;
    },
  ) {
    return this.workflowService.createDefinition(body);
  }

  /**
   * 查询流程定义（按 code）
   * GET /api/internal/workflow/definitions/:code
   */
  @Get('definitions/:code')
  async getDefinition(@Param('code') code: string) {
    return this.workflowService.findDefinitionByCode(code);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 【流程实例管理】
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 发起审批流程
   * POST /api/internal/workflow/instances
   */
  @Post('instances')
  @HttpCode(HttpStatus.CREATED)
  async startInstance(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      definitionCode: string;
      businessType: string;
      businessId: number;
      businessNo?: string;
      applyReason?: string;
    },
  ) {
    this.logger.log(
      `用户 ${user.username} 发起审批: 流程 [${body.definitionCode}], 业务 ${body.businessType}#${body.businessId}`,
    );
    return this.workflowService.startInstance({
      definitionCode: body.definitionCode,
      businessType: body.businessType,
      businessId: body.businessId,
      businessNo: body.businessNo,
      initiatorId: user.userId,
      initiatorName: user.realName ?? user.username,
      initiatorOrgId: user.orgId,
      applyReason: body.applyReason,
    });
  }

  /**
   * 审批操作（同意 / 拒绝 / 驳回）
   * POST /api/internal/workflow/instances/:id/approve
   */
  @Post('instances/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) instanceId: number,
    @Body() body: { comment?: string },
  ) {
    this.logger.log(
      `用户 ${user.username} 同意审批: 实例 #${instanceId}`,
    );
    return this.workflowService.processApproval({
      instanceId,
      operatorId: user.userId,
      operatorName: user.realName ?? user.username,
      operatorRoles: user.roles,
      action: ApprovalAction.APPROVE,
      comment: body.comment,
    });
  }

  /**
   * 拒绝审批
   * POST /api/internal/workflow/instances/:id/reject
   */
  @Post('instances/:id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) instanceId: number,
    @Body() body: { comment: string },
  ) {
    this.logger.log(
      `用户 ${user.username} 拒绝审批: 实例 #${instanceId}, 原因: ${body.comment}`,
    );
    return this.workflowService.processApproval({
      instanceId,
      operatorId: user.userId,
      operatorName: user.realName ?? user.username,
      operatorRoles: user.roles,
      action: ApprovalAction.REJECT,
      comment: body.comment,
    });
  }

  /**
   * 驳回审批（退回给发起人）
   * POST /api/internal/workflow/instances/:id/withdraw
   */
  @Post('instances/:id/withdraw')
  @HttpCode(HttpStatus.OK)
  async withdraw(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) instanceId: number,
    @Body() body: { comment?: string },
  ) {
    return this.workflowService.processApproval({
      instanceId,
      operatorId: user.userId,
      operatorName: user.realName ?? user.username,
      operatorRoles: user.roles,
      action: ApprovalAction.WITHDRAW,
      comment: body.comment,
    });
  }

  /**
   * 撤销流程（发起人主动撤回）
   * POST /api/internal/workflow/instances/:id/cancel
   */
  @Post('instances/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) instanceId: number,
    @Body() body: { comment?: string },
  ) {
    return this.workflowService.cancelInstance({
      instanceId,
      operatorId: user.userId,
      operatorName: user.realName ?? user.username,
      comment: body.comment,
    });
  }

  /**
   * 查询流程实例详情（含审批日志）
   * GET /api/internal/workflow/instances/:id
   */
  @Get('instances/:id')
  async getInstance(@Param('id', ParseIntPipe) instanceId: number) {
    return this.workflowService.getInstanceById(instanceId);
  }

  /**
   * 查询某个业务单据的流程实例
   * GET /api/internal/workflow/instances/by-business?type=ORDER&id=123
   */
  @Get('instances/by-business')
  async getInstanceByBusiness(
    @Query('type') businessType: string,
    @Query('id', ParseIntPipe) businessId: number,
  ) {
    return this.workflowService.getInstanceByBusiness(businessType, businessId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 【待办查询】核心接口
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 查询当前用户的待审批列表
   * GET /api/internal/workflow/my-todos
   *
   * 从 JWT Payload 中读取 userId、roles、orgId
   * 动态查询所有需要当前用户角色审批的流程实例
   */
  @Get('my-todos')
  async getMyTodos(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    this.logger.log(
      `查询待办: 用户 ${user.username} (roles: [${user.roles.join(',')}], orgId: ${user.orgId})`,
    );
    const result = await this.workflowService.getMyTodos({
      userId: user.userId,
      roles: user.roles,
      orgId: user.orgId,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
    return {
      ...result,
      user: {
        userId: user.userId,
        username: user.username,
        roles: user.roles,
        orgId: user.orgId,
      },
    };
  }
}
