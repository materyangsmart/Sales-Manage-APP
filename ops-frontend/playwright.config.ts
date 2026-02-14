import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright配置 - ops-frontend E2E测试
 * 
 * 用于验证ops-frontend的核心业务流程
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  /* 并行运行测试 */
  fullyParallel: false, // 业务流程测试需要顺序执行
  
  /* 失败时不重试（确保问题可见） */
  retries: 0,
  
  /* 单worker（避免并发导致的数据冲突） */
  workers: 1,
  
  /* Reporter */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  
  /* 全局配置 */
  use: {
    /* Base URL */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    /* 截图和视频 */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    /* 超时 */
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  
  /* 浏览器配置 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  
  /* Web server配置（可选） */
  // webServer: {
  //   command: 'pnpm dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  // },
});
