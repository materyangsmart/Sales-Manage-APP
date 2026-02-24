import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Development mode: Auto-inject mock user if no session exists
  if (process.env.NODE_ENV === 'development' && !user) {
    console.log('[tRPC Context] DEV MODE: Injecting mock user (ID: 1, Role: admin)');
    user = {
      id: 1,
      openId: 'mock-dev-user',
      name: 'Dev User',
      email: 'dev@example.com',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
