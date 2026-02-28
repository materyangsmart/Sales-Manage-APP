/**
 * 工作流节点待审批事件
 * 当 WorkflowService.startInstance() 成功创建工作流实例时触发
 * NotificationService 监听此事件，为对应角色的用户生成站内待办通知
 */
export class WorkflowPendingEvent {
  /**
   * 工作流实例 ID
   */
  instanceId: number;

  /**
   * 工作流定义 code（如 'ORDER_DISCOUNT'）
   */
  workflowCode: string;

  /**
   * 工作流定义名称（如 '超低折扣订单审批'）
   */
  workflowName: string;

  /**
   * 当前待审批节点的步骤序号
   */
  currentStep: number;

  /**
   * 当前节点需要审批的角色 ID
   */
  roleId: number;

  /**
   * 业务单据类型（如 'ORDER'）
   */
  businessType: string;

  /**
   * 业务单据 ID
   */
  businessId: number;

  /**
   * 提交人用户 ID
   */
  submittedByUserId: number;

  /**
   * 提交人姓名
   */
  submittedByName: string;

  /**
   * 提交时间
   */
  submittedAt: Date;

  constructor(partial: Partial<WorkflowPendingEvent>) {
    Object.assign(this, partial);
  }
}

/**
 * 事件名称常量
 */
export const WORKFLOW_EVENTS = {
  NODE_PENDING: 'workflow.node.pending',
  INSTANCE_APPROVED: 'workflow.instance.approved',
  INSTANCE_REJECTED: 'workflow.instance.rejected',
} as const;
