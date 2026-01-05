"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { storage, storageKeys } from "@/lib/storage";

import { Sender, Attachments, Conversations } from "@ant-design/x";
import { Popover, Upload } from "antd";
import {
  PaperClipOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import TutorialModal from "@/components/TutorialModal";
import Navigation from "@/components/layout/Navigation";
import { getApiUrl, getAuthHeaders } from "@/lib/utils";
import MenuBar, { type MenuBarRef } from "@/components/layout/MenuBar";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import type { UploadFile } from "antd";
import type {
  Message,
  Conversation as AgentConversation,
  Attachment,
} from "@/types/agent";
import CustomStreamdown from "@/components/CustomStreamdown";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { AttachmentFile } from "@/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { welcomeQuestions, welcomeText, guestMode } from "@/config/app";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const { me, isLoading, logout, organizations } = useApp();
  const isAuthenticated = !!me;
  const router = useRouter();
  const menuBarRef = useRef<MenuBarRef>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isTablet = useMediaQuery("(min-width: 769px) and (max-width: 1024px)");

  // 从组织列表中获取聊天配置
  const chatConfig = organizations?.find((org) => org.chatConfig)?.chatConfig;

  // 检查用户是否是管理员
  const isAdmin = me?.roles?.some((role) => role.role_name === "管理员");

  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const senderRef = useRef<any>(null);
  const shouldForceScrollRef = useRef(false);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        if (!guestMode.enabled) {
          router.push("/login");
        } else {
          // Guest mode: load conversations directly
          loadConversations();
        }
      } else {
        loadConversations();

        // Check if tutorial should be shown
        const tutorialShown = storage.getItem(storageKeys.TUTORIAL_SHOWN);
        if (tutorialShown !== "true") {
          setIsHelpOpen(true);
          storage.setItem(storageKeys.TUTORIAL_SHOWN, "true");
        }
      }
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || messages.length === 0) return;

    const atTop = container.scrollTop === 0;
    const threshold = 150;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold;

    const shouldScroll =
      shouldForceScrollRef.current ||
      (atTop && messages.length > 0) ||
      nearBottom;

    if (shouldScroll) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "auto",
          block: "end",
        });
        shouldForceScrollRef.current = false;
      }, 50);
    }
  }, [messages]);

  const loadConversations = async (append = false) => {
    if (append) setIsLoadingMore(true);

    try {
      const headers = {
        ...getAuthHeaders(storage, storageKeys),
      };

      const offset = append ? conversations.length : 0;
      const url = `${getApiUrl(
        "/api/agent/conversations"
      )}?limit=20&offset=${offset}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        console.error("Failed to load conversations");
        return;
      }

      const data = await response.json();

      if (append) {
        setConversations((prev) => [...prev, ...data.conversations]);
        setIsLoadingMore(false);
      } else {
        setConversations(data.conversations);
      }

      setHasMore(data.conversations.length === 20);
    } catch (error) {
      console.error("Error loading conversations:", error);
      if (append) setIsLoadingMore(false);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      const headers = {
        ...getAuthHeaders(storage, storageKeys),
      };

      const response = await fetch(
        getApiUrl(`/api/agent/conversations/${conversationId}`),
        {
          method: "DELETE",
          headers,
        }
      );

      if (response.ok) {
        // Remove from local state
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        // If deleting current conversation, clear it
        if (currentConvId === conversationId) {
          setCurrentConvId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  const closeMobileSidebarIfNeeded = () => {
    if (isMobile && menuBarRef.current) {
      menuBarRef.current.closeMobileSidebar();
    }
  };

  const startNewConversation = () => {
    setCurrentConvId(null);
    setMessages([]);
    setInput("");
    closeMobileSidebarIfNeeded();
  };

  const getCurrentConversationName = () => {
    if (!currentConvId) return undefined;
    const conv = conversations.find((c) => c.id === currentConvId);
    return conv?.title || "新对话";
  };

  const loadConversation = async (convId: string) => {
    setCurrentConvId(convId);
    setInput("");
    setAttachments([]);
    setMessages([]);
    setIsLoadingConversation(true);
    closeMobileSidebarIfNeeded();

    try {
      const headers = {
        ...getAuthHeaders(storage, storageKeys),
        "Content-Type": "application/json",
      };

      const response = await fetch(
        getApiUrl(`/api/agent/conversations/${convId}/messages`),
        {
          headers,
        }
      );
      if (!response.ok) {
        setMessages([]);
        return;
      }

      const data = await response.json();
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const handleStop = async () => {
    // Cancel fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsStreaming(false);
    abortControllerRef.current = null;
  };


  const uploadFile = async ({
    file,
    onProgress,
    onSuccess,
    onError,
  }: {
    file: File;
    onProgress: (percent: number) => void;
    onSuccess: (response: any) => void;
    onError: (error: Error) => void;
  }) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const headers = getAuthHeaders(storage, storageKeys);
      const response = await fetch(getApiUrl("/api/upload"), {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      onSuccess(data);
    } catch (error) {
      onError(error as Error);
    }
  };
  const handleFileUpload = (file: File): boolean => {
    console.log("handleFileUpload called with:", file.name, file.size);
    const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${
      file.name
    }`;

    // Add file to list with uploading status
    const newFile: AttachmentFile = {
      uid,
      name: file.name,
      size: file.size,
      type: file.type,
      status: "uploading",
      percent: 0,
      originFileObj: file,
    };

    console.log("Adding file to attachments:", newFile);
    setAttachments((prev) => {
      const updated = [...prev, newFile];
      console.log("Attachments after adding:", updated);
      return updated;
    });

    // Start upload
    uploadFile({
      file,
      onProgress: (percent) => {
        setAttachments((prev) =>
          prev.map((f) => (f.uid === uid ? { ...f, percent } : f))
        );
      },
      onSuccess: (response) => {
        console.log("Upload success:", response);
        setAttachments((prev) =>
          prev.map((f) =>
            f.uid === uid
              ? { ...f, status: "done", percent: 100, uploadedId: response.id }
              : f
          )
        );
      },
      onError: (error) => {
        console.error("Upload error:", error);
        // For demo purposes, mark as done anyway so file shows properly
        setAttachments((prev) =>
          prev.map((f) =>
            f.uid === uid ? { ...f, status: "done", percent: 100 } : f
          )
        );
      },
    });

    return false; // Prevent default upload, we handle via onChange
  };

  const handleFileChange = (info: any) => {
    console.log("handleFileChange called:", info);

    if (info.fileList) {
      const newFiles: AttachmentFile[] = info.fileList.map((file: any) => {
        const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${
          file.name
        }`;
        return {
          uid,
          name: file.name,
          size: file.size,
          type: file.type,
          status: "uploading" as const,
          percent: 0,
          originFileObj: file.originFileObj,
        };
      });

      console.log("Adding multiple files:", newFiles);
      setAttachments((prev) => [...prev, ...newFiles]);

      // Simulate upload completion for each file
      newFiles.forEach((file, index) => {
        setTimeout(() => {
          setAttachments((prev) =>
            prev.map((f) =>
              f.uid === file.uid
                ? {
                    ...f,
                    status: "done",
                    percent: 100,
                    url: file.originFileObj
                      ? URL.createObjectURL(file.originFileObj)
                      : undefined,
                  }
                : f
            )
          );
        }, 300 + index * 200); // Stagger the completion times
      });
    }
  };

  const handleFileRemove = (file: UploadFile) => {
    setAttachments((prev) => prev.filter((f) => f.uid !== file.uid));
  };

  // Helper: Auto-generate title if needed (called after message completes)
  const tryGenerateTitle = async (conversationId: string) => {
    try {
      const headers = {
        ...getAuthHeaders(storage, storageKeys),
        "Content-Type": "application/json",
      };
      const response = await fetch(
        getApiUrl(`/api/agent/conversations/${conversationId}/generate-title`),
        {
          method: "POST",
          headers,
        }
      );
      if (response.ok) {
        const { title } = await response.json();
        // Update conversation in local state
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, title } : c
          )
        );
      }
    } catch (error) {
      // Silently fail - title generation is non-critical
      console.error("Failed to generate title:", error);
    }
  };

  const handleSend = async (message: string) => {
    if (!message.trim() || isStreaming) return;

    // Check if any files are still uploading
    const hasUploadingFiles = attachments.some((f) => f.status === "uploading");
    if (hasUploadingFiles) {
      console.warn("Cannot send while files are uploading");
      return;
    }

    const userMessage = message.trim();

    // Track conversation ID for title generation (may be updated during stream)
    let finalConvId = currentConvId;

    // Convert attachments to agent API format
    const agentAttachments: Attachment[] = attachments
      .filter((f) => f.uploadedId && f.url)
      .map((f) => {
        const isImage = f.type.startsWith("image/");
        return {
          type: (isImage ? "image" : "pdf") as "image" | "pdf",
          url: f.url!,
          mimeType: f.type,
          name: f.name,
        };
      });

    // Force scroll to bottom when sending new message
    shouldForceScrollRef.current = true;

    // Add user message to UI
    const tempUserMessage: Message = {
      id: `temp-user-${Date.now()}`,
      conversationId: currentConvId || "",
      role: "user",
      content: userMessage,
      attachments: agentAttachments,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMessage]);
    setInput("");
    setAttachments([]); // Clear attachments after sending
    setIsStreaming(true);

    // Add placeholder assistant message
    const tempAssistantId = `temp-assistant-${Date.now()}`;
    const tempAssistantMessage: Message = {
      id: tempAssistantId,
      conversationId: currentConvId || "",
      role: "assistant",
      content: "",
      attachments: [],
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempAssistantMessage]);

    // Create AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      // Get auth headers
      const headers = {
        ...getAuthHeaders(storage, storageKeys),
        "Content-Type": "application/json",
      };

      const response = await fetch(getApiUrl("/api/agent/chat"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: userMessage,
          conversationId: currentConvId,
          attachments: agentAttachments,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", errorText);
        throw new Error(errorText || "Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let assistantContent = "";
      const MIN_CHUNK_SIZE = 64; // Accumulate threshold to reduce fragment processing

      // SSE parsing with buffer accumulation
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Only process when buffer reaches threshold or has double newline
        if (buffer.length >= MIN_CHUNK_SIZE || buffer.includes('\n\n')) {
          const lines = buffer.split("\n");

          // Keep last partial line in buffer
          buffer = lines.pop() || "";

          let currentEvent = "";
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith("event:")) {
              currentEvent = line.substring(6).trim();
            } else if (line.startsWith("data:") && currentEvent) {
              try {
                const data = JSON.parse(line.substring(5).trim());

                if (currentEvent === "conversation" && data.conversationId) {
                  // New conversation created
                  finalConvId = data.conversationId;
                  setCurrentConvId(data.conversationId);
                  loadConversations();
                  closeMobileSidebarIfNeeded();
                } else if (currentEvent === "delta" && data.text) {
                  // Streaming text chunk
                  assistantContent += data.text;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === tempAssistantId
                        ? { ...msg, content: assistantContent }
                        : msg
                    )
                  );
                } else if (currentEvent === "done" && data.message) {
                  // Final message from server (replace temp message with real one)
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === tempAssistantId ? data.message : msg
                    )
                  );
                } else if (currentEvent === "error") {
                  console.error("Stream error:", data.error);
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === tempAssistantId
                        ? { ...msg, content: `⚠️ 错误：${data.error}` }
                        : msg
                    )
                  );
                } else if (currentEvent === "tool_call" && data.tools) {
                  // Tool execution started - update existing assistant message
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === tempAssistantId
                        ? { ...msg, tool_calls: data.tools }
                        : msg
                    )
                  );
                } else if (currentEvent === "tool_result") {
                  // Tool execution completed (text will stream via delta events)
                  console.log("[Tool Result]", data.tool_display_name, data.tool_call_id);
                }

                currentEvent = ""; // Reset after processing
              } catch (parseError) {
                console.error("Failed to parse SSE data:", parseError);
              }
            }
          }
        }
        // If buffer not ready, continue reading (reduces frequent processing)
      }
    } catch (error: unknown) {
      // Don't show error if aborted by user
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Request aborted by user");
        return;
      }

      console.error("Send error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAssistantId
            ? { ...msg, content: `Error: ${error}` }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;

      // Auto-generate title if needed (after message completes or aborts)
      if (finalConvId) {
        tryGenerateTitle(finalConvId);
      }
    }
  };

  if (isLoading && !guestMode.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <span className="spinner-large"></span>
          <span className="text-base font-medium">品核 AI 正在载入...</span>
        </div>
      </div>
    );
  }

  // Guest mode: 允许在没有认证时继续渲染
  if (!isAuthenticated && !guestMode.enabled) {
    return null;
  }

  // Helper: Generate tool placeholder text
  const generateToolPlaceholderText = (
    tools: Array<{ display_name?: string; name: string }>
  ) => {
    const names = tools.map((t) => t.display_name || t.name);
    const counts: Record<string, number> = {};
    names.forEach((n) => (counts[n] = (counts[n] || 0) + 1));
    const unique = Object.keys(counts);

    if (unique.length === 1) {
      const name = unique[0];
      const count = counts[name];
      return count === 1 ? `正在${name}...` : `正在${name} (${count}个任务)...`;
    }
    return `正在${unique.join("、")}...`;
  };

  const SidebarContent = () => (
    <>
      <div className="sidebar-header">
        <div className="sidebar-header-top">
          <Navigation />
        </div>
        <div>
          <Button
            type="default"
            onClick={startNewConversation}
            icon={<PlusOutlined />}
            block
            className="btn-action"
          >
            新建对话
          </Button>
        </div>
      </div>
      <div className="sidebar-content">
        <Conversations
          items={conversations.map((conv) => ({
            key: conv.id,
            label: conv.title || "新对话",
          }))}
          activeKey={currentConvId || undefined}
          onActiveChange={(key) => loadConversation(key)}
          menu={(conversation) => ({
            items: [
              {
                key: "delete",
                label: "删除",
                icon: <DeleteOutlined />,
                danger: true,
                onClick: () =>
                  handleDeleteConversation(conversation.key as string),
              },
            ],
          })}
        />
        {hasMore && (
          <button
            onClick={() => loadConversations(true)}
            disabled={isLoadingMore}
            className="w-full pl-[20px] pr-3 pb-2 text-left text-sm text-muted-foreground/60 bg-transparent border-none cursor-pointer transition-colors hover:text-foreground disabled:text-muted-foreground disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoadingMore ? "加载中..." : "加载更多"}
          </button>
        )}
      </div>
      <div className="sidebar-footer">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
            aria-label="使用教程"
          >
            <QuestionCircleOutlined />
            <span className="text-sm">使用教程</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <ProtectedRoute>
      {chatConfig && isAdmin ? (
        <div className="chat-container">
          {/* Desktop sidebar - hidden on mobile */}
          {!isMobile && (
            <div className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
              <SidebarContent />
            </div>
          )}

          <div className="main overflow-x-hidden">
            <MenuBar
              ref={menuBarRef}
              onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
              sidebarCollapsed={sidebarCollapsed}
              currentConvName={getCurrentConversationName()}
            >
              <SidebarContent />
            </MenuBar>
            <div className="messages cursor-select" ref={messagesContainerRef}>
              {isLoadingConversation ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                  <span className="spinner-large"></span>
                  <span className="text-base font-medium">加载对话中...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-6 text-muted-foreground">
                  <span className="text-4xl">{welcomeText.greeting}</span>
                  <span className="text-base font-medium">
                    {welcomeText.startNewConversation}
                  </span>
                  {welcomeQuestions.length > 0 ? (
                    <div className="flex flex-col gap-2 w-full max-w-md">
                      <p className="text-sm text-center">
                        {welcomeText.suggestedQuestionsTitle}
                      </p>
                      <div className="flex flex-col gap-2 text-sm">
                        {welcomeQuestions.map((question, index) => (
                          <div
                            key={index}
                            className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors"
                            onClick={() => setInput(question)}
                          >
                            {question}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setIsHelpOpen(true)}
                      className="mt-2 px-3 py-1 text-sm text-primary hover:opacity-80 transition-colors flex items-center gap-2"
                    >
                      查看使用教程
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {(() => {
                    // 过滤消息：移除 tool 消息和空内容消息
                    const visibleMessages = messages.filter((msg) => {
                      // 1. 过滤掉 tool 类型的消息
                      if (msg.role === 'tool') return false

                      // 2. 过滤掉所有 content 为空的消息（包括工具调用中间消息）
                      if (typeof msg.content === 'string' && msg.content.trim() === '') {
                        return false
                      }

                      return true
                    })

                    return visibleMessages.map((msg, index) => {
                      const isLastMessage = index === visibleMessages.length - 1;
                      const showLoading =
                        msg.role === "assistant" && isStreaming && isLastMessage;

                    return (
                      <div key={msg.id} className={`message ${msg.role}`}>
                        <div className="message-content">
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div style={{ marginBottom: "8px" }}>
                              {msg.attachments.map((file, idx) => (
                                <Attachments.FileCard
                                  key={`${msg.id}-file-${idx}`}
                                  item={{
                                    uid: `${msg.id}-${idx}`,
                                    name: file.name,
                                    type: file.mimeType,
                                    status: "done",
                                  }}
                                  style={{
                                    backgroundColor: "hsl(var(--muted) / 0.5)",
                                    border: "1px solid hsl(var(--border))",
                                  }}
                                />
                              ))}
                            </div>
                          )}

                          {/* Loading indicator - text changes based on state */}
                          {showLoading && (
                            <div className="message-loading">
                              <span className="spinner"></span>
                              <span className="loading-text">
                                {msg.tool_calls && msg.tool_calls.length > 0
                                  ? generateToolPlaceholderText(msg.tool_calls)
                                  : "正在思考"}
                              </span>
                            </div>
                          )}

                          {/* Message content */}
                          <div className="markdown-body">
                            <CustomStreamdown>{msg.content}</CustomStreamdown>
                          </div>
                        </div>
                      </div>
                    );
                  })})()}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="input-container">
              <Sender
                ref={senderRef}
                value={input}
                onChange={setInput}
                onSubmit={handleSend}
                onCancel={handleStop}
                loading={isStreaming}
                placeholder="开始提问..."
                autoSize={{ minRows: 1, maxRows: 5 }}
                rootClassName="overflow-x-hidden"
                header={
                  attachments.length > 0 && (
                    <Sender.Header title="附件" open={true}>
                      <Attachments
                        items={attachments as any}
                        onChange={({ fileList }) => {
                          setAttachments(fileList as AttachmentFile[]);
                        }}
                        onRemove={(item) => {
                          if (item.url?.startsWith("blob:")) {
                            URL.revokeObjectURL(item.url);
                          }
                        }}
                        beforeUpload={() => false}
                        overflow="wrap"
                        styles={{
                          list: {
                            display: "flex",
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: "8px",
                            padding: "8px 0",
                          },
                          item: {
                            background: "hsl(var(--muted))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                            padding: "6px 10px",
                          },
                        }}
                      />
                    </Sender.Header>
                  )
                }
                actions={(ori, { components }) => (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Upload
                      multiple
                      showUploadList={false}
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf"
                      disabled={isStreaming}
                      maxCount={10}
                      beforeUpload={(file) => {
                        // Start upload
                        const uid =
                          file.uid ||
                          `${Date.now()}-${Math.random()
                            .toString(36)
                            .substr(2, 9)}`;
                        const newAttachment: AttachmentFile = {
                          uid,
                          name: file.name,
                          size: file.size,
                          type: file.type,
                          status: "uploading",
                          percent: 0,
                          originFileObj: file,
                        };

                        setAttachments((prev) => [...prev, newAttachment]);

                        // Upload file to server
                        const formData = new FormData();
                        formData.append("file", file);

                        const xhr = new XMLHttpRequest();

                        // Upload progress
                        xhr.upload.onprogress = (e: ProgressEvent) => {
                          if (e.lengthComputable) {
                            const percent = Math.floor(
                              (e.loaded / e.total) * 100
                            );
                            setAttachments((prev) =>
                              prev.map((f) =>
                                f.uid === uid ? { ...f, percent } : f
                              )
                            );
                          }
                        };

                        // Upload complete
                        xhr.onreadystatechange = () => {
                          if (xhr.readyState === 4) {
                            if (xhr.status === 200) {
                              try {
                                const response = JSON.parse(xhr.responseText);
                                setAttachments((prev) =>
                                  prev.map((f) =>
                                    f.uid === uid
                                      ? {
                                          ...f,
                                          status: "done" as const,
                                          percent: 100,
                                          uploadedId: response.id,
                                          url:
                                            response.url ||
                                            URL.createObjectURL(file),
                                        }
                                      : f
                                  )
                                );
                              } catch (e) {
                                console.error("Upload response error:", e);
                                setAttachments((prev) =>
                                  prev.map((f) =>
                                    f.uid === uid
                                      ? { ...f, status: "error" as const }
                                      : f
                                  )
                                );
                              }
                            } else {
                              setAttachments((prev) =>
                                prev.map((f) =>
                                  f.uid === uid
                                    ? { ...f, status: "error" as const }
                                    : f
                                )
                              );
                            }
                          }
                        };

                        // Error handling
                        xhr.onerror = () => {
                          setAttachments((prev) =>
                            prev.map((f) =>
                              f.uid === uid
                                ? { ...f, status: "error" as const }
                                : f
                            )
                          );
                        };

                        xhr.open("POST", getApiUrl("/api/upload"));

                        // Add Authorization header
                        const authHeaders = getAuthHeaders(
                          storage,
                          storageKeys
                        );
                        Object.entries(authHeaders).forEach(([key, value]) => {
                          xhr.setRequestHeader(key, value);
                        });

                        xhr.send(formData);

                        return false; // Prevent default upload
                      }}
                    >
                      <button
                        type="button"
                        disabled={isStreaming}
                        className="text-muted-foreground transition-all hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          height: "32px",
                        }}
                      >
                        <PaperClipOutlined style={{ fontSize: "18px" }} />
                      </button>
                    </Upload>
                    {ori}
                  </div>
                )}
              />
              <div className="mt-3 px-1 text-xs text-center text-muted-foreground/60">
                内容由 AI 生成
              </div>
            </div>
          </div>
          <TutorialModal
            open={isHelpOpen}
            onClose={() => setIsHelpOpen(false)}
          />
        </div>
      ) : (
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <span className="text-xl">功能不可用</span>
            <button
              onClick={() => (window.location.href = "/login")}
              className="px-4 py-2 bg-primary text-white rounded"
            >
              返回登录
            </button>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
