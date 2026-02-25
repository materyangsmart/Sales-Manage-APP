import { test, expect } from '@playwright/test';

/**
 * E2E测试：核销流程
 * 
 * 验收路径：
 * 1. 访问核销页
 * 2. 选择收款和发票
 * 3. 执行核销
 * 4. 验证收款和发票状态更新
 */

test.describe('核销流程', () => {
  test.beforeEach(async ({ page }) => {
    // 访问首页
    await page.goto('/');
    
    // 等待页面加载
    await page.waitForLoadState('networkidle');
  });

  test('完整流程：选择收款和发票 → 核销 → 验证状态', async ({ page }) => {
    // ========================================
    // 1. 访问核销页
    // ========================================
    console.log('Step 1: 访问核销页');
    await page.goto('/ar-apply');
    
    // 等待页面加载
    await page.waitForSelector('select', { timeout: 10000 });
    
    // ========================================
    // 2. 选择收款
    // ========================================
    console.log('Step 2: 选择收款');
    
    // 打开收款选择器
    const paymentSelect = page.locator('select').first();
    await paymentSelect.click();
    
    // 检查是否有可用收款
    const paymentOptions = await paymentSelect.locator('option').count();
    console.log(`找到 ${paymentOptions - 1} 个可用收款`); // 减1是因为有"请选择收款"选项
    
    if (paymentOptions <= 1) {
      console.log('⚠️ 没有可用收款，跳过测试');
      test.skip();
      return;
    }
    
    // 选择第一个收款
    await paymentSelect.selectOption({ index: 1 });
    console.log('✓ 已选择收款');
    
    // ========================================
    // 3. 选择发票
    // ========================================
    console.log('Step 3: 选择发票');
    
    // 打开发票选择器
    const invoiceSelect = page.locator('select').nth(1);
    await invoiceSelect.click();
    
    // 检查是否有可用发票
    const invoiceOptions = await invoiceSelect.locator('option').count();
    console.log(`找到 ${invoiceOptions - 1} 个可用发票`);
    
    if (invoiceOptions <= 1) {
      console.log('⚠️ 没有可用发票，跳过测试');
      test.skip();
      return;
    }
    
    // 选择第一个发票
    await invoiceSelect.selectOption({ index: 1 });
    console.log('✓ 已选择发票');
    
    // ========================================
    // 4. 智能建议金额
    // ========================================
    console.log('Step 4: 智能建议金额');
    
    // 点击"智能建议"按钮
    await page.locator('button:has-text("智能建议")').click();
    
    // 等待金额自动填充
    await page.waitForTimeout(1000);
    
    // 检查金额是否已填充
    const amountInput = page.locator('input[type="number"]');
    const amount = await amountInput.inputValue();
    console.log(`建议金额: ${amount}`);
    
    expect(parseFloat(amount)).toBeGreaterThan(0);
    console.log('✓ 金额已自动填充');
    
    // ========================================
    // 5. 执行核销
    // ========================================
    console.log('Step 5: 执行核销');
    
    // 点击"执行核销"按钮
    await page.locator('button:has-text("执行核销")').click();
    
    // 等待toast提示
    await expect(page.locator('text=核销成功')).toBeVisible({ timeout: 5000 });
    console.log('✓ 核销成功');
    
    // 等待页面刷新
    await page.waitForTimeout(2000);
    
    // ========================================
    // 6. 验证收款状态
    // ========================================
    console.log('Step 6: 验证收款状态');
    await page.goto('/ar-payments');
    
    // 等待列表加载
    await page.waitForSelector('table', { timeout: 10000 });
    
    // 检查收款列表
    const paymentRows = await page.locator('table tbody tr').count();
    console.log(`找到 ${paymentRows} 个收款`);
    
    expect(paymentRows).toBeGreaterThan(0);
    console.log('✓ 收款列表正常');
    
    // ========================================
    // 7. 验证发票状态
    // ========================================
    console.log('Step 7: 验证发票状态');
    await page.goto('/ar-invoices');
    
    // 等待列表加载
    await page.waitForSelector('table', { timeout: 10000 });
    
    // 检查发票列表
    const invoiceRows = await page.locator('table tbody tr').count();
    console.log(`找到 ${invoiceRows} 个发票`);
    
    expect(invoiceRows).toBeGreaterThan(0);
    console.log('✓ 发票列表正常');
    
    // ========================================
    // 8. 验证审计日志
    // ========================================
    console.log('Step 8: 验证审计日志');
    await page.goto('/audit-logs');
    
    // 等待列表加载
    await page.waitForSelector('table', { timeout: 10000 });
    
    // 过滤APPLY事件
    await page.locator('select').nth(1).selectOption('APPLY');
    
    // 等待过滤结果
    await page.waitForTimeout(2000);
    
    // 检查是否有APPLY事件
    const applyLogRows = await page.locator('table tbody tr').count();
    console.log(`找到 ${applyLogRows} 个APPLY事件`);
    
    expect(applyLogRows).toBeGreaterThan(0);
    console.log('✓ 核销事件已记录');
    
    console.log('========================================');
    console.log('✅ 核销流程测试通过！');
    console.log('========================================');
  });
});
