/**
 * 埋点工具
 * 用于追踪用户行为和业务事件
 */

interface EventData {
  [key: string]: any;
}

/**
 * 发送埋点事件
 * @param eventName 事件名称
 * @param data 事件数据
 */
export function trackEvent(eventName: string, data?: EventData): void {
  // 在开发环境打印日志
  if (import.meta.env.DEV) {
    console.log('[Analytics]', eventName, data);
  }

  // TODO: 集成实际的埋点SDK（如Google Analytics、神策、友盟等）
  // 示例：
  // window.gtag?.('event', eventName, data);
  // window.sensors?.track(eventName, data);

  // 暂时使用console.log模拟
  try {
    // 可以发送到后端埋点接口
    // fetch('/api/analytics/track', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ event: eventName, data, timestamp: Date.now() }),
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
