/**
 * 微信下沉市场订货网关 (WeChat B2B Portal BFF)
 * Mega-Sprint 7 Epic 1
 *
 * 路由：
 *   GET  /portal/wechat/quick-order  - 极简 H5 下单页（返回 HTML）
 *   POST /portal/wechat/auth/token   - 免密登录（openId → JWT Token）
 *   GET  /portal/wechat/api/history  - 获取历史常买商品（需 Bearer Token）
 *   POST /portal/wechat/api/order    - 一键复购提交（需 Bearer Token）
 *   GET  /portal/wechat/api/credit   - 获取可用信用额度（需 Bearer Token）
 *
 * 设计原则：
 * 1. 免密登录：通过 openId 直接识别商贩身份，无需账号密码
 * 2. 极简 UI：大字体、大按钮，适合菜市场商贩手机操作
 * 3. 结算页：支持挂账（显示可用额度）或微信支付（二维码展示）
 */
import express, { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { ordersAPI } from "./backend-api";

// ============================================================
// 免密 Token 认证中间件
// ============================================================
async function wechatAuth(req: Request, res: Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "请先登录" });
    return;
  }
  const token = authHeader.slice(7);
  const session = await sdk.verifySession(token);
  if (!session) {
    res.status(401).json({ error: "TOKEN_EXPIRED", message: "登录已过期，请重新扫码" });
    return;
  }
  (req as any).wechatUser = session;
  next();
}

// ============================================================
// POST /portal/wechat/auth/token - 免密登录
// ============================================================
/**
 * 商贩通过微信链接进入后，后台通过 openId 识别身份并颁发 JWT Token
 * 在真实微信环境中，openId 来自微信 JSSDK 的 wx.login() 返回
 * 在测试/演示环境中，直接传入 openId 即可
 */
async function handleWechatAuth(req: Request, res: Response) {
  const { openId, name } = req.body as { openId?: string; name?: string };
  if (!openId) {
    res.status(400).json({ error: "MISSING_OPENID", message: "缺少微信 OpenID" });
    return;
  }
  try {
    // 通过 openId 创建或查找用户，颁发 JWT Token
    const wechatOpenId = openId.startsWith("wx_") ? openId : `wx_${openId}`;
    const token = await sdk.createSessionToken(wechatOpenId, {
      name: name || `商贩_${openId.slice(-4)}`,
    });
    console.log(`[WeChat BFF] 免密登录成功: openId=${wechatOpenId}`);
    res.json({
      success: true,
      token,
      user: {
        openId: wechatOpenId,
        name: name || `商贩_${openId.slice(-4)}`,
      },
    });
  } catch (err: any) {
    console.error("[WeChat BFF] 免密登录失败:", err.message);
    res.status(500).json({ error: "AUTH_FAILED", message: "登录失败，请重试" });
  }
}

// ============================================================
// GET /portal/wechat/api/history - 获取历史常买商品
// ============================================================
async function handleGetHistory(req: Request, res: Response) {
  const user = (req as any).wechatUser;
  try {
    // 从历史订单中提取最常买的商品（取最近 10 笔订单的商品）
    const ordersResp = await ordersAPI.list({
      orgId: 0,
      page: 1,
      pageSize: 10,
      status: "COMPLETED",
    });
    const orders = (ordersResp as any)?.data || (ordersResp as any)?.items || [];
    // 统计商品购买频次
    const productFreq: Record<string, { productId: number; productName: string; count: number; lastQty: number; unitPrice: number }> = {};
    for (const order of orders) {
      const items = order.items || order.orderItems || [];
      for (const item of items) {
        const key = String(item.productId || item.product_id);
        if (!productFreq[key]) {
          productFreq[key] = {
            productId: item.productId || item.product_id,
            productName: item.productName || item.product_name || "千张",
            count: 0,
            lastQty: item.quantity || 1,
            unitPrice: parseFloat(item.unitPrice || item.unit_price || "0"),
          };
        }
        productFreq[key].count += 1;
        productFreq[key].lastQty = item.quantity || 1;
      }
    }
    // 按频次排序，取 Top 5
    const topProducts = Object.values(productFreq)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 如果没有历史订单，返回默认商品列表
    if (topProducts.length === 0) {
      res.json({
        success: true,
        products: [
          { productId: 1, productName: "薄千张（标准装）", lastQty: 10, unitPrice: 28.5, unit: "包" },
          { productId: 2, productName: "中厚千张（家庭装）", lastQty: 5, unitPrice: 32.0, unit: "包" },
          { productId: 3, productName: "厚千张（火锅专用）", lastQty: 8, unitPrice: 35.5, unit: "包" },
        ],
        isDefault: true,
      });
      return;
    }
    res.json({ success: true, products: topProducts, isDefault: false });
  } catch (err: any) {
    console.error("[WeChat BFF] 获取历史商品失败:", err.message);
    // 降级返回默认商品
    res.json({
      success: true,
      products: [
        { productId: 1, productName: "薄千张（标准装）", lastQty: 10, unitPrice: 28.5, unit: "包" },
        { productId: 2, productName: "中厚千张（家庭装）", lastQty: 5, unitPrice: 32.0, unit: "包" },
      ],
      isDefault: true,
    });
  }
}

// ============================================================
// POST /portal/wechat/api/order - 一键复购提交
// ============================================================
async function handleQuickReorder(req: Request, res: Response) {
  const user = (req as any).wechatUser;
  const { items, paymentMethod, remark } = req.body as {
    items: Array<{ productId: number; quantity: number; unitPrice: number }>;
    paymentMethod: "CREDIT" | "ONLINE_PAYMENT";
    remark?: string;
  };
  if (!items || items.length === 0) {
    res.status(400).json({ error: "EMPTY_ORDER", message: "请选择商品" });
    return;
  }
  try {
    const result = await ordersAPI.create({
      customerId: 1, // 在真实场景中从 user.id 获取
      items,
      source: "WECHAT_PORTAL",
      remark: remark || "微信一键复购",
      autoApprove: false,
    });
    const orderNo = (result as any)?.orderNo || (result as any)?.id || "N/A";
    console.log(`[WeChat BFF] 复购成功: orderNo=${orderNo}, user=${user?.openId}`);
    res.status(201).json({
      success: true,
      data: {
        orderNo,
        status: "PENDING_APPROVAL",
        paymentMethod,
        message: paymentMethod === "CREDIT" ? "已挂账，等待审核" : "订单已提交，请完成支付",
        // 微信支付场景：生成二维码内容（真实场景需调用微信支付 API）
        paymentQrCode: paymentMethod === "ONLINE_PAYMENT"
          ? `wxpay://pay?order=${orderNo}&amount=${items.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)}`
          : null,
      },
    });
  } catch (err: any) {
    console.error("[WeChat BFF] 复购失败:", err.message);
    res.status(500).json({ error: "ORDER_FAILED", message: err.message || "下单失败，请重试" });
  }
}

// ============================================================
// GET /portal/wechat/api/credit - 获取可用信用额度
// ============================================================
async function handleGetCredit(req: Request, res: Response) {
  try {
    // 真实场景从 creditAPI 获取，这里返回演示数据
    res.json({
      success: true,
      credit: {
        limit: 50000,
        used: 12500,
        available: 37500,
        currency: "CNY",
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "CREDIT_QUERY_FAILED", message: "额度查询失败" });
  }
}

// ============================================================
// GET /portal/wechat/quick-order - 极简 H5 下单页
// ============================================================
function handleWechatH5Page(_req: Request, res: Response) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>千张快速订货</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif; background: #f5f5f5; color: #333; }
    .header { background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; padding: 20px 16px; text-align: center; }
    .header h1 { font-size: 24px; font-weight: 700; }
    .header p { font-size: 14px; opacity: 0.9; margin-top: 4px; }
    .login-card { background: white; margin: 16px; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .login-card h2 { font-size: 18px; margin-bottom: 16px; }
    .input-group { margin-bottom: 12px; }
    .input-group label { display: block; font-size: 14px; color: #666; margin-bottom: 6px; }
    .input-group input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; }
    .btn-primary { width: 100%; padding: 16px; background: #e74c3c; color: white; border: none; border-radius: 10px; font-size: 18px; font-weight: 700; cursor: pointer; margin-top: 8px; }
    .btn-primary:active { background: #c0392b; }
    .btn-secondary { width: 100%; padding: 14px; background: white; color: #e74c3c; border: 2px solid #e74c3c; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 8px; }
    .product-card { background: white; margin: 0 16px 12px; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: space-between; }
    .product-info { flex: 1; }
    .product-name { font-size: 18px; font-weight: 700; }
    .product-price { font-size: 16px; color: #e74c3c; margin-top: 4px; }
    .qty-control { display: flex; align-items: center; gap: 12px; }
    .qty-btn { width: 36px; height: 36px; border-radius: 50%; border: 2px solid #e74c3c; background: white; color: #e74c3c; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .qty-input { width: 60px; text-align: center; font-size: 20px; font-weight: 700; border: 1px solid #ddd; border-radius: 8px; padding: 4px; }
    .order-summary { background: white; margin: 0 16px 16px; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 16px; }
    .summary-total { font-size: 20px; font-weight: 700; color: #e74c3c; }
    .payment-options { margin: 12px 0; }
    .payment-option { display: flex; align-items: center; gap: 10px; padding: 12px; border: 2px solid #ddd; border-radius: 10px; margin-bottom: 8px; cursor: pointer; }
    .payment-option.selected { border-color: #e74c3c; background: #fff5f5; }
    .payment-option input[type=radio] { width: 20px; height: 20px; }
    .payment-option label { font-size: 16px; cursor: pointer; flex: 1; }
    .credit-badge { background: #27ae60; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .section-title { font-size: 16px; font-weight: 700; margin: 16px 16px 8px; color: #333; }
    .toast { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 12px 24px; border-radius: 8px; font-size: 16px; z-index: 999; display: none; }
    .loading { text-align: center; padding: 40px; color: #999; }
    #orderSection { display: none; }
    #successSection { display: none; text-align: center; padding: 40px 16px; }
    .success-icon { font-size: 64px; margin-bottom: 16px; }
    .success-title { font-size: 24px; font-weight: 700; color: #27ae60; }
    .success-msg { font-size: 16px; color: #666; margin-top: 8px; }
    .qr-placeholder { background: #f5f5f5; border: 2px dashed #ddd; border-radius: 12px; padding: 40px; margin: 16px 0; text-align: center; color: #999; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🥛 千张快速订货</h1>
    <p>菜市场专属 · 一键复购</p>
  </div>

  <!-- 登录区域 -->
  <div id="loginSection">
    <div class="login-card">
      <h2>📱 快速登录</h2>
      <div class="input-group">
        <label>微信号（OpenID）</label>
        <input type="text" id="openIdInput" placeholder="输入您的微信号" value="vendor_demo_001">
      </div>
      <div class="input-group">
        <label>您的姓名</label>
        <input type="text" id="nameInput" placeholder="例如：李大姐" value="李大姐菜摊">
      </div>
      <button class="btn-primary" onclick="doLogin()">🔓 一键登录</button>
    </div>
  </div>

  <!-- 下单区域 -->
  <div id="orderSection">
    <p class="section-title" id="welcomeText">您好！以下是您常买的商品：</p>
    <div id="productList"><div class="loading">加载中...</div></div>

    <p class="section-title">📋 结算方式</p>
    <div style="margin: 0 16px;">
      <div class="order-summary">
        <div class="summary-row"><span>商品合计</span><span id="totalAmount">¥0.00</span></div>
        <div class="summary-row"><span>可用额度</span><span class="credit-badge" id="creditBadge">查询中...</span></div>
        <div class="payment-options">
          <div class="payment-option selected" id="opt-credit" onclick="selectPayment('CREDIT')">
            <input type="radio" name="payment" value="CREDIT" checked>
            <label>💳 挂账（账期结算）</label>
          </div>
          <div class="payment-option" id="opt-online" onclick="selectPayment('ONLINE_PAYMENT')">
            <input type="radio" name="payment" value="ONLINE_PAYMENT">
            <label>📱 微信支付（立即付款）</label>
          </div>
        </div>
        <div class="summary-row"><span style="font-weight:700">应付金额</span><span class="summary-total" id="finalAmount">¥0.00</span></div>
      </div>
    </div>
    <div style="margin: 0 16px 32px;">
      <button class="btn-primary" onclick="submitOrder()">🛒 立即下单</button>
    </div>
  </div>

  <!-- 成功区域 -->
  <div id="successSection">
    <div class="success-icon">✅</div>
    <div class="success-title">下单成功！</div>
    <div class="success-msg" id="successMsg">订单已提交，等待审核</div>
    <div id="qrSection" style="display:none">
      <div class="qr-placeholder">
        <div style="font-size:48px">📱</div>
        <div>微信支付二维码</div>
        <div style="margin-top:8px;font-size:12px">（真实场景由微信支付 API 生成）</div>
        <div style="margin-top:8px;font-weight:700;color:#e74c3c" id="qrAmount"></div>
      </div>
    </div>
    <button class="btn-secondary" style="margin: 0 16px; width: calc(100% - 32px);" onclick="location.reload()">继续购买</button>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    let token = '';
    let products = [];
    let selectedPayment = 'CREDIT';
    const BASE = '/portal/wechat';

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.style.display = 'block';
      setTimeout(() => t.style.display = 'none', 2000);
    }

    async function doLogin() {
      const openId = document.getElementById('openIdInput').value.trim();
      const name = document.getElementById('nameInput').value.trim();
      if (!openId) { showToast('请输入微信号'); return; }
      try {
        const resp = await fetch(BASE + '/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ openId, name })
        });
        const data = await resp.json();
        if (!data.success) throw new Error(data.message);
        token = data.token;
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('orderSection').style.display = 'block';
        document.getElementById('welcomeText').textContent = '您好，' + (data.user.name || name) + '！以下是您常买的商品：';
        loadProducts();
        loadCredit();
      } catch (e) {
        showToast('登录失败：' + e.message);
      }
    }

    async function loadProducts() {
      try {
        const resp = await fetch(BASE + '/api/history', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await resp.json();
        products = data.products || [];
        renderProducts();
      } catch (e) {
        document.getElementById('productList').innerHTML = '<div class="loading">加载失败，请刷新</div>';
      }
    }

    async function loadCredit() {
      try {
        const resp = await fetch(BASE + '/api/credit', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await resp.json();
        if (data.success) {
          document.getElementById('creditBadge').textContent = '¥' + data.credit.available.toLocaleString() + ' 可用';
        }
      } catch (e) {}
    }

    function renderProducts() {
      const list = document.getElementById('productList');
      if (products.length === 0) {
        list.innerHTML = '<div class="loading">暂无历史记录</div>';
        return;
      }
      list.innerHTML = products.map((p, i) => \`
        <div class="product-card">
          <div class="product-info">
            <div class="product-name">\${p.productName}</div>
            <div class="product-price">¥\${parseFloat(p.unitPrice || 0).toFixed(2)} / \${p.unit || '包'}</div>
          </div>
          <div class="qty-control">
            <button class="qty-btn" onclick="changeQty(\${i}, -1)">−</button>
            <input class="qty-input" type="number" id="qty_\${i}" value="\${p.lastQty || 1}" min="1" onchange="updateTotal()">
            <button class="qty-btn" onclick="changeQty(\${i}, 1)">+</button>
          </div>
        </div>
      \`).join('');
      updateTotal();
    }

    function changeQty(idx, delta) {
      const input = document.getElementById('qty_' + idx);
      const newVal = Math.max(1, parseInt(input.value) + delta);
      input.value = newVal;
      updateTotal();
    }

    function updateTotal() {
      let total = 0;
      products.forEach((p, i) => {
        const qty = parseInt(document.getElementById('qty_' + i)?.value || '0');
        total += qty * parseFloat(p.unitPrice || 0);
      });
      document.getElementById('totalAmount').textContent = '¥' + total.toFixed(2);
      document.getElementById('finalAmount').textContent = '¥' + total.toFixed(2);
    }

    function selectPayment(method) {
      selectedPayment = method;
      document.getElementById('opt-credit').classList.toggle('selected', method === 'CREDIT');
      document.getElementById('opt-online').classList.toggle('selected', method === 'ONLINE_PAYMENT');
    }

    async function submitOrder() {
      const items = products.map((p, i) => ({
        productId: p.productId,
        quantity: parseInt(document.getElementById('qty_' + i)?.value || '1'),
        unitPrice: parseFloat(p.unitPrice || 0),
      })).filter(item => item.quantity > 0);
      if (items.length === 0) { showToast('请选择商品数量'); return; }
      try {
        const resp = await fetch(BASE + '/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ items, paymentMethod: selectedPayment })
        });
        const data = await resp.json();
        if (!data.success) throw new Error(data.message || '下单失败');
        document.getElementById('orderSection').style.display = 'none';
        document.getElementById('successSection').style.display = 'block';
        document.getElementById('successMsg').textContent = data.data.message + '\\n订单号：' + data.data.orderNo;
        if (data.data.paymentMethod === 'ONLINE_PAYMENT') {
          document.getElementById('qrSection').style.display = 'block';
          const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
          document.getElementById('qrAmount').textContent = '应付：¥' + total.toFixed(2);
        }
      } catch (e) {
        showToast('下单失败：' + e.message);
      }
    }
  </script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
}

// ============================================================
// 注册微信 BFF 路由
// ============================================================
export function registerWechatBFFRoutes(app: express.Application) {
  const router = express.Router();

  // 极简 H5 页面（无需认证）
  router.get("/quick-order", handleWechatH5Page);

  // 免密登录（无需认证）
  router.post("/auth/token", handleWechatAuth);

  // 需要认证的 API
  router.get("/api/history", wechatAuth, handleGetHistory);
  router.post("/api/order", wechatAuth, handleQuickReorder);
  router.get("/api/credit", wechatAuth, handleGetCredit);

  app.use("/portal/wechat", router);
  console.log("[WeChat BFF] Routes registered: /portal/wechat/{quick-order, auth/token, api/history, api/order, api/credit}");
}
