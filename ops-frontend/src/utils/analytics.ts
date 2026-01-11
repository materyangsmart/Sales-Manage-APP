/**
 * 埋点工具
 * 用于追踪用户行为和业务事件
 */

interface EventData {
  [key: string]: any;
}

/**
 * AR相关埋点事件数据
 */
interface AREventData extends EventData {
  payment_id?: number | string;
  customer_id?: number;
  amount_fen?: number;
  invoice_count?: number;
  [key: string]: any;
}

/**
 * 发送埋点事件
 * @param eventName 事件名称
 * @param data 事件数据
 */
export function trackEvent(eventName: string, data?: EventData): void {
  // 添加通用字段
  const enrichedData = {
    ...data,
    timestamp: Date.now(),
    user_agent: navigator.userAgent,
    page_url: window.location.href,
  };
  // 在开发环境打印日志
  if (import.meta.env.DEV) {
    console.log('[Analytics]', eventName, enrichedData);
  }

  // TODO: 集成实际的埋点SDK（如Google Analytics、神策、友盟等）
  // 示例：
  // window.gtag?.('event', eventName, enrichedData);
  // window.sensors?.track(eventName, enrichedData);

  // 暂时使用console.log模拟
  try {
    // 可以发送到后端埋点接口
    // fetch('/api/analytics/track', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ event: eventName, data: enrichedData }),
    // });
  } catch (error) {
    console.error('[Analytics] Failed to track event:', error);
  }
}

/**
 * 追踪页面浏览
 * @param pageName 页面名称
 * @param data 额外数据
 */
export function trackPageView(pageName: string, data?: EventData): void {
  trackEvent('page_view', {
    page: pageName,
    ...data,
  });
}

/**
 * 追踪错误
 * @param error 错误对象
 * @param context 错误上下文
 */
export function trackError(error: Error, context?: EventData): void {
  trackEvent('error', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
}

/**
 * AR核销相关埋点
 */
export const ARAnalytics = {
  /**
   * 核销提交
   */
  applySubmit(data: AREventData): void {
    trackEvent('apply_submit', {
      payment_id: data.payment_id,
      customer_id: data.customer_id,
      amount_fen: data.amount_fen,
      invoice_count: data.invoice_count,
      ...data,
    });
  },

  /**
   * 核销成功
   */
  applySuccess(data: AREventData): void {
    trackEvent('apply_success', {
      payment_id: data.payment_id,
      customer_id: data.customer_id,
      amount_fen: data.amount_fen,
      invoice_count: data.invoice_count,
      ...data,
    });
  },

  /**
   * 核销冲突（409错误）
   */
  applyConflict(data: AREventData): void {
    trackEvent('apply_conflict', {
      payment_id: data.payment_id,
      customer_id: data.customer_id,
      amount_fen: data.amount_fen,
      invoice_count: data.invoice_count,
      error_code: 409,
      error_message: '数据已被他人更新',
      ...data,
    });
  },

  /**
   * 核销失败（其他错误）
   */
  applyError(data: AREventData & { error_code?: number; error_message?: string }): void {
    trackEvent('apply_error', {
      payment_id: data.payment_id,
      customer_id: data.customer_id,
      amount_fen: data.amount_fen,
      invoice_count: data.invoice_count,
      ...data,
    });
  },
};

// 导出类型
export type { AREventData };

