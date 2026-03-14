import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface ForbiddenProps {
  message?: string;
  showBackButton?: boolean;
}

export default function Forbidden({ 
  message = "您暂无权限访问此功能，请联系管理员", 
  showBackButton = true 
}: ForbiddenProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <div className="max-w-md w-full">
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="text-lg font-semibold">403 无权操作</AlertTitle>
          <AlertDescription className="mt-2">
            {message}
          </AlertDescription>
        </Alert>
        
        {showBackButton && (
          <div className="mt-6 flex justify-center">
            <Button 
              variant="outline" 
              onClick={() => setLocation("/")}
            >
              返回首页
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// 小型内联版本（用于页面内的按钮/操作）
export function ForbiddenInline({ message = "无权操作" }: { message?: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      <span>{message}</span>
    </div>
  );
}
