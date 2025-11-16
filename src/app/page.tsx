"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
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
import MenuBar from "@/components/layout/MenuBar";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import type { UploadFile } from "antd";
import type { Message as AppMessage } from "@/types";
import CustomStreamdown from "@/components/CustomStreamdown";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { getConversations, deleteConversation } from "@/lib/api";
import { uploadFile, convertToVisionFiles } from "@/lib/file-upload";
import type { AttachmentFile } from "@/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  welcomeQuestions,
  welcomeText,
  difyInputs,
  guestMode,
} from "@/config/app";

interface Conversation {
  id: string;
  name: string;
  updatedAt: number;
}

// Use shared Message type (with message_files) from src/types

function InstanceHandler({
  onInstanceLoaded,
  onInstanceDataLoaded,
  onLoadingChange,
}: {
  onInstanceLoaded: (title: string) => void;
  onInstanceDataLoaded: (data: any) => void;
  onLoadingChange: (loading: boolean) => void;
}) {
  const searchParams = useSearchParams();

  // 处理 instance 查询参数
  useEffect(() => {
    const instanceId = searchParams.get("instance");
    if (instanceId) {
      fetchInstanceConfig(instanceId);
    }
  }, [searchParams]);

  const fetchInstanceConfig = async (instanceId: string) => {
    try {
      onLoadingChange(true);
      console.log(`🔍 Fetching instance config for: ${instanceId}`);

      const response = await fetch(`/api/instance/${instanceId}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("📋 Instance API Response:");
        console.log(JSON.stringify(data, null, 2));

        // 设置实例标题和数据
        if (data.title) {
          onInstanceLoaded(data.title);
          onInstanceDataLoaded(data);
          console.log(`📝 Instance Title: ${data.title}`);
        }
        if (data.tags) {
          console.log(`🏷️  Instance Tags: ${data.tags.join(", ")}`);
        }
      } else {
        console.error(`❌ Failed to fetch instance: ${response.status}`);
      }
    } catch (error) {
      console.error("❌ Error fetching instance config:", error);
    } finally {
      onLoadingChange(false);
    }
  };

  return null;
}

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [instanceTitle, setInstanceTitle] = useState<string>("");
  const [instanceData, setInstanceData] = useState<any>(null);
  const [isLoadingInstance, setIsLoadingInstance] = useState<boolean>(false);
  const { me, isLoading } = useApp();
  const isAuthenticated = !!me;
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<string>("");
  const [docCountLabel, setDocCountLabel] = useState<string | null>(null);
  const [docFiles, setDocFiles] = useState<
    Array<{ name?: string; indexed_page_count?: number }>
  >([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const senderRef = useRef<any>(null);
  const currentTaskIdRef = useRef<string | null>(null);
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
        const tutorialShown = localStorage.getItem("tutorial-shown");
        if (tutorialShown !== "true") {
          setIsHelpOpen(true);
          localStorage.setItem("tutorial-shown", "true");
        }
      }
    }
  }, [isAuthenticated, isLoading, router]);

  // LlamaIndex knowledge functionality removed
  useEffect(() => {
    // No-op - knowledge documents fetching disabled
  }, []);

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
    const lastId =
      append && conversations.length > 0
        ? conversations[conversations.length - 1].id
        : undefined;

    if (append) setIsLoadingMore(true);

    const response = await getConversations(lastId);

    if (append) {
      setConversations((prev) => [...prev, ...response.conversations]);
      setIsLoadingMore(false);
    } else {
      setConversations(response.conversations);
    }

    setHasMore(response.hasMore);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    const success = await deleteConversation(conversationId);
    if (success) {
      // Remove from local state
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      // If deleting current conversation, clear it
      if (currentConvId === conversationId) {
        setCurrentConvId(null);
        setMessages([]);
      }
    }
  };

  const startNewConversation = () => {
    setCurrentConvId(null);
    setMessages([]);
    setInput("");
  };

  const getCurrentConversationName = () => {
    if (!currentConvId) return undefined;
    const conv = conversations.find((c) => c.id === currentConvId);
    return conv?.name || undefined;
  };

  const loadConversation = async (convId: string) => {
    setCurrentConvId(convId);
    setInput("");
    setAttachments([]);
    setMessages([]);
    setIsLoadingConversation(true);

    try {
      const response = await fetch(`/api/conversations/${convId}/messages`);
      if (!response.ok) {
        setMessages([]);
        return;
      }

      const data = await response.json();
      const history: AppMessage[] = [];

      for (const msg of data.data || []) {
        const userFiles =
          msg.message_files?.filter((f: any) => f.belongs_to === "user") || [];
        const assistantFiles =
          msg.message_files?.filter((f: any) => f.belongs_to === "assistant") ||
          [];

        if (msg.query) {
          history.push({
            id: `${msg.id}-user`,
            role: "user",
            content: msg.query,
            message_files: userFiles,
          });
        }
        if (msg.answer) {
          history.push({
            id: msg.id,
            role: "assistant",
            content: msg.answer,
            message_files: assistantFiles,
          });
        }
      }

      setMessages(history);
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

    // Call Dify stop API
    const userName = guestMode.enabled ? guestMode.username : user?.username;
    if (currentTaskIdRef.current && userName) {
      try {
        await fetch("/api/chat/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: currentTaskIdRef.current,
          }),
        });
      } catch (error) {
        console.error("Stop error:", error);
      }
    }

    setIsStreaming(false);
    setWorkflowStatus("");
    currentTaskIdRef.current = null;
    abortControllerRef.current = null;
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

  const handleSend = async (message: string) => {
    if (!message.trim() || isStreaming) return;

    // Check if any files are still uploading
    const hasUploadingFiles = attachments.some((f) => f.status === "uploading");
    if (hasUploadingFiles) {
      console.warn("Cannot send while files are uploading");
      return;
    }

    const userMessage = message.trim();
    const userMsgId = Date.now().toString();

    // Convert attachments to VisionFile format
    const visionFiles = convertToVisionFiles(attachments);

    // Force scroll to bottom when sending new message
    shouldForceScrollRef.current = true;

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: userMessage,
        message_files: attachments.map((f) => ({
          id: f.uid,
          filename: f.name,
          type: f.type,
          url: f.url || "",
          size: f.size,
          mime_type: f.type,
          transfer_method: "local_file" as const,
          belongs_to: "user" as const,
          upload_file_id: f.uploadedId!,
        })),
      },
    ]);
    setInput("");
    setAttachments([]); // Clear attachments after sending
    setIsStreaming(true);
    setWorkflowStatus("正在思考");

    const assistantMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
      },
    ]);

    // Create AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage,
          conversationId: currentConvId,
          files: visionFiles,
          inputs: {
            ...difyInputs,
            ...(instanceData && !currentConvId && instanceData.prompt
              ? {
                  prompt: instanceData.prompt,
                }
              : {}),
          },
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

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const payload = line.slice(6);

          try {
            const data = JSON.parse(payload);

            // Capture task_id
            if (data.task_id && !currentTaskIdRef.current) {
              currentTaskIdRef.current = data.task_id;
            }

            if (data.event === "message") {
              assistantContent += data.answer;
              setWorkflowStatus("");
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: assistantContent }
                    : msg
                )
              );
            } else if (data.event === "message_end") {
              if (data.conversation_id) {
                setCurrentConvId(data.conversation_id);
                loadConversations();
              }
            } else if (data.event === "workflow_started") {
              setWorkflowStatus("正在思考");
            } else if (data.event === "node_started") {
              setWorkflowStatus(data.data?.title || "正在思考");
            } else if (data.event === "agent_log") {
              const queryMatch = payload.match(
                /"query":("(?:(?:\\.)|[^"\\])*")/
              );
              if (!queryMatch?.[1]) {
                continue; // Skip agent_log events that don't include a query field
              }

              try {
                const extractedQuery = JSON.parse(queryMatch[1]).trim();
                if (extractedQuery) {
                  setWorkflowStatus(`正在检索：${extractedQuery}`);
                }
              } catch (parseError) {
                // Ignore malformed query payloads
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
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
          msg.id === assistantMsgId
            ? { ...msg, content: `Error: ${error}` }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      setWorkflowStatus("");
      currentTaskIdRef.current = null;
      abortControllerRef.current = null;
    }
  };

  if (isLoading && !guestMode.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        正在载入...
      </div>
    );
  }

  // Guest mode: 允许在没有认证时继续渲染
  if (!isAuthenticated && !guestMode.enabled) {
    return null;
  }

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
            label: conv.name,
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
            className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors"
            aria-label="使用教程"
          >
            <QuestionCircleOutlined />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <ProtectedRoute>
      <div className="chat-container">
        <Suspense fallback={null}>
          <InstanceHandler
            onInstanceLoaded={setInstanceTitle}
            onInstanceDataLoaded={setInstanceData}
            onLoadingChange={setIsLoadingInstance}
          />
        </Suspense>
        {/* Desktop sidebar - hidden on mobile */}
        {!isMobile && (
          <div className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
            <SidebarContent />
          </div>
        )}

        <div className="main overflow-x-hidden">
          <MenuBar
            onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            sidebarCollapsed={sidebarCollapsed}
            currentConvName={getCurrentConversationName()}
          >
            <SidebarContent />
          </MenuBar>
          <div className="messages" ref={messagesContainerRef}>
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
                {(instanceTitle || isLoadingInstance) && (
                  <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full flex items-center gap-2">
                    {isLoadingInstance ? (
                      <>
                        <LoadingOutlined className="animate-spin" />
                        正在加载任务模板
                      </>
                    ) : (
                      <Popover
                        content={
                          <div className="max-w-xs">
                            <p className="text-sm text-gray-700">
                              {instanceData?.description || "暂无描述"}
                            </p>
                            {instanceData?.tags && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {instanceData.tags.map(
                                  (tag: string, index: number) => (
                                    <span
                                      key={index}
                                      className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                                    >
                                      {tag}
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        }
                        trigger="hover"
                        placement="bottom"
                      >
                        <span className="cursor-help hover:bg-gray-200 transition-colors px-1 rounded">
                          {instanceTitle}
                        </span>
                      </Popover>
                    )}
                  </span>
                )}
                {welcomeQuestions.length > 0 && (
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
                )}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="mt-2 px-3 py-1 text-sm text-primary hover:opacity-80 transition-colors flex items-center gap-2"
                  >
                    了解更多
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, index) => {
                  const isLastMessage = index === messages.length - 1;
                  const showLoading =
                    msg.role === "assistant" && isStreaming && isLastMessage;

                  return (
                    <div key={msg.id} className={`message ${msg.role}`}>
                      <div className="message-content">
                        {msg.message_files && msg.message_files.length > 0 && (
                          <div style={{ marginBottom: "8px" }}>
                            {msg.message_files.map((file) => (
                              <Attachments.FileCard
                                key={file.id}
                                item={{
                                  uid: file.id,
                                  name: file.filename,
                                  size: file.size,
                                  type: file.mime_type,
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

                        {showLoading && workflowStatus && (
                          <div className="message-loading">
                            <span className="spinner"></span>
                            <span className="loading-text">
                              {workflowStatus}
                            </span>
                          </div>
                        )}

                        <div className="markdown-body">
                          <CustomStreamdown>{msg.content}</CustomStreamdown>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Upload
                    multiple
                    showUploadList={false}
                    accept=".pdf,.txt,.doc,.docx,.md,.csv,.xlsx,.xls,.pptx,.ppt"
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

                      xhr.open("POST", "/api/files/upload");
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
            <div className="mt-3 px-1 text-xs text-center text-muted-foreground/60 cursor-pointer select-none">
              {docCountLabel && docFiles.length > 0 ? (
                <div>
                  <span className="inline">基于</span>
                  <Popover
                    placement="top"
                    trigger={["hover", "click"]}
                    arrow={true}
                    styles={{
                      root: {
                        width: "300px",
                      },
                    }}
                    content={
                      <div className="max-h-80 overflow-y-auto break-words space-y-3">
                        {docFiles.map((file, index) => (
                          <div
                            key={`${file.name || "file"}-${index}`}
                            className="text-xs"
                          >
                            <div className="text-foreground">
                              {file.name || "未命名"}
                            </div>
                            {typeof file.indexed_page_count === "number" && (
                              <div className="text-muted-foreground/80">
                                {file.indexed_page_count} 页
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    }
                  >
                    <span className="text-muted-foreground/60 hover:text-muted-foreground">
                      {" "}
                      {docCountLabel} 个知识库文档
                    </span>
                  </Popover>
                  <span className="inline">和互联网搜索，内容由 AI 生成</span>
                </div>
              ) : (
                <span className="inline">内容由 AI 生成</span>
              )}
            </div>
          </div>
        </div>
        <TutorialModal open={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      </div>
    </ProtectedRoute>
  );
}
