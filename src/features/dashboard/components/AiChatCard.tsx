"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { cn } from "@/lib/utils";
import { useTasks } from "@/contexts/TaskContext";
import { useTemplates } from "@/contexts/TemplateContext";
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
// 预设建议
// ─────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { text: "分析数据", icon: BarChart3Icon },
  { text: "查询任务", icon: ZapIcon },
  { text: "生成代码", icon: SettingsIcon },
  { text: "获取建议", icon: SparklesIcon },
];

// ─────────────────────────────────────────────────────────────
// API 配置
// ─────────────────────────────────────────────────────────────
const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || "http://localhost:3001/api/chat";

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export function AiChatCard({ className }: { className?: string }) {
  const [inputValue, setInputValue] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { runningTasks, completedTasks } = useTasks();
  const { templates } = useTemplates();

  const impactMetrics = useMemo(() => {
    if (completedTasks.length === 0) {
      return { totalCO2: 0, totalValue: 0, avgFE: 0 };
    }
    const totalCO2 = completedTasks.reduce((acc, t) => acc + (t.result?.co2Processed || 0), 0);
    const totalValue = completedTasks.reduce((acc, t) => acc + (t.result?.coValue || 0), 0);
    const avgFE =
      completedTasks.reduce((acc, t) => acc + (t.result?.fe || 0), 0) / completedTasks.length;
    return { totalCO2, totalValue, avgFE };
  }, [completedTasks]);

  const chatContext = useMemo(() => {
    return {
      runningTasks,
      completedTasks,
      impactMetrics,
      templates,
    };
  }, [runningTasks, completedTasks, impactMetrics, templates]);

  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: CHAT_API_URL,
      prepareSendMessagesRequest: ({ messages }) => {
        return {
          body: {
            messages,
            context: chatContext,
          },
        };
      },
    });
  }, [chatContext]);

  // 使用 AI SDK 的 useChat hook
  const { messages, sendMessage, status, error, stop } = useChat({
    transport,
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // ───────────────────────────────────────────────────────────
  // Handlers
  // ───────────────────────────────────────────────────────────
  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSuggestionClick = useCallback((suggestion: string) => {
    sendMessage({ text: suggestion });
  }, [sendMessage]);

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    
    sendMessage({ text: trimmed });
    setInputValue("");
  }, [inputValue, isLoading, sendMessage]);

  // ───────────────────────────────────────────────────────────
  // 提取消息文本内容
  // ───────────────────────────────────────────────────────────
  const getMessageText = (message: typeof messages[0]): string => {
    let text = "";
    for (const part of message.parts) {
      if (part.type === "text") {
        text += part.text;
      }
    }
    return text;
  };

  // ───────────────────────────────────────────────────────────
  // Render
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
              <ConversationEmptyState
                icon={<SparklesIcon className="size-10 text-muted-foreground" />}
                title="AI 助手"
                description="查询任务状态、分析效率趋势、生成参数配置"
              />
            </div>
          ) : (
            <>
              {messages.map((m) => {
                const messageText = getMessageText(m);
                
                return (
                  <Message from={m.role as "user" | "assistant"} key={m.id} className="group">
                    <MessageContent>
                      {m.role === "assistant" ? (
                        <MessageResponse>
                          {messageText}
                        </MessageResponse>
                      ) : (
                        messageText
                      )}
                    </MessageContent>

                    {/* 消息工具栏 */}
                    {m.role === "assistant" && messageText && (
                      <MessageActions className="mt-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <MessageAction
                          tooltip="复制"
                          onClick={() => handleCopy(messageText, m.id)}
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
                );
              })}

              {/* 思考中状态 */}
              {status === "submitted" && (
                <div className="flex items-center gap-3">
                  <Loader size={16} />
                  <Shimmer className="text-muted-foreground text-sm" duration={1.5}>
                    AI 正在思考...
                  </Shimmer>
                </div>
              )}
            </>
          )}

          {/* 错误状态 */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              <strong>错误：</strong> {error.message}
              <p className="mt-1 text-xs text-red-400/70">
                请确保 AI Chat Server 已启动（npm run dev:chat）且 API Key 已配置
              </p>
            </div>
          )}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      {/* ─────────────────────────────────────────────────────── */}
      {/* 输入区域 */}
      {/* ─────────────────────────────────────────────────────── */}
      <div className="border-t p-4">
        <PromptInput
          onSubmit={() => handleSubmit()}
          className="w-full"
        >
          <PromptInputBody>
            <PromptInputTextarea
              ref={inputRef}
              value={inputValue}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setInputValue(e.currentTarget.value)
              }
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ask anything"
              className="min-h-14"
            />
          </PromptInputBody>

          <PromptInputFooter className="p-3">
            {/* 左侧工具按钮 */}
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

            {/* 右侧工具按钮 */}
            <PromptInputTools>
              <PromptInputButton>
                <MicIcon className="size-4" />
                <span className="ml-1 text-sm">Voice</span>
              </PromptInputButton>
              {isLoading ? (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                >
                  Stop
                </button>
              ) : (
                <PromptInputSubmit
                  disabled={!inputValue.trim()}
                />
              )}
            </PromptInputTools>
          </PromptInputFooter>
        </PromptInput>

        {/* 底部建议按钮 */}
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
