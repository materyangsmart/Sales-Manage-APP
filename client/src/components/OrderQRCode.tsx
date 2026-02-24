import { QRCodeSVG } from 'qrcode.react';
import { Card } from '@/components/ui/card';

interface OrderQRCodeProps {
  orderId: number;
  batchNo?: string;
  size?: number;
}

export function OrderQRCode({ orderId, batchNo, size = 200 }: OrderQRCodeProps) {
  // 生成追溯URL（公开访问，无需登录）
  const traceUrl = `${window.location.origin}/public/trace/${orderId}`;

  return (
    <Card className="p-4 inline-block">
      <div className="flex flex-col items-center gap-2">
        <QRCodeSVG
          value={traceUrl}
          size={size}
          level="H"
          includeMargin
        />
        <div className="text-sm text-muted-foreground text-center">
          <div>订单编号: {orderId}</div>
          {batchNo && <div>生产批次: {batchNo}</div>}
          <div className="text-xs mt-1">扫码查看质量追溯</div>
        </div>
      </div>
    </Card>
  );
}
