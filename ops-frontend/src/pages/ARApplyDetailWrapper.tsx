import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, message } from 'antd';
import { ARApplyDetail } from './ARApplyDetail';
import type { ARPayment, ARInvoice } from '../types/ar';

/**
 * AR核销详情页面路由包装器
 * 负责从URL参数获取paymentId并加载数据
 */
export const ARApplyDetailWrapper: React.FC = () => {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<ARPayment | null>(null);
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);

  useEffect(() => {
    loadData();
  }, [paymentId]);

  const loadData = async () => {
    if (!paymentId) {
      message.error('缺少收款单ID');
      navigate('/ar/payments');
      return;
    }

    setLoading(true);
    try {
      // TODO: 调用实际的API获取收款单和应收单数据
      // const paymentData = await getPaymentDetail(parseInt(paymentId));
      // const invoicesData = await getCustomerInvoices(paymentData.customerId);
      
      // 临时模拟数据
      const mockPayment: ARPayment = {
        id: parseInt(paymentId),
        paymentNo: `PAY-${paymentId}`,
        orgId: 2,
        customerId: 101,
        amount: 1000000, // 10000元
        unappliedAmount: 1000000,
        status: 'UNAPPLIED',
        paymentDate: '2024-01-10',
        paymentMethod: '银行转账',
        bankRef: 'BANK-REF-123',
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
        {
          id: 1002,
          invoiceNo: 'INV-2024-002',
          orgId: 2,
          customerId: 101,
          amount: 300000,
          balance: 300000,
          dueDate: '2024-01-20',
          status: 'OPEN',
          createdAt: '2024-01-05T10:00:00Z',
        },
        {
          id: 1003,
          invoiceNo: 'INV-2024-003',
          orgId: 2,
          customerId: 101,
          amount: 400000,
          balance: 400000,
          dueDate: '2024-01-25',
          status: 'OPEN',
          createdAt: '2024-01-08T10:00:00Z',
        },
      ];

      setPayment(mockPayment);
      setInvoices(mockInvoices);
    } catch (error: any) {
      message.error(error.userMessage || '加载失败');
      navigate('/ar/payments');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    message.success('核销成功，返回列表');
    navigate('/ar/payments');
  };

  const handleCancel = () => {
    navigate('/ar/payments');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!payment) {
    return null;
  }

  return (
    <ARApplyDetail
      payment={payment}
      invoices={invoices}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
};
