"use client";

import { useState, useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sender } from "@ant-design/x";
import CustomStreamdown from "@/components/CustomStreamdown";
import { getConversations } from "@/lib/api";

interface Conversation {
  id: string;
  name: string;
  updatedAt: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      loadConversations();
    }
  }, [status, router]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || messages.length === 0) return;

    const atTop = container.scrollTop === 0;
    const threshold = 150;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold;

    const shouldScroll = (atTop && messages.length > 0) || nearBottom;

    if (shouldScroll) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "auto",
          block: "end",
        });
      }, 50);
    }
  }, [messages]);

  const loadConversations = async () => {
    const convs = await getConversations();
    setConversations(convs.sort((a, b) => b.updatedAt - a.updatedAt));
  };

  const startNewConversation = () => {
    setCurrentConvId(null);
    setMessages([]);
    setInput("");
  };

  const loadConversation = async (convId: string) => {
    setCurrentConvId(convId);

    try {
      const response = await fetch(`/api/conversations/${convId}/messages`);
      if (!response.ok) {
        setMessages([]);
        return;
      }

      const data = await response.json();
      const history: Message[] = [];

      for (const msg of data.data || []) {
        if (msg.query) {
          history.push({
            id: `${msg.id}-user`,
            role: "user",
            content: msg.query,
          });
        }
        if (msg.answer) {
          history.push({
            id: msg.id,
            role: "assistant",
            content: msg.answer,
          });
        }
      }

      setMessages(history);
    } catch {
      setMessages([]);
    }
  };

  const handleStop = async () => {
    // Cancel fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Call Dify stop API
    if (currentTaskIdRef.current && session?.user?.name) {
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

  const handleSend = async (message: string) => {
    if (!message.trim() || isStreaming) return;

    const userMessage = message.trim();
    const userMsgId = Date.now().toString();

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: userMessage,
      },
    ]);
    setInput("");
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
          files: [],
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
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

          try {
            const data = JSON.parse(line.slice(6));

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

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="chat-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="user-info">{session.user?.name}</div>
          <button onClick={() => signOut()} className="button-small">
            Logout
          </button>
        </div>
        <button
          onClick={startNewConversation}
          className="new-chat-button"
        >
          New Chat
        </button>
        <div className="conversations">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${
                conv.id === currentConvId ? "active" : ""
              }`}
              onClick={() => loadConversation(conv.id)}
            >
              {conv.name}
            </div>
          ))}
        </div>
      </div>

      <div className="main">
        <div className="messages" ref={messagesContainerRef}>
          {messages.map((msg, index) => {
            const isLastMessage = index === messages.length - 1;
            const showLoading =
              msg.role === "assistant" && isStreaming && isLastMessage;

            return (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="message-content">
                  {showLoading && workflowStatus && (
                    <div className="message-loading">
                      <span className="spinner"></span>
                      <span className="loading-text">{workflowStatus}</span>
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
        </div>

        <div className="input-container">
          <Sender
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            onCancel={handleStop}
            loading={isStreaming}
            placeholder="开始提问..."
            autoSize={{ minRows: 1, maxRows: 5 }}
          />
        </div>
      </div>
    </div>
  );
}
