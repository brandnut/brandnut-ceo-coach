import { useState, useEffect, useRef } from 'react'
import { Streamdown } from 'streamdown'
import { sendMessage, getConversations, getMessages, Message, Conversation } from './dify'
import './markdown.css'

interface Props {
  userId: string
  username: string
  onLogout: () => void
}

export default function Chat({ userId, username, onLogout }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [workflowStatus, setWorkflowStatus] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations()
  }, [userId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async () => {
    const convs = await getConversations(userId)
    setConversations(convs.sort((a, b) => b.updatedAt - a.updatedAt))
  }

  const startNewConversation = () => {
    setCurrentConvId(null)
    setMessages([])
  }

  const loadConversation = async (convId: string) => {
    setCurrentConvId(convId)
    const history = await getMessages(convId, userId)
    setMessages(history)
  }

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
    }

    setMessages((prev) => [...prev, assistantMessage])

    await sendMessage(
      userMessage.content,
      userId,
      currentConvId,
      (chunk) => {
        console.log('[Chat] onChunk called, chunk length:', chunk.length)
        setWorkflowStatus('')
        setMessages((prev) => {
          const updated = [...prev]
          const lastIndex = updated.length - 1
          if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
            updated[lastIndex] = {
              ...updated[lastIndex],
              content: updated[lastIndex].content + chunk,
            }
          }
          return updated
        })
      },
      (convId) => {
        setCurrentConvId(convId)
        loadConversations()
        setIsStreaming(false)
        setWorkflowStatus('')
      },
      (error) => {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last.role === 'assistant') {
            last.content = `Error: ${error}`
          }
          return updated
        })
        setIsStreaming(false)
        setWorkflowStatus('')
      },
      () => {
        setWorkflowStatus('正在工作')
      },
      (title) => {
        setWorkflowStatus(title)
      }
    )
  }

  return (
    <div className="chat-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="user-info">{username}</div>
          <button onClick={onLogout} className="button-small">Logout</button>
        </div>
        <button onClick={startNewConversation} className="button new-chat-button">
          New Chat
        </button>
        <div className="conversations">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${conv.id === currentConvId ? 'active' : ''}`}
              onClick={() => loadConversation(conv.id)}
            >
              {conv.name}
            </div>
          ))}
        </div>
      </div>

      <div className="main">
        <div className="messages">
          {messages.map((msg, index) => {
            const isLastMessage = index === messages.length - 1
            const showLoading = msg.role === 'assistant' && isStreaming && isLastMessage

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
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message..."
            disabled={isStreaming}
            className="input"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="button"
          >
            {isStreaming ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
