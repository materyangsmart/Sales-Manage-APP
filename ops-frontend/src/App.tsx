import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ARPaymentList } from './pages/ARPaymentList';
import { ARApplyDetailWrapper } from './pages/ARApplyDetailWrapper';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

function App() {
  return (
    <ErrorBoundary onReset={() => window.location.reload()}>
      <ConfigProvider locale={zhCN}>
        <BrowserRouter>
          <div className="min-h-screen bg-gray-100">
            <Routes>
              <Route path="/" element={<Navigate to="/ar/payments" replace />} />
              <Route path="/ar/payments" element={<ARPaymentList />} />
              <Route path="/ar/apply/:paymentId" element={<ARApplyDetailWrapper />} />
            </Routes>
          </div>
        </BrowserRouter>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
