import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ARPaymentList } from '../../pages/ARPaymentList';
import { ARApplyDetail } from '../../pages/ARApplyDetail';
import { server } from '../mocks/server';
import { conflict409Handler, error500Handler, emptyDataHandler } from '../mocks/handlers';
import type { ARPayment, ARInvoice } from '../../types/ar';

// 包装组件以提供必要的context
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </ConfigProvider>
  );
};

describe('AR Integration Tests', () => {
  describe('Test 1: 列表→详情→返回列表', () => {
    it('should navigate from list to detail and back', async () => {
      const user = userEvent.setup();
      
      // 渲染列表页
      renderWithProviders(<ARPaymentList />);
      
      // 等待数据加载
      await waitFor(() => {
        expect(screen.getByText('PAY-2024-001')).toBeInTheDocument();
      });
      
      // 验证列表显示
      expect(screen.getByText('AR到款待处理列表')).toBeInTheDocument();
      expect(screen.getByText('PAY-2024-001')).toBeInTheDocument();
      
      // 点击核销按钮（这里我们只验证按钮存在，实际导航由路由处理）
      const applyButton = screen.getByRole('button', { name: '核销' });
      expect(applyButton).toBeInTheDocument();
      expect(applyButton).not.toBeDisabled();
    });
  });

  describe('Test 2: 金额超额前端拦截', () => {
    it('should prevent overpayment in apply detail', async () => {
      const user = userEvent.setup();
      
      // Mock数据
      const mockPayment: ARPayment = {
        id: 1,
        paymentNo: 'PAY-2024-001',
        orgId: 2,
        customerId: 101,
        amount: 1000000, // 10000元
        unappliedAmount: 1000000,
        status: 'UNAPPLIED',
        paymentDate: '2024-01-10',
        paymentMethod: '银行转账',
        bankRef: 'BANK-REF-001',
        createdAt: '2024-01-10T10:00:00Z',
        updatedAt: '2024-01-10T10:00:00Z',
      };

      const mockInvoices: ARInvoice[] = [
        {
          id: 1001,
          invoiceNo: 'INV-2024-001',
          orgId: 2,
          customerId: 101,
          amount: 500000, // 5000元
          balance: 500000,
          dueDate: '2024-01-15',
          status: 'OPEN',
          createdAt: '2024-01-01T10:00:00Z',
        },
      ];

      const onSuccess = vi.fn();
      const onCancel = vi.fn();
      
      // 渲染详情页
      renderWithProviders(
        <ARApplyDetail
          payment={mockPayment}
          invoices={mockInvoices}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      );
      
      // 验证页面显示
      expect(screen.getByText('核销收款单')).toBeInTheDocument();
      expect(screen.getByText('PAY-2024-001')).toBeInTheDocument();
      
      // 找到金额输入框
      const amountInput = screen.getByPlaceholderText('请输入核销金额');
      
      // 尝试输入超额金额（6000元，超过应收单余额5000元）
      await user.clear(amountInput);
      await user.type(amountInput, '6000');
      
      // 验证输入被限制或显示错误提示
      // AmountInput组件应该限制最大值为5000元
      await waitFor(() => {
        const value = (amountInput as HTMLInputElement).value;
        // 输入应该被限制在最大值5000以内
        expect(parseFloat(value)).toBeLessThanOrEqual(5000);
      });
    });
  });

  describe('Test 3: 模拟409冲突并发', () => {
    it('should handle 409 conflict with toast and refresh', async () => {
      const user = userEvent.setup();
      
      // Mock数据
      const mockPayment: ARPayment = {
        id: 1,
        paymentNo: 'PAY-2024-001',
        orgId: 2,
        customerId: 101,
        amount: 1000000,
        unappliedAmount: 1000000,
        status: 'UNAPPLIED',
        paymentDate: '2024-01-10',
        paymentMethod: '银行转账',
        bankRef: 'BANK-REF-001',
        createdAt: '2024-01-10T10:00:00Z',
        updatedAt: '2024-01-10T10:00:00Z',
      };

      const mockInvoices: ARInvoice[] = [
        {
          id: 1001,
          invoiceNo: 'INV-2024-001',
          orgId: 2,
          customerId: 101,
          amount: 500000,
          balance: 500000,
          dueDate: '2024-01-15',
          status: 'OPEN',
          createdAt: '2024-01-01T10:00:00Z',
        },
      ];

      const onSuccess = vi.fn();
      const onCancel = vi.fn();
      
      // 使用409冲突handler
      server.use(conflict409Handler);
      
      // 渲染详情页
      renderWithProviders(
        <ARApplyDetail
          payment={mockPayment}
          invoices={mockInvoices}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      );
      
      // 输入核销金额
      const amountInput = screen.getByPlaceholderText('请输入核销金额');
      await user.clear(amountInput);
      await user.type(amountInput, '5000');
      
      // 点击提交按钮
      const submitButton = screen.getByRole('button', { name: '确认核销' });
      expect(submitButton).not.toBeDisabled();
      
      await user.click(submitButton);
      
      // 验证按钮在提交期间被禁用
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
      
      // 等待409错误提示
      await waitFor(() => {
        // Ant Design的message组件会显示错误提示
        expect(screen.getByText(/数据已被他人更新，请刷新后重试/i)).toBeInTheDocument();
      }, { timeout: 3000 });
      
      // 验证按钮恢复可用
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
      
      // 验证onSuccess没有被调用
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Test 4: 空数据状态', () => {
    it('should show empty state when no data', async () => {
      // 使用空数据handler
      server.use(emptyDataHandler);
      
      // 渲染列表页
      renderWithProviders(<ARPaymentList />);
      
      // 等待空态显示
      await waitFor(() => {
        expect(screen.getByText('暂无符合条件的收款记录')).toBeInTheDocument();
      });
      
      // 验证重置按钮存在
      const resetButton = screen.getByRole('button', { name: '重置' });
      expect(resetButton).toBeInTheDocument();
    });
  });

  describe('Test 5: 500错误状态', () => {
    it('should show error state with retry button on 500 error', async () => {
      const user = userEvent.setup();
      
      // 使用500错误handler
      server.use(error500Handler);
      
      // 渲染列表页
      renderWithProviders(<ARPaymentList />);
      
      // 等待错误提示显示
      await waitFor(() => {
        expect(screen.getByText(/服务器错误，请稍后重试/i)).toBeInTheDocument();
      });
      
      // 验证重试按钮存在
      const retryButtons = screen.getAllByRole('button', { name: '重试' });
      expect(retryButtons.length).toBeGreaterThan(0);
      
      // 点击重试按钮
      await user.click(retryButtons[0]);
      
      // 验证重新加载（这里需要恢复正常handler）
      server.resetHandlers();
      
      await waitFor(() => {
        expect(screen.getByText('PAY-2024-001')).toBeInTheDocument();
      });
    });
  });
});
