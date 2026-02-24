import { useState } from 'react';
import { useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Package, Factory, Truck, CheckCircle, AlertCircle, Star, MessageSquare, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { ImageUpload } from '@/components/ImageUpload';

export default function PublicTrace() {
  const params = useParams();
  const orderId = params.id ? parseInt(params.id) : 0;

  const { data: traceData, isLoading } = trpc.public.getTraceData.useQuery(
    { orderId },
    { enabled: orderId > 0 }
  );
  
  const { data: feedbacks, refetch: refetchFeedbacks } = trpc.public.getFeedbackList.useQuery(
    { orderId },
    { enabled: orderId > 0 }
  );
  
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [customerName, setCustomerName] = useState('');
  const [comment, setComment] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  
  // P25: 投诉直达老板看板
  const [complaintName, setComplaintName] = useState('');
  const [complaintPhone, setComplaintPhone] = useState('');
  const [complaintContent, setComplaintContent] = useState('');
  const [complaintImages, setComplaintImages] = useState<string[]>([]);
  
  const submitFeedback = trpc.public.submitFeedback.useMutation({
    onSuccess: () => {
      toast.success('评价提交成功！');
      setShowFeedbackForm(false);
      setRating(5);
      setCustomerName('');
      setComment('');
      setImageUrls([]);
      refetchFeedbacks();
    },
    onError: (error) => {
      toast.error(`提交失败：${error.message}`);
    },
  });
  
  const handleSubmitFeedback = () => {
    if (!customerName.trim()) {
      toast.error('请输入您的姓名');
      return;
    }
    
    submitFeedback.mutate({
      orderId,
      batchNo: traceData?.production?.batchNo,
      customerName: customerName.trim(),
      rating,
      comment: comment.trim() || undefined,
      images: imageUrls.length > 0 ? imageUrls : undefined,
    });
  };

  // P25: 投诉直达老板看板
  const submitComplaint = trpc.public.submitComplaint.useMutation({
    onSuccess: (data: any) => {
      toast.success(`投诉已提交，将直接发送至CEO看板！投诉编号: #${data.id}`);
      setShowComplaintForm(false);
      setComplaintName('');
      setComplaintPhone('');
      setComplaintContent('');
      setComplaintImages([]);
    },
    onError: (error: any) => {
      toast.error(`投诉提交失败：${error.message}`);
    },
  });

  const handleSubmitComplaint = () => {
    if (!complaintName.trim()) {
      toast.error('请输入您的姓名');
      return;
    }
    if (!complaintContent.trim()) {
      toast.error('请输入投诉内容');
      return;
    }

    // 自动关联batch_no和driver_id（从二维码追溯数据中抽取）
    const batchNo = traceData?.production?.batchNo || `ORD-${orderId}`;
    // driver_id从URL参数或追溯数据中获取
    const urlParams = new URLSearchParams(window.location.search);
    const driverIdFromUrl = urlParams.get('driver_id');
    const driverId = driverIdFromUrl ? parseInt(driverIdFromUrl) : undefined;

    submitComplaint.mutate({
      batchNo,
      driverId,
      orderId,
      complainantName: complaintName.trim(),
      complainantPhone: complaintPhone.trim() || undefined,
      complaintContent: complaintContent.trim(),
      imageUrls: complaintImages.length > 0 ? complaintImages : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8">
            <div className="text-center">加载中...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!traceData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
              <p>未找到订单追溯信息</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* 标题卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>质量追溯详情</span>
              <Badge variant={traceData.status === 'FULFILLED' ? 'default' : 'secondary'}>
                {traceData.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">订单编号</div>
                <div className="font-medium">{traceData.orderNo}</div>
              </div>
              <div>
                <div className="text-muted-foreground">客户名称</div>
                <div className="font-medium">{traceData.customerName}</div>
              </div>
              <div>
                <div className="text-muted-foreground">订单金额</div>
                <div className="font-medium">¥{traceData.totalAmount.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">下单时间</div>
                <div className="font-medium">{new Date(traceData.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 原料端 */}
        {traceData.rawMaterial && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                原料端
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">黄豆批次</div>
                  <div className="font-medium">{traceData.rawMaterial.soybeanBatch}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">水质检测</div>
                  <div className="font-medium flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    {traceData.rawMaterial.waterQuality}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 制造端 */}
        {traceData.production && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="w-5 h-5" />
                制造端
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">生产批次</div>
                  <div className="font-medium">{traceData.production.batchNo}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">生产日期</div>
                  <div className="font-medium">{new Date(traceData.production.productionDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">车间温度</div>
                  <div className="font-medium">{traceData.production.workshopTemp}°C</div>
                </div>
                <div>
                  <div className="text-muted-foreground">灭菌参数</div>
                  <div className="font-medium">{traceData.production.sterilizationParams}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 物流端 */}
        {traceData.logistics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                物流端
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {traceData.logistics.pickingTime && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <div>
                      <span className="text-muted-foreground">拣货完成：</span>
                      <span className="ml-2">{new Date(traceData.logistics.pickingTime).toLocaleString()}</span>
                    </div>
                  </div>
                )}
                {traceData.logistics.shippingTime && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <div>
                      <span className="text-muted-foreground">出库发货：</span>
                      <span className="ml-2">{new Date(traceData.logistics.shippingTime).toLocaleString()}</span>
                    </div>
                  </div>
                )}
                {traceData.logistics.deliveryTime && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <div>
                      <span className="text-muted-foreground">客户签收：</span>
                      <span className="ml-2">{new Date(traceData.logistics.deliveryTime).toLocaleString()}</span>
                    </div>
                  </div>
                )}
                {traceData.logistics.driverName && (
                  <div className="text-sm mt-2">
                    <span className="text-muted-foreground">司机信息：</span>
                    <span className="ml-2">{traceData.logistics.driverName} ({traceData.logistics.driverPhone})</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 客户评价 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              客户评价与质量反馈
            </CardTitle>
            <CardDescription>您的反馈将帮助我们持续改进产品质量</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 已有评价列表 */}
            {feedbacks && feedbacks.length > 0 && (
              <div className="space-y-3">
                {feedbacks.map((feedback: any) => (
                  <div key={feedback.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{feedback.customerName}</span>
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < feedback.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(feedback.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {feedback.comment && (
                      <p className="text-sm text-muted-foreground">{feedback.comment}</p>
                    )}
                    {feedback.images && feedback.images.length > 0 && (
                      <div className="flex gap-2">
                        {feedback.images.map((url: string, idx: number) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`评价图片${idx + 1}`}
                            className="w-20 h-20 object-cover rounded border"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <Separator />
              </div>
            )}
            
            {/* 评价表单 */}
            {!showFeedbackForm ? (
              <div className="text-center py-4">
                <Button onClick={() => setShowFeedbackForm(true)} className="w-full">
                  提交我的评价
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="customerName">您的姓名 *</Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="请输入您的姓名"
                  />
                </div>
                
                <div>
                  <Label>评分 *</Label>
                  <div className="flex items-center gap-2 mt-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRating(i + 1)}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`w-8 h-8 cursor-pointer transition-colors ${
                            i < rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300 hover:text-yellow-200'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-sm text-muted-foreground">
                      {rating} 星
                    </span>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="comment">评价内容（可选）</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="分享您的使用体验或建议..."
                    rows={4}
                  />
                </div>
                
                <div>
                  <Label htmlFor="images">上传图片（可选，最多3张）</Label>
                  <ImageUpload
                    maxImages={3}
                    images={imageUrls}
                    onChange={setImageUrls}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleSubmitFeedback}
                    disabled={submitFeedback.isPending}
                    className="flex-1"
                  >
                    {submitFeedback.isPending ? '提交中...' : '提交评价'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowFeedbackForm(false)}
                    disabled={submitFeedback.isPending}
                  >
                    取消
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* P25: 意见直达老板 —— 投诉入口 */}
        <Card className="border-red-300 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-red-600 text-lg">
              <ShieldAlert className="w-5 h-5" />
              意见直达老板
            </CardTitle>
            <CardDescription className="text-red-500">
              您的投诉将直接发送至CEO看板，不经过销售和片区中层
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showComplaintForm ? (
              <Button
                variant="destructive"
                onClick={() => setShowComplaintForm(true)}
                className="w-full"
              >
                我要投诉
              </Button>
            ) : (
              <div className="space-y-4">
                {/* 自动关联信息展示 */}
                <div className="bg-white rounded-lg p-3 text-sm space-y-1">
                  <div className="text-muted-foreground">
                    以下信息将自动关联到您的投诉：
                  </div>
                  <div>
                    <span className="text-muted-foreground">生产批次号: </span>
                    <span className="font-mono font-medium">
                      {traceData?.production?.batchNo || `ORD-${orderId}`}
                    </span>
                  </div>
                  {traceData?.logistics?.driverName && (
                    <div>
                      <span className="text-muted-foreground">配送司机: </span>
                      <span className="font-medium">
                        {traceData.logistics.driverName}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">订单编号: </span>
                    <span className="font-mono font-medium">{traceData?.orderNo}</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="complaintName">您的姓名 *</Label>
                  <Input
                    id="complaintName"
                    value={complaintName}
                    onChange={(e) => setComplaintName(e.target.value)}
                    placeholder="请输入您的姓名"
                  />
                </div>

                <div>
                  <Label htmlFor="complaintPhone">联系电话（可选）</Label>
                  <Input
                    id="complaintPhone"
                    value={complaintPhone}
                    onChange={(e) => setComplaintPhone(e.target.value)}
                    placeholder="方便我们联系您跟进处理结果"
                  />
                </div>

                <div>
                  <Label htmlFor="complaintContent">投诉内容 *</Label>
                  <Textarea
                    id="complaintContent"
                    value={complaintContent}
                    onChange={(e) => setComplaintContent(e.target.value)}
                    placeholder="请详细描述您遇到的质量问题..."
                    rows={4}
                  />
                </div>

                <div>
                  <Label>上传图片（可选，最多3张）</Label>
                  <ImageUpload
                    maxImages={3}
                    images={complaintImages}
                    onChange={setComplaintImages}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleSubmitComplaint}
                    disabled={submitComplaint.isPending}
                    className="flex-1"
                  >
                    {submitComplaint.isPending ? '提交中...' : '提交投诉（直达CEO）'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowComplaintForm(false)}
                    disabled={submitComplaint.isPending}
                  >
                    取消
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground pb-4">
          <p>千张销售管理系统 - 质量追溯平台</p>
          <p className="mt-1">您的投诉将直接发送至CEO看板，确保问题得到最高级别关注</p>
        </div>
      </div>
    </div>
  );
}
