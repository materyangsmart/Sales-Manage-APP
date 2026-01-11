import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ARPaymentList } from './pages/ARPaymentList';
import './index.css';

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-100">
          <Routes>
            <Route path="/" element={<Navigate to="/ar/payments" replace />} />
            <Route path="/ar/payments" element={<ARPaymentList />} />
            {/* TODO: 添加核销详情页路由 */}
          </Routes>
        </div>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
