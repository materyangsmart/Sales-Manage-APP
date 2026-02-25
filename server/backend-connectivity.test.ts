import { describe, it, expect } from 'vitest';

describe('Backend Connectivity', () => {
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3100';
  const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'test-token';

  it('should connect to backend traceability API', async () => {
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
