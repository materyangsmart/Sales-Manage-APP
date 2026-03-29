// ============================================================
// 本地用户名/密码登录服务
// ============================================================
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { users, type User } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { ENV } from "../_core/env";

const SALT_ROUNDS = 10;

// 默认超级管理员账号
const DEFAULT_ADMIN = {
  username: "admin",
  password: "Admin@2026",
  name: "超级管理员",
  email: "admin@qianzhang.local",
  role: "admin" as const,
};

/**
 * 哈希密码
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * 验证密码
 */
export async function verifyPassword(
  plain: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

/**
 * 通过 openId（本地登录用 "local:<username>" 格式）查找用户
 */
function localOpenId(username: string): string {
  return `local:${username}`;
}

/**
 * 种子：确保默认超级管理员存在
 * 在服务启动时调用一次
 */
export async function seedDefaultAdmin(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[LocalAuth] DB not available, skipping admin seed");
    return;
  }

  const openId = localOpenId(DEFAULT_ADMIN.username);
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  if (existing.length > 0) {
    console.log("[LocalAuth] Default admin already exists (id=" + existing[0].id + ")");
    return;
  }

  const hashedPw = await hashPassword(DEFAULT_ADMIN.password);
  await db.insert(users).values({
    openId,
    name: DEFAULT_ADMIN.name,
    email: DEFAULT_ADMIN.email,
    role: DEFAULT_ADMIN.role,
    loginMethod: "local",
    // 密码哈希存储在 imUnionid 字段（复用现有 schema，避免 ALTER TABLE）
    imUnionid: hashedPw,
    imProvider: null,
  } as any);

  console.log("[LocalAuth] ✓ Default admin seeded: username=admin");
}

/**
 * 本地登录：验证用户名+密码，返回 JWT token
 */
export async function localLogin(
  username: string,
  password: string
): Promise<{ token: string; user: Pick<User, "id" | "name" | "email" | "role" | "openId"> }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const openId = localOpenId(username);
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error("用户名或密码错误");
  }

  const user = rows[0];
  // 密码哈希存储在 imUnionid 字段
  const storedHash = user.imUnionid;
  if (!storedHash) {
    throw new Error("该账户未设置本地密码");
  }

  const valid = await verifyPassword(password, storedHash);
  if (!valid) {
    throw new Error("用户名或密码错误");
  }

  // 使用现有 SDK 签发 JWT（复用同一套 cookie 机制）
  const token = await sdk.signSession({
    openId: user.openId,
    appId: ENV.appId || "local-app",
    name: user.name || username,
  });

  // 更新最后登录时间
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, user.id));

  console.log(`[LocalAuth] ✓ Login success: username=${username}, userId=${user.id}`);

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      openId: user.openId,
    },
  };
}

/**
 * 修改密码
 */
export async function changePassword(
  userId: number,
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (rows.length === 0) throw new Error("用户不存在");

  const user = rows[0];
  const storedHash = user.imUnionid;
  if (!storedHash) throw new Error("该账户未设置本地密码");

  const valid = await verifyPassword(oldPassword, storedHash);
  if (!valid) throw new Error("原密码错误");

  const newHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ imUnionid: newHash } as any)
    .where(eq(users.id, userId));

  console.log(`[LocalAuth] ✓ Password changed for userId=${userId}`);
  return true;
}

/**
 * 创建本地用户（管理员操作）
 */
export async function createLocalUser(params: {
  username: string;
  password: string;
  name: string;
  email?: string;
  role?: "admin" | "user" | "sales" | "fulfillment" | "finance" | "auditor";
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const openId = localOpenId(params.username);

  // 检查用户名是否已存在
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  if (existing.length > 0) {
    throw new Error(`用户名 "${params.username}" 已存在`);
  }

  const hashedPw = await hashPassword(params.password);
  const result = await db.insert(users).values({
    openId,
    name: params.name,
    email: params.email || null,
    role: params.role || "user",
    loginMethod: "local",
    imUnionid: hashedPw,
    imProvider: null,
  } as any);

  const insertId = (result as any)[0]?.insertId ?? 0;
  console.log(`[LocalAuth] ✓ Local user created: username=${params.username}, id=${insertId}`);
  return insertId;
}

/**
 * 查询所有用户列表（管理员操作）
 */
export async function listUsers(): Promise<Array<{
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: string;
  loginMethod: string | null;
  createdAt: Date;
  lastSignedIn: Date;
}>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      loginMethod: users.loginMethod,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(users.id);

  return rows.map((r) => ({
    ...r,
    // 从 openId 提取用户名用于显示
    username: r.openId.startsWith('local:') ? r.openId.slice(6) : r.openId,
  }));
}

/**
 * 修改用户角色（管理员操作）
 */
export async function updateUserRole(
  userId: number,
  newRole: "admin" | "user" | "sales" | "fulfillment" | "finance" | "auditor"
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (rows.length === 0) throw new Error("用户不存在");

  await db
    .update(users)
    .set({ role: newRole })
    .where(eq(users.id, userId));

  console.log(`[LocalAuth] ✓ Role updated: userId=${userId}, newRole=${newRole}`);
  return true;
}

/**
 * 管理员重置用户密码
 */
export async function resetUserPassword(
  userId: number,
  newPassword: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (rows.length === 0) throw new Error("用户不存在");

  const newHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ imUnionid: newHash } as any)
    .where(eq(users.id, userId));

  console.log(`[LocalAuth] ✓ Password reset by admin for userId=${userId}`);
  return true;
}

/**
 * 删除用户（管理员操作，不允许删除自己）
 */
export async function deleteUser(
  adminUserId: number,
  targetUserId: number
): Promise<boolean> {
  if (adminUserId === targetUserId) {
    throw new Error("不能删除自己的账户");
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (rows.length === 0) throw new Error("用户不存在");

  await db.delete(users).where(eq(users.id, targetUserId));

  console.log(`[LocalAuth] ✓ User deleted: userId=${targetUserId} by admin=${adminUserId}`);
  return true;
}
