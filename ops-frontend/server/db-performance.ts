/**
 * 数据库性能调优模块 (Epic 3)
 * 
 * 1. 联合索引建议与自动创建
 * 2. Redis 查询缓存（字典/枚举等低变动数据）
 * 3. 慢查询分析与监控
 */

import IORedis from 'ioredis';

// ==================== Redis 缓存层 ====================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_PREFIX = 'ops:cache:';
const DEFAULT_TTL = 300; // 5 分钟

let redisClient: IORedis | null = null;
let redisAvailable = false;

/**
 * 获取 Redis 客户端（惰性初始化，连接失败时降级为内存缓存）
 */
function getRedisClient(): IORedis | null {
  if (redisClient) return redisAvailable ? redisClient : null;
  
  try {
    redisClient = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 3) return null; // 3 次重试后放弃
        return Math.min(times * 200, 2000);
      },
      connectTimeout: 3000,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      redisAvailable = true;
      console.log('[DB-Performance] Redis cache connected');
    });

    redisClient.on('error', (err) => {
      redisAvailable = false;
      console.warn('[DB-Performance] Redis cache unavailable, falling back to in-memory:', err.message);
    });

    redisClient.connect().catch(() => {
      redisAvailable = false;
    });

    return redisClient;
  } catch {
    redisAvailable = false;
    return null;
  }
}

// 内存缓存降级方案
const memoryCache = new Map<string, { data: any; expireAt: number }>();

/**
 * 通用缓存读取（Redis 优先，降级内存缓存）
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const fullKey = CACHE_PREFIX + key;
  
  // 尝试 Redis
  const redis = getRedisClient();
  if (redis && redisAvailable) {
    try {
      const cached = await redis.get(fullKey);
      if (cached) {
        console.log(`[Cache HIT] Redis: ${key}`);
        return JSON.parse(cached) as T;
      }
    } catch {
      // Redis 失败，降级
    }
  }

  // 降级内存缓存
  const memEntry = memoryCache.get(fullKey);
  if (memEntry && memEntry.expireAt > Date.now()) {
    console.log(`[Cache HIT] Memory: ${key}`);
    return memEntry.data as T;
  }
  
  if (memEntry) memoryCache.delete(fullKey);
  return null;
}

/**
 * 通用缓存写入（Redis 优先，降级内存缓存）
 */
export async function cacheSet(key: string, data: any, ttlSeconds: number = DEFAULT_TTL): Promise<void> {
  const fullKey = CACHE_PREFIX + key;
  const serialized = JSON.stringify(data);

  // 尝试 Redis
  const redis = getRedisClient();
  if (redis && redisAvailable) {
    try {
      await redis.setex(fullKey, ttlSeconds, serialized);
      console.log(`[Cache SET] Redis: ${key} (TTL: ${ttlSeconds}s)`);
      return;
    } catch {
      // Redis 失败，降级
    }
  }

  // 降级内存缓存
  memoryCache.set(fullKey, {
    data,
    expireAt: Date.now() + ttlSeconds * 1000,
  });
  console.log(`[Cache SET] Memory: ${key} (TTL: ${ttlSeconds}s)`);
}

/**
 * 缓存失效
 */
export async function cacheInvalidate(pattern: string): Promise<void> {
  const fullPattern = CACHE_PREFIX + pattern;
  
  // Redis
  const redis = getRedisClient();
  if (redis && redisAvailable) {
    try {
      const keys = await redis.keys(fullPattern.replace('*', '*'));
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`[Cache INVALIDATE] Redis: ${keys.length} keys matching ${pattern}`);
      }
    } catch {
      // ignore
    }
  }

  // 内存缓存
  const keysToDelete = Array.from(memoryCache.keys()).filter(k => 
    k.startsWith(CACHE_PREFIX + pattern.replace('*', ''))
  );
  keysToDelete.forEach(k => memoryCache.delete(k));
}

// ==================== 带缓存的字典查询 ====================

/**
 * 带缓存的字典查询包装器
 * 用于高频且变动极低的数据（数据范围枚举、分类枚举、提成规则等）
 */
export function createCachedQuery<TInput, TOutput>(
  queryName: string,
  queryFn: (input: TInput) => Promise<TOutput>,
  options: {
    ttlSeconds?: number;
    keyGenerator?: (input: TInput) => string;
  } = {}
) {
  const { ttlSeconds = DEFAULT_TTL, keyGenerator } = options;

  return async (input: TInput): Promise<TOutput> => {
    const cacheKey = keyGenerator
      ? `${queryName}:${keyGenerator(input)}`
      : `${queryName}:${JSON.stringify(input)}`;

    // 尝试缓存
    const cached = await cacheGet<TOutput>(cacheKey);
    if (cached !== null) return cached;

    // 缓存未命中，执行查询
    console.log(`[Cache MISS] ${cacheKey}`);
    const result = await queryFn(input);

    // 写入缓存
    await cacheSet(cacheKey, result, ttlSeconds);
    return result;
  };
}

// ==================== 联合索引定义 ====================

/**
 * 高频查询场景的联合索引建议
 * 
 * 这些 SQL 语句应在数据库迁移时执行
 * 针对 6 亿级数据量（4万+ 订单）的查询优化
 */
export const COMPOSITE_INDEX_DEFINITIONS = [
  // ===== orders 表 =====
  {
    table: 'orders',
    indexName: 'idx_orders_org_status_created',
    columns: ['org_id', 'status', 'created_at'],
    purpose: '订单列表页按组织+状态筛选+时间排序（RBAC DataScope 场景）',
    sql: 'CREATE INDEX IF NOT EXISTS idx_orders_org_status_created ON orders (org_id, status, created_at DESC)',
  },
  {
    table: 'orders',
    indexName: 'idx_orders_sales_rep_created',
    columns: ['sales_rep_id', 'created_at'],
    purpose: '销售个人订单查询（我的业绩页面）',
    sql: 'CREATE INDEX IF NOT EXISTS idx_orders_sales_rep_created ON orders (sales_rep_id, created_at DESC)',
  },
  {
    table: 'orders',
    indexName: 'idx_orders_customer_status',
    columns: ['customer_id', 'status'],
    purpose: '客户维度订单聚合（客户详情页、信用评估）',
    sql: 'CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders (customer_id, status)',
  },
  {
    table: 'orders',
    indexName: 'idx_orders_approval_status',
    columns: ['approval_status', 'created_at'],
    purpose: '待审批订单列表（审批工作流）',
    sql: 'CREATE INDEX IF NOT EXISTS idx_orders_approval_status ON orders (approval_status, created_at DESC)',
  },

  // ===== customers 表 =====
  {
    table: 'customers',
    indexName: 'idx_customers_org_category',
    columns: ['org_id', 'category'],
    purpose: '按组织+客户类型筛选（菜市场/商超/电商）',
    sql: 'CREATE INDEX IF NOT EXISTS idx_customers_org_category ON customers (org_id, category)',
  },
  {
    table: 'customers',
    indexName: 'idx_customers_sales_rep',
    columns: ['sales_rep_id', 'status'],
    purpose: '销售负责的客户列表',
    sql: 'CREATE INDEX IF NOT EXISTS idx_customers_sales_rep ON customers (sales_rep_id, status)',
  },

  // ===== order_items 表 =====
  {
    table: 'order_items',
    indexName: 'idx_order_items_order_product',
    columns: ['order_id', 'product_id'],
    purpose: '订单明细查询 + 商品维度聚合',
    sql: 'CREATE INDEX IF NOT EXISTS idx_order_items_order_product ON order_items (order_id, product_id)',
  },

  // ===== invoices 表 =====
  {
    table: 'invoices',
    indexName: 'idx_invoices_org_status_due',
    columns: ['org_id', 'status', 'due_date'],
    purpose: '发票列表页按组织+状态+到期日筛选（逾期回款预警）',
    sql: 'CREATE INDEX IF NOT EXISTS idx_invoices_org_status_due ON invoices (org_id, status, due_date)',
  },

  // ===== payments 表 =====
  {
    table: 'payments',
    indexName: 'idx_payments_org_applied_status',
    columns: ['org_id', 'applied_status', 'paid_at'],
    purpose: '收款列表页按组织+核销状态+打款时间筛选',
    sql: 'CREATE INDEX IF NOT EXISTS idx_payments_org_applied_status ON payments (org_id, applied_status, paid_at DESC)',
  },

  // ===== price_anomalies 表 =====
  {
    table: 'price_anomalies',
    indexName: 'idx_price_anomalies_status_created',
    columns: ['status', 'createdAt'],
    purpose: '反欺诈监控：待处理异常列表',
    sql: 'CREATE INDEX IF NOT EXISTS idx_price_anomalies_status_created ON price_anomalies (status, created_at DESC)',
  },

  // ===== customer_credit_scores 表 =====
  {
    table: 'customer_credit_scores',
    indexName: 'idx_credit_scores_level_score',
    columns: ['creditLevel', 'creditScore'],
    purpose: '信用评级分布统计 + 按等级筛选',
    sql: 'CREATE INDEX IF NOT EXISTS idx_credit_scores_level_score ON customer_credit_scores (credit_level, credit_score DESC)',
  },

  // ===== sales_commissions 表 =====
  {
    table: 'sales_commissions',
    indexName: 'idx_sales_commissions_sales_period',
    columns: ['salesId', 'period'],
    purpose: '销售个人月度提成查询（幂等校验 + 历史查询）',
    sql: 'CREATE INDEX IF NOT EXISTS idx_sales_commissions_sales_period ON sales_commissions (salesId, period)',
  },
  {
    table: 'sales_commissions',
    indexName: 'idx_sales_commissions_status_period',
    columns: ['status', 'period'],
    purpose: '按状态+月份筛选提成列表（财务审批）',
    sql: 'CREATE INDEX IF NOT EXISTS idx_sales_commissions_status_period ON sales_commissions (status, period DESC)',
  },

  // ===== payment_receipts 表 =====
  {
    table: 'payment_receipts',
    indexName: 'idx_payment_receipts_order_status',
    columns: ['orderId', 'status'],
    purpose: '订单维度打款凭证查询',
    sql: 'CREATE INDEX IF NOT EXISTS idx_payment_receipts_order_status ON payment_receipts (orderId, status)',
  },

  // ===== audit_logs 表 =====
  {
    table: 'audit_logs',
    indexName: 'idx_audit_logs_user_action_time',
    columns: ['user_id', 'action', 'created_at'],
    purpose: '用户操作日志查询（审计追溯）',
    sql: 'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action_time ON audit_logs (user_id, action, created_at DESC)',
  },

  // ===== batch_trace 表 =====
  {
    table: 'batch_trace',
    indexName: 'idx_batch_trace_production_quality',
    columns: ['productionDate', 'qualityStatus'],
    purpose: '按生产日期+质检状态筛选批次',
    sql: 'CREATE INDEX IF NOT EXISTS idx_batch_trace_production_quality ON batch_trace (production_date, quality_status)',
  },
];

/**
 * 执行所有联合索引创建（幂等操作）
 * 在生产环境部署时调用
 */
export async function applyCompositeIndexes(executeSQL: (sql: string) => Promise<any>): Promise<{
  applied: string[];
  skipped: string[];
  errors: Array<{ index: string; error: string }>;
}> {
  const applied: string[] = [];
  const skipped: string[] = [];
  const errors: Array<{ index: string; error: string }> = [];

  for (const idx of COMPOSITE_INDEX_DEFINITIONS) {
    try {
      await executeSQL(idx.sql);
      applied.push(idx.indexName);
      console.log(`[Index] Applied: ${idx.indexName} on ${idx.table} — ${idx.purpose}`);
    } catch (err: any) {
      if (err.message?.includes('Duplicate') || err.message?.includes('already exists')) {
        skipped.push(idx.indexName);
      } else if (err.message?.includes("doesn't exist")) {
        // 表不存在（backend 管理的表），跳过
        skipped.push(idx.indexName);
        console.log(`[Index] Skipped (table not found): ${idx.indexName}`);
      } else {
        errors.push({ index: idx.indexName, error: err.message });
        console.error(`[Index] Failed: ${idx.indexName} — ${err.message}`);
      }
    }
  }

  console.log(`[Index] Summary: ${applied.length} applied, ${skipped.length} skipped, ${errors.length} errors`);
  return { applied, skipped, errors };
}

// ==================== 慢查询监控 ====================

interface SlowQueryLog {
  query: string;
  durationMs: number;
  timestamp: Date;
  params?: any;
}

const slowQueryLogs: SlowQueryLog[] = [];
const SLOW_QUERY_THRESHOLD_MS = 500; // 500ms 以上视为慢查询
const MAX_SLOW_QUERY_LOGS = 100;

/**
 * 慢查询监控包装器
 */
export function withSlowQueryMonitor<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  params?: any
): Promise<T> {
  const start = Date.now();
  return queryFn().then(result => {
    const duration = Date.now() - start;
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      const log: SlowQueryLog = {
        query: queryName,
        durationMs: duration,
        timestamp: new Date(),
        params,
      };
      slowQueryLogs.unshift(log);
      if (slowQueryLogs.length > MAX_SLOW_QUERY_LOGS) {
        slowQueryLogs.pop();
      }
      console.warn(`[SLOW QUERY] ${queryName}: ${duration}ms`, params);
    }
    return result;
  });
}

/**
 * 获取慢查询日志
 */
export function getSlowQueryLogs(limit: number = 20): SlowQueryLog[] {
  return slowQueryLogs.slice(0, limit);
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): {
  redisAvailable: boolean;
  memoryCacheSize: number;
  memoryCacheKeys: string[];
} {
  return {
    redisAvailable,
    memoryCacheSize: memoryCache.size,
    memoryCacheKeys: Array.from(memoryCache.keys()).map(k => k.replace(CACHE_PREFIX, '')),
  };
}

/**
 * 清理过期的内存缓存条目
 */
export function cleanupMemoryCache(): number {
  const now = Date.now();
  let cleaned = 0;
  const entries = Array.from(memoryCache.entries());
  for (const [key, entry] of entries) {
    if (entry.expireAt <= now) {
      memoryCache.delete(key);
      cleaned++;
    }
  }
  return cleaned;
}

// 每 60 秒自动清理过期内存缓存
setInterval(() => {
  const cleaned = cleanupMemoryCache();
  if (cleaned > 0) {
    console.log(`[Cache Cleanup] Removed ${cleaned} expired entries`);
  }
}, 60000);
