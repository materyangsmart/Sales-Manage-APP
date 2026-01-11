import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Select, DatePicker, Input, message, Space, Tag, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { getPaymentList } from '../services/ar';
import type { ARPayment, PaymentListParams } from '../types/ar';
import { Amount } from '../components/Amount';
import { Empty } from '../components/Empty';

const { RangePicker } = DatePicker;
const { Option } = Select;

/**
 * AR待处理列表页面
 */
export const ARPaymentList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ARPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<PaymentListParams>({
    status: 'UNAPPLIED',
    page: 1,
    page_size: 20,
  });

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    setError(null); // 清除之前的错误
    try {
      const response = await getPaymentList(params);
      setData(response.items);
      setTotal(response.total);
    } catch (error: any) {
      // 区分不同类型的错误
      let errorMessage = '加载失败';
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = '请求超时，请检查网络连接后重试';
      } else if (error.response) {
        // 服务器返回错误
        const status = error.response.status;
        if (status >= 500) {
          errorMessage = '服务器错误，请稍后重试';
        } else if (status === 404) {
          errorMessage = '接口不存在';
        } else if (status === 403) {
          errorMessage = '无权限访问';
        } else if (status === 401) {
          errorMessage = '未登录或登录已过期';
        } else {
          errorMessage = error.userMessage || error.response.data?.message || '加载失败';
        }
      } else if (error.request) {
        // 网络错误
        errorMessage = '网络连接失败，请检查网络后重试';
      }
      
      setError(errorMessage);
      message.error(errorMessage);
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
      width: 120,
    },
    {
      title: '收款金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      render: (amount: number) => <Amount value={amount} />,
    },
    {
      title: '未分配金额',
      dataIndex: 'unappliedAmount',
      key: 'unappliedAmount',
      width: 150,
      render: (amount: number) => (
        <Amount
          value={amount}
          className={amount === 0 ? 'text-green-600 font-semibold' : ''}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const statusMap = {
          UNAPPLIED: { text: '待处理', color: 'orange' },
          PARTIAL: { text: '部分核销', color: 'blue' },
          CLOSED: { text: '已结清', color: 'green' },
        };
        const config = statusMap[status as keyof typeof statusMap] || { text: status, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '收款日期',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 150,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '收款方式',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 120,
    },
    {
      title: '银行流水号',
      dataIndex: 'bankRef',
      key: 'bankRef',
      width: 200,
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
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => handleApply(record)}
          disabled={record.status === 'CLOSED'}
        >
          核销
        </Button>
      ),
    },
  ];

  // 处理核销
  const handleApply = (payment: ARPayment) => {
    navigate(`/ar/apply/${payment.id}`);
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
      page_size: pageSize,
    }));
  };

  // 重置筛选条件
  const handleReset = () => {
    setParams({
      status: 'UNAPPLIED',
      page: 1,
      page_size: 20,
    });
  };

  // 渲染内容
  const renderContent = () => {
    // 如果有错误，显示错误状态
    if (error && !loading) {
      return (
        <Empty
          description={error}
          onRetry={loadData}
          showRetry={true}
        />
      );
    }

    // 如果没有数据且不在加载中，显示空态
    if (!loading && data.length === 0) {
      return (
        <Empty
          description="暂无符合条件的收款记录"
          onReset={handleReset}
          showReset={true}
        />
      );
    }

    // 正常显示表格
    return (
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1500 }}
        pagination={{
          current: params.page,
          pageSize: params.page_size,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: handlePageChange,
        }}
      />
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">AR到款待处理列表</h1>

      {/* 错误提示（顶部横幅） */}
      {error && !loading && (
        <Alert
          message="加载失败"
          description={
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <Button size="small" onClick={loadData}>
                重试
              </Button>
            </div>
          }
          type="error"
          closable
          onClose={() => setError(null)}
          className="mb-4"
        />
      )}

      {/* 筛选条件 */}
      <div className="mb-4 p-4 bg-white rounded shadow">
        <Space wrap size="middle">
          <div>
            <span className="mr-2">状态:</span>
            <Select
              value={params.status}
              onChange={(value) => handleFilterChange('status', value)}
              style={{ width: 120 }}
            >
              <Option value="UNAPPLIED">待处理</Option>
              <Option value="PARTIAL">部分核销</Option>
              <Option value="CLOSED">已结清</Option>
            </Select>
          </div>

          <div>
            <span className="mr-2">客户ID:</span>
            <Input
              value={params.customer_id}
              onChange={(e) => handleFilterChange('customer_id', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="请输入客户ID"
              style={{ width: 150 }}
            />
          </div>

          <div>
            <span className="mr-2">收款日期:</span>
            <RangePicker
              value={
                params.date_from && params.date_to
                  ? [dayjs(params.date_from), dayjs(params.date_to)]
                  : null
              }
              onChange={(dates) => {
                if (dates) {
                  handleFilterChange('date_from', dates[0]?.format('YYYY-MM-DD'));
                  handleFilterChange('date_to', dates[1]?.format('YYYY-MM-DD'));
                } else {
                  handleFilterChange('date_from', undefined);
                  handleFilterChange('date_to', undefined);
                }
              }}
            />
          </div>

          <Button type="primary" onClick={loadData}>
            查询
          </Button>
          <Button onClick={handleReset}>
            重置
          </Button>
        </Space>
      </div>

      {/* 数据表格或空态 */}
      {renderContent()}
    </div>
  );
};
