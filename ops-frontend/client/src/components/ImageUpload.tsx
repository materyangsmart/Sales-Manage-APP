import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface ImageUploadProps {
  maxImages?: number;
  images: string[];
  onChange: (images: string[]) => void;
}

export function ImageUpload({ maxImages = 3, images, onChange }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);

  const uploadImage = trpc.storage.uploadImage.useMutation({
    onSuccess: (data: { url: string; fileKey: string }) => {
      if (images.length < maxImages) {
        onChange([...images, data.url]);
        toast.success('图片上传成功！');
      } else {
        toast.error(`最多只能上传${maxImages}张图片`);
      }
      setUploading(false);
    },
    onError: (error: any) => {
      toast.error(`上传失败：${error.message}`);
      setUploading(false);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    // 验证文件大小（最大5MB）
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片大小不能超过5MB');
      return;
    }

    setUploading(true);

    // 读取文件为Base64
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      uploadImage.mutate({
        filename: file.name,
        contentType: file.type,
        base64Data: base64.split(',')[1], // 移除 "data:image/xxx;base64," 前缀
      });
    };
    reader.onerror = () => {
      toast.error('文件读取失败');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* 已上传的图片列表 */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`上传图片${index + 1}`}
                className="w-full h-24 object-cover rounded border"
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 上传按钮 */}
      {images.length < maxImages && (
        <div>
          <input
            type="file"
            id="image-upload"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
          <label htmlFor="image-upload">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              className="w-full"
              asChild
            >
              <span className="flex items-center justify-center gap-2 cursor-pointer">
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    上传中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    选择图片上传 ({images.length}/{maxImages})
                  </>
                )}
              </span>
            </Button>
          </label>
          <p className="text-xs text-muted-foreground mt-1">
            支持 JPG、PNG、GIF 格式，单张图片不超过 5MB
          </p>
        </div>
      )}
    </div>
  );
}
