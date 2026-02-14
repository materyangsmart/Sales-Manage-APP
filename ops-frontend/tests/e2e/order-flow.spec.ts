import { test, expect } from '@playwright/test';

/**
 * E2E测试：订单审核到履行流程
 * 
 * 验收路径：
 * 1. 访问订单审核页
 * 2. 查看待审核订单列表
 * 3. 批准一个订单
 * 4. 访问订单履行页
 * 5. 履行刚批准的订单
 * 6. 验证发票已生成
 */

test.describe('订单审核到履行流程', () => {
  test.beforeEach(async ({ page }) => {
    // 访问首页
    await page.goto('/');
    
    // 等待页面加载
    await page.waitForLoadState('networkidle');
  });

  test('完整流程：审核 → 批准 → 履行 → 发票生成', async ({ page }) => {
    // ========================================
    // 1. 订单审核页
    // ========================================
    console.log('Step 1: 访问订单审核页');
    await page.goto('/order-review');
    
    // 等待列表加载
    await page.waitForSelector('table', { timeout: 10000 });
    
    // 检查是否有待审核订单
    const orderRows = await page.locator('table tbody tr').count();
    console.log(`找到 ${orderRows} 个待审核订单`);
    
    if (orderRows === 0) {
      console.log('⚠️ 没有待审核订单，跳过测试');
      test.skip();
      return;
    }
    
    // 获取第一个订单的ID（用于后续追踪）
    const firstOrderId = await page.locator('table tbody tr:first-child td:first-child').textContent();
    console.log(`选择订单ID: ${firstOrderId}`);
    
    // ========================================
    // 2. 批准订单
    // ========================================
    console.log('Step 2: 批准订单');
    
    // 点击第一个订单的"批准"按钮
    await page.locator('table tbody tr:first-child button:has-text("批准")').click();
    
    // 等待对话框出现
    await page.waitForSelector('textarea', { timeout: 5000 });
    
    // 输入备注（可选）
    await page.fill('textarea', 'E2E测试自动批准');
    
    // 点击"确认批准"按钮
    await page.locator('button:has-text("确认批准")').click();
    
    // 等待toast提示
    await expect(page.locator('text=订单已批准')).toBeVisible({ timeout: 5000 });
    console.log('✓ 订单批准成功');
    
    // 等待页面刷新
    await page.waitForTimeout(2000);
    
    // ========================================
    // 3. 订单履行页
    // ========================================
    console.log('Step 3: 访问订单履行页');
    await page.goto('/order-fulfill');
    
    // 等待列表加载
    await page.waitForSelector('table', { timeout: 10000 });
    
    // 检查是否有已审核订单
    const approvedOrderRows = await page.locator('table tbody tr').count();
    console.log(`找到 ${approvedOrderRows} 个已审核订单`);
    
    if (approvedOrderRows === 0) {
      console.log('⚠️ 没有已审核订单，测试失败');
      throw new Error('批准后未找到已审核订单');
    }
    
    // ========================================
    // 4. 履行订单
    // ========================================
    console.log('Step 4: 履行订单');
    
    // 点击第一个订单的"履行订单"按钮
    await page.locator('table tbody tr:first-child button:has-text("履行订单")').click();
    
    // 等待确认对话框
    await page.waitForSelector('text=确认要履行此订单吗', { timeout: 5000 });
    
    // 点击"确定"按钮
    await page.locator('button:has-text("确定")').click();
    
    // 等待toast提示
    await expect(page.locator('text=订单履行成功')).toBeVisible({ timeout: 5000 });
    console.log('✓ 订单履行成功');
    
    // 等待页面刷新
    await page.waitForTimeout(2000);
    
    // ========================================
    // 5. 验证发票已生成
    // ========================================
    console.log('Step 5: 验证发票已生成');
    await page.goto('/ar-invoices');
    
    // 等待列表加载
    await page.waitForSelector('table', { timeout: 10000 });
    
    // 检查是否有发票
    const invoiceRows = await page.locator('table tbody tr').count();
    console.log(`找到 ${invoiceRows} 个发票`);
    
    if (invoiceRows === 0) {
      console.log('⚠️ 没有发票，测试失败');
      throw new Error('履行后未生成发票');
    }
    
    // 检查第一个发票的状态是否为OPEN
    const firstInvoiceStatus = await page.locator('table tbody tr:first-child td:nth-child(5)').textContent();
    console.log(`第一个发票状态: ${firstInvoiceStatus}`);
    
    expect(firstInvoiceStatus).toContain('未结清');
    console.log('✓ 发票已生成且状态正确');
    
    // ========================================
    // 6. 验证审计日志
    // ========================================
    console.log('Step 6: 验证审计日志');
    await page.goto('/audit-logs');
    
    // 等待列表加载
    await page.waitForSelector('table', { timeout: 10000 });
    
    // 检查是否有审计日志
    const auditLogRows = await page.locator('table tbody tr').count();
    console.log(`找到 ${auditLogRows} 个审计日志`);
    
    expect(auditLogRows).toBeGreaterThan(0);
    console.log('✓ 审计日志已记录');
    
    console.log('========================================');
    console.log('✅ 完整流程测试通过！');
    console.log('========================================');
  });
  
  test('订单审核页：拒绝订单', async ({ page }) => {
    console.log('Step 1: 访问订单审核页');
    await page.goto('/order-review');
    
    // 等待列表加载
    await page.waitForSelector('table', { timeout: 10000 });
    
    // 检查是否有待审核订单
    const orderRows = await page.locator('table tbody tr').count();
    
    if (orderRows === 0) {
      console.log('⚠️ 没有待审核订单，跳过测试');
      test.skip();
      return;
    }
    
    console.log('Step 2: 拒绝订单');
    
    // 点击第一个订单的"拒绝"按钮
    await page.locator('table tbody tr:first-child button:has-text("拒绝")').click();
    
    // 等待对话框出现
    await page.waitForSelector('textarea', { timeout: 5000 });
    
    // 输入拒绝原因
    await page.fill('textarea', 'E2E测试自动拒绝');
    
    // 点击"确认拒绝"按钮
    await page.locator('button:has-text("确认拒绝")').click();
    
    // 等待toast提示
    await expect(page.locator('text=订单已拒绝')).toBeVisible({ timeout: 5000 });
    console.log('✓ 订单拒绝成功');
  });
});
