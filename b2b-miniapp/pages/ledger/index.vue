<template>
  <view class="container">
    <!-- 账本概览卡片 -->
    <view class="card summary-card">
      <view class="summary-title">账本概览</view>
      <view class="summary-content">
        <view class="summary-item">
          <text class="summary-label">应收总额</text>
          <text class="summary-value text-primary">¥{{ formatAmount(summary.totalReceivable) }}</text>
        </view>
        <view class="summary-item">
          <text class="summary-label">已收金额</text>
          <text class="summary-value">¥{{ formatAmount(summary.totalReceived) }}</text>
        </view>
        <view class="summary-item">
          <text class="summary-label">未收余额</text>
          <text class="summary-value text-danger">¥{{ formatAmount(summary.totalBalance) }}</text>
        </view>
        <view class="summary-item">
          <text class="summary-label">逾期金额</text>
          <text class="summary-value text-warning">¥{{ formatAmount(summary.overdueAmount) }}</text>
        </view>
      </view>
    </view>

    <!-- 筛选器 -->
    <view class="card filter-card">
      <view class="filter-row">
        <picker mode="selector" :range="statusOptions" :value="filterStatus" @change="onStatusChange">
          <view class="filter-item">
            <text>状态：{{ statusOptions[filterStatus] }}</text>
            <text class="arrow">▼</text>
          </view>
        </picker>
        <picker mode="date" :value="filterDate" @change="onDateChange">
          <view class="filter-item">
            <text>日期：{{ filterDate || '全部' }}</text>
            <text class="arrow">▼</text>
          </view>
        </picker>
      </view>
    </view>

    <!-- 应收单列表 -->
    <view class="invoice-list">
      <view class="card invoice-item" v-for="invoice in invoices" :key="invoice.id" @tap="onInvoiceClick(invoice)">
        <view class="invoice-header flex-between">
          <text class="invoice-no">{{ invoice.invoiceNo }}</text>
          <view :class="['invoice-status', 'status-' + invoice.status]">
            {{ getStatusText(invoice.status) }}
          </view>
        </view>
        <view class="invoice-body mt-10">
          <view class="invoice-row flex-between">
            <text class="label">应收金额</text>
            <text class="value text-bold">¥{{ formatAmount(invoice.amount) }}</text>
          </view>
          <view class="invoice-row flex-between mt-10">
            <text class="label">未收余额</text>
            <text class="value text-danger">¥{{ formatAmount(invoice.balance) }}</text>
          </view>
          <view class="invoice-row flex-between mt-10">
            <text class="label">到期日期</text>
            <text class="value">{{ invoice.dueDate }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="invoices.length === 0 && !loading" class="empty-state">
      <text class="empty-text">暂无数据</text>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="loading-state">
      <text class="loading-text">加载中...</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      loading: false,
      summary: {
        totalReceivable: 0,
        totalReceived: 0,
        totalBalance: 0,
        overdueAmount: 0
      },
      invoices: [],
      statusOptions: ['全部', '未结清', '已结清', '逾期'],
      filterStatus: 0,
      filterDate: ''
    }
  },
  onLoad() {
    this.loadData()
  },
  onPullDownRefresh() {
    this.loadData().then(() => {
      uni.stopPullDownRefresh()
    })
  },
  methods: {
    async loadData() {
      this.loading = true
      try {
        // TODO: 调用实际API
        // const res = await this.$api.getLedger()
        // this.summary = res.summary
        // this.invoices = res.invoices
        
        // 模拟数据
        this.summary = {
          totalReceivable: 1000000,
          totalReceived: 600000,
          totalBalance: 400000,
          overdueAmount: 50000
        }
        this.invoices = [
          {
            id: 1,
            invoiceNo: 'INV-2024-001',
            amount: 100000,
            balance: 50000,
            status: 'UNPAID',
            dueDate: '2024-01-15'
          },
          {
            id: 2,
            invoiceNo: 'INV-2024-002',
            amount: 200000,
            balance: 200000,
            status: 'OVERDUE',
            dueDate: '2024-01-10'
          }
        ]
      } catch (error) {
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      } finally {
        this.loading = false
      }
    },
    formatAmount(amount) {
      return (amount / 100).toFixed(2)
    },
    getStatusText(status) {
      const statusMap = {
        'UNPAID': '未结清',
        'PAID': '已结清',
        'OVERDUE': '逾期'
      }
      return statusMap[status] || status
    },
    onStatusChange(e) {
      this.filterStatus = e.detail.value
      this.loadData()
    },
    onDateChange(e) {
      this.filterDate = e.detail.value
      this.loadData()
    },
    onInvoiceClick(invoice) {
      // TODO: 跳转到详情页
      uni.showToast({
        title: '详情页开发中',
        icon: 'none'
      })
    }
  }
}
</script>

<style scoped>
.summary-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.summary-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 20rpx;
}

.summary-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.summary-item {
  display: flex;
  flex-direction: column;
}

.summary-label {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 8rpx;
}

.summary-value {
  font-size: 18px;
  font-weight: bold;
}

.filter-card {
  padding: 16rpx 24rpx;
}

.filter-row {
  display: flex;
  justify-content: space-between;
}

.filter-item {
  display: flex;
  align-items: center;
  padding: 8rpx 16rpx;
  background-color: #f5f5f5;
  border-radius: 4rpx;
}

.arrow {
  margin-left: 8rpx;
  font-size: 12px;
  color: #909399;
}

.invoice-list {
  margin-top: 20rpx;
}

.invoice-item {
  margin-bottom: 20rpx;
}

.invoice-header {
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.invoice-no {
  font-size: 16px;
  font-weight: bold;
}

.invoice-status {
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
  font-size: 12px;
}

.status-UNPAID {
  background-color: #fef0f0;
  color: #f56c6c;
}

.status-PAID {
  background-color: #f0f9ff;
  color: #409eff;
}

.status-OVERDUE {
  background-color: #fdf6ec;
  color: #e6a23c;
}

.invoice-body {
  padding-top: 16rpx;
}

.invoice-row {
  display: flex;
  justify-content: space-between;
}

.label {
  color: #909399;
  font-size: 14px;
}

.value {
  font-size: 14px;
}

.empty-state,
.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400rpx;
}

.empty-text,
.loading-text {
  color: #909399;
  font-size: 14px;
}
</style>
