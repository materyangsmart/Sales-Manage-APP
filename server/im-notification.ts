/**
 * IM 消息推送路由服务
 * 
 * 架构：
 * - 当有重要审批/预警时，判断用户是否绑定了 IM 账号
 * - 若绑定，通过异步队列（BullMQ 模拟）调用企业微信/钉钉"发送应用消息 API"
 * - 本地使用 Mock HTTP 调用模拟外部 IM Webhook 行为
 * 
 * 注意：BullMQ 需要 Redis。在沙箱环境中使用内存队列模拟 BullMQ 行为，
 * 生产环境替换为真实 BullMQ + Redis 连接。
 */

import * as imSsoModule from "./im-sso";
import type { IMProvider } from "./im-sso";

// ============================================================
// 类型定义
// ============================================================

export type NotificationPriority = "HIGH" | "NORMAL" | "LOW";
export type NotificationEvent =
  | "ORDER_APPROVAL_REQUIRED"
  | "ORDER_APPROVED"
  | "ORDER_REJECTED"
  | "CEO_RADAR_ALERT"
  | "CREDIT_LIMIT_WARNING"
  | "PAYMENT_OVERDUE";

export interface IMNotificationPayload {
  userId: number;
  event: NotificationEvent;
  title: string;
  content: string;
  priority: NotificationPriority;
  bizId?: string;
  bizType?: string;
}

export interface IMPushResult {
  success: boolean;
  channel: "WECOM" | "DINGTALK" | "WEBSOCKET_ONLY";
  provider?: IMProvider;
  webhookUrl?: string;
  requestBody?: object;
  responseStatus?: number;
  error?: string;
  timestamp: string;
}

// ============================================================
// 内存队列（BullMQ 沙箱替代实现）
// 生产环境替换为：
//   import { Queue, Worker } from 'bullmq';
//   const imPushQueue = new Queue('im-push', { connection: redisConnection });
// ============================================================

interface QueueJob {
  id: string;
  payload: IMNotificationPayload;
  addedAt: Date;
  status: "pending" | "processing" | "done" | "failed";
  result?: IMPushResult;
}

class InMemoryQueue {
  private jobs: QueueJob[] = [];
  private processors: Array<(job: QueueJob) => Promise<IMPushResult>> = [];

  async add(name: string, payload: IMNotificationPayload): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job: QueueJob = {
      id: jobId,
      payload,
      addedAt: new Date(),
      status: "pending",
    };
    this.jobs.push(job);
    console.log(`[BullMQ-Mock] Job enqueued: id=${jobId}, event=${payload.event}, userId=${payload.userId}`);

    // 异步处理（模拟 Worker 消费）
    setImmediate(async () => {
      job.status = "processing";
      try {
        const result = await this.process(job);
        job.status = "done";
        job.result = result;
        console.log(`[BullMQ-Mock] Job completed: id=${jobId}, channel=${result.channel}`);
      } catch (err: any) {
        job.status = "failed";
        console.error(`[BullMQ-Mock] Job failed: id=${jobId}, error=${err.message}`);
      }
    });

    return jobId;
  }

  private async process(job: QueueJob): Promise<IMPushResult> {
    return sendIMPushDirect(job.payload);
  }

  getJob(jobId: string): QueueJob | undefined {
    return this.jobs.find(j => j.id === jobId);
  }

  getRecentJobs(limit = 20): QueueJob[] {
    return this.jobs.slice(-limit).reverse();
  }
}

export const imPushQueue = new InMemoryQueue();

// ============================================================
// Mock IM Webhook 调用
// 模拟企业微信/钉钉"发送应用消息"接口
// 生产环境替换为真实 HTTP 请求
// ============================================================

/**
 * Mock 企业微信发送应用消息
 * 真实接口：POST https://qyapi.weixin.qq.com/cgi-bin/message/send
 */
async function mockWECOMSendMessage(
  unionid: string,
  title: string,
  content: string,
  bizId?: string
): Promise<{ errcode: number; errmsg: string }> {
  const webhookUrl = "https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=MOCK_TOKEN";
  const requestBody = {
    touser: unionid,
    msgtype: "textcard",
    agentid: 1000001,
    textcard: {
      title,
      description: content,
      url: bizId ? `https://salesops.company.com/orders/${bizId}` : "https://salesops.company.com",
      btntxt: "查看详情",
    },
  };

  console.log(`[IM-Push] WECOM Mock Webhook POST → ${webhookUrl}`);
  console.log(`[IM-Push] WECOM Request Body:`, JSON.stringify(requestBody, null, 2));

  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 80));

  // 模拟成功响应
  const response = { errcode: 0, errmsg: "ok" };
  console.log(`[IM-Push] WECOM Mock Response: ${JSON.stringify(response)}`);

  return response;
}

/**
 * Mock 钉钉发送工作通知
 * 真实接口：POST https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2
 */
async function mockDINGTALKSendMessage(
  unionid: string,
  title: string,
  content: string,
  bizId?: string
): Promise<{ errcode: number; errmsg: string }> {
  const webhookUrl = "https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2";
  const requestBody = {
    agent_id: 2000001,
    userid_list: unionid,
    msg: {
      msgtype: "action_card",
      action_card: {
        title,
        markdown: `**${title}**\n\n${content}`,
        single_title: "查看详情",
        single_url: bizId ? `https://salesops.company.com/orders/${bizId}` : "https://salesops.company.com",
      },
    },
  };

  console.log(`[IM-Push] DINGTALK Mock Webhook POST → ${webhookUrl}`);
  console.log(`[IM-Push] DINGTALK Request Body:`, JSON.stringify(requestBody, null, 2));

  await new Promise(resolve => setTimeout(resolve, 80));

  const response = { errcode: 0, errmsg: "ok" };
  console.log(`[IM-Push] DINGTALK Mock Response: ${JSON.stringify(response)}`);

  return response;
}

// ============================================================
// 核心推送路由逻辑
// ============================================================

/**
 * 直接执行 IM 推送（由队列 Worker 调用）
 */
async function sendIMPushDirect(payload: IMNotificationPayload): Promise<IMPushResult> {
  const { userId, title, content, bizId, event } = payload;
  const timestamp = new Date().toISOString();

  // 查询用户 IM 绑定信息
  const imBinding = await imSsoModule.getUserIMBinding(userId);

  if (!imBinding) {
    console.log(`[IM-Push] User ${userId} has no IM binding, skipping IM push (WebSocket only)`);
    return {
      success: true,
      channel: "WEBSOCKET_ONLY",
      timestamp,
    };
  }

  const { imUnionid, imProvider } = imBinding;
  console.log(`[IM-Push] Routing to ${imProvider}: userId=${userId}, unionid=${imUnionid}, event=${event}`);

  try {
    let webhookUrl: string;
    let requestBody: object;
    let responseStatus: number;

    if (imProvider === "WECOM") {
      webhookUrl = "https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=MOCK_TOKEN";
      requestBody = {
        touser: imUnionid,
        msgtype: "textcard",
        agentid: 1000001,
        textcard: { title, description: content, url: bizId ? `https://salesops.company.com/orders/${bizId}` : "https://salesops.company.com", btntxt: "查看详情" },
      };
      const resp = await mockWECOMSendMessage(imUnionid, title, content, bizId);
      responseStatus = resp.errcode === 0 ? 200 : 400;
    } else {
      webhookUrl = "https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2";
      requestBody = {
        agent_id: 2000001,
        userid_list: imUnionid,
        msg: { msgtype: "action_card", action_card: { title, markdown: `**${title}**\n\n${content}` } },
      };
      const resp = await mockDINGTALKSendMessage(imUnionid, title, content, bizId);
      responseStatus = resp.errcode === 0 ? 200 : 400;
    }

    console.log(`[IM-Push] ✓ Push sent via ${imProvider}: userId=${userId}, status=${responseStatus}`);

    return {
      success: responseStatus === 200,
      channel: imProvider,
      provider: imProvider,
      webhookUrl,
      requestBody,
      responseStatus,
      timestamp,
    };
  } catch (err: any) {
    console.error(`[IM-Push] ✗ Push failed: userId=${userId}, error=${err.message}`);
    return {
      success: false,
      channel: imProvider,
      provider: imProvider,
      error: err.message,
      timestamp,
    };
  }
}

/**
 * 主推送入口：将消息加入异步队列
 * 
 * 调用方式：
 *   await routeIMNotification({ userId: 1, event: 'CEO_RADAR_ALERT', title: '...', content: '...', priority: 'HIGH' });
 */
export async function routeIMNotification(payload: IMNotificationPayload): Promise<string> {
  console.log(`[IM-Push] Enqueuing notification: event=${payload.event}, userId=${payload.userId}, priority=${payload.priority}`);
  const jobId = await imPushQueue.add("im-push", payload);
  return jobId;
}

/**
 * 同步推送（用于测试和紧急场景）
 */
export async function routeIMNotificationSync(payload: IMNotificationPayload): Promise<IMPushResult> {
  console.log(`[IM-Push] Sync push: event=${payload.event}, userId=${payload.userId}`);
  return sendIMPushDirect(payload);
}

/**
 * 获取最近推送日志（用于管理界面和验收测试）
 */
export function getRecentPushLogs(limit = 20): Array<{
  id: string;
  payload: IMNotificationPayload;
  status: string;
  result?: IMPushResult;
  addedAt: Date;
}> {
  return imPushQueue.getRecentJobs(limit).map(j => ({
    id: j.id,
    payload: j.payload,
    status: j.status,
    result: j.result,
    addedAt: j.addedAt,
  }));
}
