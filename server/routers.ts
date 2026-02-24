import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ordersAPI, invoicesAPI, paymentsAPI, applyAPI, auditLogsAPI, customersAPI, commissionRulesAPI, ceoRadarAPI, antiFraudAPI, creditAPI } from "./backend-api";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Task 1: Ping endpoint (不依赖backend，用于验证tRPC handler被命中)
  ping: publicProcedure.query(() => {
    return {
      success: true,
      message: 'pong',
      timestamp: new Date().toISOString(),
      server: 'ops-frontend tRPC',
    };
  }),

  // CEO router - 经营异常雷达
  ceo: router({
    getRadarData: protectedProcedure.query(async ({ ctx }) => {
      // 限制仅admin角色可访问
      if (ctx.user?.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: '仅CEO可访问此功能' });
      }
      
      // 调用backend API获取真实雷达数据
      return ceoRadarAPI.getRadarData();
    }),
  }),
  
  // Storage router - 文件上传
  storage: router({
    uploadImage: protectedProcedure
      .input(z.object({
        filename: z.string(),
        contentType: z.string(),
        base64Data: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import('./storage');
        
        // 将Base64转换为Buffer
        const buffer = Buffer.from(input.base64Data, 'base64');
        
        // 生成唯一文件名（防止枚举）
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const ext = input.filename.split('.').pop() || 'jpg';
        const fileKey = `feedback-images/${timestamp}-${randomSuffix}.${ext}`;
        
        // 上传到S3
        const { url } = await storagePut(fileKey, buffer, input.contentType);
        
        return {
          url,
          fileKey,
        };
      }),
  }),
  
  // Backend API Routers
  // 通过server-side tRPC procedures调用backend REST API
  // INTERNAL_SERVICE_TOKEN只在server端使用，不会暴露到前端
  
  orders: router({
    list: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        status: z.string().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await ordersAPI.list(input);
        } catch (error: any) {
          // Task 4: Preserve 401/403 error codes from backend
          if (error.status === 401) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: error.message || 'Unauthorized: Invalid or missing authentication token',
              cause: error,
            });
          } else if (error.status === 403) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error.message || 'Forbidden: Insufficient permissions',
              cause: error,
            });
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message || 'Failed to fetch orders',
            cause: error,
          });
        }
      }),
    
    approve: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return ordersAPI.approve(input.orderId, input.remark);
      }),
    
    reject: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return ordersAPI.reject(input.orderId, input.remark);
      }),
    
    fulfill: protectedProcedure
      .input(z.object({
        orderId: z.number(),
      }))
      .mutation(async ({ input }) => {
        return ordersAPI.fulfill(input.orderId);
      }),
    
    get: protectedProcedure
      .input(z.object({
        orderId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          return await ordersAPI.get(input.orderId);
        } catch (error: any) {
          if (error.status === 404) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: '订单不存在',
              cause: error,
            });
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message || 'Failed to fetch order',
            cause: error,
          });
        }
      }),
  }),
  
  invoices: router({
    list: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        status: z.string().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return invoicesAPI.list(input);
      }),
    
    get: protectedProcedure
      .input(z.object({
        invoiceId: z.number(),
      }))
      .query(async ({ input }) => {
        return invoicesAPI.get(input.invoiceId);
      }),
  }),
  
  payments: router({
    list: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        appliedStatus: z.string().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return paymentsAPI.list(input);
      }),
    
    get: protectedProcedure
      .input(z.object({
        paymentId: z.number(),
      }))
      .query(async ({ input }) => {
        return paymentsAPI.get(input.paymentId);
      }),
  }),
  
  arApply: router({
    create: protectedProcedure
      .input(z.object({
        paymentId: z.number(),
        invoiceId: z.number(),
        appliedAmount: z.number(),
      }))
      .mutation(async ({ input }) => {
        return applyAPI.apply(input);
      }),
  }),
  
  commission: router({
    /**
     * 获取KPI统计数据（多维度提成计算）
     * 
     * 计算公式：
     * Commission = (发货总额 × 基础利率) + (新增有效客户数 × 奖励基数)
     * 
     * @param input.orgId - 组织ID
     * @param input.startDate - 统计开始日期 (ISO 8601格式)
     * @param input.endDate - 统计结束日期 (ISO 8601格式)
     * @param input.ruleVersion - 提成规则版本（默认使用2026-V1）
     */
    getKpiStats: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        startDate: z.string(), // ISO 8601 date string
        endDate: z.string(),
        ruleVersion: z.string(), // e.g., "2026-V1"
        customerCategory: z.enum(['WET_MARKET', 'WHOLESALE_B', 'SUPERMARKET', 'ECOMMERCE', 'DEFAULT']).optional(), // 客户类型过滤
      }))
      .query(async ({ input }) => {
        try {
          // 使用新的commission-engine模块
          const { calculateCommission } = await import('./commission-engine');
          const { getCommissionRule } = await import('./db');
          
          // 获取提成规则
          const category = input.customerCategory || 'DEFAULT';
          const dbRule = await getCommissionRule(input.ruleVersion, category);
          
          if (!dbRule) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Commission rule not found: ${input.ruleVersion} (category: ${category})`,
            });
          }
          
          // 解析规则配置
          const ruleJsonParsed = dbRule.ruleJson ? (typeof dbRule.ruleJson === 'string' ? JSON.parse(dbRule.ruleJson) : dbRule.ruleJson) : {};
          const commissionRule = {
            ruleVersion: dbRule.version, // Fixed: use 'version' not 'ruleVersion'
            category: dbRule.category,
            baseRate: parseFloat(ruleJsonParsed.baseRate || '0'), // baseRate is in ruleJson, not a separate field
            newCustomerBonus: parseFloat(ruleJsonParsed.newCustomerBonus || '0'), // newCustomerBonus is in ruleJson
            ruleJson: ruleJsonParsed,
          };
          
          // 计算提成
          return await calculateCommission(input, commissionRule);


        } catch (error: any) {
          // 错误处理
          if (error.status === 401) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: error.message || 'Unauthorized: Invalid or missing authentication token',
              cause: error,
            });
          } else if (error.status === 403) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error.message || 'Forbidden: Insufficient permissions',
              cause: error,
            });
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message || 'Failed to calculate KPI stats',
            cause: error,
          });
        }
      }),

    /**
     * 获取订单详情列表（用于KPI钻取）
     */
    getOrderDetails: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
        customerCategory: z.enum(['WET_MARKET', 'WHOLESALE_B', 'SUPERMARKET', 'ECOMMERCE', 'DEFAULT']).optional(),
      }))
      .query(async ({ input }) => {
        try {
          // 获取期间内已履行的订单
          const fulfilledOrdersResponse = await ordersAPI.list({
            orgId: input.orgId,
            status: 'FULFILLED',
            page: 1,
            pageSize: 10000,
          });
          
          const ordersData = fulfilledOrdersResponse.items || fulfilledOrdersResponse.data || [];
          const startDate = new Date(input.startDate);
          const endDate = new Date(input.endDate);
          
          // 过滤期间内的订单
          const ordersInPeriod = ordersData.filter((order: any) => {
            if (!order.fulfilledAt) return false;
            
            const fulfilledAt = new Date(order.fulfilledAt);
            const inPeriod = fulfilledAt >= startDate && fulfilledAt <= endDate;
            
            // 如果指定了客户类型且不是"全部类型"，只统计该类型的订单
            if (input.customerCategory && input.customerCategory !== 'DEFAULT' && order.customer?.category !== input.customerCategory) {
              return false;
            }
            
            return inPeriod;
          });
          
          return {
            success: true,
            data: ordersInPeriod.map((order: any) => ({
              orderNo: order.orderNo,
              customerName: order.customer?.name || order.customer?.customerName || 'N/A',
              customerCategory: order.customer?.category || 'N/A',
              totalAmount: parseFloat(order.totalAmount || '0'),
              fulfilledAt: order.fulfilledAt,
            })),
          };
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message || 'Failed to fetch order details',
            cause: error,
          });
        }
      }),

    /**
     * 获取新增客户详情列表（用于KPI钻取）
     */
    getNewCustomerDetails: protectedProcedure
      .input(z.object({
        orgId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
        customerCategory: z.enum(['WET_MARKET', 'WHOLESALE_B', 'SUPERMARKET', 'ECOMMERCE', 'DEFAULT']).optional(),
      }))
      .query(async ({ input }) => {
        try {
          const newCustomersResponse = await customersAPI.list({
            orgId: input.orgId,
            createdAfter: input.startDate,
            page: 1,
            pageSize: 10000,
          });
          
          const startDate = new Date(input.startDate);
          const endDate = new Date(input.endDate);
          
          const newCustomersInPeriod = newCustomersResponse.data.filter((customer: any) => {
            const createdAt = new Date(customer.createdAt);
            const inPeriod = createdAt >= startDate && createdAt <= endDate;
            
            // 如果指定了客户类型且不是"全部类型"，只统计该类型的客户
            if (input.customerCategory && input.customerCategory !== 'DEFAULT' && customer.category !== input.customerCategory) {
              return false;
            }
            
            return inPeriod;
          });
          
          return {
            success: true,
            data: newCustomersInPeriod.map((customer: any) => ({
              customerCode: customer.customerCode,
              customerName: customer.name || customer.customerName,
              category: customer.category,
              createdAt: customer.createdAt,
              status: customer.status,
            })),
          };
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message || 'Failed to fetch new customer details',
            cause: error,
          });
        }
      }),

    /**
     * 获取当前用户的个人业绩数据（销售员专用）
     */
    myPerformance: protectedProcedure
      .query(async ({ ctx }) => {
        // TODO: 调用backend API获取当前用户的业绩数据
        // 暂时返回模拟数据
        return {
          totalRevenue: 1250000, // 发货总额：125万
          orderCount: 45, // 订单数
          newCustomerCount: 8, // 新增客户数
          paymentRate: 0.92, // 回款率：92%
          overdueAmount: 50000, // 逾期金额：5万
          totalCommission: 28750, // 总提成 = 1250000*0.02 - 50000*0.005 + 8*500 = 25000 - 250 + 4000 = 28750
        };
      }),
  }),

  commissionRules: router({ 
    list: protectedProcedure
      .input(z.object({
        category: z.string().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        try {
          return await commissionRulesAPI.list(input);
        } catch (error: any) {
          if (error.status === 401) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: error.message || 'Unauthorized',
              cause: error,
            });
          } else if (error.status === 403) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error.message || 'Forbidden',
              cause: error,
            });
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message || 'Failed to fetch commission rules',
            cause: error,
          });
        }
      }),
    
    get: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          return await commissionRulesAPI.get(input.id);
        } catch (error: any) {
          if (error.status === 404) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Commission rule not found',
              cause: error,
            });
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message || 'Failed to fetch commission rule',
            cause: error,
          });
        }
      }),
    
    create: protectedProcedure
      .input(z.object({
        ruleVersion: z.string(),
        category: z.string(),
        baseRate: z.number(),
        newCustomerBonus: z.number(),
        ruleJson: z.string().optional(),
        effectiveFrom: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await commissionRulesAPI.create(input);
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message || 'Failed to create commission rule',
            cause: error,
          });
        }
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        ruleVersion: z.string().optional(),
        category: z.string().optional(),
        baseRate: z.number().optional(),
        newCustomerBonus: z.number().optional(),
        ruleJson: z.string().optional(),
        effectiveFrom: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        try {
          return await commissionRulesAPI.update(id, data);
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message || 'Failed to update commission rule',
            cause: error,
          });
        }
      }),
    
    delete: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await commissionRulesAPI.delete(input.id);
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message || 'Failed to delete commission rule',
            cause: error,
          });
        }
      }),
  }),

  employee: router({
    list: protectedProcedure.query(async () => {
      // TODO: 调用backend API获取员工列表
      // 暂时返回模拟数据
      return [
        {
          id: 1,
          username: "admin",
          email: "admin@example.com",
          full_name: "系统管理员",
          phone: "",
          department: "管理部",
          status: "ACTIVE",
          job_position: {
            id: 1,
            position_name: "系统管理员",
            department: "管理部",
          },
          roles: [
            {
              id: 1,
              code: "CEO",
              name: "老板",
            },
          ],
        },
      ];
    }),

    getJobPositions: protectedProcedure.query(async () => {
      // TODO: 调用backend API获取职位模板列表
      // 暂时返回模拟数据
      return [
        {
          id: 1,
          department: "管理部",
          position_name: "系统管理员",
          default_role_id: 1,
          role: {
            id: 1,
            code: "CEO",
            name: "老板",
            permissions: [
              { id: 1, code: "order.view", name: "查看订单" },
              { id: 2, code: "order.create", name: "创建订单" },
              { id: 3, code: "invoice.view", name: "查看发票" },
              { id: 4, code: "payment.view", name: "查看回款" },
              { id: 5, code: "payment.create", name: "录入回款" },
              { id: 6, code: "apply.create", name: "核销操作" },
              { id: 7, code: "commission.view", name: "查看提成" },
              { id: 8, code: "employee.manage", name: "员工管理" },
            ],
          },
        },
        {
          id: 2,
          department: "财务部",
          position_name: "财务主管",
          default_role_id: 2,
          role: {
            id: 2,
            code: "FINANCE_MANAGER",
            name: "财务主管",
            permissions: [
              { id: 1, code: "order.view", name: "查看订单" },
              { id: 3, code: "invoice.view", name: "查看发票" },
              { id: 4, code: "payment.view", name: "查看回款" },
              { id: 5, code: "payment.create", name: "录入回款" },
              { id: 6, code: "apply.create", name: "核销操作" },
            ],
          },
        },
        {
          id: 3,
          department: "销售部",
          position_name: "高级业务员",
          default_role_id: 4,
          role: {
            id: 4,
            code: "SALES",
            name: "销售",
            permissions: [
              { id: 1, code: "order.view", name: "查看订单" },
              { id: 2, code: "order.create", name: "创建订单" },
              { id: 7, code: "commission.view", name: "查看提成" },
            ],
          },
        },
      ];
    }),

    create: protectedProcedure
      .input(z.object({
        username: z.string(),
        email: z.string().email(),
        password: z.string(),
        full_name: z.string().optional(),
        phone: z.string().optional(),
        department: z.string().optional(),
        job_position_id: z.string(),
      }))
      .mutation(async ({ input }) => {
        // TODO: 调用backend API创建员工
        // 暂时返回成功
        return {
          success: true,
          message: "员工创建成功",
        };
      }),

    delete: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        // TODO: 调用backend API删除员工
        // 暂时返回成功
        return {
          success: true,
          message: "员工删除成功",
        };
      }),
  }),

  auditLogs: router({
    list: protectedProcedure
      .input(z.object({
        resourceType: z.string().optional(),
        resourceId: z.number().optional(),
        action: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return auditLogsAPI.list(input);
      }),
    
    trace: protectedProcedure
      .input(z.object({
        resourceType: z.string(),
        resourceId: z.number(),
      }))
      .query(async ({ input }) => {
        return auditLogsAPI.trace(input.resourceType, input.resourceId);
      }),
  }),

  // Public router (无需登录)
  public: router({
    getTraceData: publicProcedure
      .input(z.object({
        orderId: z.number(),
      }))
      .query(async ({ input }) => {
        // 模拟追溯数据（实际应从backend API获取）
        return {
          orderNo: `ORD-${input.orderId}`,
          customerName: '李记菜市场',
          totalAmount: 12500,
          status: 'FULFILLED',
          createdAt: new Date().toISOString(),
          rawMaterial: {
            soybeanBatch: 'SB-2026-02-20-001',
            waterQuality: '合格（pH 7.2）',
          },
          production: {
            batchNo: `BATCH-2026-02-${String(input.orderId).padStart(6, '0')}`,
            productionDate: new Date().toISOString(),
            workshopTemp: 25,
            sterilizationParams: '121°C × 15min',
          },
          logistics: {
            pickingTime: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
            shippingTime: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
            deliveryTime: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
            driverName: '张师傅',
            driverPhone: '138****5678',
          },
        };
      }),
    
    // 提交客户评价
    submitFeedback: publicProcedure
      .input(z.object({
        orderId: z.number(),
        batchNo: z.string().optional(),
        customerName: z.string().optional(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
        images: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { getDb } = await import('./db');
        const { qualityFeedback } = await import('../drizzle/schema');
        
        const db = await getDb();
        if (!db) {
          throw new Error('Database not available');
        }
        
        const result = await db.insert(qualityFeedback).values({
          orderId: input.orderId,
          batchNo: input.batchNo || null,
          customerName: input.customerName || null,
          rating: input.rating,
          comment: input.comment || null,
          images: input.images ? JSON.stringify(input.images) : null,
        });
        
        return {
          success: true,
          feedbackId: result[0].insertId,
        };
      }),
    
    // 获取订单评价列表
    getFeedbackList: publicProcedure
      .input(z.object({
        orderId: z.number(),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import('./db');
        const { qualityFeedback } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        
        const db = await getDb();
        if (!db) {
          return [];
        }
        
        const feedbacks = await db.select().from(qualityFeedback).where(eq(qualityFeedback.orderId, input.orderId));
        
        return feedbacks.map((f: any) => ({
          ...f,
          images: f.images ? JSON.parse(f.images) : [],
        }));
      }),
  }),

  // P22: Anti-Fraud & Deviation Warning System
  antiFraud: router({
    getPriceAnomalies: protectedProcedure
      .input(z.object({
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
      }))
      .query(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可访问' });
        }
        // TODO: 实现从数据库查询价格异常
        return [];
      }),

    approvePriceAnomaly: protectedProcedure
      .input(z.object({
        id: z.number(),
        specialReason: z.string().min(10),
      }))
      .mutation(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可审批' });
        }
        // TODO: 实现审批逻辑
        return { success: true };
      }),

    rejectPriceAnomaly: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可审批' });
        }
        // TODO: 实现拒绝逻辑
        return { success: true };
      }),

    getSettlementAudits: protectedProcedure
      .input(z.object({
        suspiciousOnly: z.boolean().default(false),
      }))
      .query(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可访问' });
        }
        // TODO: 实现从数据库查询结算审计
        return [];
      }),
  }),
});

export type AppRouter = typeof appRouter;
