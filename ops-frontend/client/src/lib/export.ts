/**
 * 数据导出工具函数
 * 支持CSV和JSON格式导出
 */

/**
 * 将数据导出为CSV文件
 */
export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert("没有数据可导出");
    return;
  }

  // 获取所有列名
  const headers = Object.keys(data[0]);
  
  // 构建CSV内容
  const csvContent = [
    // 表头
    headers.join(","),
    // 数据行
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // 处理包含逗号或换行符的值，用双引号包裹
        if (value === null || value === undefined) {
          return "";
        }
        const stringValue = String(value);
        if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(",")
    )
  ].join("\n");

  // 添加BOM以支持中文
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  
  // 创建下载链接
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 将数据导出为JSON文件
 */
export function exportToJSON(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert("没有数据可导出");
    return;
  }

  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.json`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 将订单数据转换为导出格式（包含所有BI分析所需字段）
 */
export function transformOrdersForExport(orders: any[]) {
  return orders.map(order => ({
    "订单编号": order.order_no || order.orderNo,
    "客户名称": order.customer?.name || order.customer?.customer_name || "-",
    "客户类型": translateCustomerCategory(order.customer?.category),
    "订单金额": order.total_amount || order.totalAmount || 0,
    "订单毛利": calculateOrderProfit(order),
    "订单状态": translateOrderStatus(order.status),
    "创建时间": order.created_at || order.createdAt,
    "履行时间": order.fulfilled_at || order.fulfilledAt || "-",
    "生产批次号": order.batch_no || order.batchNo || "-",
    "备注": order.remark || "-",
  }));
}

/**
 * 将回款数据转换为导出格式
 */
export function transformPaymentsForExport(payments: any[]) {
  return payments.map(payment => ({
    "回款编号": payment.payment_no || payment.paymentNo,
    "客户名称": payment.customer?.name || payment.customer?.customer_name || "-",
    "回款金额": payment.amount || 0,
    "回款方式": translatePaymentMethod(payment.payment_method || payment.paymentMethod),
    "回款状态": translatePaymentStatus(payment.status),
    "核销金额": payment.applied_amount || payment.appliedAmount || 0,
    "未核销金额": payment.unapplied_amount || payment.unappliedAmount || 0,
    "核销时间戳": payment.applied_at || payment.appliedAt || "-",
    "创建时间": payment.created_at || payment.createdAt,
    "银行流水号": payment.bank_ref || payment.bankRef || "-",
    "备注": payment.remark || "-",
  }));
}

// 辅助函数：翻译客户类型
function translateCustomerCategory(category: string | undefined): string {
  const map: Record<string, string> = {
    WET_MARKET: "菜市场",
    WHOLESALE_B: "批发商",
    SUPERMARKET: "商超",
    ECOMMERCE: "电商",
  };
  return category ? (map[category] || category) : "-";
}

// 辅助函数：翻译订单状态
function translateOrderStatus(status: string | undefined): string {
  const map: Record<string, string> = {
    PENDING: "待审核",
    APPROVED: "已审核",
    REJECTED: "已拒绝",
    FULFILLED: "已履行",
    CANCELLED: "已取消",
  };
  return status ? (map[status] || status) : "-";
}

// 辅助函数：翻译回款方式
function translatePaymentMethod(method: string | undefined): string {
  const map: Record<string, string> = {
    CASH: "现金",
    BANK_TRANSFER: "银行转账",
    ALIPAY: "支付宝",
    WECHAT: "微信支付",
  };
  return method ? (map[method] || method) : "-";
}

// 辅助函数：翻译回款状态
function translatePaymentStatus(status: string | undefined): string {
  const map: Record<string, string> = {
    UNAPPLIED: "待核销",
    PARTIAL: "部分核销",
    APPLIED: "已核销",
  };
  return status ? (map[status] || status) : "-";
}

// 辅助函数：计算订单毛利（基于订单金额的简化计算，毛利率约20%）
function calculateOrderProfit(order: any): number {
  const totalAmount = order.total_amount || order.totalAmount || 0;
  return Math.round(totalAmount * 0.2);
}
