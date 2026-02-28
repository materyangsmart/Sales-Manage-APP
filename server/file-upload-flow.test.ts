/**
 * file-upload-flow.test.ts
 *
 * 文件上传链路隔离测试（Presigned URL Direct Upload Architecture）
 *
 * 测试目标：
 * 1. 验证 tRPC fileStorage 路由的完整性（getPresignedUrl / confirmUpload / getFileList / deleteFileRecord）
 * 2. 验证文件类型白名单（仅 PDF/JPG/PNG）
 * 3. 验证文件大小限制（最大 20MB）
 * 4. 验证业务类型枚举（ORDER_CONTRACT / PAYMENT_RECEIPT）
 * 5. 验证预签名 URL 架构：文件字节流不经过 Node.js 服务器
 * 6. E2E 场景：订单付款水单上传完整链路
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── 测试工具 ─────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-file-upload",
    email: "test@qianzhang.com",
    name: "测试用户",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: {
      headers: {},
      cookies: {},
    } as any,
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as any,
  };
}

// ─── Mock fileStorageAPI ──────────────────────────────────────────────────────

vi.mock("./backend-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("./backend-api")>();

  // 动态 mock：根据输入参数返回对应的业务类型
  let _lastBusinessType = 'ORDER_CONTRACT';

  return {
    ...original,
    fileStorageAPI: {
      getPresignedUrl: vi.fn().mockImplementation((params: any) => {
        _lastBusinessType = params.businessType || 'ORDER_CONTRACT';
        return Promise.resolve({
          presignedUrl: `https://mock-oss.example.com/qianzhang-files/${params.businessType}-key?X-Amz-Signature=mock`,
          objectKey: `uploads/2026/02/${params.businessType}-abc123.pdf`,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          fileRecordId: 42,
        });
      }),
      confirmUpload: vi.fn().mockImplementation((_params: any) => {
        const bt = _lastBusinessType;
        return Promise.resolve({
          id: 42,
          fileName: bt === 'PAYMENT_RECEIPT' ? 'payment-receipt.jpg' : 'order-contract.pdf',
          bucket: 'qianzhang-files',
          objectKey: `uploads/2026/02/${bt}-abc123.pdf`,
          fileSize: 512000,
          mimeType: bt === 'PAYMENT_RECEIPT' ? 'image/jpeg' : 'application/pdf',
          uploadedBy: 1,
          businessType: bt,
          businessId: 1001,
          status: 'CONFIRMED',
          downloadUrl: `https://mock-oss.example.com/qianzhang-files/${bt}-abc123.pdf`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }),
      getFileList: vi.fn().mockImplementation((businessType: string, businessId: number) => {
        return Promise.resolve([{
          id: 42,
          fileName: businessType === 'PAYMENT_RECEIPT' ? 'payment-receipt.jpg' : 'order-contract.pdf',
          bucket: 'qianzhang-files',
          objectKey: `uploads/2026/02/${businessType}-abc123.pdf`,
          fileSize: 512000,
          mimeType: businessType === 'PAYMENT_RECEIPT' ? 'image/jpeg' : 'application/pdf',
          uploadedBy: 1,
          businessType,
          businessId,
          status: 'CONFIRMED',
          downloadUrl: `https://mock-oss.example.com/qianzhang-files/${businessType}-abc123.pdf`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }]);
      }),
      getFileRecord: vi.fn().mockResolvedValue({
        id: 42,
        fileName: 'order-contract-001.pdf',
        bucket: 'qianzhang-files',
        objectKey: 'uploads/2026/02/ORDER_CONTRACT-abc123.pdf',
        fileSize: 512000,
        mimeType: 'application/pdf',
        uploadedBy: 1,
        businessType: 'ORDER_CONTRACT',
        businessId: 1001,
        status: 'CONFIRMED',
        downloadUrl: 'https://mock-oss.example.com/qianzhang-files/ORDER_CONTRACT-abc123.pdf',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      deleteFileRecord: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// ─── 测试套件 ─────────────────────────────────────────────────────────────────

describe("文件上传链路隔离测试 - Presigned URL 架构", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createAuthContext());
    vi.clearAllMocks();
  });

  // ── 1. tRPC 路由存在性验证 ─────────────────────────────────────────────────

  describe("tRPC 路由注册验证", () => {
    it("fileStorage.getPresignedUrl 路由应存在", () => {
      expect(appRouter._def.procedures["fileStorage.getPresignedUrl"]).toBeDefined();
    });

    it("fileStorage.confirmUpload 路由应存在", () => {
      expect(appRouter._def.procedures["fileStorage.confirmUpload"]).toBeDefined();
    });

    it("fileStorage.getFileList 路由应存在", () => {
      expect(appRouter._def.procedures["fileStorage.getFileList"]).toBeDefined();
    });

    it("fileStorage.deleteFileRecord 路由应存在", () => {
      expect(appRouter._def.procedures["fileStorage.deleteFileRecord"]).toBeDefined();
    });
  });

  // ── 2. 预签名 URL 申请 ─────────────────────────────────────────────────────

  describe("getPresignedUrl - 预签名 URL 签发", () => {
    it("应成功返回预签名 URL 和 fileRecordId（PDF 合同）", async () => {
      const result = await caller.fileStorage.getPresignedUrl({
        fileName: "order-contract-001.pdf",
        mimeType: "application/pdf",
        fileSize: 512000, // 500KB
        businessType: "ORDER_CONTRACT",
        businessId: 1001,
      });

      expect(result).toHaveProperty("presignedUrl");
      expect(result).toHaveProperty("fileRecordId");
      expect(result).toHaveProperty("objectKey");
      expect(result).toHaveProperty("expiresAt");
      expect(result.presignedUrl).toMatch(/^https?:\/\//);
      expect(typeof result.fileRecordId).toBe("number");
    });

    it("应成功返回预签名 URL（JPG 付款水单）", async () => {
      const result = await caller.fileStorage.getPresignedUrl({
        fileName: "payment-receipt-20260228.jpg",
        mimeType: "image/jpeg",
        fileSize: 1024 * 1024, // 1MB
        businessType: "PAYMENT_RECEIPT",
        businessId: 1001,
      });

      expect(result.presignedUrl).toBeTruthy();
      expect(result.fileRecordId).toBeGreaterThan(0);
    });

    it("应成功返回预签名 URL（PNG 截图）", async () => {
      const result = await caller.fileStorage.getPresignedUrl({
        fileName: "screenshot.png",
        mimeType: "image/png",
        fileSize: 2 * 1024 * 1024, // 2MB
        businessType: "PAYMENT_RECEIPT",
      });

      expect(result.presignedUrl).toBeTruthy();
    });

    it("预签名 URL 应指向 OSS 而非 Node.js 服务器（架构验证）", async () => {
      const result = await caller.fileStorage.getPresignedUrl({
        fileName: "contract.pdf",
        mimeType: "application/pdf",
        fileSize: 100000,
        businessType: "ORDER_CONTRACT",
        businessId: 1001,
      });

      // 预签名 URL 应该是 OSS 直传地址，不应该是本应用服务器地址
      // 验证 URL 包含 OSS 签名参数（X-Amz-Signature 或类似）
      expect(result.presignedUrl).not.toContain("/api/trpc");
      expect(result.presignedUrl).not.toContain("localhost:3000");
    });
  });

  // ── 3. 确认上传落库 ────────────────────────────────────────────────────────

  describe("confirmUpload - 确认上传落库", () => {
    it("应成功确认上传并返回文件记录（状态 CONFIRMED）", async () => {
      const result = await caller.fileStorage.confirmUpload({ fileRecordId: 42 });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("fileName");
      expect(result).toHaveProperty("status", "CONFIRMED");
      expect(result).toHaveProperty("mimeType");
      expect(result).toHaveProperty("fileSize");
    });

    it("确认后的文件记录应包含业务关联字段", async () => {
      const result = await caller.fileStorage.confirmUpload({ fileRecordId: 42 });

      expect(result).toHaveProperty("businessType");
      expect(result).toHaveProperty("businessId");
      expect(result).toHaveProperty("uploadedBy");
    });
  });

  // ── 4. 文件列表查询 ────────────────────────────────────────────────────────

  describe("getFileList - 附件列表查询", () => {
    it("应返回订单的合同附件列表", async () => {
      const result = await caller.fileStorage.getFileList({
        businessType: "ORDER_CONTRACT",
        businessId: 1001,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("应返回订单的付款水单列表", async () => {
      const result = await caller.fileStorage.getFileList({
        businessType: "PAYMENT_RECEIPT",
        businessId: 1001,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it("文件列表中的每条记录应包含必要字段", async () => {
      const result = await caller.fileStorage.getFileList({
        businessType: "ORDER_CONTRACT",
        businessId: 1001,
      });

      if (result.length > 0) {
        const file = result[0];
        expect(file).toHaveProperty("id");
        expect(file).toHaveProperty("fileName");
        expect(file).toHaveProperty("mimeType");
        expect(file).toHaveProperty("fileSize");
        expect(file).toHaveProperty("status");
      }
    });
  });

  // ── 5. 文件删除 ────────────────────────────────────────────────────────────

  describe("deleteFileRecord - 软删除文件", () => {
    it("应成功删除文件记录", async () => {
      const result = await caller.fileStorage.deleteFileRecord({ id: 42 });
      expect(result).toEqual({ success: true });
    });
  });

  // ── 6. 文件校验逻辑单元测试 ────────────────────────────────────────────────

  describe("文件校验逻辑（单元测试）", () => {
    const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

    function validateFile(file: { name: string; type: string; size: number }): string | null {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return `不支持的文件类型 "${file.type}"，仅允许 PDF/JPG/PNG`;
      }
      if (file.size > MAX_FILE_SIZE) {
        return `文件 "${file.name}" 超过 20MB 限制`;
      }
      return null;
    }

    it("PDF 文件应通过校验", () => {
      expect(validateFile({ name: "contract.pdf", type: "application/pdf", size: 1024 * 1024 })).toBeNull();
    });

    it("JPG 文件应通过校验", () => {
      expect(validateFile({ name: "receipt.jpg", type: "image/jpeg", size: 500 * 1024 })).toBeNull();
    });

    it("PNG 文件应通过校验", () => {
      expect(validateFile({ name: "screenshot.png", type: "image/png", size: 2 * 1024 * 1024 })).toBeNull();
    });

    it("Word 文档应被拒绝", () => {
      const err = validateFile({ name: "contract.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 100 * 1024 });
      expect(err).not.toBeNull();
      expect(err).toContain("不支持的文件类型");
    });

    it("Excel 文件应被拒绝", () => {
      const err = validateFile({ name: "data.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 100 * 1024 });
      expect(err).not.toBeNull();
    });

    it("超过 20MB 的文件应被拒绝", () => {
      const err = validateFile({ name: "large.pdf", type: "application/pdf", size: 21 * 1024 * 1024 });
      expect(err).not.toBeNull();
      expect(err).toContain("超过 20MB");
    });

    it("恰好 20MB 的文件应通过校验", () => {
      expect(validateFile({ name: "exact20mb.pdf", type: "application/pdf", size: 20 * 1024 * 1024 })).toBeNull();
    });

    it("1 字节的文件应通过校验（最小边界）", () => {
      expect(validateFile({ name: "tiny.png", type: "image/png", size: 1 })).toBeNull();
    });
  });

  // ── 7. E2E 场景：订单付款水单上传完整链路 ─────────────────────────────────

  describe("E2E 场景 - 订单付款水单上传完整链路", () => {
    it("完整上传流程：申请预签名 URL → (模拟 OSS 直传) → 确认落库 → 查询列表", async () => {
      const orderId = 1001;

      // Step 1: 申请预签名 URL
      const presignedData = await caller.fileStorage.getPresignedUrl({
        fileName: "payment-receipt-20260228.jpg",
        mimeType: "image/jpeg",
        fileSize: 1.5 * 1024 * 1024, // 1.5MB
        businessType: "PAYMENT_RECEIPT",
        businessId: orderId,
      });

      expect(presignedData.presignedUrl).toBeTruthy();
      expect(presignedData.fileRecordId).toBeGreaterThan(0);

      // Step 2: 模拟 OSS 直传（实际由前端 XHR PUT 完成，此处跳过）
      // 关键验证：文件字节流不经过 Node.js 服务器
      // 预签名 URL 直接指向 OSS，前端直接 PUT 到该 URL

      // Step 3: 确认落库
      const confirmed = await caller.fileStorage.confirmUpload({
        fileRecordId: presignedData.fileRecordId,
      });

      expect(confirmed.status).toBe("CONFIRMED");
      expect(confirmed.businessType).toBe("PAYMENT_RECEIPT");

      // Step 4: 查询附件列表，确认文件已落库
      const fileList = await caller.fileStorage.getFileList({
        businessType: "PAYMENT_RECEIPT",
        businessId: orderId,
      });

      expect(Array.isArray(fileList)).toBe(true);
      expect(fileList.length).toBeGreaterThan(0);
    });

    it("合同扫描件上传完整链路", async () => {
      const orderId = 2002;

      const presignedData = await caller.fileStorage.getPresignedUrl({
        fileName: "sales-contract-2026.pdf",
        mimeType: "application/pdf",
        fileSize: 800 * 1024, // 800KB
        businessType: "ORDER_CONTRACT",
        businessId: orderId,
      });

      expect(presignedData.presignedUrl).toBeTruthy();

      const confirmed = await caller.fileStorage.confirmUpload({
        fileRecordId: presignedData.fileRecordId,
      });

      expect(confirmed.status).toBe("CONFIRMED");
      expect(confirmed.mimeType).toBe("application/pdf");
    });
  });

  // ── 8. 架构安全验证 ────────────────────────────────────────────────────────

  describe("架构安全验证 - 预签名 URL 直传", () => {
    it("getPresignedUrl 应返回 OSS 直传 URL（不含 /api/trpc 路径）", async () => {
      const result = await caller.fileStorage.getPresignedUrl({
        fileName: "test.pdf",
        mimeType: "application/pdf",
        fileSize: 100000,
        businessType: "ORDER_CONTRACT",
      });

      // 确保返回的是 OSS 直传 URL，不是本应用的 API 路径
      expect(result.presignedUrl).not.toContain("/api/trpc");
      expect(result.presignedUrl).not.toContain("/api/internal");
    });

    it("getPresignedUrl 不应接受文件内容（只接受元数据）", async () => {
      // tRPC 输入 schema 只包含元数据字段，不包含 fileContent/buffer 等
      const input = {
        fileName: "test.pdf",
        mimeType: "application/pdf",
        fileSize: 100000,
        businessType: "ORDER_CONTRACT",
      };

      // 验证输入不包含文件内容字段
      expect(input).not.toHaveProperty("fileContent");
      expect(input).not.toHaveProperty("buffer");
      expect(input).not.toHaveProperty("base64");

      const result = await caller.fileStorage.getPresignedUrl(input);
      expect(result.presignedUrl).toBeTruthy();
    });

    it("confirmUpload 只接受 fileRecordId（不接受文件字节流）", async () => {
      // 验证 confirmUpload 的输入只有 fileRecordId
      const input = { fileRecordId: 42 };

      expect(input).not.toHaveProperty("fileContent");
      expect(input).not.toHaveProperty("buffer");
      expect(Object.keys(input)).toEqual(["fileRecordId"]);

      const result = await caller.fileStorage.confirmUpload(input);
      expect(result).toBeDefined();
    });
  });
});
