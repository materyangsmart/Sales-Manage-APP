import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ordersAPI, invoicesAPI, paymentsAPI, applyAPI, auditLogsAPI } from "./backend-api";

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
