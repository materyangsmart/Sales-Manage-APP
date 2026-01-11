import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Table, Button, Select, DatePicker, Input, message, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { getPaymentList } from '../services/ar';
import type { ARPayment, PaymentListParams } from '../types/ar';
import { Amount } from '../components/Amount';

const { RangePicker } = DatePicker;
const { Option } = Select;

const STORAGE_KEY = 'ar_payment_list_filters';

/**
 * 获取默认日期范围（近7天）
 */
const getDefaultDateRange = (): [string, string] => {
  const today = dayjs().endOf('day');
  const sevenDaysAgo = dayjs().subtract(7, 'days').startOf('day');
  return [
    sevenDaysAgo.format('YYYY-MM-DD'),
    today.format('YYYY-MM-DD'),
  ];
};

/**
 * 从localStorage或URL参数加载筛选条件
 */
const loadFiltersFromStorage = (searchParams: URLSearchParams): PaymentListParams => {
  // 优先从URL参数读取
  const urlStatus = searchParams.get('status') as 'UNAPPLIED' | 'PARTIAL' | 'CLOSED' | null;
  const urlCustomerId = searchParams.get('customer_id');
  const urlDateFrom = searchParams.get('date_from');
  const urlDateTo = searchParams.get('date_to');
  const urlPage = searchParams.get('page');
  const urlPageSize = searchParams.get('page_size');

  // 如果URL有参数，使用URL参数
  if (urlStatus || urlCustomerId || urlDateFrom || urlDateTo) {
    return {
      status: urlStatus || 'UNAPPLIED',
      customer_id: urlCustomerId ? parseInt(urlCustomerId) : undefined,
      date_from: urlDateFrom || undefined,
      date_to: urlDateTo || undefined,
      page: urlPage ? parseInt(urlPage) : 1,
      page_size: urlPageSize ? parseInt(urlPageSize) : 20,
    };
  }

  // 尝试从localStorage读取
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // 验证日期是否仍然有效（不超过30天）
      if (parsed.date_from && parsed.date_to) {
        const storedDate = dayjs(parsed.date_from);
        const daysDiff = dayjs().diff(storedDate, 'days');
        if (daysDiff <= 30) {
          return parsed;
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load filters from localStorage:', error);
  }

  // 默认值：近7天 + 待处理状态
  const [dateFrom, dateTo] = getDefaultDateRange();
  return {
    status: 'UNAPPLIED',
    date_from: dateFrom,
    date_to: dateTo,
    page: 1,
    page_size: 20,
  };
};

/**
 * 保存筛选条件到localStorage
 */
const saveFiltersToStorage = (params: PaymentListParams) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch (error) {
    console.warn('Failed to save filters to localStorage:', error);
  }
};

/**
 * AR待处理列表页面
 */
export const ARPaymentList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ARPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [params, setParams] = useState<PaymentListParams>(() => 
    loadFiltersFromStorage(searchParams)
  );

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      // 添加排序参数（默认received_at DESC）
      const response = await getPaymentList({
        ...params,
        sort_by: 'received_at',
        sort_order: 'DESC',
      });
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
    // 保存到localStorage
    saveFiltersToStorage(params);
    // 更新URL参数
    const newSearchParams = new URLSearchParams();
    if (params.status) newSearchParams.set('status', params.status);
    if (params.customer_id) newSearchParams.set('customer_id', params.customer_id.toString());
    if (params.date_from) newSearchParams.set('date_from', params.date_from);
    if (params.date_to) newSearchParams.set('date_to', params.date_to);
    if (params.page) newSearchParams.set('page', params.page.toString());
    if (params.page_size) newSearchParams.set('page_size', params.page_size.toString());
    setSearchParams(newSearchParams, { replace: true });
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
    const [dateFrom, dateTo] = getDefaultDateRange();
    setParams({
      status: 'UNAPPLIED',
      date_from: dateFrom,
      date_to: dateTo,
      page: 1,
      page_size: 20,
    });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">AR到款待处理列表</h1>

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

      {/* 数据表格 */}
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
    </div>
  );
};
