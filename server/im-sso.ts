/**
 * IM SSO 认证服务
 * 支持企业微信（WECOM）和钉钉（DINGTALK）免密登录
 * 本地开发使用 Mock IM OAuth 服务模拟外部 IM 接口
 */

import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";

// ============================================================
// 类型定义
// ============================================================

export type IMProvider = "WECOM" | "DINGTALK";

export interface IMUserInfo {
  unionid: string;
  name: string;
  email?: string;
  mobile?: string;
  avatar?: string;
  provider: IMProvider;
}

export interface IMLoginResult {
  token: string;
  user: {
    id: number;
    openId: string;
    name: string | null;
    email: string | null;
    role: "user" | "admin";
    imUnionid: string;
    imProvider: IMProvider;
    isNewUser: boolean;
  };
}

// ============================================================
// Mock IM OAuth 服务
// 在本地开发环境中模拟企业微信/钉钉的 code 换 userinfo 行为
// 生产环境中替换为真实的 IM SDK 调用
// ============================================================

/**
 * Mock 企业微信 code 换取用户信息
 * 真实实现：POST https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo
 */
async function mockWECOMCodeExchange(code: string): Promise<IMUserInfo> {
  console.log(`[IM-SSO] WECOM Mock: exchanging code=${code}`);

  // Mock 数据库：code -> userinfo 映射（模拟企业微信 OAuth 服务器）
  const mockUsers: Record<string, IMUserInfo> = {
    "mock_wecom_code_001": {
      unionid: "wecom_uid_sales_001",
      name: "张三（外勤销售）",
      email: "zhangsan@company.com",
      mobile: "13800138001",
      provider: "WECOM",
    },
    "mock_wecom_code_002": {
      unionid: "wecom_uid_sales_002",
      name: "李四（区域经理）",
      email: "lisi@company.com",
      mobile: "13800138002",
      provider: "WECOM",
    },
    "mock_wecom_code_new": {
      unionid: "wecom_uid_new_user_999",
      name: "新销售员工",
      email: "newstaff@company.com",
      mobile: "13900139001",
      provider: "WECOM",
    },
  };

  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 50));

  const userInfo = mockUsers[code];
  if (!userInfo) {
    throw new Error(`[WECOM Mock] Invalid or expired code: ${code}`);
  }

  console.log(`[IM-SSO] WECOM Mock: resolved unionid=${userInfo.unionid}, name=${userInfo.name}`);
  return userInfo;
}

/**
 * Mock 钉钉 code 换取用户信息
 * 真实实现：POST https://oapi.dingtalk.com/sns/getuserinfo_bycode
 */
async function mockDINGTALKCodeExchange(code: string): Promise<IMUserInfo> {
  console.log(`[IM-SSO] DINGTALK Mock: exchanging code=${code}`);

  const mockUsers: Record<string, IMUserInfo> = {
    "mock_ding_code_001": {
      unionid: "ding_uid_sales_001",
      name: "王五（钉钉销售）",
      email: "wangwu@company.com",
      mobile: "13700137001",
      provider: "DINGTALK",
    },
    "mock_ding_code_new": {
      unionid: "ding_uid_new_999",
      name: "新钉钉员工",
      email: "newding@company.com",
      provider: "DINGTALK",
    },
  };

  await new Promise(resolve => setTimeout(resolve, 50));

  const userInfo = mockUsers[code];
  if (!userInfo) {
    throw new Error(`[DINGTALK Mock] Invalid or expired code: ${code}`);
  }

  console.log(`[IM-SSO] DINGTALK Mock: resolved unionid=${userInfo.unionid}, name=${userInfo.name}`);
  return userInfo;
}

/**
 * 通过 IM code 换取用户信息（路由到对应的 Mock 服务）
 */
export async function exchangeIMCode(code: string, provider: IMProvider): Promise<IMUserInfo> {
  if (provider === "WECOM") {
    return mockWECOMCodeExchange(code);
  } else if (provider === "DINGTALK") {
    return mockDINGTALKCodeExchange(code);
  }
  throw new Error(`Unsupported IM provider: ${provider}`);
}

// ============================================================
// 核心 SSO 逻辑：imLogin
// ============================================================

/**
 * IM 免密登录主方法
 *
 * 流程：
 * 1. 通过 code 向 Mock IM 服务换取 unionid + 用户信息
 * 2. 查询数据库是否已有绑定该 unionid 的用户
 * 3. 若存在 → 直接签发 JWT
 * 4. 若不存在 → 自动静默注册（分配 user 角色）→ 签发 JWT
 *
 * @param code - 前端移动端传来的 IM 授权 code
 * @param provider - IM 平台类型（WECOM / DINGTALK）
 */
export async function imLogin(code: string, provider: IMProvider): Promise<IMLoginResult> {
  console.log(`[IM-SSO] imLogin called: provider=${provider}, code=${code}`);

  // Step 1: 通过 Mock IM 服务换取用户信息
  const imUserInfo = await exchangeIMCode(code, provider);

  const db = await getDb();
  if (!db) {
    throw new Error("[IM-SSO] Database not available");
  }

  // Step 2: 查询是否已有绑定该 IM unionid 的用户
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.imUnionid as any, imUserInfo.unionid))
    .limit(1);

  let user = existingUsers[0];
  let isNewUser = false;

  if (user) {
    // Step 3: 用户已存在，更新最后登录时间
    console.log(`[IM-SSO] Existing user found: id=${user.id}, openId=${user.openId}`);
    await db
      .update(users)
      .set({ lastSignedIn: new Date() })
      .where(eq(users.id, user.id));
  } else {
    // Step 4: 用户不存在，自动静默注册
    console.log(`[IM-SSO] New user, auto-registering: unionid=${imUserInfo.unionid}`);
    isNewUser = true;

    // 生成唯一 openId（IM 平台前缀 + unionid）
    const openId = `${provider.toLowerCase()}_${imUserInfo.unionid}`;

    await db.insert(users).values({
      openId,
      name: imUserInfo.name,
      email: imUserInfo.email ?? null,
      loginMethod: provider,
      role: "user", // 默认分配基础角色
      imUnionid: imUserInfo.unionid,
      imProvider: provider,
      lastSignedIn: new Date(),
    } as any);

    const newUsers = await db
      .select()
      .from(users)
      .where(eq(users.openId, openId))
      .limit(1);

    user = newUsers[0];
    if (!user) {
      throw new Error("[IM-SSO] Failed to create user after registration");
    }

    console.log(`[IM-SSO] New user registered: id=${user.id}, openId=${user.openId}`);
  }

  // Step 5: 签发 JWT Session Token（复用现有 SDK 的签发机制）
  const token = await sdk.createSessionToken(user.openId, {
    name: user.name ?? imUserInfo.name,
    expiresInMs: 7 * 24 * 60 * 60 * 1000, // 7 天有效期
  });

  console.log(`[IM-SSO] JWT issued for user id=${user.id}, isNewUser=${isNewUser}`);

  return {
    token,
    user: {
      id: user.id,
      openId: user.openId,
      name: user.name,
      email: user.email,
      role: user.role,
      imUnionid: imUserInfo.unionid,
      imProvider: provider,
      isNewUser,
    },
  };
}

/**
 * 通过 userId 查询 IM 绑定信息（用于消息推送路由判断）
 */
export async function getUserIMBinding(userId: number): Promise<{ imUnionid: string; imProvider: IMProvider } | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      imUnionid: users.imUnionid,
      imProvider: users.imProvider,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const row = result[0];
  if (!row || !row.imUnionid || !row.imProvider) return null;

  return {
    imUnionid: row.imUnionid,
    imProvider: row.imProvider as IMProvider,
  };
}
