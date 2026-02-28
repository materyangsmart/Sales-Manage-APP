import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ordersAPI, invoicesAPI, paymentsAPI, applyAPI, auditLogsAPI, customersAPI, commissionRulesAPI, ceoRadarAPI, antiFraudAPI, creditAPI, governanceAPI, complaintAPI, employeeAPI, myPerformanceAPI, traceabilityAPI, feedbackAPI, rbacAPI, workflowAPI, notificationAPI } from "./backend-api";

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
});

export type AppRouter = typeof appRouter;
