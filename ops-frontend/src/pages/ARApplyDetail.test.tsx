/**
 * ARApplyDetail 埋点字段单元测试
 * 
 * 目的：验证 apply_submit/apply_success/apply_conflict 事件包含统一的埋点字段
 * 
 * 必需字段：
 * - payment_id: 收款单ID
 * - applied_total_fen: 总核销金额（分）
 * - remain_fen_after: 核销后剩余金额（分）
 * - invoice_count: 核销的发票数量
 * 
 * 可选字段：
 * - settled: 是否结清（仅 apply_success）
 * - error_message: 错误信息（仅 apply_conflict）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ARApplyDetail } from './ARApplyDetail';
import { trackEvent } from '../utils/analytics';
import * as arService from '../services/ar';

// Mock dependencies
vi.mock('../utils/analytics');
vi.mock('../services/ar');

describe('ARApplyDetail - Analytics Fields', () => {
  const mockPayment = {
    id: 'P1',
    paymentNo: 'PAY001',
    customerId: 'CUST001',
    amount: 5000,
    unappliedAmount: 5000,
    paymentDate: '2024-01-01',
    paymentMethod: 'bank_transfer',
    bankRef: 'BANK001',
  };

  const mockInvoices = [
    {
      id: 1,
      invoiceNo: 'INV001',
      amount: 3000,
      balance: 3000,
      dueDate: '2024-02-01',
    },
    {
      id: 2,
      invoiceNo: 'INV002',
      amount: 2000,
      balance: 2000,
      dueDate: '2024-02-15',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('apply_submit should contain required fields', async () => {
    const mockTrackEvent = vi.mocked(trackEvent);
    
    render(
      <ARApplyDetail
        payment={mockPayment}
        invoices={mockInvoices}
      />
    );

    // 填写核销金额
    const amountInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(amountInputs[0], { target: { value: '20' } }); // 2000分

    // 点击确认核销
    const submitButton = screen.getByText('确认核销');
    fireEvent.click(submitButton);

    // 验证 apply_submit 事件被调用
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'apply_submit',
        expect.objectContaining({
          payment_id: expect.any(String),
          applied_total_fen: expect.any(Number),
          remain_fen_after: expect.any(Number),
          invoice_count: expect.any(Number),
        })
      );
    });

    // 验证具体值
    const applySubmitCall = mockTrackEvent.mock.calls.find(
      (call) => call[0] === 'apply_submit'
    );
    expect(applySubmitCall).toBeDefined();
    
    const applySubmitData = applySubmitCall![1];
    expect(applySubmitData).toHaveProperty('payment_id', 'P1');
    expect(applySubmitData).toHaveProperty('applied_total_fen', 2000);
    expect(applySubmitData).toHaveProperty('remain_fen_after', 3000);
    expect(applySubmitData).toHaveProperty('invoice_count', 1);
  });

  it('apply_success should contain required fields plus settled', async () => {
    const mockTrackEvent = vi.mocked(trackEvent);
    const mockApplyPayment = vi.mocked(arService.applyPayment);
    mockApplyPayment.mockResolvedValue({ success: true });

    render(
      <ARApplyDetail
        payment={mockPayment}
        invoices={mockInvoices}
      />
    );

    // 填写核销金额
    const amountInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(amountInputs[0], { target: { value: '20' } });

    // 点击确认核销
    const submitButton = screen.getByText('确认核销');
    fireEvent.click(submitButton);

    // 点击Modal中的确定按钮
    await waitFor(() => {
      const confirmButton = screen.getByText('确定');
      fireEvent.click(confirmButton);
    });

    // 验证 apply_success 事件被调用
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'apply_success',
        expect.objectContaining({
          payment_id: expect.any(String),
          applied_total_fen: expect.any(Number),
          remain_fen_after: expect.any(Number),
          invoice_count: expect.any(Number),
          settled: expect.any(Boolean),
        })
      );
    });

    // 验证具体值
    const applySuccessCall = mockTrackEvent.mock.calls.find(
      (call) => call[0] === 'apply_success'
    );
    expect(applySuccessCall).toBeDefined();
    
    const applySuccessData = applySuccessCall![1];
    expect(applySuccessData).toHaveProperty('payment_id', 'P1');
    expect(applySuccessData).toHaveProperty('applied_total_fen', 2000);
    expect(applySuccessData).toHaveProperty('remain_fen_after', 3000);
    expect(applySuccessData).toHaveProperty('invoice_count', 1);
    expect(applySuccessData).toHaveProperty('settled', false);
  });

  it('apply_conflict should contain required fields plus error_message', async () => {
    const mockTrackEvent = vi.mocked(trackEvent);
    const mockApplyPayment = vi.mocked(arService.applyPayment);
    
    // Mock 409 conflict error
    mockApplyPayment.mockRejectedValue({
      response: { status: 409 },
      userMessage: '该收款单已被其他用户核销',
    });

    render(
      <ARApplyDetail
        payment={mockPayment}
        invoices={mockInvoices}
      />
    );

    // 填写核销金额
    const amountInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(amountInputs[0], { target: { value: '20' } });

    // 点击确认核销
    const submitButton = screen.getByText('确认核销');
    fireEvent.click(submitButton);

    // 点击Modal中的确定按钮
    await waitFor(() => {
      const confirmButton = screen.getByText('确定');
      fireEvent.click(confirmButton);
    });

    // 验证 apply_conflict 事件被调用
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'apply_conflict',
        expect.objectContaining({
          payment_id: expect.any(String),
          applied_total_fen: expect.any(Number),
          remain_fen_after: expect.any(Number),
          invoice_count: expect.any(Number),
          error_message: expect.any(String),
        })
      );
    });

    // 验证具体值
    const applyConflictCall = mockTrackEvent.mock.calls.find(
      (call) => call[0] === 'apply_conflict'
    );
    expect(applyConflictCall).toBeDefined();
    
    const applyConflictData = applyConflictCall![1];
    expect(applyConflictData).toHaveProperty('payment_id', 'P1');
    expect(applyConflictData).toHaveProperty('applied_total_fen', 2000);
    expect(applyConflictData).toHaveProperty('remain_fen_after', 3000);
    expect(applyConflictData).toHaveProperty('invoice_count', 1);
    expect(applyConflictData).toHaveProperty('error_message', '该收款单已被其他用户核销');
  });

  it('all events should NOT contain legacy fields', async () => {
    const mockTrackEvent = vi.mocked(trackEvent);
    
    render(
      <ARApplyDetail
        payment={mockPayment}
        invoices={mockInvoices}
      />
    );

    // 填写核销金额
    const amountInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(amountInputs[0], { target: { value: '20' } });

    // 点击确认核销
    const submitButton = screen.getByText('确认核销');
    fireEvent.click(submitButton);

    // 验证不包含旧字段
    await waitFor(() => {
      const applySubmitCall = mockTrackEvent.mock.calls.find(
        (call) => call[0] === 'apply_submit'
      );
      expect(applySubmitCall).toBeDefined();
      
      const applySubmitData = applySubmitCall![1];
      
      // 不应该包含旧字段
      expect(applySubmitData).not.toHaveProperty('paymentNo');
      expect(applySubmitData).not.toHaveProperty('totalApplied');
      expect(applySubmitData).not.toHaveProperty('invoiceCount');
      
      // 应该包含新字段
      expect(applySubmitData).toHaveProperty('payment_id');
      expect(applySubmitData).toHaveProperty('applied_total_fen');
      expect(applySubmitData).toHaveProperty('remain_fen_after');
      expect(applySubmitData).toHaveProperty('invoice_count');
    });
  });
});
