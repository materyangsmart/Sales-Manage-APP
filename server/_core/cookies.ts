import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure" | "maxAge"> {
  const secure = isSecureRequest(req);

  // 关键修复：sameSite: "none" 必须搭配 secure: true（即 HTTPS）。
  // 在 HTTP 环境下（如阿里云直连 IP），使用 "lax" 以确保浏览器正确保存 Cookie。
  // "lax" 允许同站导航携带 Cookie，完全满足登录场景需求。
  const sameSite: "none" | "lax" = secure ? "none" : "lax";

  return {
    httpOnly: true,
    path: "/",
    sameSite,
    secure,
    maxAge: 1000 * 60 * 60 * 24 * 365, // 1 年
  };
}
