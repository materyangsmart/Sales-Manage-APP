/**
 * Open API Gateway (RC3 Epic 1)
 * 
 * 面向外部合作伙伴和官网的公开 API：
 * - GET  /api/v1/products           商品目录查询（支持分类筛选+分页）
 * - POST /api/v1/leads              意向线索收集
 * - GET  /api/v1/traceability/:batch_no  批次溯源查询
 * - GET  /api/v1/docs               Swagger API 文档（HTML）
 * 
 * 安全机制：
 * - 全局限流：每 IP 每分钟 60 次请求
 * - CORS 白名单：仅允许配置的域名
 * - 统一响应格式：{ code: number, data: any, msg: string }
 */

import express, { Request, Response, NextFunction } from 'express';
import { getDb } from './db';
import { productCatalog, leads, batchTrace } from '../drizzle/schema';
import { eq, and, like, sql, desc } from 'drizzle-orm';

// ==================== 限流器 ====================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 分钟
const RATE_LIMIT_MAX = 60; // 每分钟 60 次

// 定期清理过期条目
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Array.from(rateLimitStore.entries())) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let entry = rateLimitStore.get(clientIP);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(clientIP, entry);
  }

  entry.count++;

  // 设置限流响应头
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - entry.count).toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

  if (entry.count > RATE_LIMIT_MAX) {
    console.warn(`[Open API] Rate limit exceeded for IP: ${clientIP} (${entry.count}/${RATE_LIMIT_MAX})`);
    res.status(429).json({
      code: 429,
      data: null,
      msg: '请求过于频繁，请稍后再试 (Rate limit: 60 requests per minute)',
    });
    return;
  }

  next();
}

// ==================== CORS 白名单 ====================

const CORS_WHITELIST = [
  'https://salesops-8qptles6.manus.space',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://*.manus.space',
  'https://*.manus.computer',
];

function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin || '';

  const isAllowed = CORS_WHITELIST.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '[^.]+') + '$');
      return regex.test(origin);
    }
    return pattern === origin;
  });

  if (isAllowed || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

// ==================== 统一响应格式 ====================

function success<T>(data: T, msg: string = 'OK') {
  return { code: 0, data, msg };
}

function error(code: number, msg: string) {
  return { code, data: null, msg };
}

// ==================== API 路由 ====================

/**
 * GET /api/v1/products
 * 商品目录查询（支持分类筛选+分页）
 */
async function handleGetProducts(req: Request, res: Response) {
  try {
    const { category, specification, page = '1', pageSize = '20', keyword } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(pageSize as string) || 20));
    const offset = (pageNum - 1) * limit;

    console.log(`[Open API] GET /products - category=${category}, spec=${specification}, page=${pageNum}, pageSize=${limit}`);

    const conditions: any[] = [eq(productCatalog.isActive, true)];

    if (category && ['THIN', 'MEDIUM', 'THICK'].includes(category as string)) {
      conditions.push(eq(productCatalog.category, category as 'THIN' | 'MEDIUM' | 'THICK'));
    }

    if (specification) {
      conditions.push(eq(productCatalog.specification, specification as string));
    }

    if (keyword) {
      conditions.push(like(productCatalog.name, `%${keyword}%`));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const db = await getDb();
    if (!db) {
      res.status(503).json(error(503, '数据库连接不可用'));
      return;
    }

    const [items, countResult] = await Promise.all([
      db.select().from(productCatalog).where(whereClause).orderBy(productCatalog.category, productCatalog.unitPrice).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(productCatalog).where(whereClause),
    ]);

    const total = countResult[0]?.count || 0;
    const categoryLabels: Record<string, string> = { THIN: '薄千张', MEDIUM: '中厚千张', THICK: '厚千张' };

    res.json(success({
      items: items.map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        categoryLabel: categoryLabels[p.category] || p.category,
        specification: p.specification,
        unitPrice: parseFloat(p.unitPrice),
        unit: p.unit,
        description: p.description,
        imageUrl: p.imageUrl,
        minOrderQuantity: p.minOrderQuantity,
      })),
      pagination: {
        page: pageNum,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }));
  } catch (err: any) {
    console.error('[Open API] GET /products error:', err.message);
    res.status(500).json(error(500, '服务器内部错误'));
  }
}

/**
 * POST /api/v1/leads
 * 意向线索收集
 */
async function handleCreateLead(req: Request, res: Response) {
  try {
    const { companyName, contactName, contactPhone, contactEmail, businessType, estimatedMonthlyVolume, region, message: msg } = req.body;

    // 参数校验
    if (!companyName || !contactName || !contactPhone) {
      res.status(400).json(error(400, '公司名称、联系人姓名、联系电话为必填项'));
      return;
    }

    // 手机号格式校验
    if (!/^1[3-9]\d{9}$/.test(contactPhone)) {
      res.status(400).json(error(400, '请输入有效的手机号码'));
      return;
    }

    // 邮箱格式校验（可选字段）
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      res.status(400).json(error(400, '请输入有效的邮箱地址'));
      return;
    }

    console.log(`[Open API] POST /leads - company=${companyName}, contact=${contactName}, phone=${contactPhone}`);

    const db = await getDb();
    if (!db) {
      res.status(503).json(error(503, '数据库连接不可用'));
      return;
    }

    const result = await db.insert(leads).values({
      companyName,
      contactName,
      contactPhone,
      contactEmail: contactEmail || null,
      businessType: businessType || 'OTHER',
      estimatedMonthlyVolume: estimatedMonthlyVolume || null,
      region: region || null,
      message: msg || null,
      source: 'WEBSITE',
      status: 'NEW',
    });

    const leadId = result[0].insertId;

    console.log(`[Open API] Lead created: id=${leadId}`);

    res.status(201).json(success({
      leadId,
      message: '感谢您的咨询，我们的销售团队将在24小时内与您联系',
    }));
  } catch (err: any) {
    console.error('[Open API] POST /leads error:', err.message);
    res.status(500).json(error(500, '提交失败，请稍后再试'));
  }
}

/**
 * GET /api/v1/traceability/:batch_no
 * 批次溯源查询
 */
async function handleTraceability(req: Request, res: Response) {
  try {
    const { batch_no } = req.params;

    if (!batch_no) {
      res.status(400).json(error(400, '批次号不能为空'));
      return;
    }

    console.log(`[Open API] GET /traceability/${batch_no}`);

    // 先查本地 batch_trace 表
    const db = await getDb();
    const localTrace = db ? await db.select().from(batchTrace).where(eq(batchTrace.batchNo, batch_no)).limit(1) : [];

    if (localTrace.length > 0) {
      const trace = localTrace[0];
      res.json(success({
        batchNo: trace.batchNo,
        production: {
          date: trace.productionDate,
          soybeanBatch: trace.soybeanBatch,
          soybeanSupplier: trace.soybeanSupplier,
          soybeanWeight: parseFloat(trace.soybeanWeight),
          waterQualityReport: trace.waterQualityReport,
          productOutput: parseFloat(trace.productOutput),
          yieldRate: parseFloat(trace.yieldRate),
          workshopTemp: trace.workshopTemp ? parseFloat(trace.workshopTemp) : null,
          sterilizationParams: trace.sterilizationParams,
        },
        quality: {
          inspectorId: trace.inspectorId,
          inspectorName: trace.inspectorName,
          status: trace.qualityStatus,
          statusLabel: trace.qualityStatus === 'PASS' ? '质检合格' : '质检不合格',
        },
        createdAt: trace.createdAt,
      }));
      return;
    }

    // 降级到后端 API 查询
    try {
      const { traceabilityAPI } = await import('./backend-api');
      const backendTrace = await traceabilityAPI.getTraceData(batch_no);
      if (backendTrace) {
        res.json(success(backendTrace));
        return;
      }
    } catch {
      // 后端不可用，继续返回 404
    }

    res.status(404).json(error(404, `未找到批次号 ${batch_no} 的溯源信息`));
  } catch (err: any) {
    console.error('[Open API] GET /traceability error:', err.message);
    res.status(500).json(error(500, '查询失败，请稍后再试'));
  }
}

/**
 * GET /api/v1/docs
 * Swagger API 文档（内联 HTML）
 */
function handleSwaggerDocs(_req: Request, res: Response) {
  const swaggerSpec = {
    openapi: '3.0.3',
    info: {
      title: '千张销售管理系统 - Open API',
      description: '面向外部合作伙伴的公开 API，提供商品查询、意向线索收集和批次溯源功能。',
      version: '1.0.0',
      contact: {
        name: '千张销售技术团队',
        email: 'api@qianzhang.com',
      },
    },
    servers: [
      { url: '/api/v1', description: '生产环境' },
    ],
    paths: {
      '/products': {
        get: {
          summary: '商品目录查询',
          description: '查询千张商品目录，支持按品类、规格筛选和分页',
          tags: ['商品'],
          parameters: [
            { name: 'category', in: 'query', schema: { type: 'string', enum: ['THIN', 'MEDIUM', 'THICK'] }, description: '品类筛选：THIN(薄)、MEDIUM(中厚)、THICK(厚)' },
            { name: 'specification', in: 'query', schema: { type: 'string' }, description: '规格筛选：160g、500g、2500g、5000g' },
            { name: 'keyword', in: 'query', schema: { type: 'string' }, description: '关键词搜索' },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: '页码' },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 }, description: '每页数量' },
          ],
          responses: {
            '200': {
              description: '成功',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductListResponse' } } },
            },
            '429': { description: '请求过于频繁' },
          },
        },
      },
      '/leads': {
        post: {
          summary: '提交意向线索',
          description: '收集潜在客户的合作意向信息，销售团队将在24小时内联系',
          tags: ['线索'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateLeadRequest' },
                example: {
                  companyName: '张记豆腐坊',
                  contactName: '张三',
                  contactPhone: '13800138000',
                  contactEmail: 'zhangsan@example.com',
                  businessType: 'WET_MARKET',
                  estimatedMonthlyVolume: '500kg',
                  region: '浙江省杭州市',
                  message: '想了解千张批发价格',
                },
              },
            },
          },
          responses: {
            '201': { description: '线索创建成功' },
            '400': { description: '参数校验失败' },
            '429': { description: '请求过于频繁' },
          },
        },
      },
      '/traceability/{batch_no}': {
        get: {
          summary: '批次溯源查询',
          description: '通过批次号查询千张产品的完整生产溯源信息，包括原料、生产、质检数据',
          tags: ['溯源'],
          parameters: [
            { name: 'batch_no', in: 'path', required: true, schema: { type: 'string' }, description: '生产批次号' },
          ],
          responses: {
            '200': { description: '溯源信息' },
            '404': { description: '未找到该批次' },
            '429': { description: '请求过于频繁' },
          },
        },
      },
    },
    components: {
      schemas: {
        ProductListResponse: {
          type: 'object',
          properties: {
            code: { type: 'integer', example: 0 },
            data: {
              type: 'object',
              properties: {
                items: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                pagination: { $ref: '#/components/schemas/Pagination' },
              },
            },
            msg: { type: 'string', example: 'OK' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string', example: '薄千张 500g' },
            category: { type: 'string', enum: ['THIN', 'MEDIUM', 'THICK'] },
            categoryLabel: { type: 'string', example: '薄千张' },
            specification: { type: 'string', example: '500g' },
            unitPrice: { type: 'number', example: 9.8 },
            unit: { type: 'string', example: '包' },
            description: { type: 'string' },
            minOrderQuantity: { type: 'integer', example: 5 },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
        CreateLeadRequest: {
          type: 'object',
          required: ['companyName', 'contactName', 'contactPhone'],
          properties: {
            companyName: { type: 'string', description: '公司名称' },
            contactName: { type: 'string', description: '联系人姓名' },
            contactPhone: { type: 'string', description: '联系电话（11位手机号）' },
            contactEmail: { type: 'string', description: '联系邮箱（可选）' },
            businessType: { type: 'string', enum: ['WET_MARKET', 'SUPERMARKET', 'WHOLESALE', 'ECOMMERCE', 'RESTAURANT', 'OTHER'], description: '业务类型' },
            estimatedMonthlyVolume: { type: 'string', description: '预估月采购量' },
            region: { type: 'string', description: '所在地区' },
            message: { type: 'string', description: '留言' },
          },
        },
      },
    },
  };

  // 返回 Swagger JSON spec
  if (_req.query.format === 'json') {
    res.json(swaggerSpec);
    return;
  }

  // 返回 Swagger UI HTML
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>千张销售管理系统 - Open API 文档</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { color: #1a1a2e; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      spec: ${JSON.stringify(swaggerSpec)},
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

// ==================== 注册路由 ====================

export function registerOpenAPIRoutes(app: express.Application) {
  const router = express.Router();

  // 全局中间件：CORS + 限流
  router.use(corsMiddleware);
  router.use(rateLimiter);

  // API 路由
  router.get('/products', handleGetProducts);
  router.post('/leads', handleCreateLead);
  router.get('/traceability/:batch_no', handleTraceability);
  router.get('/docs', handleSwaggerDocs);

  app.use('/api/v1', router);

  console.log('[Open API] Routes registered: /api/v1/{products, leads, traceability/:batch_no, docs}');
}
