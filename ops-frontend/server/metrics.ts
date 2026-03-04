/**
 * RC4 Epic 4: Prometheus 指标暴露
 * 
 * 暴露 /metrics 端点，供 Prometheus 采集：
 * - HTTP 请求计数（按方法、路径、状态码）
 * - HTTP 请求延迟直方图
 * - 活跃连接数
 * - Node.js 运行时指标（内存、CPU、事件循环延迟）
 */

import express, { Request, Response, NextFunction } from 'express';

// ============================================================
// 指标存储（轻量级实现，无需 prom-client 依赖）
// ============================================================

interface MetricCounter {
  [key: string]: number;
}

interface HistogramBucket {
  le: number;
  count: number;
}

const httpRequestsTotal: MetricCounter = {};
const httpRequestDurationBuckets: { [key: string]: HistogramBucket[] } = {};
const httpRequestDurationSum: MetricCounter = {};
const httpRequestDurationCount: MetricCounter = {};
let activeConnections = 0;
const startTime = Date.now();

const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

function getKey(method: string, path: string, status: number): string {
  // 归一化路径（去除 ID 参数）
  const normalizedPath = path
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
    .split('?')[0];
  return `${method}|${normalizedPath}|${status}`;
}

function recordRequest(method: string, path: string, status: number, durationSec: number) {
  const key = getKey(method, path, status);
  
  // Counter
  httpRequestsTotal[key] = (httpRequestsTotal[key] || 0) + 1;
  
  // Histogram
  if (!httpRequestDurationBuckets[key]) {
    httpRequestDurationBuckets[key] = BUCKETS.map(le => ({ le, count: 0 }));
  }
  for (const bucket of httpRequestDurationBuckets[key]) {
    if (durationSec <= bucket.le) {
      bucket.count++;
    }
  }
  httpRequestDurationSum[key] = (httpRequestDurationSum[key] || 0) + durationSec;
  httpRequestDurationCount[key] = (httpRequestDurationCount[key] || 0) + 1;
}

// ============================================================
// Prometheus 文本格式输出
// ============================================================

function formatMetrics(): string {
  const lines: string[] = [];
  
  // 进程运行时间
  const uptimeSec = (Date.now() - startTime) / 1000;
  lines.push('# HELP process_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${uptimeSec.toFixed(2)}`);
  
  // Node.js 内存
  const mem = process.memoryUsage();
  lines.push('# HELP nodejs_heap_used_bytes Node.js heap used bytes');
  lines.push('# TYPE nodejs_heap_used_bytes gauge');
  lines.push(`nodejs_heap_used_bytes ${mem.heapUsed}`);
  
  lines.push('# HELP nodejs_heap_total_bytes Node.js heap total bytes');
  lines.push('# TYPE nodejs_heap_total_bytes gauge');
  lines.push(`nodejs_heap_total_bytes ${mem.heapTotal}`);
  
  lines.push('# HELP nodejs_rss_bytes Node.js RSS bytes');
  lines.push('# TYPE nodejs_rss_bytes gauge');
  lines.push(`nodejs_rss_bytes ${mem.rss}`);
  
  lines.push('# HELP nodejs_external_bytes Node.js external memory bytes');
  lines.push('# TYPE nodejs_external_bytes gauge');
  lines.push(`nodejs_external_bytes ${mem.external}`);
  
  // 活跃连接
  lines.push('# HELP http_active_connections Current active HTTP connections');
  lines.push('# TYPE http_active_connections gauge');
  lines.push(`http_active_connections ${activeConnections}`);
  
  // HTTP 请求计数
  lines.push('# HELP http_requests_total Total HTTP requests');
  lines.push('# TYPE http_requests_total counter');
  for (const [key, count] of Object.entries(httpRequestsTotal)) {
    const [method, path, status] = key.split('|');
    lines.push(`http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`);
  }
  
  // HTTP 请求延迟直方图
  lines.push('# HELP http_request_duration_seconds HTTP request duration in seconds');
  lines.push('# TYPE http_request_duration_seconds histogram');
  for (const [key, buckets] of Object.entries(httpRequestDurationBuckets)) {
    const [method, path, status] = key.split('|');
    const labels = `method="${method}",path="${path}",status="${status}"`;
    for (const bucket of buckets) {
      lines.push(`http_request_duration_seconds_bucket{${labels},le="${bucket.le}"} ${bucket.count}`);
    }
    lines.push(`http_request_duration_seconds_bucket{${labels},le="+Inf"} ${httpRequestDurationCount[key]}`);
    lines.push(`http_request_duration_seconds_sum{${labels}} ${(httpRequestDurationSum[key] || 0).toFixed(6)}`);
    lines.push(`http_request_duration_seconds_count{${labels}} ${httpRequestDurationCount[key]}`);
  }
  
  return lines.join('\n') + '\n';
}

// ============================================================
// Express 中间件 + 路由注册
// ============================================================

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  // 跳过 /metrics 自身和静态资源
  if (req.path === '/metrics' || req.path.startsWith('/@') || req.path.startsWith('/node_modules')) {
    return next();
  }
  
  activeConnections++;
  const start = process.hrtime.bigint();
  
  res.on('finish', () => {
    activeConnections--;
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;
    recordRequest(req.method, req.path, res.statusCode, durationSec);
  });
  
  next();
}

export function registerMetricsRoute(app: express.Application) {
  app.get('/metrics', (_req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(formatMetrics());
  });
  
  console.log('[Metrics] Prometheus metrics endpoint registered: /metrics');
}
