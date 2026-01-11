import React, { useState } from 'react';
import { Card, Descriptions, Button, Table, message, Modal, Space, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { applyPayment } from '../services/ar';
import type { ARPayment, ARInvoice, ApplyItem } from '../types/ar';
import { Amount, AmountInput } from '../components/Amount';
import { ARAnalytics } from '../utils/analytics';

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
  const handleSubmit = () => {
    // 埋点：提交核销
    ARAnalytics.applySubmit({
      payment_id: payment.id,
      customer_id: payment.customerId,
      amount_fen: totalApplied,
      invoice_count: applyRows.filter((r) => r.appliedAmount > 0).length,
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
          ARAnalytics.applySuccess({
            payment_id: payment.id,
            customer_id: payment.customerId,
            amount_fen: totalApplied,
            invoice_count: validApplies.length,
          });

          onSuccess?.();
        } catch (error: any) {
          // 埋点：核销冲突或错误
          if (error.response?.status === 409) {
            ARAnalytics.applyConflict({
              payment_id: payment.id,
              customer_id: payment.customerId,
              amount_fen: totalApplied,
              invoice_count: validApplies.length,
            });
          } else {
            ARAnalytics.applyError({
              payment_id: payment.id,
              customer_id: payment.customerId,
              amount_fen: totalApplied,
              invoice_count: validApplies.length,
              error_code: error.response?.status,
              error_message: error.userMessage || error.message,
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
      width: 150,
      render: (amount: number) => <Amount value={amount} />,
    },
    {
      title: '剩余余额',
      dataIndex: 'balance',
      key: 'balance',
      width: 150,
      render: (balance: number) => <Amount value={balance} />,
    },
    {
      title: '到期日期',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '核销金额',
      key: 'appliedAmount',
      width: 200,
      render: (_, record) => (
        <Space>
          <AmountInput
            value={record.appliedAmount}
            onChange={(value) => handleAmountChange(record.id, value)}
            max={Math.min(remainingAmount + record.appliedAmount, record.balance)}
            placeholder="请输入核销金额"
          />
          <Button
            size="small"
            onClick={() => handleQuickFill(record)}
            disabled={remainingAmount === 0}
          >
            快速填充
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card title="核销收款单" className="mb-4">
        <Descriptions column={2} bordered>
          <Descriptions.Item label="收款单号">{payment.paymentNo}</Descriptions.Item>
          <Descriptions.Item label="客户ID">{payment.customerId}</Descriptions.Item>
          <Descriptions.Item label="收款金额">
            <Amount value={payment.amount} />
          </Descriptions.Item>
          <Descriptions.Item label="未分配金额">
            <Amount value={payment.unappliedAmount} className="text-orange-600 font-semibold" />
          </Descriptions.Item>
          <Descriptions.Item label="收款日期">
            {dayjs(payment.paymentDate).format('YYYY-MM-DD')}
          </Descriptions.Item>
          <Descriptions.Item label="收款方式">{payment.paymentMethod}</Descriptions.Item>
        </Descriptions>
      </Card>

      {remainingAmount < 0 && (
        <Alert
          message="警告"
          description="核销金额超出未分配金额，请调整"
          type="error"
          showIcon
          className="mb-4"
        />
      )}

      {canSettle && totalApplied > 0 && (
        <Alert
          message="提示"
          description="本次核销后将结清该收款单"
          type="success"
          showIcon
          className="mb-4"
        />
      )}

      <Card
        title="待核销应收单"
        extra={
          <Space>
            <span>
              本次核销：<Amount value={totalApplied} className="text-blue-600 font-semibold" />
            </span>
            <span>
              剩余可分配：<Amount value={remainingAmount} className="text-orange-600 font-semibold" />
            </span>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={applyRows}
          rowKey="id"
          pagination={false}
          scroll={{ x: 800 }}
        />

        <div className="mt-4 flex justify-end space-x-2">
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
        </div>
      </Card>
    </div>
  );
};
