/**
 * 网络请求工具
 */

const BASE_URL = 'https://api.example.com' // TODO: 替换为实际API地址

/**
 * 发送HTTP请求
 * @param {Object} options 请求配置
 * @returns {Promise}
 */
export function request(options) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': uni.getStorageSync('token') || '',
        ...options.header
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          // 未授权，跳转登录
          uni.showToast({
            title: '请先登录',
            icon: 'none'
          })
          // TODO: 跳转到登录页
          reject(new Error('未授权'))
        } else {
          uni.showToast({
            title: res.data.message || '请求失败',
            icon: 'none'
          })
          reject(new Error(res.data.message || '请求失败'))
        }
      },
      fail: (err) => {
        uni.showToast({
          title: '网络错误',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

/**
 * GET请求
 */
export function get(url, data) {
  return request({
    url,
    method: 'GET',
    data
  })
}

/**
 * POST请求
 */
export function post(url, data) {
  return request({
    url,
    method: 'POST',
    data
  })
}
