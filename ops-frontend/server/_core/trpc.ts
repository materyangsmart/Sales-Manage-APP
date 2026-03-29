import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * RBAC 角色守卫中间件工厂
 * 用法: roleProcedure(['admin', 'finance']) → 仅 admin 和 finance 角色可调用
 */
export function roleProcedure(allowedRoles: string[]) {
  return protectedProcedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;
      const user = ctx.user!;
      const userRole = user.role || 'user';
      // admin 始终放行
      if (userRole === 'admin' || allowedRoles.includes(userRole)) {
        return next({ ctx: { ...ctx, user } });
      }
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `权限不足：您的角色 [${userRole}] 无权访问此功能（需要: ${allowedRoles.join('/')}）`,
      });
    }),
  );
}
