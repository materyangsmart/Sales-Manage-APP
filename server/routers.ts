import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ordersAPI, invoicesAPI, paymentsAPI, applyAPI, auditLogsAPI, customersAPI, commissionRulesAPI } from "./backend-api";

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
        startDate: z.string(), // ISO 8601 date string
        endDate: z.string(),
        ruleVersion: z.string(), // e.g., "2026-V1"
        customerCategory: z.enum(['WET_MARKET', 'WHOLESALE_B', 'SUPERMARKET', 'ECOMMERCE', 'DEFAULT']).optional(), // 客户类型过滤
      }))
      .query(async ({ input }) => {
        try {
          // 步骤1：获取fulfilled订单（发货总额）
          const fulfilledOrders = await ordersAPI.list({
            orgId: input.orgId,
            status: 'fulfilled',
            page: 1,
            pageSize: 10000, // 获取所有订单
          });

          // 步骤2：获取收款数据（用于账期扣减）
          const payments = await paymentsAPI.list({
            orgId: input.orgId,
            page: 1,
            pageSize: 10000,
          });

          // 步骤3：获取毛利数据（用于SUPERMARKET类别）
          const marginStats = await invoicesAPI.getMarginStats({
            orgId: input.orgId,
            startDate: input.startDate,
            endDate: input.endDate,
          });

          // 步骤4：从数据库获取提成规则
          const { getCommissionRule } = await import('./db');
          const category = input.customerCategory || 'DEFAULT';
          const dbRule = await getCommissionRule(input.ruleVersion, category);
          
          if (!dbRule) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Commission rule not found: ${input.ruleVersion} (category: ${category})`,
            });
          }

          // 解析规则配置
          const commissionRule = {
            ruleVersion: dbRule.ruleVersion,
            category: dbRule.category,
            baseRate: parseFloat(dbRule.baseRate),
            newCustomerBonus: parseFloat(dbRule.newCustomerBonus),
            ruleJson: dbRule.ruleJson ? JSON.parse(dbRule.ruleJson) : {},
          };

          // 步骤5：按客户类型分层计算
          let totalShippedAmount = 0;
          let totalMargin = 0;
          let validPaymentAmount = 0; // 账期内的收款额
          let overduePaymentAmount = 0; // 超账期的收款额

          // 计算发货总额（只统计期间内的订单）
          const filteredOrders = fulfilledOrders.data.filter((order: any) => {
            const fulfilledAt = new Date(order.fulfilledAt);
            const inPeriod = fulfilledAt >= new Date(input.startDate) && fulfilledAt <= new Date(input.endDate);
            
            // 如果指定了客户类型，只统计该类型的订单
            if (input.customerCategory && order.customer?.category !== input.customerCategory) {
              return false;
            }
            
            return inPeriod;
          });

          totalShippedAmount = filteredOrders.reduce((sum: number, order: any) => {
            return sum + parseFloat(order.totalAmount || '0');
          }, 0);

          // 计算账期扣减（超账期的收款不计入提成基数）
          const paymentDueDays = commissionRule.ruleJson.paymentDueDays || 30; // 默认30天账期
          
          payments.data.forEach((payment: any) => {
            const paymentDate = new Date(payment.createdAt);
            const appliedDate = payment.appliedAt ? new Date(payment.appliedAt) : null;
            
            if (appliedDate) {
              const daysDiff = Math.floor((appliedDate.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
              
              if (daysDiff <= paymentDueDays) {
                validPaymentAmount += parseFloat(payment.appliedAmount || '0');
              } else {
                overduePaymentAmount += parseFloat(payment.appliedAmount || '0');
              }
            }
          });

          // 计算毛利（用于SUPERMARKET类别）
          totalMargin = marginStats.data?.totalMargin || 0;

          // 步骤6：获取新增客户数
          const newCustomers = await customersAPI.list({
            orgId: input.orgId,
            createdAfter: input.startDate,
            page: 1,
            pageSize: 10000,
          });

          const newCustomerCount = newCustomers.data.filter((customer: any) => {
            const createdAt = new Date(customer.createdAt);
            const inPeriod = createdAt >= new Date(input.startDate) && createdAt <= new Date(input.endDate);
            
            // 如果指定了客户类型，只统计该类型的客户
            if (input.customerCategory && customer.category !== input.customerCategory) {
              return false;
            }
            
            return inPeriod;
          }).length;

          // 步骤7：根据客户类型应用不同的计算公式
          let baseCommission = 0;
          let marginCommission = 0;
          let collectionCommission = 0;
          let newCustomerCommission = 0;

          switch (category) {
            case 'SUPERMARKET':
              // 商超类：毛利维度为核心权重
              marginCommission = totalMargin * (commissionRule.ruleJson.marginWeight || 0.5);
              baseCommission = totalShippedAmount * commissionRule.baseRate * 0.5; // 降低发货额权重
              break;
              
            case 'WET_MARKET':
            case 'WHOLESALE_B':
              // 地推型/批发型：回款维度为重点
              collectionCommission = validPaymentAmount * (commissionRule.ruleJson.collectionWeight || 0.02);
              baseCommission = totalShippedAmount * commissionRule.baseRate;
              break;
              
            case 'ECOMMERCE':
              // 电商类：均衡发货额和新客户
              baseCommission = totalShippedAmount * commissionRule.baseRate;
              newCustomerCommission = newCustomerCount * commissionRule.newCustomerBonus * 1.5; // 提高新客户奖励
              break;
              
            default:
              // 默认规则
              baseCommission = totalShippedAmount * commissionRule.baseRate;
              newCustomerCommission = newCustomerCount * commissionRule.newCustomerBonus;
              break;
          }

          const totalCommission = baseCommission + marginCommission + collectionCommission + newCustomerCommission;

          // 返回结果
          return {
            success: true,
            data: {
              period: {
                startDate: input.startDate,
                endDate: input.endDate,
              },
              kpi: {
                totalShippedAmount,
                fulfilledOrderCount: filteredOrders.length,
                newCustomerCount,
                totalMargin, // 毛利总额
                validPaymentAmount, // 账期内收款
                overduePaymentAmount, // 超账期收款
              },
              commission: {
                baseCommission,
                marginCommission,
                collectionCommission,
                newCustomerCommission,
                totalCommission,
              },
              ruleVersion: commissionRule.ruleVersion,
              category: commissionRule.category,
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
