/**
 * IM SSO 认证服务 (RC2 - 生产级真实 API 接入)
 * 
 * 支持企业微信（WECOM）和钉钉（DINGTALK）免密登录
 * 通过 IM_MODE 环境变量切换 mock/real 模式：
 *   IM_MODE=real  → 调用真实企业微信/钉钉 API
 *   IM_MODE=mock  → 使用 Mock 模拟（默认，用于开发/测试）
 * 
 * 真实模式所需环境变量：
 *   WECOM_CORP_ID, WECOM_CORP_SECRET, WECOM_AGENT_ID
 *   DINGTALK_APP_KEY, DINGTALK_APP_SECRET
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
// 环境模式判断
// ============================================================

function getIMMode(): "real" | "mock" {
  return (process.env.IM_MODE === "real") ? "real" : "mock";
}

// ============================================================
// 真实企业微信 API
// ============================================================

/**
 * 真实企业微信 OAuth：通过 code 获取用户信息
 * 
 * 流程：
 * 1. 用 corpid + corpsecret 获取 access_token
 * 2. 用 access_token + code 调用 getuserinfo 获取 UserId
 * 3. 用 access_token + UserId 调用 user/get 获取完整用户信息
 * 
 * 文档：https://developer.work.weixin.qq.com/document/path/91023
 */
async function realWECOMCodeExchange(code: string): Promise<IMUserInfo> {
  const corpId = process.env.WECOM_CORP_ID;
  const corpSecret = process.env.WECOM_CORP_SECRET;

  if (!corpId || !corpSecret) {
    throw new Error("[WECOM Real] Missing WECOM_CORP_ID or WECOM_CORP_SECRET environment variables");
  }

  console.log(`[IM-SSO] WECOM Real API: Fetching access_token for corpId=${corpId}`);

  // Step 1: 获取 access_token
  const tokenResp = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`
  );
  const tokenData = await tokenResp.json() as any;

  if (tokenData.errcode !== 0) {
    throw new Error(`[WECOM Real] Token error: errcode=${tokenData.errcode}, errmsg=${tokenData.errmsg}`);
  }

  const accessToken = tokenData.access_token;
  console.log(`[IM-SSO] WECOM Real API: access_token obtained, expires_in=${tokenData.expires_in}s`);

  // Step 2: 通过 code 获取 UserId
  const userInfoResp = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo?access_token=${accessToken}&code=${code}`
  );
  const userInfoData = await userInfoResp.json() as any;

  if (userInfoData.errcode !== 0) {
    throw new Error(`[WECOM Real] getuserinfo error: errcode=${userInfoData.errcode}, errmsg=${userInfoData.errmsg}`);
  }

  const userId = userInfoData.userid || userInfoData.UserId;
  if (!userId) {
    throw new Error("[WECOM Real] No userid returned from getuserinfo (may be external user)");
  }

  console.log(`[IM-SSO] WECOM Real API: userId=${userId}`);

  // Step 3: 获取完整用户信息
  const userDetailResp = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=${accessToken}&userid=${userId}`
  );
  const userDetail = await userDetailResp.json() as any;

  if (userDetail.errcode !== 0) {
    throw new Error(`[WECOM Real] user/get error: errcode=${userDetail.errcode}, errmsg=${userDetail.errmsg}`);
  }

  console.log(`[IM-SSO] WECOM Real API: resolved name=${userDetail.name}, email=${userDetail.email}`);

  return {
    unionid: userId, // 企业微信内部使用 userid 作为唯一标识
    name: userDetail.name || userId,
    email: userDetail.email || undefined,
    mobile: userDetail.mobile || undefined,
    avatar: userDetail.avatar || undefined,
    provider: "WECOM",
  };
}

/**
 * 真实钉钉 OAuth：通过 code 获取用户信息
 * 
 * 流程：
 * 1. 用 appkey + appsecret 获取 access_token
 * 2. 用 access_token + code 调用 user/getuserinfo 获取 userid
 * 3. 用 access_token + userid 调用 topapi/v2/user/get 获取完整用户信息
 * 
 * 文档：https://open.dingtalk.com/document/orgapp/obtain-the-userid-of-a-user-by-using-the-log-free
 */
async function realDINGTALKCodeExchange(code: string): Promise<IMUserInfo> {
  const appKey = process.env.DINGTALK_APP_KEY;
  const appSecret = process.env.DINGTALK_APP_SECRET;

  if (!appKey || !appSecret) {
    throw new Error("[DINGTALK Real] Missing DINGTALK_APP_KEY or DINGTALK_APP_SECRET environment variables");
  }

  console.log(`[IM-SSO] DINGTALK Real API: Fetching access_token for appKey=${appKey}`);

  // Step 1: 获取 access_token
  const tokenResp = await fetch(
    `https://oapi.dingtalk.com/gettoken?appkey=${appKey}&appsecret=${appSecret}`
  );
  const tokenData = await tokenResp.json() as any;

  if (tokenData.errcode !== 0) {
    throw new Error(`[DINGTALK Real] Token error: errcode=${tokenData.errcode}, errmsg=${tokenData.errmsg}`);
  }

  const accessToken = tokenData.access_token;
  console.log(`[IM-SSO] DINGTALK Real API: access_token obtained, expires_in=${tokenData.expires_in}s`);

  // Step 2: 通过 code 获取 userid
  const userInfoResp = await fetch(
    `https://oapi.dingtalk.com/topapi/v2/user/getuserinfo?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }
  );
  const userInfoData = await userInfoResp.json() as any;

  if (userInfoData.errcode !== 0) {
    throw new Error(`[DINGTALK Real] getuserinfo error: errcode=${userInfoData.errcode}, errmsg=${userInfoData.errmsg}`);
  }

  const userId = userInfoData.result?.userid;
  if (!userId) {
    throw new Error("[DINGTALK Real] No userid returned from getuserinfo");
  }

  console.log(`[IM-SSO] DINGTALK Real API: userId=${userId}`);

  // Step 3: 获取完整用户信息
  const userDetailResp = await fetch(
    `https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userid: userId }),
    }
  );
  const userDetail = await userDetailResp.json() as any;

  if (userDetail.errcode !== 0) {
    throw new Error(`[DINGTALK Real] user/get error: errcode=${userDetail.errcode}, errmsg=${userDetail.errmsg}`);
  }

  const detail = userDetail.result || {};
  console.log(`[IM-SSO] DINGTALK Real API: resolved name=${detail.name}, mobile=${detail.mobile}`);

  return {
    unionid: detail.unionid || userId,
    name: detail.name || userId,
    email: detail.email || undefined,
    mobile: detail.mobile || undefined,
    avatar: detail.avatar || undefined,
    provider: "DINGTALK",
  };
}

// ============================================================
// Mock IM OAuth 服务（开发/测试环境）
// ============================================================

async function mockWECOMCodeExchange(code: string): Promise<IMUserInfo> {
  console.log(`[IM-SSO] WECOM Mock: exchanging code=${code}`);

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

  await new Promise(resolve => setTimeout(resolve, 50));

  const userInfo = mockUsers[code];
  if (!userInfo) {
    throw new Error(`[WECOM Mock] Invalid or expired code: ${code}`);
  }

  console.log(`[IM-SSO] WECOM Mock: resolved unionid=${userInfo.unionid}, name=${userInfo.name}`);
  return userInfo;
}

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

// ============================================================
// 统一 code 换取接口（自动路由 real/mock）
// ============================================================

/**
 * 通过 IM code 换取用户信息
 * 根据 IM_MODE 环境变量自动选择真实 API 或 Mock
 */
export async function exchangeIMCode(code: string, provider: IMProvider): Promise<IMUserInfo> {
  const mode = getIMMode();
  console.log(`[IM-SSO] exchangeIMCode: provider=${provider}, mode=${mode}`);

  if (provider === "WECOM") {
    return mode === "real" ? realWECOMCodeExchange(code) : mockWECOMCodeExchange(code);
  } else if (provider === "DINGTALK") {
    return mode === "real" ? realDINGTALKCodeExchange(code) : mockDINGTALKCodeExchange(code);
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
 * 1. 通过 code 向 IM 服务换取 unionid + 用户信息
 * 2. 查询数据库是否已有绑定该 unionid 的用户
 * 3. 若存在 → 直接签发 JWT
 * 4. 若不存在 → 自动静默注册（分配 user 角色）→ 签发 JWT
 */
export async function imLogin(code: string, provider: IMProvider): Promise<IMLoginResult> {
  console.log(`[IM-SSO] imLogin called: provider=${provider}, code=${code}, mode=${getIMMode()}`);

  // Step 1: 通过 IM 服务换取用户信息
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

    const openId = `${provider.toLowerCase()}_${imUserInfo.unionid}`;

    await db.insert(users).values({
      openId,
      name: imUserInfo.name,
      email: imUserInfo.email ?? null,
      loginMethod: provider,
      role: "user",
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

  // Step 5: 签发 JWT Session Token
  const token = await sdk.createSessionToken(user.openId, {
    name: user.name ?? imUserInfo.name,
    expiresInMs: 7 * 24 * 60 * 60 * 1000,
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
