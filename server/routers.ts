import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ordersAPI, invoicesAPI, paymentsAPI, applyAPI, auditLogsAPI, customersAPI } from "./backend-api";

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
        startDate: z.string(),
        endDate: z.string(),
        ruleVersion: z.string().default('2026-V1'),
      }))
      .query(async ({ input }) => {
        try {
          // 步骤1：获取fulfilled状态的订单（用于计算发货总额）
          const fulfilledOrders = await ordersAPI.list({
            orgId: input.orgId,
            status: 'FULFILLED',
            page: 1,
            pageSize: 10000, // 获取所有fulfilled订单
          });

          // 计算发货总额（过滤时间范围内的订单）
          const totalShippedAmount = fulfilledOrders.data
            .filter((order: any) => {
              const fulfilledAt = new Date(order.fulfilledAt || order.updatedAt);
              return fulfilledAt >= new Date(input.startDate) && fulfilledAt <= new Date(input.endDate);
            })
            .reduce((sum: number, order: any) => sum + parseFloat(order.totalAmount || 0), 0);

          // 步骤2：获取新增客户数（创建时间在startDate之后）
          const newCustomers = await customersAPI.list({
            orgId: input.orgId,
            createdAfter: input.startDate,
            page: 1,
            pageSize: 10000, // 获取所有新客户
          });

          // 过滤时间范围内的客户
          const newCustomerCount = newCustomers.data.filter((customer: any) => {
            const createdAt = new Date(customer.createdAt);
            return createdAt >= new Date(input.startDate) && createdAt <= new Date(input.endDate);
          }).length;

          // 步骤43：从数据库获取提成规则（这里暂时使用2026-V1的默认值）
          // TODO: 实现从 sales_commission_rules 表查询规则
          const commissionRule = {
            ruleVersion: input.ruleVersion,
            baseRate: 0.02, // 2% 基础利率
            newCustomerBonus: 100, // 每个新客户100元奖励
          };

          // 步骤4：计算提成
          const baseCommission = totalShippedAmount * commissionRule.baseRate;
          const newCustomerCommission = newCustomerCount * commissionRule.newCustomerBonus;
          const totalCommission = baseCommission + newCustomerCommission;

          // 返回结果（包含ruleVersion字段）
          return {
            success: true,
            data: {
              // 统计期间
              period: {
                startDate: input.startDate,
                endDate: input.endDate,
              },
              // KPI指标
              kpi: {
                totalShippedAmount, // 发货总额
                fulfilledOrderCount: fulfilledOrders.data.length, // fulfilled订单数
                newCustomerCount, // 新增客户数
              },
              // 提成计算
              commission: {
                baseCommission, // 基础提成（发货额 × 基础利率）
                newCustomerCommission, // 新客户奖励
                totalCommission, // 总提成
              },
              // 规则版本（关联 sales_commission_rules 表）
              ruleVersion: commissionRule.ruleVersion,
              rule: commissionRule,
            },
          };
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
});

export type AppRouter = typeof appRouter;
