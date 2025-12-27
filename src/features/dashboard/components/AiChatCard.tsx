"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import { Loader } from "@/components/ai-elements/loader";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputButton,
} from "@/components/ai-elements/prompt-input";
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  CopyIcon,
  CheckIcon,
  RefreshCwIcon,
  SparklesIcon,
  ZapIcon,
  BarChart3Icon,
  SettingsIcon,
  PaperclipIcon,
  GlobeIcon,
  MicIcon,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  isStreaming?: boolean;
};

// ─────────────────────────────────────────────────────────────
// 预设建议 (官网 ChatGPT 样式: Analyze data, Surprise me, 等)
// ─────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { text: "分析数据", icon: BarChart3Icon },
  { text: "查询任务", icon: ZapIcon },
  { text: "生成代码", icon: SettingsIcon },
  { text: "获取建议", icon: SparklesIcon },
];

// ─────────────────────────────────────────────────────────────
// Mock AI Reply (后续接入 AI SDK 后端)
// ─────────────────────────────────────────────────────────────
function mockAssistantReply(text: string): string {
  const t = text.trim();
  if (!t) return "请先输入一条指令。";

  if (/T-\d{3,6}/i.test(t)) {
    const id = t.match(/T-\d{3,6}/i)?.[0]?.toUpperCase();
    return `已定位到任务 **${id}**。\n\n当前状态：\n- 🔄 QUBO 寻优进行中\n- ⏱️ 已运行 12 分钟\n- 📊 当前 FE(CO): 87.3%\n\n_后续将接入 AI SDK 流式输出与工具调用。_`;
  }

  if (/(法拉第|FE\(CO\)|效率|趋势)/i.test(t)) {
    return "**FE(CO) 趋势分析**\n\n最近 24 小时内，法拉第效率整体呈上升趋势：\n\n| 时间段 | 平均 FE(CO) |\n|--------|------------|\n| 0-6h | 85.2% |\n| 6-12h | 87.8% |\n| 12-18h | 89.1% |\n| 18-24h | 91.3% |\n\n_建议：继续保持当前电流密度参数。_";
  }

  if (/(QUBO|权重|矩阵|参数|代码|生成)/i.test(t)) {
    return "**QUBO 参数配置建议**\n\n基于历史数据，推荐以下权重配置：\n\n```json\n{\n  \"coupling_strength\": 1.5,\n  \"bias_weight\": 0.8,\n  \"constraint_penalty\": 2.0\n}\n```\n\n需要我为您创建新的参数模板吗？";
  }

  if (/(优化|策略|寻优)/i.test(t)) {
    return "**寻优策略优化**\n\n当前可用的优化方向：\n\n1. **时间优先** - 牺牲精度换取更快收敛\n2. **精度优先** - 增加迭代次数提升结果质量\n3. **平衡模式** - 在时间与精度间取得平衡\n\n请告诉我您偏好的方向，我将调整相应参数。";
  }

  if (/(状态|任务|查询)/i.test(t)) {
    return "**当前系统状态**\n\n- 🟢 Vision Agent: 在线\n- 🟢 Quantum Agent: 在线\n- 🟢 Decision Agent: 在线\n\n活跃任务: **3** 个\n排队任务: **1** 个\n\n_输入任务 ID（如 T-8821）可查看详细信息。_";
  }

  return "已收到您的指令。\n\n您可以尝试：\n- 输入任务 ID 查询状态（如 T-8821）\n- 询问 FE(CO) 效率趋势\n- 请求生成 QUBO 参数模板\n- 优化寻优策略配置";
}

// ─────────────────────────────────────────────────────────────
// 流式输出 Hook (Streaming Simulation)
// ─────────────────────────────────────────────────────────────
function useStreamingResponse() {
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef(false);

  const startStreaming = useCallback(
    async (fullText: string, onComplete: () => void) => {
      setIsStreaming(true);
      setStreamingText("");
      abortRef.current = false;

      const chars = fullText.split("");
      for (let i = 0; i < chars.length; i++) {
        if (abortRef.current) break;
        await new Promise((resolve) =>
          setTimeout(resolve, 10 + Math.random() * 5)
        );
        setStreamingText((prev) => prev + chars[i]);
      }

      setIsStreaming(false);
      onComplete();
    },
    []
  );

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { streamingText, isStreaming, startStreaming, abort };
}

// ─────────────────────────────────────────────────────────────
// Main Component - 官网 ChatGPT 版本一比一复刻
// ─────────────────────────────────────────────────────────────
export function AiChatCard({ className }: { className?: string }) {
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { streamingText, isStreaming, startStreaming } = useStreamingResponse();
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null
  );

  // ───────────────────────────────────────────────────────────
  // Handlers
  // ───────────────────────────────────────────────────────────
  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSuggestionClick = (suggestion: string) => {
    send(suggestion);
  };

  // ───────────────────────────────────────────────────────────
  // Empty State - 官网样式
  // ───────────────────────────────────────────────────────────
  const emptyState = useMemo(
    () => (
      <ConversationEmptyState
        icon={<SparklesIcon className="size-10 text-muted-foreground" />}
        title="AI 助手"
        description="查询任务状态、分析效率趋势、生成参数配置"
      />
    ),
    []
  );

  // ───────────────────────────────────────────────────────────
  // Send Message
  // ───────────────────────────────────────────────────────────
  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking || isStreaming) return;

    setMessages((prev) => [
      ...prev,
      { id: nanoid(), role: "user", content: trimmed },
    ]);
    setInput("");
    setIsThinking(true);

    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsThinking(false);

    const reply = mockAssistantReply(trimmed);
    const newMsgId = nanoid();
    setStreamingMessageId(newMsgId);

    setMessages((prev) => [
      ...prev,
      { id: newMsgId, role: "assistant", content: "", isStreaming: true },
    ]);

    startStreaming(reply, () => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === newMsgId ? { ...m, content: reply, isStreaming: false } : m
        )
      );
      setStreamingMessageId(null);
    });
  };

  // ───────────────────────────────────────────────────────────
  // Render - 官网 ChatGPT 版本布局
  // ───────────────────────────────────────────────────────────
  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* ─────────────────────────────────────────────────────── */}
      {/* 对话区域 */}
      {/* ─────────────────────────────────────────────────────── */}
      <Conversation className="flex-1">
        <ConversationContent className="gap-6 p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-8">
              {emptyState}
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <Message from={m.role} key={m.id} className="group">
                  <MessageContent>
                    {m.role === "assistant" ? (
                      <MessageResponse>
                        {m.isStreaming && streamingMessageId === m.id
                          ? streamingText
                          : m.content}
                      </MessageResponse>
                    ) : (
                      m.content
                    )}
                  </MessageContent>

                  {/* 消息工具栏 - 官网样式：仅 AI 回复且非流式时显示 */}
                  {m.role === "assistant" && !m.isStreaming && m.content && (
                    <MessageActions className="mt-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <MessageAction
                        tooltip="复制"
                        onClick={() => handleCopy(m.content, m.id)}
                      >
                        {copiedId === m.id ? (
                          <CheckIcon className="size-4 text-green-500" />
                        ) : (
                          <CopyIcon className="size-4" />
                        )}
                      </MessageAction>
                      <MessageAction tooltip="重新生成">
                        <RefreshCwIcon className="size-4" />
                      </MessageAction>
                    </MessageActions>
                  )}
                </Message>
              ))}

              {/* 思考中状态 - 官网样式 */}
              {isThinking && (
                <div className="flex items-center gap-3">
                  <Loader size={16} />
                  <Shimmer className="text-muted-foreground text-sm" duration={1.5}>
                    AI 正在思考...
                  </Shimmer>
                </div>
              )}
            </>
          )}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 输入区域 - 官网 ChatGPT 版本布局 */}
      {/* ─────────────────────────────────────────────────────── */}
      <div className="border-t p-4">
        <PromptInput
          onSubmit={({ text }) => send(text)}
          className="w-full"
        >
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setInput(e.currentTarget.value)
              }
              placeholder="Ask anything"
              className="min-h-14"
            />
          </PromptInputBody>

          <PromptInputFooter className="p-3">
            {/* 左侧工具按钮 - 官网样式: Attach, Search */}
            <PromptInputTools>
              <PromptInputButton>
                <PaperclipIcon className="size-4" />
                <span className="ml-1 text-sm">Attach</span>
              </PromptInputButton>
              <PromptInputButton>
                <GlobeIcon className="size-4" />
                <span className="ml-1 text-sm">Search</span>
              </PromptInputButton>
            </PromptInputTools>

            {/* 右侧工具按钮 - 官网样式: Voice, Submit */}
            <PromptInputTools>
              <PromptInputButton>
                <MicIcon className="size-4" />
                <span className="ml-1 text-sm">Voice</span>
              </PromptInputButton>
              <PromptInputSubmit
                status={isThinking || isStreaming ? "submitted" : undefined}
                disabled={!input.trim() || isThinking || isStreaming}
              />
            </PromptInputTools>
          </PromptInputFooter>
        </PromptInput>

        {/* 底部建议按钮 - 官网样式: Analyze data, Surprise me, 等 */}
        <div className="mt-3">
          <Suggestions>
            {SUGGESTIONS.map((s) => (
              <Suggestion
                key={s.text}
                suggestion={s.text}
                onClick={handleSuggestionClick}
              >
                <s.icon className="mr-1.5 size-4" />
                {s.text}
              </Suggestion>
            ))}
          </Suggestions>
        </div>
      </div>
    </div>
  );
}
