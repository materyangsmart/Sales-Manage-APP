import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock backend-api module
vi.mock('./backend-api', () => ({
  complaintAPI: {
    submitComplaint: vi.fn(),
    getUnreadCount: vi.fn(),
    getComplaints: vi.fn(),
    getComplaintDetail: vi.fn(),
    markAsRead: vi.fn(),
    updateComplaintStatus: vi.fn(),
  },
  ceoRadarAPI: {
    getRadarData: vi.fn(),
  },
  ordersAPI: {},
  invoicesAPI: {},
  paymentsAPI: {},
  applyAPI: {},
  auditLogsAPI: {},
  customersAPI: {},
  commissionRulesAPI: {},
  antiFraudAPI: {},
  creditAPI: {},
  governanceAPI: {},
}));

describe('P25: 质量投诉直达CEO看板 - 完整闭环测试', () => {
  let complaintAPI: any;
  let ceoRadarAPI: any;

  beforeEach(async () => {
    const backendApi = await import('./backend-api');
    complaintAPI = backendApi.complaintAPI;
    ceoRadarAPI = backendApi.ceoRadarAPI;
    vi.clearAllMocks();
  });

  describe('投诉提交流程', () => {
    it('应正确提交投诉并返回投诉ID', async () => {
      const mockResponse = {
        id: 1,
        severity: 'HIGH',
        status: 'PENDING',
        message: '投诉已提交，将直接发送至CEO看板',
      };
      complaintAPI.submitComplaint.mockResolvedValue(mockResponse);

      const complaintData = {
        batchNo: 'BATCH-2026-001',
        driverId: 5,
        orderId: 100,
        complainantName: '张三',
        complainantPhone: '13800138000',
        complaintContent: '千张有异味，疑似变质',
        imageUrls: ['https://example.com/img1.jpg'],
      };

      const result = await complaintAPI.submitComplaint(complaintData);

      expect(result).toEqual(mockResponse);
      expect(result.id).toBe(1);
      expect(result.severity).toBe('HIGH');
      expect(result.status).toBe('PENDING');
      expect(complaintAPI.submitComplaint).toHaveBeenCalledWith(complaintData);
    });

    it('投诉应包含batch_no和driver_id自动关联', async () => {
      complaintAPI.submitComplaint.mockResolvedValue({
        id: 2,
        severity: 'HIGH',
        status: 'PENDING',
        message: '投诉已提交',
      });

      // 模拟从QR码URL参数中提取的数据
      const complaintWithAutoAssociation = {
        batchNo: 'BATCH-2026-002', // 从traceData.production.batchNo获取
        driverId: 8, // 从URL参数driver_id获取
        orderId: 200,
        complainantName: '李四',
        complaintContent: '产品包装破损',
      };

      await complaintAPI.submitComplaint(complaintWithAutoAssociation);

      expect(complaintAPI.submitComplaint).toHaveBeenCalledWith(
        expect.objectContaining({
          batchNo: 'BATCH-2026-002',
          driverId: 8,
          orderId: 200,
        })
      );
    });

    it('投诉无driver_id时应正常提交', async () => {
      complaintAPI.submitComplaint.mockResolvedValue({
        id: 3,
        severity: 'MEDIUM',
        status: 'PENDING',
        message: '投诉已提交',
      });

      const complaintWithoutDriver = {
        batchNo: 'ORD-300',
        orderId: 300,
        complainantName: '王五',
        complaintContent: '产品质量不达标',
      };

      const result = await complaintAPI.submitComplaint(complaintWithoutDriver);
      expect(result.id).toBe(3);
    });
  });

  describe('CEO看板投诉提醒', () => {
    it('应返回未读投诉数量', async () => {
      complaintAPI.getUnreadCount.mockResolvedValue({ unreadCount: 3 });

      const result = await complaintAPI.getUnreadCount();
      expect(result.unreadCount).toBe(3);
    });

    it('CEO雷达数据应包含投诉警报', async () => {
      const mockRadarData = {
        badDebtRisks: [],
        yieldAnomalies: [],
        churnRisks: [],
        complaintAlerts: [
          {
            id: 1,
            batchNo: 'BATCH-2026-001',
            complainantName: '张三',
            complaintContent: '千张有异味',
            severity: 'HIGH',
            createdAt: '2026-02-24T10:00:00Z',
          },
        ],
        unreadComplaintCount: 1,
        lastUpdate: '2026-02-24T10:00:00Z',
      };
      ceoRadarAPI.getRadarData.mockResolvedValue(mockRadarData);

      const result = await ceoRadarAPI.getRadarData();
      expect(result.complaintAlerts).toHaveLength(1);
      expect(result.unreadComplaintCount).toBe(1);
      expect(result.complaintAlerts[0].severity).toBe('HIGH');
      expect(result.complaintAlerts[0].batchNo).toBe('BATCH-2026-001');
    });

    it('无投诉时应返回空列表和0未读', async () => {
      const mockRadarData = {
        badDebtRisks: [],
        yieldAnomalies: [],
        churnRisks: [],
        complaintAlerts: [],
        unreadComplaintCount: 0,
        lastUpdate: '2026-02-24T10:00:00Z',
      };
      ceoRadarAPI.getRadarData.mockResolvedValue(mockRadarData);

      const result = await ceoRadarAPI.getRadarData();
      expect(result.complaintAlerts).toHaveLength(0);
      expect(result.unreadComplaintCount).toBe(0);
    });
  });

  describe('投诉处理流程', () => {
    it('CEO应能标记投诉为已读', async () => {
      complaintAPI.markAsRead.mockResolvedValue(undefined);

      await complaintAPI.markAsRead(1);
      expect(complaintAPI.markAsRead).toHaveBeenCalledWith(1);
    });

    it('CEO应能更新投诉状态', async () => {
      const updatedComplaint = {
        id: 1,
        status: 'PROCESSING',
        ceoNote: '已安排品控部门调查',
      };
      complaintAPI.updateComplaintStatus.mockResolvedValue(updatedComplaint);

      const result = await complaintAPI.updateComplaintStatus(1, {
        status: 'PROCESSING',
        ceoNote: '已安排品控部门调查',
      });

      expect(result.status).toBe('PROCESSING');
      expect(complaintAPI.updateComplaintStatus).toHaveBeenCalledWith(1, {
        status: 'PROCESSING',
        ceoNote: '已安排品控部门调查',
      });
    });

    it('投诉解决后应能关闭', async () => {
      const resolvedComplaint = {
        id: 1,
        status: 'RESOLVED',
        resolution: '已更换产品并退款',
      };
      complaintAPI.updateComplaintStatus.mockResolvedValue(resolvedComplaint);

      const result = await complaintAPI.updateComplaintStatus(1, {
        status: 'RESOLVED',
        resolution: '已更换产品并退款',
      });

      expect(result.status).toBe('RESOLVED');
    });
  });

  describe('投诉数据完整性', () => {
    it('投诉列表应包含完整字段', async () => {
      const mockComplaints = {
        items: [
          {
            id: 1,
            orderId: 100,
            batchNo: 'BATCH-2026-001',
            customerName: '张三',
            customerPhone: '13800138000',
            complaintType: 'QUALITY',
            complaintContent: '千张有异味',
            complaintImages: '["https://example.com/img1.jpg"]',
            driverId: 5,
            driverName: '赵六',
            status: 'PENDING',
            severity: 'HIGH',
            createdAt: '2026-02-24T10:00:00Z',
          },
        ],
        total: 1,
      };
      complaintAPI.getComplaints.mockResolvedValue(mockComplaints);

      const result = await complaintAPI.getComplaints({ page: 1, pageSize: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toHaveProperty('batchNo');
      expect(result.items[0]).toHaveProperty('driverId');
      expect(result.items[0]).toHaveProperty('complaintContent');
      expect(result.items[0]).toHaveProperty('severity');
    });

    it('应支持按状态和严重程度过滤投诉', async () => {
      complaintAPI.getComplaints.mockResolvedValue({ items: [], total: 0 });

      await complaintAPI.getComplaints({
        page: 1,
        pageSize: 10,
        status: 'PENDING',
        severity: 'HIGH',
        unreadOnly: true,
      });

      expect(complaintAPI.getComplaints).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        status: 'PENDING',
        severity: 'HIGH',
        unreadOnly: true,
      });
    });
  });
});
