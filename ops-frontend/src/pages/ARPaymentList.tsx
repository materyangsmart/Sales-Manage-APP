import React, { useState, useEffect } from 'react';
import { Table, Button, Select, DatePicker, Input, message, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { getPaymentList } from '../services/ar';
import type { ARPayment, PaymentListParams } from '../types/ar';
import { Amount } from '../components/Amount';

const { RangePicker } = DatePicker;
const { Option } = Select;

/**
 * AR待处理列表页面
 */
export const ARPaymentList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ARPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [params, setParams] = useState<PaymentListParams>({
    orgId: 2, // TODO: 从登录态获取
    status: 'UNAPPLIED',
    page: 1,
    pageSize: 20,
  });

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const response = await getPaymentList(params);
      setData(response.items);
      setTotal(response.total);
    } catch (error: any) {
      message.error(error.userMessage || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [params]);

  // 表格列定义
  const columns: ColumnsType<ARPayment> = [
    {
      title: '收款单号',
      dataIndex: 'paymentNo',
      key: 'paymentNo',
      width: 200,
      fixed: 'left',
    },
    {
      title: '客户ID',
      dataIndex: 'customerId',
      key: 'customerId',
      width: 100,
    },
    {
      title: '收款金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (value: number) => <Amount value={value} />,
    },
    {
      title: '未分配金额',
      dataIndex: 'unappliedAmount',
      key: 'unappliedAmount',
      width: 120,
      render: (value: number) => (
        <Amount value={value} className={value === 0 ? 'text-green-600 font-semibold' : ''} />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          UNAPPLIED: 'orange',
          PARTIAL: 'blue',
          CLOSED: 'green',
        };
        const textMap: Record<string, string> = {
          UNAPPLIED: '待处理',
          PARTIAL: '部分核销',
          CLOSED: '已结清',
        };
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
      },
    },
    {
      title: '收款日期',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '支付方式',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 120,
    },
    {
      title: '银行流水号',
      dataIndex: 'bankRef',
      key: 'bankRef',
      width: 150,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_: any, record: ARPayment) => (
        <Button
          type="link"
          onClick={() => handleApply(record)}
          disabled={record.unappliedAmount === 0}
        >
          核销
        </Button>
      ),
    },
  ];

  // 处理核销
  const handleApply = (payment: ARPayment) => {
    // TODO: 跳转到核销详情页
    message.info(`跳转到核销页面: ${payment.paymentNo}`);
  };

  // 处理筛选变更
  const handleFilterChange = (key: keyof PaymentListParams, value: any) => {
    setParams((prev) => ({
      ...prev,
      [key]: value,
      page: 1, // 重置页码
    }));
  };

  // 处理分页变更
  const handlePageChange = (page: number, pageSize: number) => {
    setParams((prev) => ({
      ...prev,
      page,
      pageSize,
    }));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">AR到款待处理列表</h1>

      {/* 筛选条件 */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <Space wrap size="middle">
          <div>
            <span className="mr-2">状态:</span>
            <Select
              value={params.status}
              onChange={(value) => handleFilterChange('status', value)}
              style={{ width: 120 }}
            >
              <Option value={undefined}>全部</Option>
              <Option value="UNAPPLIED">待处理</Option>
              <Option value="PARTIAL">部分核销</Option>
              <Option value="CLOSED">已结清</Option>
            </Select>
          </div>

          <div>
            <span className="mr-2">客户ID:</span>
            <Input
              value={params.customerId}
              onChange={(e) => handleFilterChange('customerId', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="请输入客户ID"
              style={{ width: 150 }}
            />
          </div>

          <div>
            <span className="mr-2">收款日期:</span>
            <RangePicker
              value={
                params.dateFrom && params.dateTo
                  ? [dayjs(params.dateFrom), dayjs(params.dateTo)]
                  : null
              }
              onChange={(dates) => {
                if (dates) {
                  handleFilterChange('dateFrom', dates[0]?.format('YYYY-MM-DD'));
                  handleFilterChange('dateTo', dates[1]?.format('YYYY-MM-DD'));
                } else {
                  handleFilterChange('dateFrom', undefined);
                  handleFilterChange('dateTo', undefined);
                }
              }}
            />
          </div>

          <Button type="primary" onClick={loadData}>
            查询
          </Button>
        </Space>
      </div>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1500 }}
        pagination={{
          current: params.page,
          pageSize: params.pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: handlePageChange,
        }}
      />
    </div>
  );
};
