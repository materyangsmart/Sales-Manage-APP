/**
 * UploadAttachment - 通用附件上传组件
 *
 * 架构：预签名 URL 直传（Presigned URL Direct Upload）
 * 流程：
 *   1. 调用 tRPC fileStorage.getPresignedUrl → 获取 OSS 直传凭证
 *   2. 用 XMLHttpRequest PUT 文件字节流直接到 OSS（绕过 Node.js 服务器）
 *   3. 直传成功后调用 tRPC fileStorage.confirmUpload → 落库文件元数据
 *
 * 特性：
 * - 支持拖拽上传和点击选择
 * - 实时进度条（基于 XHR onprogress 事件）
 * - 文件类型白名单：PDF / JPG / PNG
 * - 单文件最大 20MB
 * - 多文件队列上传
 */

import React, { useCallback, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  Image,
  X,
  CheckCircle,
  AlertCircle,
  CloudUpload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── 类型定义 ────────────────────────────────────────────────────────────────

export type BusinessType =
  | 'ORDER_CONTRACT'
  | 'PAYMENT_RECEIPT'
  | 'CUSTOMER_DOCUMENT'
  | 'COMPLAINT_EVIDENCE'
  | 'OTHER';

export interface UploadedFile {
  id: number;           // file_records.id
  fileName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl: string | null;
  status: 'CONFIRMED';
  uploadedBy: number;
  createdAt: string;
}

interface UploadTask {
  id: string;           // 本地临时 ID
  file: File;
  status: 'pending' | 'uploading' | 'confirming' | 'done' | 'error';
  progress: number;     // 0-100
  errorMsg?: string;
  result?: UploadedFile;
}

interface UploadAttachmentProps {
  businessType: BusinessType;
  businessId?: number;
  onUploadComplete?: (file: UploadedFile) => void;
  maxFiles?: number;
  className?: string;
  disabled?: boolean;
}

// ─── 常量 ────────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
  return <Image className="h-4 w-4 text-blue-500" />;
}

// ─── 组件主体 ─────────────────────────────────────────────────────────────────

export function UploadAttachment({
  businessType,
  businessId,
  onUploadComplete,
  maxFiles = 10,
  className,
  disabled = false,
}: UploadAttachmentProps) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getPresignedUrl = trpc.fileStorage.getPresignedUrl.useMutation();
  const confirmUpload = trpc.fileStorage.confirmUpload.useMutation();

  // ─── 文件校验 ──────────────────────────────────────────────────────────────

  function validateFile(file: File): string | null {
    if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
      return `不支持的文件类型 "${file.type}"，仅允许 PDF/JPG/PNG`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `文件 "${file.name}" 超过 20MB 限制（当前 ${formatFileSize(file.size)}）`;
    }
    return null;
  }

  // ─── 核心上传逻辑 ──────────────────────────────────────────────────────────

  async function uploadFile(task: UploadTask) {
    const { file } = task;
    const taskId = task.id;

    const updateTask = (patch: Partial<UploadTask>) => {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
    };

    try {
      // ── 第一步：向后端申请预签名 URL ──────────────────────────────────────
      updateTask({ status: 'uploading', progress: 5 });

      const presignedData = await getPresignedUrl.mutateAsync({
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        businessType,
        businessId,
      });

      updateTask({ progress: 15 });

      // ── 第二步：用 XHR 直传文件到 OSS（绕过 Node.js）──────────────────────
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 75) + 15; // 15% ~ 90%
            updateTask({ progress: pct });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`OSS 直传失败: HTTP ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('网络错误，OSS 直传失败'));
        xhr.ontimeout = () => reject(new Error('OSS 直传超时'));

        xhr.open('PUT', presignedData.presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.timeout = 120_000; // 2 分钟超时
        xhr.send(file);
      });

      updateTask({ progress: 92, status: 'confirming' });

      // ── 第三步：通知后端确认上传成功，落库元数据 ─────────────────────────
      const confirmed = await confirmUpload.mutateAsync({
        fileRecordId: presignedData.fileRecordId,
      });

      updateTask({ status: 'done', progress: 100, result: confirmed });
      onUploadComplete?.(confirmed);
      toast.success(`"${file.name}" 上传成功`);
    } catch (err: any) {
      const msg = err?.message ?? '上传失败，请重试';
      updateTask({ status: 'error', errorMsg: msg });
      toast.error(msg);
    }
  }

  // ─── 添加文件到队列并开始上传 ─────────────────────────────────────────────

  function enqueueFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const remaining = maxFiles - tasks.length;

    if (remaining <= 0) {
      toast.warning(`最多只能上传 ${maxFiles} 个文件`);
      return;
    }

    const toProcess = fileArray.slice(0, remaining);

    for (const file of toProcess) {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        continue;
      }

      const task: UploadTask = {
        id: `${Date.now()}-${Math.random()}`,
        file,
        status: 'pending',
        progress: 0,
      };

      setTasks((prev) => [...prev, task]);
      // 异步启动上传（不阻塞 UI）
      setTimeout(() => uploadFile(task), 0);
    }
  }

  // ─── 拖拽处理 ─────────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!disabled) enqueueFiles(e.dataTransfer.files);
    },
    [disabled, tasks],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      enqueueFiles(e.target.files);
      e.target.value = ''; // 允许重复选择同一文件
    }
  };

  function removeTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  return (
    <div className={cn('space-y-3', className)}>
      {/* 拖拽区域 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <CloudUpload className={cn('h-8 w-8', isDragOver ? 'text-primary' : 'text-muted-foreground')} />
        <div className="text-center">
          <p className="text-sm font-medium">
            {isDragOver ? '松开鼠标上传文件' : '拖拽文件到此处，或点击选择'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            支持 PDF / JPG / PNG，单文件最大 20MB
          </p>
        </div>
        <div className="flex gap-1 mt-1">
          {['PDF', 'JPG', 'PNG'].map((ext) => (
            <Badge key={ext} variant="secondary" className="text-xs px-1.5 py-0">
              {ext}
            </Badge>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={handleFileInput}
          disabled={disabled}
        />
      </div>

      {/* 上传中的任务列表 */}
      {activeTasks.length > 0 && (
        <div className="space-y-2">
          {activeTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-md border bg-card p-3"
            >
              {getFileIcon(task.file.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{task.file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatFileSize(task.file.size)}
                  </span>
                </div>
                {task.status === 'error' ? (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {task.errorMsg}
                  </p>
                ) : (
                  <div className="mt-1.5 space-y-1">
                    <Progress value={task.progress} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {task.status === 'uploading' && `直传 OSS 中... ${task.progress}%`}
                      {task.status === 'confirming' && '确认落库中...'}
                      {task.status === 'pending' && '等待上传...'}
                    </p>
                  </div>
                )}
              </div>
              {(task.status === 'error' || task.status === 'pending') && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={(e) => { e.stopPropagation(); removeTask(task.id); }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 已上传成功的文件列表 */}
      {doneTasks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">本次已上传</p>
          {doneTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2"
            >
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              {getFileIcon(task.file.type)}
              <span className="text-sm truncate flex-1">{task.file.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatFileSize(task.file.size)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => { e.stopPropagation(); removeTask(task.id); }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default UploadAttachment;
