import { http, HttpResponse, delay } from 'msw';

const API_BASE_URL = 'http://localhost:3001/api';

// Mock数据
const mockPayments = [
  {
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
  },
];

const mockInvoices = [
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

export const handlers = [
  // GET /ar/payments - 正常响应
  http.get(`${API_BASE_URL}/ar/payments`, async () => {
    await delay(100); // 模拟网络延迟
    return HttpResponse.json({
      items: mockPayments,
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
  }),

  // POST /ar/apply - 正常响应
  http.post(`${API_BASE_URL}/ar/apply`, async () => {
    await delay(100);
    return HttpResponse.json({
      paymentNo: 'PAY-2024-001',
      totalApplied: 500000,
      unappliedAmount: 500000,
      paymentStatus: 'PARTIAL',
      appliedInvoices: [
        {
          invoiceNo: 'INV-2024-001',
          appliedAmount: 500000,
          beforeBalance: 500000,
          afterBalance: 0,
          status: 'CLOSED',
        },
      ],
    });
  }),
];

// 409冲突响应handler
export const conflict409Handler = http.post(`${API_BASE_URL}/ar/apply`, async () => {
  await delay(100);
  return HttpResponse.json(
    {
      error: 'CONFLICT',
      message: '数据已被他人更新，请刷新后重试',
      userMessage: '数据已被他人更新，请刷新后重试',
    },
    { status: 409 }
  );
});

// 500错误响应handler
export const error500Handler = http.get(`${API_BASE_URL}/ar/payments`, async () => {
  await delay(100);
  return HttpResponse.json(
    {
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    },
    { status: 500 }
  );
});

// 空数据响应handler
export const emptyDataHandler = http.get(`${API_BASE_URL}/ar/payments`, async () => {
  await delay(100);
  return HttpResponse.json({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  });
});

// 超时handler
export const timeoutHandler = http.get(`${API_BASE_URL}/ar/payments`, async () => {
  await delay(30000); // 30秒超时
  return HttpResponse.json({
    items: mockPayments,
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  });
});
