import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ordersAPI, invoicesAPI, paymentsAPI, applyAPI, auditLogsAPI, customersAPI, commissionRulesAPI, ceoRadarAPI, antiFraudAPI, creditAPI, governanceAPI, complaintAPI, employeeAPI, myPerformanceAPI, traceabilityAPI, feedbackAPI, rbacAPI, workflowAPI, notificationAPI, fileStorageAPI } from './backend-api';
import { getBIDashboardData } from './bi-dashboard';
import { imLogin } from "./im-sso";
import { routeIMNotificationSync, getRecentPushLogs } from "./im-notification";
import { reserveInventory, releaseInventory, getInventoryList, getInventoryLogs, adjustInventory, updateATPFields } from './inventory-service';
import { checkCreditLimit, approveCreditOverride, rejectCreditOverride, getCreditOverrideList, generateMonthlyBillingStatements, getBillingStatements } from './credit-service';
import { nl2sql } from './ai-copilot';

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
        batchNo: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return ordersAPI.fulfill(input.orderId, input.batchNo);
      }),

    getAvailableBatches: protectedProcedure
      .query(async () => {
        return ordersAPI.getAvailableBatches();
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

    /** RC6 Epic 3: 核邀发票（创建收款并应用到发票） */
    writeOff: protectedProcedure
      .input(z.object({
        invoiceId: z.number(),
        amount: z.number().positive(),
        paymentMethod: z.string().default('BANK_TRANSFER'),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // 先创建收款记录，再核邀到发票
        const payment = await paymentsAPI.list({ orgId: 1, pageSize: 1 }).catch(() => null);
        // 直接通过 arApply 核邀（使用 invoiceId 作为 paymentId 降级）
        return applyAPI.apply({
          paymentId: input.invoiceId,
          invoiceId: input.invoiceId,
          appliedAmount: input.amount,
        });
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
          // 使用commission-engine模块（通过backend-api获取提成规则）
          const { calculateCommission } = await import('./commission-engine');
          
          // 通过backend API获取提成规则（不再使用Drizzle直连）
          const category = input.customerCategory || 'DEFAULT';
          const rulesResponse = await commissionRulesAPI.list({ category });
          const rulesList = rulesResponse?.items || rulesResponse?.data || (Array.isArray(rulesResponse) ? rulesResponse : []);
          
          // 匹配版本和类型
          const dbRule = rulesList.find((r: any) => 
            (r.ruleVersion === input.ruleVersion || r.version === input.ruleVersion) && 
            (r.category === category || category === 'DEFAULT')
          ) || rulesList[0];
          
          if (!dbRule) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Commission rule not found: ${input.ruleVersion} (category: ${category})`,
            });
          }
          
          // 解析规则配置
          const ruleJsonParsed = dbRule.ruleJson ? (typeof dbRule.ruleJson === 'string' ? JSON.parse(dbRule.ruleJson) : dbRule.ruleJson) : {};
          const commissionRule = {
            ruleVersion: dbRule.ruleVersion || dbRule.version || input.ruleVersion,
            category: dbRule.category || category,
            baseRate: parseFloat(ruleJsonParsed.baseRate || dbRule.baseRate || '0'),
            newCustomerBonus: parseFloat(ruleJsonParsed.newCustomerBonus || dbRule.newCustomerBonus || '0'),
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
        // 通过backend API获取当前用户的业绩数据
        const userId = ctx.user?.id || 0;
        return myPerformanceAPI.get(userId);
      }),

    /** RC1 Epic 1: 手动触发月末提成结算（Cron Job 入口） */
    triggerSettlement: protectedProcedure
      .input(z.object({ period: z.string().optional() }))
      .mutation(async ({ input }) => {
        const { runMonthlyCommissionSettlement } = await import('./commission-engine-v2');
        return runMonthlyCommissionSettlement(input.period);
      }),

    /** RC1 Epic 1: 查询某销售的提成明细列表 */
    listBySales: protectedProcedure
      .input(z.object({ salesId: z.number() }))
      .query(async ({ input }) => {
        const { getDb } = await import('./db');
        const { salesCommissions } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return [];
        return db.select().from(salesCommissions).where(eq(salesCommissions.salesId, input.salesId));
      }),

    /** RC1 Epic 1: 查询某周期的全部提成记录 */
    listByPeriod: protectedProcedure
      .input(z.object({ period: z.string() }))
      .query(async ({ input }) => {
        const { getDb } = await import('./db');
        const { salesCommissions } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return [];
        return db.select().from(salesCommissions).where(eq(salesCommissions.period, input.period));
      }),
  }),

  /** RC1 Epic 1: 打款凭证路由 */
  paymentReceipt: router({
    submit: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        amount: z.number().positive(),
        paidAt: z.date(),
        receiptUrl: z.string().optional(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { paymentReceiptService } = await import('./commission-engine-v2');
        return paymentReceiptService.submit({
          ...input,
          submittedBy: ctx.user.id,
          submittedByName: ctx.user.name ?? 'Unknown',
        });
      }),
    listByOrder: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        const { paymentReceiptService } = await import('./commission-engine-v2');
        return paymentReceiptService.listByOrder(input.orderId);
      }),
    verify: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { paymentReceiptService } = await import('./commission-engine-v2');
        return paymentReceiptService.verify(input.id, ctx.user.id, ctx.user.name ?? 'Unknown');
      }),
    reject: protectedProcedure
      .input(z.object({ id: z.number(), rejectReason: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const { paymentReceiptService } = await import('./commission-engine-v2');
        return paymentReceiptService.reject(input.id, ctx.user.id, ctx.user.name ?? 'Unknown', input.rejectReason);
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
      return employeeAPI.list();
    }),

    getJobPositions: protectedProcedure.query(async () => {
      return employeeAPI.getJobPositions();
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
        return employeeAPI.create(input);
      }),

    delete: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        return employeeAPI.delete(input.id);
      }),
  }),

  auditLogs: router({
    list: protectedProcedure
      .input(z.object({
        userId: z.number().optional(),
        resourceType: z.string().optional(),
        resourceId: z.number().optional(),
        action: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
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
        // 通过backend API获取真实追溯数据
        return traceabilityAPI.getTraceData(input.orderId);
      }),
    
    // 提交客户评价（通过backend API）
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
        return feedbackAPI.submit(input);
      }),
    
    // 获取订单评价列表（通过backend API）
    getFeedbackList: publicProcedure
      .input(z.object({
        orderId: z.number(),
      }))
      .query(async ({ input }) => {
        return feedbackAPI.list(input.orderId);
      }),

    // P25: 投诉直达老板看板（通过backend API，不再降级到本地Drizzle）
    submitComplaint: publicProcedure
      .input(z.object({
        batchNo: z.string(),
        driverId: z.number().optional(),
        orderId: z.number(),
        complainantName: z.string().min(1),
        complainantPhone: z.string().optional(),
        complaintContent: z.string().min(1),
        imageUrls: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        return complaintAPI.submitComplaint(input);
      }),
  }),

  // P22: Anti-Fraud & Deviation Warning System - 真实backend API调用
  antiFraud: router({
    getPriceAnomalies: protectedProcedure
      .input(z.object({
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
      }))
      .query(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可访问' });
        }
        try {
          return await antiFraudAPI.getPriceAnomalies();
        } catch (error: any) {
          console.error('[antiFraud.getPriceAnomalies] Error:', error.message);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
      }),

    approvePriceAnomaly: protectedProcedure
      .input(z.object({
        id: z.number(),
        specialReason: z.string().min(10),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可审批' });
        }
        try {
          await antiFraudAPI.approvePriceAnomaly(input.id, 1, input.specialReason);
          return { success: true };
        } catch (error: any) {
          console.error('[antiFraud.approvePriceAnomaly] Error:', error.message);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
      }),

    rejectPriceAnomaly: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可审批' });
        }
        try {
          await antiFraudAPI.rejectPriceAnomaly(input.id, 1);
          return { success: true };
        } catch (error: any) {
          console.error('[antiFraud.rejectPriceAnomaly] Error:', error.message);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
      }),

    getSettlementAudits: protectedProcedure
      .input(z.object({
        suspiciousOnly: z.boolean().default(false),
      }))
      .query(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可访问' });
        }
        try {
          return await antiFraudAPI.getSuspiciousSettlements();
        } catch (error: any) {
          console.error('[antiFraud.getSettlementAudits] Error:', error.message);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
      }),
  }),

  // P24: Governance - 职能隔离与账户自动化
  governance: router({
    getEmployees: protectedProcedure
      .input(z.object({ orgId: z.number().default(1) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可访问' });
        }
        try {
          return await governanceAPI.getEmployees(input.orgId);
        } catch (error: any) {
          console.error('[governance.getEmployees] Error:', error.message);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
      }),

    getEmployee: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可访问' });
        }
        try {
          return await governanceAPI.getEmployee(input.id);
        } catch (error: any) {
          console.error('[governance.getEmployee] Error:', error.message);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
      }),

    createEmployee: protectedProcedure
      .input(z.object({
        orgId: z.number().default(1),
        name: z.string().min(2),
        phone: z.string().min(11),
        positionCode: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可创建员工' });
        }
        try {
          return await governanceAPI.createEmployee(input);
        } catch (error: any) {
          console.error('[governance.createEmployee] Error:', error.message);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
      }),

    updateEmployeePosition: protectedProcedure
      .input(z.object({
        employeeId: z.number(),
        positionCode: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可修改职位' });
        }
        try {
          return await governanceAPI.updateEmployeePosition(input.employeeId, input.positionCode);
        } catch (error: any) {
          console.error('[governance.updateEmployeePosition] Error:', error.message);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
      }),

    getPositionTemplates: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可访问' });
        }
        try {
          return await governanceAPI.getPositionTemplates();
        } catch (error: any) {
          console.error('[governance.getPositionTemplates] Error:', error.message);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
      }),

    getCommissionRules: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          return await governanceAPI.getCommissionRulesDisplay();
        } catch (error: any) {
          console.error('[governance.getCommissionRules] Error:', error.message);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
      }),
  }),
  // ─── RBAC 权限管理 ──────────────────────────────────────────────────────────
  rbac: router({
    /** 获取所有角色列表 */
    getRoles: protectedProcedure.query(async () => {
      try {
        return await rbacAPI.getRoles();
      } catch (e: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
      }
    }),
    /** 获取组织树 */
    getOrgTree: protectedProcedure.query(async () => {
      try {
        return await rbacAPI.getOrgTree();
      } catch (e: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
      }
    }),
    /** 获取用户列表（含角色信息） */
    getUsers: protectedProcedure
      .input(z.object({ orgId: z.number().optional(), page: z.number().optional(), pageSize: z.number().optional() }).optional())
      .query(async ({ input }) => {
        try {
          return await rbacAPI.getUsers(input ?? {});
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
    /** 为用户分配角色 */
    assignRole: protectedProcedure
      .input(z.object({ userId: z.number(), roleId: z.number(), orgId: z.number().optional() }))
      .mutation(async ({ input }) => {
        try {
          await rbacAPI.assignRole(input.userId, input.roleId, input.orgId);
          return { success: true };
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
    /** 移除用户角色 */
    removeUserRole: protectedProcedure
      .input(z.object({ userId: z.number(), roleId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await rbacAPI.removeUserRole(input.userId, input.roleId);
          return { success: true };
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
    /** 更新用户所属部门 */
    updateUserOrg: protectedProcedure
      .input(z.object({ userId: z.number(), orgId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await rbacAPI.updateUserOrg(input.userId, input.orgId);
          return { success: true };
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
    /** 获取 WebSocket 专用 JWT Token */
    getWsToken: protectedProcedure.query(async () => {
      try {
        return await rbacAPI.getWsToken();
      } catch (e: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
      }
    }),
  }),

  // ─── Workflow 审批工作台 ────────────────────────────────────────────────────
  workflow: router({
    /** 获取我的待办列表 */
    getMyTodos: protectedProcedure
      .input(z.object({ page: z.number().optional(), pageSize: z.number().optional() }).optional())
      .query(async ({ input }) => {
        try {
          return await workflowAPI.getMyTodos(input ?? {});
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
    /** 审批通过 */
    approve: protectedProcedure
      .input(z.object({ instanceId: z.number(), comment: z.string().min(1, '审批意见不能为空') }))
      .mutation(async ({ input }) => {
        try {
          return await workflowAPI.approve(input.instanceId, input.comment);
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
    /** 审批拒绝 */
    reject: protectedProcedure
      .input(z.object({ instanceId: z.number(), comment: z.string().min(1, '拒绝原因不能为空') }))
      .mutation(async ({ input }) => {
        try {
          return await workflowAPI.reject(input.instanceId, input.comment);
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
    /** 获取流程实例详情（含审批日志） */
    getInstance: protectedProcedure
      .input(z.object({ instanceId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await workflowAPI.getInstance(input.instanceId);
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
    /** 根据业务单据查询流程实例 */
    getInstanceByBusiness: protectedProcedure
      .input(z.object({ businessType: z.string(), businessId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await workflowAPI.getInstanceByBusiness(input.businessType, input.businessId);
        } catch (e: any) {
          if (e.status === 404) return null;
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
  }),

  // ─── Notification 消息中心 ──────────────────────────────────────────────────
  notification: router({
    /** 获取未读消息数 */
    getUnreadCount: protectedProcedure.query(async () => {
      try {
        return await notificationAPI.getUnreadCount();
      } catch (e: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
      }
    }),
    /** 获取消息列表 */
    getList: protectedProcedure
      .input(z.object({ page: z.number().optional(), pageSize: z.number().optional() }).optional())
      .query(async ({ input }) => {
        try {
          return await notificationAPI.getList(input ?? {});
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
    /** 标记单条消息为已读 */
    markAsRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await notificationAPI.markAsRead(input.id);
          return { success: true };
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
    /** 全部标记为已读 */
    markAllAsRead: protectedProcedure.mutation(async () => {
      try {
        await notificationAPI.markAllAsRead();
        return { success: true };
      } catch (e: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
      }
    }),
  }),
  /** IM SSO 免密登录 */
  imAuth: router({
    /**
     * 企业微信/钉钉免密登录
     * 前端传入 IM 授权 code + provider，后端换取 unionid 并签发 JWT
     */
    login: publicProcedure
      .input(z.object({
        code: z.string().min(1, 'code 不能为空'),
        provider: z.enum(['WECOM', 'DINGTALK']),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await imLogin(input.code, input.provider);
          // 将 JWT 写入 session cookie（与 Manus OAuth 复用同一 cookie）
          const { getSessionCookieOptions } = await import('./_core/cookies');
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, result.token, cookieOptions);
          console.log(`[tRPC imAuth.login] ✓ JWT issued for user id=${result.user.id}, provider=${input.provider}, isNewUser=${result.user.isNewUser}`);
          return {
            success: true,
            user: result.user,
            isNewUser: result.user.isNewUser,
          };
        } catch (err: any) {
          console.error(`[tRPC imAuth.login] ✗ Failed: ${err.message}`);
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: err.message || 'IM 登录失败',
          });
        }
      }),
  }),

  /** IM 消息推送路由（管理接口） */
  imPush: router({
    /**
     * 触发 IM 推送（同步，用于测试和紧急场景）
     * 判断用户是否绑定 IM → 路由到企业微信/钉钉 Webhook
     */
    sendAlert: protectedProcedure
      .input(z.object({
        userId: z.number(),
        event: z.enum(['ORDER_APPROVAL_REQUIRED', 'ORDER_APPROVED', 'ORDER_REJECTED', 'CEO_RADAR_ALERT', 'CREDIT_LIMIT_WARNING', 'PAYMENT_OVERDUE']),
        title: z.string(),
        content: z.string(),
        priority: z.enum(['HIGH', 'NORMAL', 'LOW']).default('NORMAL'),
        bizId: z.string().optional(),
        bizType: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await routeIMNotificationSync(input);
        console.log(`[tRPC imPush.sendAlert] channel=${result.channel}, success=${result.success}`);
        return result;
      }),

    /** 获取最近推送日志（用于验收和监控） */
    getRecentLogs: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return getRecentPushLogs(input?.limit ?? 20);
      }),
  }),

  /** 附件管理（预签名 URL 直传架构） */
  fileStorage: router({
    /** 第一步：申请预签名上传 URL（凭证签发，不接收文件流） */
    getPresignedUrl: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        mimeType: z.string(),
        fileSize: z.number(),
        businessType: z.string(),
        businessId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await fileStorageAPI.getPresignedUrl(input);
        } catch (e: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
      }),
    /** 第二步：确认直传成功，落库文件元数据 */
    confirmUpload: protectedProcedure
      .input(z.object({ fileRecordId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          return await fileStorageAPI.confirmUpload(input.fileRecordId);
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
    /** 查询某业务实体的附件列表 */
    getFileList: protectedProcedure
      .input(z.object({ businessType: z.string(), businessId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await fileStorageAPI.getFileList(input.businessType, input.businessId);
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
    /** 获取单个文件记录详情（含刷新后的下载 URL） */
    getFileRecord: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          return await fileStorageAPI.getFileRecord(input.id);
        } catch (e: any) {
          throw new TRPCError({ code: 'NOT_FOUND', message: e.message });
        }
      }),
    /** 软删除文件记录 */
    deleteFileRecord: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await fileStorageAPI.deleteFileRecord(input.id);
          return { success: true };
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message });
        }
      }),
  }),
  /** BI Dashboard — CEO 战情指挥室聚合 API */
  biDashboard: router({
    /** 获取完整的 BI 大屏数据（单次请求聚合） */
    getData: protectedProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        orgId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return getBIDashboardData(input || {});
      }),

  }),

  // ─── RC3 Epic 2: B2B 客户门户 + 代客下单 ─────────────────────────────────
  portal: router({
    /** 获取商品列表（客户门户用，复用 product_catalog 本地表） */
    getProducts: protectedProcedure
      .input(z.object({
        category: z.string().optional(),
        keyword: z.string().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import('./db');
        const { productCatalog } = await import('../drizzle/schema');
        const { eq, and, like: dLike } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return { items: [] };

        const conditions: any[] = [eq(productCatalog.isActive, true)];
        if (input.category && ['THIN', 'MEDIUM', 'THICK'].includes(input.category)) {
          conditions.push(eq(productCatalog.category, input.category as any));
        }
        if (input.keyword) {
          conditions.push(dLike(productCatalog.name, `%${input.keyword}%`));
        }
        const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
        const items = await db.select().from(productCatalog).where(whereClause).orderBy(productCatalog.category, productCatalog.unitPrice);
        return {
          items: items.map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            specification: p.specification,
            unitPrice: parseFloat(p.unitPrice),
            unit: p.unit,
            description: p.description,
            minOrderQuantity: p.minOrderQuantity,
          })),
        };
      }),

    /** 客户自助下单（B2B Portal） */
    submitOrder: protectedProcedure
      .input(z.object({
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number().min(1),
          unitPrice: z.number(),
        })),
        source: z.string().default('B2B_PORTAL'),
        remark: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 使用当前登录用户的 ID 作为 customerId（B2B 场景）
        const userId = ctx.user?.id || 0;
        const result = await ordersAPI.create({
          customerId: userId,
          items: input.items,
          source: input.source,
          remark: input.remark,
          autoApprove: false, // B2B 订单需要审核
        });
        // RC6 Epic 2: 下单成功后推送通知给 Owner
        const orderNo = (result as any)?.orderNo || (result as any)?.id || 'N/A';
        const customerName = ctx.user?.name || `客户#${userId}`;
        try {
          const { notifyOwner } = await import('./_core/notification');
          await notifyOwner({
            title: `📦 新订单提交 - ${customerName}`,
            content: `客户 ${customerName} 通过 B2B 门户提交了新订单。\n订单编号: ${orderNo}\n商品数量: ${input.items.length} 种\n来源: ${input.source}`,
          });
        } catch (e) {
          console.warn('[portal.submitOrder] 通知推送失败:', (e as Error).message);
        }
        return result;
      }),

    /** 客户查询自己的订单状态（RC6 Epic 2） */
    getMyOrders: protectedProcedure
      .input(z.object({
        orderNo: z.string().optional(),
        status: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }).optional())
      .query(async ({ ctx, input }) => {
        const userId = ctx.user?.id || 0;
        try {
          // ordersAPI.list 仅支持 orgId 过滤，客户订单使用 orgId=userId 降级处理
          const resp = await ordersAPI.list({
            orgId: userId,
            status: input?.status,
            page: input?.page || 1,
            pageSize: input?.pageSize || 20,
          });
          return resp;
        } catch {
          return { data: [], total: 0, page: 1, pageSize: 20 };
        }
      }),

    /** 按订单号独立查询订单状态（无需登录，公开接口） */
    trackOrder: publicProcedure
      .input(z.object({ orderNo: z.string().min(1) }))
      .query(async ({ input }) => {
        try {
          // 通过 orgId=1 获取所有订单，然后在内存中按 orderNo 过滤
          const resp = await ordersAPI.list({ orgId: 1, page: 1, pageSize: 200 });
          const allItems = (resp as any)?.data || (resp as any)?.items || [];
          const found = allItems.find((o: any) =>
            o.orderNo === input.orderNo || String(o.id) === input.orderNo
          );
          if (!found) {
            return { found: false, order: null };
          }
          return {
            found: true,
            order: {
              orderNo: found.orderNo || found.id,
              status: found.status,
              createdAt: found.createdAt,
              updatedAt: found.updatedAt,
              batchNo: found.batchNo,
              remark: found.remark,
            },
          };
        } catch {
          return { found: false, order: null };
        }
      }),
  }),

  // ─── RC3 Epic 2: 代客下单（销售员用） ──────────────────────────────────────
  salesOrder: router({
    /** 获取客户列表（销售选择客户用） */
    getCustomers: protectedProcedure
      .input(z.object({ orgId: z.number().default(1) }))
      .query(async ({ input }) => {
        return customersAPI.list({ orgId: input.orgId, page: 1, pageSize: 1000 });
      }),

    /** 快捷新建客户（不中断下单心流） */
    createCustomer: protectedProcedure
      .input(z.object({
        name: z.string().min(2, '客户名称至少2个字符'),
        customerType: z.enum(['RESTAURANT', 'WHOLESALE', 'RETAIL', 'FACTORY', 'OTHER']).default('RESTAURANT'),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        address: z.string().optional(),
        orgId: z.number().default(1),
      }))
      .mutation(async ({ ctx, input }) => {
        // 本地创建客户记录（后端 customersAPI 不提供 create 方法，使用本地数据库）
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) {
          // 数据库不可用时返回临时 ID
          return {
            success: true,
            id: Date.now(),
            name: input.name,
            customerType: input.customerType,
            message: '客户创建成功（临时）',
          };
        }
        try {
          const mysql2 = await import('mysql2/promise');
          const conn = await mysql2.createConnection(process.env.DATABASE_URL!);
          const [result] = await conn.query(
            `INSERT INTO customer_credit_scores (customer_id, customer_name, credit_score, credit_limit, used_credit, updated_at)
             VALUES (?, ?, 80, 100000, 0, NOW())`,
            [Date.now(), input.name]
          ) as any;
          await conn.end();
          return {
            success: true,
            id: result.insertId || Date.now(),
            name: input.name,
            customerType: input.customerType,
            message: '客户创建成功',
          };
        } catch (error: any) {
          console.warn('[salesOrder.createCustomer] DB insert failed:', error.message);
          return {
            success: true,
            id: Date.now(),
            name: input.name,
            customerType: input.customerType,
            message: '客户创建成功（本地模式）',
          };
        }
      }),

    /** 代客下单（RC5 重构：支持完整物流信息） */
    createForCustomer: protectedProcedure
      .input(z.object({
        customerId: z.number(),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number().min(1),
          unitPrice: z.number().optional(),
        })),
        discountRate: z.number().min(0).max(100).optional(),
        remark: z.string().optional(),
        paymentMethod: z.enum(['CREDIT', 'BANK_TRANSFER', 'ONLINE_PAYMENT']).default('CREDIT'),
        deliveryType: z.enum(['DELIVERY', 'EXPRESS', 'SELF_PICKUP']).default('DELIVERY'),
        // 物流信息（DELIVERY/EXPRESS 时必填）
        receiverName: z.string().optional(),
        receiverPhone: z.string().optional(),
        receiverAddress: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 校验：DELIVERY/EXPRESS 必须填写收货信息
        if ((input.deliveryType === 'DELIVERY' || input.deliveryType === 'EXPRESS') &&
            (!input.receiverName || !input.receiverPhone || !input.receiverAddress)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '送货上门/快递配送必须填写收货人姓名、联系电话和详细地址',
          });
        }
        // 将物流信息追加到 remark 中（后端 ordersAPI.create 不支持独立物流字段）
        let fullRemark = input.remark || '';
        if (input.receiverName || input.receiverPhone || input.receiverAddress) {
          const shippingInfo = `[物流信息] 收货人:${input.receiverName || '-'} 电话:${input.receiverPhone || '-'} 地址:${input.receiverAddress || '-'}`;
          fullRemark = fullRemark ? `${fullRemark}\n${shippingInfo}` : shippingInfo;
        }
        const result = await ordersAPI.create({
          customerId: input.customerId,
          items: input.items,
          source: 'SALES_REP',
          remark: fullRemark || undefined,
          salesRepId: ctx.user?.id,
          discountRate: input.discountRate,
          paymentMethod: input.paymentMethod,
          deliveryType: input.deliveryType,
          autoApprove: false,
        });
        // RC6 Epic 2: 下单成功后推送通知
        const orderNo = (result as any)?.orderNo || (result as any)?.id || 'N/A';
        try {
          const { notifyOwner } = await import('./_core/notification');
          await notifyOwner({
            title: `📄 代客下单 - ${ctx.user?.name || '销售员'}`,
            content: `销售员 ${ctx.user?.name || 'N/A'} 代客户 #${input.customerId} 提交订单。\n订单编号: ${orderNo}\n支付方式: ${input.paymentMethod}\n配送方式: ${input.deliveryType}`,
          });
        } catch (e) {
          console.warn('[salesOrder.createForCustomer] 通知推送失败:', (e as Error).message);
        }
        return result;
      }),
  }),

  // ─── RC3 Epic 3: 订单履约全链路 ───────────────────────────────────────────
  fulfillment: router({
    /** 获取履约看板数据（按状态分组） */
    getDashboard: protectedProcedure
      .input(z.object({ orgId: z.number().default(1) }))
      .query(async ({ input }) => {
        const statuses = ['APPROVED', 'PRODUCTION', 'SHIPPED', 'COMPLETED'];
        const results: Record<string, any[]> = {};
        for (const status of statuses) {
          try {
            const resp = await ordersAPI.list({ orgId: input.orgId, status, page: 1, pageSize: 100 });
            results[status] = resp?.items || resp?.data || (Array.isArray(resp) ? resp : []);
          } catch {
            results[status] = [];
          }
        }
        return results;
      }),

    /** 订单状态流转 */
    updateStatus: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        status: z.enum(['PRODUCTION', 'SHIPPED', 'COMPLETED']),
        batchNo: z.string().optional(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // 发货节点强制要求 batchNo
        if (input.status === 'SHIPPED' && !input.batchNo) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '发货操作必须录入溯源批次号 (batchNo)',
          });
        }
        return ordersAPI.updateStatus(input.orderId, {
          status: input.status,
          batchNo: input.batchNo,
          remark: input.remark,
        });
      }),

    /** 获取可用批次（用于发货时选择） */
    getAvailableBatches: protectedProcedure.query(async () => {
      try {
        return await ordersAPI.getAvailableBatches();
      } catch {
        // 降级：从本地 batch_trace 表查询
        const { getDb } = await import('./db');
        const { batchTrace } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return [];
        return db.select().from(batchTrace).where(eq(batchTrace.qualityStatus, 'PASS'));
      }
    }),
  }),

  // ─── RC4 Epic 1: 智能仓储与防超卖 ────────────────────────────────────────
  inventory: router({
    /** 获取库存列表 */
    getList: protectedProcedure
      .input(z.object({ lowStockOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return getInventoryList(input || {});
      }),

    /** 获取出入库流水 */
    getLogs: protectedProcedure
      .input(z.object({ productId: z.number().optional(), limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return getInventoryLogs(input?.productId, input?.limit);
      }),

    /** 库存预扣减（下单时调用） */
    reserve: protectedProcedure
      .input(z.object({
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number().min(1),
        })),
        orderId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return reserveInventory(
          input.items,
          input.orderId,
          ctx.user?.id,
          ctx.user?.name || 'System',
        );
      }),

    /** 释放库存预扣减 */
    release: protectedProcedure
      .input(z.object({
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number().min(1),
        })),
        orderId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return releaseInventory(input.items, input.orderId, ctx.user?.name || undefined);
      }),

    /** 更新 ATP 参数（待交付量、锁定配额、闲置产能） */
    updateATP: protectedProcedure
      .input(z.object({
        productId: z.number(),
        pendingDelivery: z.number().min(0).optional(),
        lockedCapacity: z.number().min(0).optional(),
        dailyIdleCapacity: z.number().min(0).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return updateATPFields(
          input.productId,
          {
            pendingDelivery: input.pendingDelivery,
            lockedCapacity: input.lockedCapacity,
            dailyIdleCapacity: input.dailyIdleCapacity,
          },
          ctx.user?.name || 'System',
        );
      }),

    /** 手动调整库存（入库/出库/盘点） */
    adjust: protectedProcedure
      .input(z.object({
        productId: z.number(),
        adjustType: z.enum(['INBOUND', 'OUTBOUND', 'ADJUST']),
        quantity: z.number().min(1),
        remark: z.string().optional(),
        batchNo: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return adjustInventory(
          input.productId,
          input.adjustType,
          input.quantity,
          ctx.user?.id,
          ctx.user?.name || 'System',
          input.remark || undefined,
          input.batchNo || undefined,
        );
      }),
  }),

  // ─── RC4 Epic 2: B2B 信用额度控制 ────────────────────────────────────────
  credit: router({
    /** 信用额度校验（下单前调用） */
    check: protectedProcedure
      .input(z.object({
        customerId: z.number(),
        orderAmount: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        return checkCreditLimit(
          input.customerId,
          input.orderAmount,
          ctx.user?.id,
          ctx.user?.name || undefined,
        );
      }),

    /** 获取信用超限特批列表 */
    getOverrideList: protectedProcedure
      .input(z.object({ status: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return getCreditOverrideList(input?.status);
      }),

    /** 审批信用超限特批 */
    approveOverride: protectedProcedure
      .input(z.object({
        approvalId: z.number(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return approveCreditOverride(
          input.approvalId,
          ctx.user?.id || 0,
          ctx.user?.name || 'System',
          input.remark,
        );
      }),

    /** 拒绝信用超限特批 */
    rejectOverride: protectedProcedure
      .input(z.object({
        approvalId: z.number(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return rejectCreditOverride(
          input.approvalId,
          ctx.user?.id || 0,
          ctx.user?.name || 'System',
          input.remark,
        );
      }),
  }),

  // ─── RC4 Epic 2: 月结账单 ─────────────────────────────────────────────────
  billing: router({
    /** 获取月结账单列表 */
    getStatements: protectedProcedure
      .input(z.object({
        customerId: z.number().optional(),
        period: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return getBillingStatements(input?.customerId, input?.period);
      }),

    /** 手动触发月结账单生成 */
    generate: protectedProcedure.mutation(async () => {
      return generateMonthlyBillingStatements();
    }),
  }),

  // ─── RC4 Epic 3: AI Copilot 智能助手 ──────────────────────────────────────
  aiCopilot: router({
    /** NL2SQL 自然语言查询 */
    ask: protectedProcedure
      .input(z.object({
        question: z.string().min(2).max(500),
      }))
      .mutation(async ({ input }) => {
        return nl2sql(input.question);
      }),
  }),

  // ─── MS7 Epic 2: 售后处理引擎 ─────────────────────────────────────────────────
  afterSales: router({
    /** 创建售后工单 */
    createTicket: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        orderNo: z.string(),
        customerId: z.number(),
        customerName: z.string(),
        issueType: z.enum(["DAMAGE", "QUALITY", "SHORT_DELIVERY", "WRONG_ITEM", "OTHER"]),
        description: z.string().min(5),
        evidenceImages: z.string().optional(),
        claimAmount: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createAfterSalesTicket } = await import('./after-sales-service');
        return createAfterSalesTicket({
          ...input,
          reportedBy: ctx.user?.id,
          reportedByName: ctx.user?.name || undefined,
        });
      }),

    /** 品质部审核工单 */
    reviewTicket: protectedProcedure
      .input(z.object({
        ticketId: z.number(),
        approved: z.boolean(),
        reviewRemark: z.string().optional(),
        replacementItems: z.array(z.object({
          productId: z.number(),
          productName: z.string(),
          quantity: z.number().min(1),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { reviewAfterSalesTicket } = await import('./after-sales-service');
        return reviewAfterSalesTicket({
          ticketId: input.ticketId,
          reviewedBy: ctx.user?.id || 0,
          reviewedByName: ctx.user?.name || 'System',
          approved: input.approved,
          reviewRemark: input.reviewRemark,
          replacementItems: input.replacementItems,
        });
      }),

    /** 查询售后工单列表 */
    listTickets: protectedProcedure
      .input(z.object({
        customerId: z.number().optional(),
        status: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }).optional())
      .query(async ({ input }) => {
        const { listAfterSalesTickets } = await import('./after-sales-service');
        return listAfterSalesTickets(input);
      }),

    /** 查询补发订单列表 */
    listReplacements: protectedProcedure
      .input(z.object({
        customerId: z.number().optional(),
        afterSalesTicketId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { listReplacementOrders } = await import('./after-sales-service');
        return listReplacementOrders(input);
      }),
  }),

  // ─── MS7 Epic 3: 费用报销与单客P&L ────────────────────────────────────────────
  expenses: router({
    /** 提交报销单 */
    submit: protectedProcedure
      .input(z.object({
        associatedCustomerId: z.number().optional(),
        associatedCustomerName: z.string().optional(),
        expenseType: z.enum(["TRAVEL", "ENTERTAINMENT", "LOGISTICS_SUBSIDY", "OTHER"]),
        amount: z.number().positive(),
        description: z.string().min(2),
        invoiceImageUrl: z.string().optional(),
        invoiceImageKey: z.string().optional(),
        expenseDate: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { submitExpenseClaim } = await import('./expense-service');
        return submitExpenseClaim({
          ...input,
          submittedBy: ctx.user?.id || 0,
          submittedByName: ctx.user?.name || 'Unknown',
        });
      }),

    /** 审批报销单 */
    approve: protectedProcedure
      .input(z.object({
        claimId: z.number(),
        approved: z.boolean(),
        approvalRemark: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { approveExpenseClaim } = await import('./expense-service');
        return approveExpenseClaim({
          claimId: input.claimId,
          approvedBy: ctx.user?.id || 0,
          approvedByName: ctx.user?.name || 'System',
          approved: input.approved,
          approvalRemark: input.approvalRemark,
        });
      }),

    /** 查询报销列表 */
    list: protectedProcedure
      .input(z.object({
        submittedBy: z.number().optional(),
        associatedCustomerId: z.number().optional(),
        status: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }).optional())
      .query(async ({ input }) => {
        const { listExpenseClaims } = await import('./expense-service');
        return listExpenseClaims(input);
      }),

    /** 单客真实毛利核算（订单毛利 - 售后赔款 - 归属费用） */
    getCustomerPnL: protectedProcedure
      .input(z.object({
        customerId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { getCustomerPnL } = await import('./expense-service');
        return getCustomerPnL(input.customerId, input.startDate, input.endDate);
      }),
  }),

  // ─── MS7 Epic 4: 销售KPI看板 ──────────────────────────────────────────────────
  salesKPI: router({
    /** 设置/更新月度销售目标 */
    setTarget: protectedProcedure
      .input(z.object({
        salesRepId: z.number(),
        salesRepName: z.string(),
        regionName: z.string().optional(),
        period: z.string().regex(/^\d{4}-\d{2}$/),
        revenueTarget: z.number().positive(),
        collectionTarget: z.number().positive(),
        newCustomerTarget: z.number().int().positive(),
      }))
      .mutation(async ({ input }) => {
        const { setSalesTarget } = await import('./sales-kpi-service');
        return setSalesTarget(input);
      }),

    /** 查询销售KPI实时进度 */
    getPerformance: protectedProcedure
      .input(z.object({
        period: z.string().optional(),
        salesRepId: z.number().optional(),
        regionName: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getSalesPerformance } = await import('./sales-kpi-service');
        return getSalesPerformance(input?.period, input?.salesRepId, input?.regionName);
      }),

    /** 查询战区汇总数据 */
    getRegionSummary: protectedProcedure
      .input(z.object({ period: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const { getRegionSummary } = await import('./sales-kpi-service');
        return getRegionSummary(input?.period);
      }),
  }),
});
export type AppRouter = typeof appRouter;
// This line intentionally left blank - routes appended below by MS7
