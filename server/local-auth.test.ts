import { describe, it, expect, beforeAll, afterAll } from "vitest";

// ============================================================
// 本地登录系统 E2E 测试
// ============================================================

describe("Local Auth System", () => {
  // T1: VITE_ENABLE_OAUTH 环境变量已设置
  it("T1: VITE_ENABLE_OAUTH env is set to false", () => {
    // 在测试环境中验证环境变量存在
    const val = process.env.VITE_ENABLE_OAUTH;
    // 值应该为 "false"（字符串）
    expect(val).toBe("false");
  });

  // T2: 密码哈希与验证
  it("T2: hashPassword and verifyPassword work correctly", async () => {
    const { hashPassword, verifyPassword } = await import("./services/local-auth-service");
    const plain = "TestPassword123!";
    const hashed = await hashPassword(plain);
    
    // 哈希不应等于明文
    expect(hashed).not.toBe(plain);
    // 哈希应以 $2a$ 或 $2b$ 开头（bcrypt 格式）
    expect(hashed).toMatch(/^\$2[ab]\$/);
    
    // 正确密码验证通过
    const valid = await verifyPassword(plain, hashed);
    expect(valid).toBe(true);
    
    // 错误密码验证失败
    const invalid = await verifyPassword("WrongPassword", hashed);
    expect(invalid).toBe(false);
  });

  // T3: localLogin 对不存在的用户抛出错误
  it("T3: localLogin rejects non-existent user", async () => {
    const { localLogin } = await import("./services/local-auth-service");
    await expect(
      localLogin("nonexistent_user_xyz_999", "anypassword")
    ).rejects.toThrow("用户名或密码错误");
  });

  // T4: localLogin 对错误密码抛出错误（需要 admin 种子已运行）
  it("T4: localLogin rejects wrong password for admin", async () => {
    const { seedDefaultAdmin, localLogin } = await import("./services/local-auth-service");
    // 确保 admin 存在
    await seedDefaultAdmin();
    
    await expect(
      localLogin("admin", "WrongPassword999!")
    ).rejects.toThrow("用户名或密码错误");
  });

  // T5: localLogin 成功返回 JWT token
  it("T5: localLogin succeeds with correct credentials", async () => {
    const { seedDefaultAdmin, localLogin } = await import("./services/local-auth-service");
    await seedDefaultAdmin();
    
    const result = await localLogin("admin", "Admin@2026");
    
    expect(result).toBeDefined();
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe("string");
    expect(result.token.length).toBeGreaterThan(10);
    expect(result.user).toBeDefined();
    expect(result.user.name).toBe("超级管理员");
    expect(result.user.role).toBe("admin");
    expect(result.user.openId).toBe("local:admin");
  });

  // T6: createLocalUser 创建新用户
  it("T6: createLocalUser creates a new user", async () => {
    const { createLocalUser, localLogin } = await import("./services/local-auth-service");
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    
    const testUsername = `testuser_${Date.now()}`;
    const testPassword = "Test@123456";
    
    const userId = await createLocalUser({
      username: testUsername,
      password: testPassword,
      name: "测试用户",
      email: "test@example.com",
      role: "user",
    });
    
    expect(userId).toBeGreaterThan(0);
    
    // 用新账号登录验证
    const result = await localLogin(testUsername, testPassword);
    expect(result.user.name).toBe("测试用户");
    expect(result.user.role).toBe("user");
    
    // 清理：删除测试用户
    const { users } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(users).where(eq(users.openId, `local:${testUsername}`));
  });

  // T7: createLocalUser 拒绝重复用户名
  it("T7: createLocalUser rejects duplicate username", async () => {
    const { seedDefaultAdmin, createLocalUser } = await import("./services/local-auth-service");
    await seedDefaultAdmin();
    
    await expect(
      createLocalUser({
        username: "admin",
        password: "AnotherPw123!",
        name: "Another Admin",
      })
    ).rejects.toThrow("已存在");
  });

  // T8: changePassword 修改密码后旧密码失效
  it("T8: changePassword invalidates old password", async () => {
    const { createLocalUser, localLogin, changePassword } = await import("./services/local-auth-service");
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    
    const testUsername = `pwchange_${Date.now()}`;
    const oldPw = "OldPass@123";
    const newPw = "NewPass@456";
    
    await createLocalUser({
      username: testUsername,
      password: oldPw,
      name: "密码测试用户",
    });
    
    // 先登录获取 userId
    const loginResult = await localLogin(testUsername, oldPw);
    const userId = loginResult.user.id;
    
    // 修改密码
    await changePassword(userId, oldPw, newPw);
    
    // 旧密码应该失败
    await expect(localLogin(testUsername, oldPw)).rejects.toThrow("用户名或密码错误");
    
    // 新密码应该成功
    const newResult = await localLogin(testUsername, newPw);
    expect(newResult.token).toBeDefined();
    
    // 清理
    const { users } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(users).where(eq(users.openId, `local:${testUsername}`));
  });
});
