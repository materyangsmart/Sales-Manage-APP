/**
 * 账本相关API
 */
import { get, post } from '../utils/request'

/**
 * 获取账本概览
 * @returns {Promise}
 */
export function getLedgerSummary() {
  return get('/api/b2b/ledger/summary')
}

/**
 * 获取应收单列表
 * @param {Object} params 查询参数
 * @returns {Promise}
 */
export function getInvoiceList(params) {
  return get('/api/b2b/ledger/invoices', params)
}

/**
 * 获取应收单详情
 * @param {Number} invoiceId 应收单ID
 * @returns {Promise}
 */
export function getInvoiceDetail(invoiceId) {
  return get(`/api/b2b/ledger/invoices/${invoiceId}`)
}

/**
 * 获取收款记录
 * @param {Number} invoiceId 应收单ID
 * @returns {Promise}
 */
export function getPaymentRecords(invoiceId) {
  return get(`/api/b2b/ledger/invoices/${invoiceId}/payments`)
}
