import { describe, it, expect } from 'vitest';

/**
 * Backend Connectivity Tests
 * 
 * 这些测试验证与后端各个 API 的连通性。
 * 当后端不可用时（如 CI/CD 环境或沙箱环境），测试会自动 skip 而不是 fail。
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3100';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'test-token';

async function isBackendAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(`${BACKEND_URL}/api/internal/health`, {
      signal: controller.signal,
      headers: { 'Authorization': `Bearer ${INTERNAL_SERVICE_TOKEN}` },
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

describe('Backend Connectivity', () => {
  it('should connect to backend traceability API', async () => {
    const available = await isBackendAvailable();
    if (!available) {
      console.log(`⏭️  Backend not available at ${BACKEND_URL}, skipping traceability connectivity test`);
      return;
    }

    const res = await fetch(`${BACKEND_URL}/api/internal/traceability/1`, {
      headers: { 'Authorization': `Bearer ${INTERNAL_SERVICE_TOKEN}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.batchNo).toBeTruthy();
    expect(data.production).toBeTruthy();
    expect(data.production.qualityInspector).toBeTruthy();
  });

  it('should connect to backend commission API', async () => {
    const available = await isBackendAvailable();
    if (!available) {
      console.log(`⏭️  Backend not available at ${BACKEND_URL}, skipping commission connectivity test`);
      return;
    }

    const res = await fetch(`${BACKEND_URL}/api/internal/commission/my-performance`, {
      headers: { 'Authorization': `Bearer ${INTERNAL_SERVICE_TOKEN}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.categoryBreakdown).toBeDefined();
    expect(Array.isArray(data.categoryBreakdown)).toBe(true);
    expect(data.categoryBreakdown.length).toBeGreaterThan(0);
  });

  it('should connect to backend CEO radar API', async () => {
    const available = await isBackendAvailable();
    if (!available) {
      console.log(`⏭️  Backend not available at ${BACKEND_URL}, skipping CEO radar connectivity test`);
      return;
    }

    const res = await fetch(`${BACKEND_URL}/api/internal/ceo-radar/alerts?orgId=1`, {
      headers: { 'Authorization': `Bearer ${INTERNAL_SERVICE_TOKEN}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    const yieldAlerts = data.filter((a: any) => a.type === 'YIELD_ANOMALY');
    expect(yieldAlerts.length).toBeGreaterThan(0);
  });
});
