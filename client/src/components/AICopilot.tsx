/**
 * RC4 Epic 3: AI Copilot 智能问答组件
 * 
 * 嵌入 BI 大屏右上角，支持自然语言查询（NL2SQL）
 */
import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Bot, Send, Sparkles, X, ChevronDown, ChevronUp, Code, Clock } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  queryResult?: any[];
  executionTimeMs?: number;
  error?: string;
  timestamp: Date;
}

export default function AICopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [expandedSQL, setExpandedSQL] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const askMutation = trpc.aiCopilot.ask.useMutation({
    onSuccess: (result) => {
      const assistantMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: result.success ? result.aiSummary : (result.error || '查询失败'),
        sql: result.sql,
        queryResult: result.queryResult,
        executionTimeMs: result.executionTimeMs,
        error: result.error,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    },
    onError: (err) => {
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `请求失败：${err.message}`,
        error: err.message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
      toast.error('AI 助手请求失败');
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || askMutation.isPending) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    askMutation.mutate({ question: question.trim() });
    setQuestion('');
  };

  const quickQuestions = [
    '本月销售总额是多少？',
    '库存最低的 5 个商品',
    '哪些客户信用评分最低？',
    '最近 30 天的订单趋势',
  ];

  return (
    <>
      {/* 悬浮按钮 */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 shadow-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
        size="icon"
      >
        <Bot className="w-6 h-6 text-white" />
      </Button>

      {/* 对话框 */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              AI 智能决策助手
              <Badge variant="secondary" className="ml-2 text-xs">NL2SQL</Badge>
            </DialogTitle>
          </DialogHeader>

          {/* 消息区域 */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Bot className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-6">您好！我是 AI 智能决策助手，可以用自然语言查询业务数据。</p>
                <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                  {quickQuestions.map((q) => (
                    <Button
                      key={q}
                      variant="outline"
                      size="sm"
                      className="text-xs text-left h-auto py-2 px-3"
                      onClick={() => {
                        setQuestion(q);
                      }}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}>
                  {/* 消息内容 */}
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>

                  {/* SQL 展示（可折叠） */}
                  {msg.sql && (
                    <div className="mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2 gap-1"
                        onClick={() => setExpandedSQL(expandedSQL === msg.id ? null : msg.id)}
                      >
                        <Code className="w-3 h-3" />
                        {expandedSQL === msg.id ? '收起 SQL' : '查看 SQL'}
                        {expandedSQL === msg.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </Button>
                      {expandedSQL === msg.id && (
                        <pre className="mt-1 p-2 bg-background/80 rounded text-xs overflow-x-auto border">
                          {msg.sql}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* 查询结果表格 */}
                  {msg.queryResult && msg.queryResult.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-background/50">
                            {Object.keys(msg.queryResult[0]).slice(0, 6).map((key) => (
                              <th key={key} className="border p-1 text-left font-medium">{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {msg.queryResult.slice(0, 10).map((row: any, i: number) => (
                            <tr key={i}>
                              {Object.keys(row).slice(0, 6).map((key) => (
                                <td key={key} className="border p-1">{String(row[key] ?? '-')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {msg.queryResult.length > 10 && (
                        <p className="text-xs text-muted-foreground mt-1">显示前 10 条，共 {msg.queryResult.length} 条</p>
                      )}
                    </div>
                  )}

                  {/* 执行时间 */}
                  {msg.executionTimeMs && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {msg.executionTimeMs}ms
                    </div>
                  )}
                </div>
              </div>
            ))}

            {askMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                    AI 正在分析您的问题...
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 输入区域 */}
          <form onSubmit={handleSubmit} className="px-6 pb-6 pt-3 border-t">
            <div className="flex gap-2">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="输入您的问题，如：分析上月华东区业绩下滑原因..."
                disabled={askMutation.isPending}
                className="flex-1"
              />
              <Button type="submit" disabled={askMutation.isPending || !question.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
