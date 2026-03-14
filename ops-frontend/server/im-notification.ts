/**
 * IM 消息推送路由服务 (RC2 - 生产级 Redis BullMQ)
 * 
 * 架构：
 * - 当有重要审批/预警时，判断用户是否绑定了 IM 账号
 * - 若绑定，通过 BullMQ 异步队列（Redis 持久化）调用企业微信/钉钉"发送应用消息 API"
 * - 通过 REDIS_URL 环境变量控制：有 Redis 则使用 BullMQ，无则降级为内存队列
 * - 断电不丢数据：Redis 队列中的任务在服务重启后自动被 Worker 重新拾取
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
// 统一队列接口 (Strategy Pattern)
// ============================================================

interface QueueJob {
  id: string;
  payload: IMNotificationPayload;
  addedAt: Date;
  status: "pending" | "processing" | "done" | "failed";
  result?: IMPushResult;
  retryCount?: number;
}

interface IPushQueue {
  add(name: string, payload: IMNotificationPayload): Promise<string>;
  getJob(jobId: string): QueueJob | undefined;
  getRecentJobs(limit?: number): QueueJob[];
  close(): Promise<void>;
}

// ============================================================
// Redis BullMQ 持久化队列实现
// ============================================================

let bullmqModule: any = null;
let ioredisModule: any = null;

async function loadBullMQ() {
  if (!bullmqModule) {
    try {
      bullmqModule = await import("bullmq");
      ioredisModule = await import("ioredis");
    } catch {
      return null;
    }
  }
  return bullmqModule;
}

class RedisBullMQQueue implements IPushQueue {
  private queue: any;
  private worker: any;
  private connection: any;
  private jobCache = new Map<string, QueueJob>();
  private recentJobIds: string[] = [];

  constructor(private redisUrl: string) {}

  async initialize(): Promise<void> {
    const IORedis = ioredisModule.default || ioredisModule;
    this.connection = new IORedis(this.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    const { Queue, Worker } = bullmqModule;

    this.queue = new Queue("im-push", {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });

    // Worker 消费队列任务
    const workerConnection = new IORedis(this.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.worker = new Worker(
      "im-push",
      async (job: any) => {
        const payload: IMNotificationPayload = job.data;
        console.log(`[BullMQ-Redis] Processing job: id=${job.id}, event=${payload.event}, userId=${payload.userId}, attempt=${job.attemptsMade + 1}`);

        const cached = this.jobCache.get(job.id!);
        if (cached) cached.status = "processing";

        const result = await sendIMPushDirect(payload);

        if (cached) {
          cached.status = result.success ? "done" : "failed";
          cached.result = result;
        }

        if (!result.success) {
          throw new Error(`Push failed: ${result.error || "unknown"}`);
        }

        console.log(`[BullMQ-Redis] Job completed: id=${job.id}, channel=${result.channel}`);
        return result;
      },
      {
        connection: workerConnection,
        concurrency: 5,
        limiter: { max: 100, duration: 60000 },
      }
    );

    this.worker.on("failed", (job: any, err: any) => {
      console.error(`[BullMQ-Redis] Job failed permanently: id=${job?.id}, error=${err.message}`);
      const cached = this.jobCache.get(job?.id);
      if (cached) cached.status = "failed";
    });

    this.worker.on("error", (err: any) => {
      console.error(`[BullMQ-Redis] Worker error: ${err.message}`);
    });

    console.log("[BullMQ-Redis] ✓ Queue and Worker initialized with Redis persistence");
  }

  async add(name: string, payload: IMNotificationPayload): Promise<string> {
    const priority = payload.priority === "HIGH" ? 1 : payload.priority === "NORMAL" ? 5 : 10;
    const job = await this.queue.add(name, payload, { priority });
    const jobId = job.id!;

    const queueJob: QueueJob = {
      id: jobId,
      payload,
      addedAt: new Date(),
      status: "pending",
      retryCount: 0,
    };
    this.jobCache.set(jobId, queueJob);
    this.recentJobIds.push(jobId);
    if (this.recentJobIds.length > 200) {
      const removed = this.recentJobIds.shift()!;
      this.jobCache.delete(removed);
    }

    console.log(`[BullMQ-Redis] Job enqueued: id=${jobId}, event=${payload.event}, userId=${payload.userId}, priority=${priority}`);
    return jobId;
  }

  getJob(jobId: string): QueueJob | undefined {
    return this.jobCache.get(jobId);
  }

  getRecentJobs(limit = 20): QueueJob[] {
    return this.recentJobIds
      .slice(-limit)
      .reverse()
      .map(id => this.jobCache.get(id)!)
      .filter(Boolean);
  }

  async close(): Promise<void> {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
    if (this.connection) await this.connection.quit();
    console.log("[BullMQ-Redis] ✓ Queue and Worker closed");
  }
}

// ============================================================
// 内存队列降级实现（无 Redis 时自动使用）
// ============================================================

class InMemoryFallbackQueue implements IPushQueue {
  private jobs: QueueJob[] = [];

  async add(name: string, payload: IMNotificationPayload): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job: QueueJob = {
      id: jobId,
      payload,
      addedAt: new Date(),
      status: "pending",
    };
    this.jobs.push(job);
    console.log(`[BullMQ-Fallback] Job enqueued (in-memory): id=${jobId}, event=${payload.event}, userId=${payload.userId}`);

    // 异步处理
    setImmediate(async () => {
      job.status = "processing";
      try {
        const result = await sendIMPushDirect(job.payload);
        job.status = "done";
        job.result = result;
        console.log(`[BullMQ-Fallback] Job completed: id=${jobId}, channel=${result.channel}`);
      } catch (err: any) {
        job.status = "failed";
        console.error(`[BullMQ-Fallback] Job failed: id=${jobId}, error=${err.message}`);
      }
    });

    return jobId;
  }

  getJob(jobId: string): QueueJob | undefined {
    return this.jobs.find(j => j.id === jobId);
  }

  getRecentJobs(limit = 20): QueueJob[] {
    return this.jobs.slice(-limit).reverse();
  }

  async close(): Promise<void> {
    this.jobs = [];
  }
}

// ============================================================
// 队列工厂：根据环境自动选择 Redis 或内存
// ============================================================

let _queue: IPushQueue | null = null;

export async function getQueue(): Promise<IPushQueue> {
  if (_queue) return _queue;

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const bm = await loadBullMQ();
      if (bm) {
        const rq = new RedisBullMQQueue(redisUrl);
        await rq.initialize();
        _queue = rq;
        console.log("[Queue Factory] ✓ Using Redis BullMQ persistent queue");
        return _queue;
      }
    } catch (err: any) {
      console.warn(`[Queue Factory] Redis BullMQ init failed (${err.message}), falling back to in-memory`);
    }
  }

  console.log("[Queue Factory] Using in-memory fallback queue (no REDIS_URL or bullmq not available)");
  _queue = new InMemoryFallbackQueue();
  return _queue;
}

// 同步访问（用于 getRecentPushLogs 等不需要 await 的场景）
export function getQueueSync(): IPushQueue | null {
  return _queue;
}

// 导出兼容旧接口的 imPushQueue（延迟初始化）
export const imPushQueue = {
  async add(name: string, payload: IMNotificationPayload): Promise<string> {
    const q = await getQueue();
    return q.add(name, payload);
  },
  getJob(jobId: string): QueueJob | undefined {
    return _queue?.getJob(jobId);
  },
  getRecentJobs(limit = 20): QueueJob[] {
    return _queue?.getRecentJobs(limit) || [];
  },
};

// ============================================================
// 真实 IM Webhook 调用（RC2 生产级）
// 通过环境变量 IM_MODE 切换 mock/real：
//   IM_MODE=real  → 调用真实 API
//   IM_MODE=mock  → 使用 Mock 模拟（默认）
// ============================================================

function getIMMode(): "real" | "mock" {
  return (process.env.IM_MODE === "real") ? "real" : "mock";
}

/**
 * 企业微信发送应用消息
 * 真实接口：POST https://qyapi.weixin.qq.com/cgi-bin/message/send
 */
async function sendWECOMMessage(
  unionid: string,
  title: string,
  content: string,
  bizId?: string
): Promise<{ errcode: number; errmsg: string; webhookUrl: string; requestBody: object }> {
  const mode = getIMMode();
  const wecomCorpId = process.env.WECOM_CORP_ID || "";
  const wecomCorpSecret = process.env.WECOM_CORP_SECRET || "";
  const wecomAgentId = process.env.WECOM_AGENT_ID || "1000001";

  const requestBody = {
    touser: unionid,
    msgtype: "textcard",
    agentid: parseInt(wecomAgentId),
    textcard: {
      title,
      description: content,
      url: bizId ? `https://salesops.company.com/orders/${bizId}` : "https://salesops.company.com",
      btntxt: "查看详情",
    },
  };

  if (mode === "real" && wecomCorpId && wecomCorpSecret) {
    // 真实模式：先获取 access_token，再发送消息
    console.log(`[IM-Push] WECOM Real API: Fetching access_token for corpId=${wecomCorpId}`);
    const tokenResp = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${wecomCorpId}&corpsecret=${wecomCorpSecret}`
    );
    const tokenData = await tokenResp.json() as any;

    if (tokenData.errcode !== 0) {
      throw new Error(`WECOM token error: ${tokenData.errmsg}`);
    }

    const webhookUrl = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${tokenData.access_token}`;
    console.log(`[IM-Push] WECOM Real Webhook POST → ${webhookUrl}`);

    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const result = await resp.json() as any;
    console.log(`[IM-Push] WECOM Real Response: ${JSON.stringify(result)}`);

    return { ...result, webhookUrl, requestBody };
  }

  // Mock 模式
  const webhookUrl = "https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=MOCK_TOKEN";
  console.log(`[IM-Push] WECOM Mock Webhook POST → ${webhookUrl}`);
  console.log(`[IM-Push] WECOM Request Body:`, JSON.stringify(requestBody, null, 2));
  await new Promise(resolve => setTimeout(resolve, 50));
  console.log(`[IM-Push] WECOM Mock Response: {"errcode":0,"errmsg":"ok"}`);

  return { errcode: 0, errmsg: "ok", webhookUrl, requestBody };
}

/**
 * 钉钉发送工作通知
 * 真实接口：POST https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2
 */
async function sendDINGTALKMessage(
  unionid: string,
  title: string,
  content: string,
  bizId?: string
): Promise<{ errcode: number; errmsg: string; webhookUrl: string; requestBody: object }> {
  const mode = getIMMode();
  const dingAppKey = process.env.DINGTALK_APP_KEY || "";
  const dingAppSecret = process.env.DINGTALK_APP_SECRET || "";
  const dingAgentId = process.env.DINGTALK_AGENT_ID || "2000001";

  const requestBody = {
    agent_id: parseInt(dingAgentId),
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

  if (mode === "real" && dingAppKey && dingAppSecret) {
    // 真实模式：先获取 access_token，再发送消息
    console.log(`[IM-Push] DINGTALK Real API: Fetching access_token for appKey=${dingAppKey}`);
    const tokenResp = await fetch(
      `https://oapi.dingtalk.com/gettoken?appkey=${dingAppKey}&appsecret=${dingAppSecret}`
    );
    const tokenData = await tokenResp.json() as any;

    if (tokenData.errcode !== 0) {
      throw new Error(`DINGTALK token error: ${tokenData.errmsg}`);
    }

    const webhookUrl = `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${tokenData.access_token}`;
    console.log(`[IM-Push] DINGTALK Real Webhook POST → ${webhookUrl}`);

    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const result = await resp.json() as any;
    console.log(`[IM-Push] DINGTALK Real Response: ${JSON.stringify(result)}`);

    return { ...result, webhookUrl, requestBody };
  }

  // Mock 模式
  const webhookUrl = "https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2";
  console.log(`[IM-Push] DINGTALK Mock Webhook POST → ${webhookUrl}`);
  console.log(`[IM-Push] DINGTALK Request Body:`, JSON.stringify(requestBody, null, 2));
  await new Promise(resolve => setTimeout(resolve, 50));
  console.log(`[IM-Push] DINGTALK Mock Response: {"errcode":0,"errmsg":"ok"}`);

  return { errcode: 0, errmsg: "ok", webhookUrl, requestBody };
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
    let result: { errcode: number; errmsg: string; webhookUrl: string; requestBody: object };

    if (imProvider === "WECOM") {
      result = await sendWECOMMessage(imUnionid, title, content, bizId);
    } else {
      result = await sendDINGTALKMessage(imUnionid, title, content, bizId);
    }

    const responseStatus = result.errcode === 0 ? 200 : 400;
    console.log(`[IM-Push] ✓ Push sent via ${imProvider}: userId=${userId}, status=${responseStatus}`);

    return {
      success: responseStatus === 200,
      channel: imProvider,
      provider: imProvider,
      webhookUrl: result.webhookUrl,
      requestBody: result.requestBody,
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

/**
 * 优雅关闭队列（用于进程退出时）
 */
export async function shutdownQueue(): Promise<void> {
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
}
