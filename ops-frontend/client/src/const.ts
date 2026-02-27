export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  // 本地开发模式：如果 VITE_OAUTH_PORTAL_URL 未配置，返回一个占位 URL
  // 生产环境（Manus 云平台）会自动注入此变量
  if (!oauthPortalUrl) {
    console.warn(
      "[Auth] VITE_OAUTH_PORTAL_URL is not set. " +
      "Please add it to ops-frontend/.env for local development. " +
      "See ops-frontend/.env.local.example for reference."
    );
    // 返回一个本地占位登录页，避免崩溃
    return `/api/oauth/callback?error=oauth_not_configured`;
  }

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
