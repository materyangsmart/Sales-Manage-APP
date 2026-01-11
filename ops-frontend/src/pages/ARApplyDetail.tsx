import React, { useState } from 'react';
import { Card, Descriptions, Button, Table, message, Modal, Space, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { applyPayment } from '../services/ar';
import type { ARPayment, ARInvoice, ApplyItem } from '../types/ar';
import { Amount, AmountInput } from '../components/Amount';
import { trackEvent } from '../utils/analytics';

interface ARApplyDetailProps {
  payment: ARPayment;
  invoices: ARInvoice[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface ApplyRow extends ARInvoice {
  appliedAmount: number;
}

/**
 * AR核销详情页面
 */
export const ARApplyDetail: React.FC<ARApplyDetailProps> = ({
  payment,
  invoices,
  onSuccess,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  const [applyRows, setApplyRows] = useState<ApplyRow[]>(
    invoices.map((inv) => ({ ...inv, appliedAmount: 0 }))
  );

  // 计算剩余可分配金额
  const totalApplied = applyRows.reduce((sum, row) => sum + row.appliedAmount, 0);
  const remainingAmount = payment.unappliedAmount - totalApplied;
  const canSettle = remainingAmount === 0;

  // 处理核销金额变更
  const handleAmountChange = (invoiceId: number, amount: number) => {
    setApplyRows((prev) =>
      prev.map((row) =>
        row.id === invoiceId ? { ...row, appliedAmount: amount } : row
      )
    );
  };

  // 快速填充：将剩余金额分配到当前应收单
  const handleQuickFill = (invoice: ApplyRow) => {
    const maxApply = Math.min(remainingAmount, invoice.balance);
    handleAmountChange(invoice.id, maxApply);
  };

  // 提交核销
  const handleSubmit = async () => {
    // 埋点：核销提交
    trackEvent('apply_submit', {
      paymentNo: payment.paymentNo,
      totalApplied,
      invoiceCount: applyRows.filter((r) => r.appliedAmount > 0).length,
    });

    // 验证
    const validApplies = applyRows.filter((row) => row.appliedAmount > 0);
    if (validApplies.length === 0) {
      message.warning('请至少选择一个应收单进行核销');
      return;
    }

    // 检查是否超出余额
    for (const row of validApplies) {
      if (row.appliedAmount > row.balance) {
        message.error(`应收单 ${row.invoiceNo} 的核销金额不能超过余额`);
        return;
      }
    }

    if (totalApplied > payment.unappliedAmount) {
      message.error('核销总金额不能超过未分配金额');
      return;
    }

    Modal.confirm({
      title: '确认核销',
      content: (
        <div>
          <p>
            本次核销金额：<Amount value={totalApplied} className="font-semibold text-blue-600" />
          </p>
          <p>
            剩余未分配：<Amount value={remainingAmount} className="font-semibold" />
          </p>
          {canSettle && (
            <p className="text-green-600 font-semibold mt-2">✓ 本次核销后将结清该收款单</p>
          )}
        </div>
      ),
      onOk: async () => {
        setLoading(true);
        try {
          const applies: ApplyItem[] = validApplies.map((row) => ({
            invoiceId: row.id,
            appliedAmount: row.appliedAmount,
          }));

          await applyPayment({
            paymentId: payment.id,
            applies,
          });

          message.success('核销成功');

          // 埋点：核销成功
          trackEvent('apply_success', {
            paymentNo: payment.paymentNo,
            totalApplied,
            settled: canSettle,
          });

          onSuccess?.();
        } catch (error: any) {
          // 埋点：核销冲突
          if (error.response?.status === 409) {
            trackEvent('apply_conflict', {
              paymentNo: payment.paymentNo,
              errorMessage: error.userMessage,
            });
          }

          message.error(error.userMessage || '核销失败');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 表格列定义
  const columns: ColumnsType<ApplyRow> = [
    {
      title: '应收单号',
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      width: 180,
    },
    {
      title: '应收金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (value: number) => <Amount value={value} />,
    },
    {
      title: '余额',
      dataIndex: 'balance',
      key: 'balance',
      width: 120,
      render: (value: number) => <Amount value={value} />,
    },
    {
      title: '到期日',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (date: string) => {
        const isOverdue = dayjs(date).isBefore(dayjs(), 'day');
        return (
          <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
            {dayjs(date).format('YYYY-MM-DD')}
            {isOverdue && ' (逾期)'}
          </span>
        );
      },
    },
    {
      title: '核销金额',
      key: 'appliedAmount',
      width: 200,
      render: (_: any, record: ApplyRow) => (
        <AmountInput
          value={record.appliedAmount}
          onChange={(value) => handleAmountChange(record.id, value)}
          max={Math.min(remainingAmount + record.appliedAmount, record.balance)}
          disabled={loading}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: ApplyRow) => (
        <Button
          type="link"
          size="small"
          onClick={() => handleQuickFill(record)}
          disabled={loading || remainingAmount === 0}
        >
          快速填充
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">AR核销</h1>

      {/* 收款单信息 */}
      <Card title="收款单信息" className="mb-4">
        <Descriptions column={3}>
          <Descriptions.Item label="收款单号">{payment.paymentNo}</Descriptions.Item>
          <Descriptions.Item label="客户ID">{payment.customerId}</Descriptions.Item>
          <Descriptions.Item label="收款日期">
            {dayjs(payment.paymentDate).format('YYYY-MM-DD')}
          </Descriptions.Item>
          <Descriptions.Item label="收款金额">
            <Amount value={payment.amount} />
          </Descriptions.Item>
          <Descriptions.Item label="未分配金额">
            <Amount value={payment.unappliedAmount} className="text-blue-600 font-semibold" />
          </Descriptions.Item>
          <Descriptions.Item label="支付方式">{payment.paymentMethod}</Descriptions.Item>
          <Descriptions.Item label="银行流水号">{payment.bankRef}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 核销汇总 */}
      <Alert
        message={
          <div className="flex justify-between items-center">
            <span>
              本次核销：<Amount value={totalApplied} className="font-semibold text-blue-600" />
            </span>
            <span>
              剩余可分配：
              <Amount
                value={remainingAmount}
                className={`font-semibold ${canSettle ? 'text-green-600' : ''}`}
              />
              {canSettle && <span className="ml-2 text-green-600">✓ 可结清</span>}
            </span>
          </div>
        }
        type={canSettle ? 'success' : 'info'}
        className="mb-4"
      />

      {/* 应收单列表 */}
      <Card title="选择应收单进行核销">
        <Table
          columns={columns}
          dataSource={applyRows}
          rowKey="id"
          pagination={false}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* 操作按钮 */}
      <div className="mt-6 flex justify-end">
        <Space>
          <Button onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={loading}
            disabled={totalApplied === 0}
          >
            确认核销
          </Button>
        </Space>
      </div>
    </div>
  );
};
