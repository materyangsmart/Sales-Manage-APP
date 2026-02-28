import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowDefinition } from '../entities/workflow-definition.entity';
import { WorkflowNode, NodeType } from '../entities/workflow-node.entity';
import { WorkflowInstance, InstanceStatus } from '../entities/workflow-instance.entity';
import { ApprovalLog, ApprovalAction } from '../entities/approval-log.entity';
import { UserRole } from '../../rbac/entities/user-role.entity';
import { RedisLockService } from '../../infra/redis-lock.service';
import {
  WorkflowPendingEvent,
  WORKFLOW_EVENTS,
} from '../../notification/events/workflow-pending.event';

/**
 * 工作流服务 — 状态机核心
 *
 * 核心设计原则：
 * 1. 状态机驱动：所有状态变更都通过此服务，绝不允许外部直接修改 instance.status
 * 2. RBAC 绑定：审批权限校验基于 JWT Payload 中的 roles
 * 3. 不可篡改日志：每次流转都写入 ApprovalLog，不更新旧记录
 * 4. 业务解耦：通过 businessType + businessId 关联业务，不直接依赖业务表
 * 5. 事件驱动：通过 EventEmitter2 触发通知，不直接调用 NotificationService（解耦）
 */
@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    @InjectRepository(WorkflowDefinition)
    private definitionRepo: Repository<WorkflowDefinition>,
    @InjectRepository(WorkflowNode)
    private nodeRepo: Repository<WorkflowNode>,
    @InjectRepository(WorkflowInstance)
    private instanceRepo: Repository<WorkflowInstance>,
    @InjectRepository(ApprovalLog)
    private logRepo: Repository<ApprovalLog>,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
    private dataSource: DataSource,
    private readonly redisLockService: RedisLockService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // 【流程定义管理】
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 创建流程定义（含节点）
   */
  async createDefinition(params: {
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
  }): Promise<WorkflowDefinition> {
    // 检查 code 唯一性
    const existing = await this.definitionRepo.findOne({ where: { code: params.code } });
    if (existing) {
      throw new BadRequestException(`流程编码 ${params.code} 已存在`);
    }

    const def = this.definitionRepo.create({
      code: params.code,
      name: params.name,
      description: params.description ?? null,
      businessType: params.businessType,
      triggerCondition: params.triggerCondition ?? null,
      status: 'ACTIVE',
    });
    await this.definitionRepo.save(def);

    // 批量创建节点
    const nodes = params.nodes.map((n) =>
      this.nodeRepo.create({
        definitionId: def.id,
        stepOrder: n.stepOrder,
        nodeName: n.nodeName,
        nodeType: n.nodeType,
        roleId: n.roleId ?? null,
        allowResubmit: n.allowResubmit ?? true,
        timeoutHours: n.timeoutHours ?? 0,
        remark: n.remark ?? null,
      }),
    );
    await this.nodeRepo.save(nodes);

    this.logger.log(`流程定义创建成功: [${def.code}] ${def.name}，共 ${nodes.length} 个节点`);
    return this.definitionRepo.findOne({
      where: { id: def.id },
      relations: ['nodes'],
    }) as Promise<WorkflowDefinition>;
  }

  /**
   * 根据 code 查找流程定义（含节点，按 stepOrder 排序）
   */
  async findDefinitionByCode(code: string): Promise<WorkflowDefinition> {
    const def = await this.definitionRepo.findOne({
      where: { code, status: 'ACTIVE' },
      relations: ['nodes'],
    });
    if (!def) {
      throw new NotFoundException(`流程定义 [${code}] 不存在或已停用`);
    }
    // 按步骤序号排序
    def.nodes.sort((a, b) => a.stepOrder - b.stepOrder);
    return def;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 【流程实例管理】
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 发起审批流程
   * 创建一个新的 WorkflowInstance，并写入第一条 SUBMIT 日志
   * 成功后触发 workflow.node.pending 事件（由 NotificationService 监听）
   */
  async startInstance(params: {
    definitionCode: string;
    businessType: string;
    businessId: number;
    businessNo?: string;
    initiatorId: number;
    initiatorName?: string;
    initiatorOrgId?: number;
    applyReason?: string;
  }): Promise<WorkflowInstance> {
    // ─── 分布式锁：防止高并发重复提交 ─────────────────────────────────────
    const lockKey = `workflow:start:${params.businessType}:${params.businessId}`;
    const lockToken = await this.redisLockService.acquireLock(lockKey, 15000); // 15 秒锁
    if (!lockToken) {
      this.logger.warn(
        `[分布式锁] 重复提交被拦截: ${params.businessType}#${params.businessId}, 发起人 ${params.initiatorId}`,
      );
      throw new BadRequestException(
        `业务单据 ${params.businessNo ?? params.businessId} 正在处理中，请勿重复提交`,
      );
    }
    this.logger.debug(`[分布式锁] 获取锁成功: ${lockKey}`);

    try {
      return await this._doStartInstance(params);
    } finally {
      await this.redisLockService.releaseLock(lockKey, lockToken);
      this.logger.debug(`[分布式锁] 释放锁: ${lockKey}`);
    }
  }

  /**
   * 内部实际发起审批逻辑（已在分布式锁保护下执行）
   */
  private async _doStartInstance(params: {
    definitionCode: string;
    businessType: string;
    businessId: number;
    businessNo?: string;
    initiatorId: number;
    initiatorName?: string;
    initiatorOrgId?: number;
    applyReason?: string;
  }): Promise<WorkflowInstance> {
    const def = await this.findDefinitionByCode(params.definitionCode);

    // 检查该业务单据是否已有进行中的实例
    const existingActive = await this.instanceRepo.findOne({
      where: {
        businessType: params.businessType,
        businessId: params.businessId,
        status: InstanceStatus.PENDING,
      },
    });
    if (existingActive) {
      throw new BadRequestException(
        `业务单据 ${params.businessNo ?? params.businessId} 已有进行中的审批流程（实例 ID: ${existingActive.id}）`,
      );
    }

    const instance = this.instanceRepo.create({
      definitionId: def.id,
      businessType: params.businessType,
      businessId: params.businessId,
      businessNo: params.businessNo ?? null,
      currentStep: 1,
      totalSteps: def.nodes.length,
      status: InstanceStatus.PENDING,
      initiatorId: params.initiatorId,
      initiatorName: params.initiatorName ?? null,
      initiatorOrgId: params.initiatorOrgId ?? null,
      applyReason: params.applyReason ?? null,
      finishedAt: null,
    });
    await this.instanceRepo.save(instance);

    // 写入 SUBMIT 日志
    await this.writeLog({
      instanceId: instance.id,
      stepOrder: 0,
      nodeName: '发起申请',
      operatorId: params.initiatorId,
      operatorName: params.initiatorName ?? null,
      operatorRole: null,
      action: ApprovalAction.SUBMIT,
      comment: params.applyReason ?? null,
      fromStatus: null,
      toStatus: InstanceStatus.PENDING,
    });

    this.logger.log(
      `审批流程发起: 实例 #${instance.id}, 业务 ${params.businessType}#${params.businessId}, 流程 [${def.code}]`,
    );

    // 处理第一步如果是 CC 节点（自动流转）
    await this.autoAdvanceCCNodes(instance, def);

    // ─── 触发 workflow.node.pending 事件（事件驱动，解耦通知逻辑）──────────
    // 只有实例仍处于 PENDING 状态时才触发（CC 节点自动流转可能已完结）
    if (instance.status === InstanceStatus.PENDING) {
      const currentNode = def.nodes.find((n) => n.stepOrder === instance.currentStep);
      if (currentNode && currentNode.roleId) {
        const event = new WorkflowPendingEvent({
          instanceId: instance.id,
          workflowCode: def.code,
          workflowName: def.name,
          currentStep: instance.currentStep,
          roleId: currentNode.roleId,
          businessType: params.businessType,
          businessId: params.businessId,
          submittedByUserId: params.initiatorId,
          submittedByName: params.initiatorName ?? `用户#${params.initiatorId}`,
          submittedAt: new Date(),
        });

        this.eventEmitter.emit(WORKFLOW_EVENTS.NODE_PENDING, event);

        this.logger.log(
          `[EventEmitter] 触发事件 ${WORKFLOW_EVENTS.NODE_PENDING}: ` +
            `instanceId=${instance.id}, roleId=${currentNode.roleId}, ` +
            `businessType=${params.businessType}#${params.businessId}`,
        );
      }
    }

    return instance;
  }

  /**
   * 审批操作（同意 / 拒绝 / 驳回）
   * 核心状态机逻辑
   *
   * @param instanceId 流程实例 ID
   * @param operatorId 操作人用户 ID
   * @param operatorRoles 操作人角色编码列表（来自 JWT Payload）
   * @param action 操作：APPROVE / REJECT / WITHDRAW
   * @param comment 审批意见
   */
  async processApproval(params: {
    instanceId: number;
    operatorId: number;
    operatorName?: string;
    operatorRoles: string[];
    action: ApprovalAction.APPROVE | ApprovalAction.REJECT | ApprovalAction.WITHDRAW;
    comment?: string;
  }): Promise<WorkflowInstance> {
    const instance = await this.instanceRepo.findOne({
      where: { id: params.instanceId },
      relations: ['definition'],
    });
    if (!instance) {
      throw new NotFoundException(`流程实例 #${params.instanceId} 不存在`);
    }
    if (instance.status !== InstanceStatus.PENDING) {
      throw new BadRequestException(
        `流程实例 #${params.instanceId} 当前状态为 ${instance.status}，无法操作`,
      );
    }

    // 获取当前步骤节点
    const currentNode = await this.nodeRepo.findOne({
      where: { definitionId: instance.definitionId, stepOrder: instance.currentStep },
    });
    if (!currentNode) {
      throw new NotFoundException(
        `流程定义中找不到步骤 ${instance.currentStep}，流程配置可能有误`,
      );
    }

    // ── 权限校验：操作人必须拥有当前节点要求的角色 ──
    await this.assertHasApprovalRight(
      params.operatorId,
      params.operatorRoles,
      currentNode,
      instance,
    );

    const fromStatus = instance.status;
    let toStatus: InstanceStatus;
    let logAction = params.action;

    if (params.action === ApprovalAction.APPROVE) {
      // 同意：判断是否是最后一步
      if (instance.currentStep >= instance.totalSteps) {
        // 所有步骤通过，流程完结
        toStatus = InstanceStatus.APPROVED;
        instance.status = InstanceStatus.APPROVED;
        instance.finishedAt = new Date();
        this.logger.log(
          `审批通过（最终）: 实例 #${instance.id}, 业务 ${instance.businessType}#${instance.businessId}`,
        );
      } else {
        // 流转到下一步
        toStatus = InstanceStatus.PENDING;
        instance.currentStep += 1;
        this.logger.log(
          `审批通过（流转）: 实例 #${instance.id} → 步骤 ${instance.currentStep}`,
        );
      }
    } else if (params.action === ApprovalAction.REJECT) {
      // 拒绝：流程终止
      toStatus = InstanceStatus.REJECTED;
      instance.status = InstanceStatus.REJECTED;
      instance.finishedAt = new Date();
      this.logger.log(
        `审批拒绝: 实例 #${instance.id}, 业务 ${instance.businessType}#${instance.businessId}`,
      );
    } else if (params.action === ApprovalAction.WITHDRAW) {
      // 驳回：退回给发起人
      toStatus = InstanceStatus.WITHDRAWN;
      instance.status = InstanceStatus.WITHDRAWN;
      instance.finishedAt = new Date();
      this.logger.log(
        `审批驳回: 实例 #${instance.id}, 退回给发起人 #${instance.initiatorId}`,
      );
    } else {
      throw new BadRequestException(`不支持的审批操作: ${params.action}`);
    }

    await this.instanceRepo.save(instance);

    // 写入审批日志
    const operatorRole = params.operatorRoles.length > 0 ? params.operatorRoles[0] : null;
    await this.writeLog({
      instanceId: instance.id,
      stepOrder: currentNode.stepOrder,
      nodeName: currentNode.nodeName,
      operatorId: params.operatorId,
      operatorName: params.operatorName ?? null,
      operatorRole,
      action: logAction,
      comment: params.comment ?? null,
      fromStatus: fromStatus,
      toStatus,
    });

    // 如果流转到下一步，检查是否是 CC 节点（自动流转）
    if (instance.status === InstanceStatus.PENDING) {
      const def = await this.findDefinitionByCode(instance.definition?.code ?? '');
      await this.autoAdvanceCCNodes(instance, def);

      // 流转到下一步后，触发新节点的待审批事件
      if (instance.status === InstanceStatus.PENDING) {
        const nextNode = await this.nodeRepo.findOne({
          where: { definitionId: instance.definitionId, stepOrder: instance.currentStep },
        });
        if (nextNode && nextNode.roleId) {
          const event = new WorkflowPendingEvent({
            instanceId: instance.id,
            workflowCode: instance.definition?.code ?? '',
            workflowName: instance.definition?.name ?? '',
            currentStep: instance.currentStep,
            roleId: nextNode.roleId,
            businessType: instance.businessType,
            businessId: instance.businessId,
            submittedByUserId: instance.initiatorId,
            submittedByName: instance.initiatorName ?? `用户#${instance.initiatorId}`,
            submittedAt: new Date(),
          });
          this.eventEmitter.emit(WORKFLOW_EVENTS.NODE_PENDING, event);
          this.logger.log(
            `[EventEmitter] 流转后触发事件 ${WORKFLOW_EVENTS.NODE_PENDING}: ` +
              `instanceId=${instance.id}, step=${instance.currentStep}, roleId=${nextNode.roleId}`,
          );
        }
      }
    }

    return instance;
  }

  /**
   * 撤销流程（发起人主动撤回）
   */
  async cancelInstance(params: {
    instanceId: number;
    operatorId: number;
    operatorName?: string;
    comment?: string;
  }): Promise<WorkflowInstance> {
    const instance = await this.instanceRepo.findOne({
      where: { id: params.instanceId },
    });
    if (!instance) {
      throw new NotFoundException(`流程实例 #${params.instanceId} 不存在`);
    }
    if (instance.status !== InstanceStatus.PENDING) {
      throw new BadRequestException(`只有进行中的流程才能撤销`);
    }
    if (instance.initiatorId !== params.operatorId) {
      throw new ForbiddenException(`只有发起人才能撤销自己的申请`);
    }

    instance.status = InstanceStatus.CANCELLED;
    instance.finishedAt = new Date();
    await this.instanceRepo.save(instance);

    await this.writeLog({
      instanceId: instance.id,
      stepOrder: instance.currentStep,
      nodeName: '撤销申请',
      operatorId: params.operatorId,
      operatorName: params.operatorName ?? null,
      operatorRole: null,
      action: ApprovalAction.CANCEL,
      comment: params.comment ?? null,
      fromStatus: InstanceStatus.PENDING,
      toStatus: InstanceStatus.CANCELLED,
    });

    return instance;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 【待办查询】
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 查询当前用户的待审批列表（my-todos）
   * 逻辑：找出所有 PENDING 实例中，currentStep 对应节点的 roleId 在当前用户角色列表中的实例
   */
  async getMyTodos(params: {
    userId: number;
    roles: string[];  // 角色编码列表
    orgId: number;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: WorkflowInstance[]; total: number }> {
    const { userId, roles, page = 1, pageSize = 20 } = params;

    if (roles.length === 0) {
      return { items: [], total: 0 };
    }

    // 1. 查找用户所有角色对应的 role_id
    const userRoles = await this.userRoleRepo.find({
      where: { userId },
      relations: ['role'],
    });
    const roleIds = userRoles.map((ur) => ur.roleId).filter(Boolean);

    if (roleIds.length === 0) {
      return { items: [], total: 0 };
    }

    // 2. 找出这些角色负责的所有节点（按 definitionId + stepOrder）
    const responsibleNodes = await this.nodeRepo.find({
      where: { roleId: In(roleIds), nodeType: NodeType.APPROVAL },
    });

    if (responsibleNodes.length === 0) {
      return { items: [], total: 0 };
    }

    // 3. 构建查询：PENDING 实例 + currentStep 匹配负责节点
    const qb = this.instanceRepo
      .createQueryBuilder('inst')
      .where('inst.status = :status', { status: InstanceStatus.PENDING });

    // 构建 OR 条件：(definitionId=X AND currentStep=Y) OR (definitionId=A AND currentStep=B) ...
    const conditions = responsibleNodes.map((node, idx) => {
      qb.setParameter(`defId${idx}`, node.definitionId);
      qb.setParameter(`step${idx}`, node.stepOrder);
      return `(inst.definitionId = :defId${idx} AND inst.currentStep = :step${idx})`;
    });
    qb.andWhere(`(${conditions.join(' OR ')})`);

    const total = await qb.getCount();
    const items = await qb
      .orderBy('inst.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { items, total };
  }

  /**
   * 查询某个业务单据的流程实例（含日志）
   */
  async getInstanceByBusiness(businessType: string, businessId: number): Promise<WorkflowInstance | null> {
    return this.instanceRepo.findOne({
      where: { businessType, businessId },
      relations: ['logs', 'definition'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 查询流程实例详情（含日志）
   */
  async getInstanceById(instanceId: number): Promise<WorkflowInstance> {
    const instance = await this.instanceRepo.findOne({
      where: { id: instanceId },
      relations: ['logs', 'definition'],
    });
    if (!instance) {
      throw new NotFoundException(`流程实例 #${instanceId} 不存在`);
    }
    return instance;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 【状态机保护：供 OrderService 调用】
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 校验订单是否可以被直接审批（即工作流已完结或不需要工作流）
   * 如果订单有进行中的工作流实例，则抛出 BadRequestException
   */
  async assertOrderCanBeApproved(orderId: number): Promise<void> {
    const activeInstance = await this.instanceRepo.findOne({
      where: {
        businessType: 'ORDER',
        businessId: orderId,
        status: InstanceStatus.PENDING,
      },
    });
    if (activeInstance) {
      throw new BadRequestException(
        `订单 #${orderId} 有进行中的审批流程（实例 #${activeInstance.id}），` +
          `当前在第 ${activeInstance.currentStep}/${activeInstance.totalSteps} 步，` +
          `请通过工作流审批接口操作`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 【私有辅助方法】
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 校验操作人是否有当前节点的审批权限
   * 规则：操作人必须拥有 currentNode.roleId 对应的角色
   */
  private async assertHasApprovalRight(
    operatorId: number,
    operatorRoles: string[],
    currentNode: WorkflowNode,
    instance: WorkflowInstance,
  ): Promise<void> {
    if (!currentNode.roleId) {
      // 节点未指定角色，任何人都可以审批（不推荐，但允许）
      return;
    }

    // 检查操作人是否拥有该节点要求的角色
    const userRole = await this.userRoleRepo.findOne({
      where: { userId: operatorId, roleId: currentNode.roleId },
      relations: ['role'],
    });

    if (!userRole) {
      this.logger.warn(
        `越权审批拦截: 用户 #${operatorId} (roles: [${operatorRoles.join(',')}]) ` +
          `尝试审批实例 #${instance.id} 步骤 ${currentNode.stepOrder}，` +
          `但不具备所需角色 ID: ${currentNode.roleId}`,
      );
      throw new ForbiddenException(
        `您没有审批此步骤的权限。当前步骤需要角色 ID: ${currentNode.roleId}，` +
          `请联系管理员确认您的角色分配`,
      );
    }

    this.logger.log(
      `权限校验通过: 用户 #${operatorId} 拥有角色 [${userRole.role?.code ?? currentNode.roleId}]，` +
        `可审批实例 #${instance.id} 步骤 ${currentNode.stepOrder}`,
    );
  }

  /**
   * 自动流转 CC（抄送）节点
   * 如果当前步骤是 CC 节点，自动写日志并推进到下一步
   */
  private async autoAdvanceCCNodes(
    instance: WorkflowInstance,
    def: WorkflowDefinition,
  ): Promise<void> {
    let maxIterations = 10; // 防止死循环
    while (maxIterations-- > 0) {
      const currentNode = def.nodes.find((n) => n.stepOrder === instance.currentStep);
      if (!currentNode || currentNode.nodeType !== NodeType.CC) {
        break;
      }

      // 自动写 CC 日志
      await this.writeLog({
        instanceId: instance.id,
        stepOrder: currentNode.stepOrder,
        nodeName: currentNode.nodeName,
        operatorId: instance.initiatorId,
        operatorName: instance.initiatorName,
        operatorRole: 'SYSTEM',
        action: ApprovalAction.CC,
        comment: '系统自动抄送',
        fromStatus: InstanceStatus.PENDING,
        toStatus: InstanceStatus.PENDING,
      });

      // 推进到下一步
      if (instance.currentStep >= instance.totalSteps) {
        instance.status = InstanceStatus.APPROVED;
        instance.finishedAt = new Date();
        await this.instanceRepo.save(instance);
        break;
      } else {
        instance.currentStep += 1;
        await this.instanceRepo.save(instance);
      }
    }
  }

  /**
   * 写入审批日志
   */
  private async writeLog(params: {
    instanceId: number;
    stepOrder: number;
    nodeName: string | null;
    operatorId: number;
    operatorName: string | null;
    operatorRole: string | null;
    action: ApprovalAction;
    comment: string | null;
    fromStatus: string | null;
    toStatus: string | null;
  }): Promise<ApprovalLog> {
    const log = this.logRepo.create({
      instanceId: params.instanceId,
      stepOrder: params.stepOrder,
      nodeName: params.nodeName,
      operatorId: params.operatorId,
      operatorName: params.operatorName,
      operatorRole: params.operatorRole,
      action: params.action,
      comment: params.comment,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
    });
    return this.logRepo.save(log);
  }
}
