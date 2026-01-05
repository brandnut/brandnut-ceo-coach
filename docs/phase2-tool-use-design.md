# Phase 2: Tool Use Architecture Design

## 核心原则

**数据结构决定一切** - 消除特殊情况，确保三层数据一致性：
1. LangGraph execution state (内存中的完整推理链)
2. Database persistence (持久化的完整历史)
3. SSE streaming (前端实时展示)

## ReAct Pattern: 循环执行直到无 Tool Calls

```
User Input
    ↓
preprocess → agent → (有 tool_calls?)
                ↓ Yes
            tools → agent → (有 tool_calls?)
                ↓ Yes
            tools → agent → (有 tool_calls?)
                ↓ No
            postprocess → END
```

---

## 数据流完整示例

### 场景
用户问："北京和上海今天温差多少？明天呢？"

需要 4 次 tool call：
- 北京今天气温
- 上海今天气温
- 北京明天气温
- 上海明天气温

---

## Layer 1: LangGraph State (内存执行状态)

### Initial State
```typescript
{
  messages: [
    SystemMessage({
      content: "你是 CEO 教练..."
    }),
    HumanMessage({
      content: "北京和上海今天温差多少？明天呢？"
    })
  ],
  userId: "545b8fda-9baa-430b-945f-a27474c3a445",
  conversationId: "c99e421e-5b88-43d9-a404-2bb40e30fc27",
  systemPrompt: "你是 CEO 教练...",
  modelName: "anthropic/claude-3.5-sonnet"
}
```

### Round 1: Agent Calls Tools
```typescript
{
  messages: [
    SystemMessage({...}),
    HumanMessage({...}),

    // AI 决定调用 4 个 tools
    AIMessage({
      content: "",  // tool-only message 没有文本
      tool_calls: [
        {
          id: "call_abc123",
          name: "weather_search",
          args: { city: "北京", date: "today" }
        },
        {
          id: "call_abc124",
          name: "weather_search",
          args: { city: "上海", date: "today" }
        },
        {
          id: "call_abc125",
          name: "weather_search",
          args: { city: "北京", date: "tomorrow" }
        },
        {
          id: "call_abc126",
          name: "weather_search",
          args: { city: "上海", date: "tomorrow" }
        }
      ]
    })
  ]
}
```

### Round 1: Tools Execute
```typescript
{
  messages: [
    SystemMessage({...}),
    HumanMessage({...}),
    AIMessage({...tool_calls...}),

    // 4 个 ToolMessage
    ToolMessage({
      content: '{"temperature": 18, "condition": "晴天"}',
      tool_call_id: "call_abc123",
      name: "weather_search"
    }),
    ToolMessage({
      content: '{"temperature": 22, "condition": "多云"}',
      tool_call_id: "call_abc124",
      name: "weather_search"
    }),
    ToolMessage({
      content: '{"temperature": 15, "condition": "小雨"}',
      tool_call_id: "call_abc125",
      name: "weather_search"
    }),
    ToolMessage({
      content: '{"temperature": 20, "condition": "阴天"}',
      tool_call_id: "call_abc126",
      name: "weather_search"
    })
  ]
}
```

### Round 2: Agent Final Response
```typescript
{
  messages: [
    SystemMessage({...}),
    HumanMessage({...}),
    AIMessage({...tool_calls...}),
    ToolMessage({...}),
    ToolMessage({...}),
    ToolMessage({...}),
    ToolMessage({...}),

    // AI 最终回复 (无 tool_calls，循环结束)
    AIMessage({
      content: "根据天气查询结果:\n\n**今天**:\n- 北京: 18°C (晴天)\n- 上海: 22°C (多云)\n- 温差: 4度\n\n**明天**:\n- 北京: 15°C (小雨)\n- 上海: 20°C (阴天)\n- 温差: 5度",
      tool_calls: undefined  // 没有 tool_calls
    })
  ]
}
```

---

## Layer 2: Database Schema & Data

### Schema Changes

```sql
-- 扩展现有的 agent_messages 表
ALTER TABLE agent_messages
  ADD COLUMN tool_calls JSONB,        -- 存储 AIMessage 的 tool_calls
  ADD COLUMN tool_call_id VARCHAR,    -- 存储 ToolMessage 的 tool_call_id
  ADD COLUMN tool_name VARCHAR;       -- 存储 ToolMessage 的 tool name

-- 扩展 role 枚举
ALTER TYPE message_role ADD VALUE 'tool';  -- 新增 'tool' role
```

### Persisted Messages

```typescript
// Message 1: User input
{
  id: "msg_001",
  conversation_id: "c99e421e-5b88-43d9-a404-2bb40e30fc27",
  role: "user",
  content: "北京和上海今天温差多少？明天呢？",
  attachments: [],
  tool_calls: null,
  tool_call_id: null,
  tool_name: null,
  created_at: "2026-01-05T10:00:00.000Z"
}

// Message 2: AI 调用 tools
{
  id: "msg_002",
  conversation_id: "c99e421e-5b88-43d9-a404-2bb40e30fc27",
  role: "assistant",
  content: "",  // 空文本
  attachments: [],
  tool_calls: [  // 保存完整的 tool_calls
    {
      id: "call_abc123",
      name: "weather_search",
      args: { city: "北京", date: "today" }
    },
    {
      id: "call_abc124",
      name: "weather_search",
      args: { city: "上海", date: "today" }
    },
    {
      id: "call_abc125",
      name: "weather_search",
      args: { city: "北京", date: "tomorrow" }
    },
    {
      id: "call_abc126",
      name: "weather_search",
      args: { city: "上海", date: "tomorrow" }
    }
  ],
  tool_call_id: null,
  tool_name: null,
  created_at: "2026-01-05T10:00:01.500Z"
}

// Message 3-6: Tool results
{
  id: "msg_003",
  conversation_id: "c99e421e-5b88-43d9-a404-2bb40e30fc27",
  role: "tool",  // 新的 role
  content: '{"temperature": 18, "condition": "晴天"}',
  attachments: [],
  tool_calls: null,
  tool_call_id: "call_abc123",  // 关联到哪个 tool call
  tool_name: "weather_search",   // 哪个工具
  created_at: "2026-01-05T10:00:02.000Z"
}

{
  id: "msg_004",
  conversation_id: "c99e421e-5b88-43d9-a404-2bb40e30fc27",
  role: "tool",
  content: '{"temperature": 22, "condition": "多云"}',
  attachments: [],
  tool_calls: null,
  tool_call_id: "call_abc124",
  tool_name: "weather_search",
  created_at: "2026-01-05T10:00:02.100Z"
}

{
  id: "msg_005",
  conversation_id: "c99e421e-5b88-43d9-a404-2bb40e30fc27",
  role: "tool",
  content: '{"temperature": 15, "condition": "小雨"}',
  attachments: [],
  tool_calls: null,
  tool_call_id: "call_abc125",
  tool_name: "weather_search",
  created_at: "2026-01-05T10:00:02.200Z"
}

{
  id: "msg_006",
  conversation_id: "c99e421e-5b88-43d9-a404-2bb40e30fc27",
  role: "tool",
  content: '{"temperature": 20, "condition": "阴天"}',
  attachments: [],
  tool_calls: null,
  tool_call_id: "call_abc126",
  tool_name: "weather_search",
  created_at: "2026-01-05T10:00:02.300Z"
}

// Message 7: AI 最终回复
{
  id: "msg_007",
  conversation_id: "c99e421e-5b88-43d9-a404-2bb40e30fc27",
  role: "assistant",
  content: "根据天气查询结果:\n\n**今天**:\n- 北京: 18°C (晴天)\n- 上海: 22°C (多云)\n- 温差: 4度\n\n**明天**:\n- 北京: 15°C (小雨)\n- 上海: 20°C (阴天)\n- 温差: 5度",
  attachments: [],
  tool_calls: null,  // 没有 tool_calls
  tool_call_id: null,
  tool_name: null,
  created_at: "2026-01-05T10:00:05.000Z"
}
```

---

## Layer 3: SSE Stream Events

### Event Flow

```typescript
// Event 1: Conversation created (仅新对话)
{
  event: "conversation",
  data: {
    type: "conversation",
    conversationId: "c99e421e-5b88-43d9-a404-2bb40e30fc27"
  }
}

// ===== Round 1: Agent 调用 Tools =====

// Event 2: Thinking (Agent 开始调用工具)
{
  event: "thinking",
  data: {
    type: "thinking",
    message: "正在查询天气数据...",
    tools: [
      { name: "weather_search", args: { city: "北京", date: "today" } },
      { name: "weather_search", args: { city: "上海", date: "today" } },
      { name: "weather_search", args: { city: "北京", date: "tomorrow" } },
      { name: "weather_search", args: { city: "上海", date: "tomorrow" } }
    ]
  }
}

// Event 3-6: Tool results (可选展示)
{
  event: "tool_result",
  data: {
    type: "tool_result",
    tool: "weather_search",
    args: { city: "北京", date: "today" },
    result: '{"temperature": 18, "condition": "晴天"}'
  }
}

{
  event: "tool_result",
  data: {
    type: "tool_result",
    tool: "weather_search",
    args: { city: "上海", date: "today" },
    result: '{"temperature": 22, "condition": "多云"}'
  }
}

// ... (另外2个 tool_result)

// ===== Round 2: Agent 最终回复 =====

// Event 7-N: Streaming text chunks
{
  event: "delta",
  data: {
    type: "delta",
    text: "根据"
  }
}

{
  event: "delta",
  data: {
    type: "delta",
    text: "天气"
  }
}

{
  event: "delta",
  data: {
    type: "delta",
    text: "查询"
  }
}

// ... (更多 chunks)

{
  event: "delta",
  data: {
    type: "delta",
    text: "温差: 5度"
  }
}

// Event N+1: Done
{
  event: "done",
  data: {
    type: "done",
    message: {
      id: "msg_007",
      conversationId: "c99e421e-5b88-43d9-a404-2bb40e30fc27",
      role: "assistant",
      content: "根据天气查询结果:\n\n**今天**:\n- 北京: 18°C (晴天)\n- 上海: 22°C (多云)\n- 温差: 4度\n\n**明天**:\n- 北京: 15°C (小雨)\n- 上海: 20°C (阴天)\n- 温差: 5度",
      attachments: [],
      createdAt: "2026-01-05T10:00:05.000Z"
    }
  }
}
```

---

## Frontend Display Modes

### Mode A: 折叠 Tool 过程 (默认)

```
┌─────────────────────────────────────────────┐
│ User                                        │
│ 北京和上海今天温差多少？明天呢？              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Assistant                                   │
│                                             │
│ 🤔 使用了工具: weather_search (4次)         │
│    [点击展开详情]                            │
│                                             │
│ 根据天气查询结果:                            │
│                                             │
│ **今天**:                                   │
│ - 北京: 18°C (晴天)                         │
│ - 上海: 22°C (多云)                         │
│ - 温差: 4度                                 │
│                                             │
│ **明天**:                                   │
│ - 北京: 15°C (小雨)                         │
│ - 上海: 20°C (阴天)                         │
│ - 温差: 5度                                 │
└─────────────────────────────────────────────┘
```

### Mode B: 展开 Tool 过程

```
┌─────────────────────────────────────────────┐
│ User                                        │
│ 北京和上海今天温差多少？明天呢？              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Assistant                                   │
│                                             │
│ 🤔 使用了工具: weather_search (4次)         │
│    [点击折叠]                                │
│                                             │
│ ├─ 🔍 查询北京今天天气                       │
│ │  → 18°C, 晴天                             │
│ │                                           │
│ ├─ 🔍 查询上海今天天气                       │
│ │  → 22°C, 多云                             │
│ │                                           │
│ ├─ 🔍 查询北京明天天气                       │
│ │  → 15°C, 小雨                             │
│ │                                           │
│ └─ 🔍 查询上海明天天气                       │
│    → 20°C, 阴天                             │
│                                             │
│ 根据天气查询结果:                            │
│ ...                                         │
└─────────────────────────────────────────────┘
```

---

## 三层一致性保证

### DB → LangChain (读取历史)

```typescript
function dbMessageToLangChain(dbMsg: Message): BaseMessage {
  if (dbMsg.role === 'user') {
    return new HumanMessage(dbMsg.content)
  }

  if (dbMsg.role === 'assistant') {
    return new AIMessage({
      content: dbMsg.content,
      tool_calls: dbMsg.tool_calls || []  // ← 保留 tool 信息
    })
  }

  if (dbMsg.role === 'tool') {
    return new ToolMessage({
      content: dbMsg.content,
      tool_call_id: dbMsg.tool_call_id!,
      name: dbMsg.tool_name!
    })
  }

  if (dbMsg.role === 'system') {
    return new SystemMessage(dbMsg.content)
  }

  throw new Error(`Unknown role: ${dbMsg.role}`)
}
```

### LangChain → DB (保存推理链)

```typescript
async function saveLangChainMessage(
  msg: BaseMessage,
  convId: string
): Promise<Message> {
  if (msg instanceof HumanMessage) {
    return createMessage(convId, 'user', msg.content)
  }

  if (msg instanceof AIMessage) {
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // AI 调用了 tools
      return createMessage(convId, 'assistant', msg.content || '', [], {
        tool_calls: msg.tool_calls
      })
    } else {
      // AI 最终回复
      return createMessage(convId, 'assistant', msg.content)
    }
  }

  if (msg instanceof ToolMessage) {
    // Tool 结果
    return createMessage(convId, 'tool', msg.content, [], {
      tool_call_id: msg.tool_call_id,
      tool_name: msg.name
    })
  }

  throw new Error(`Cannot save message type: ${msg._getType()}`)
}
```

### LangChain → SSE (流式展示)

```typescript
async function* streamGraphToSSE(
  graph: CompiledStateGraph,
  state: AgentState
): AsyncGenerator<SSEEvent> {

  const stream = graph.streamEvents(state, { version: 'v2' })

  for await (const event of stream) {
    // Agent 调用 tools
    if (event.event === 'on_chat_model_end') {
      const message = event.data?.output
      if (message?.tool_calls?.length > 0) {
        yield {
          type: 'thinking',
          message: '正在使用工具...',
          tools: message.tool_calls
        }
      }
    }

    // Tool 执行结果
    if (event.event === 'on_tool_end') {
      const { name, output, tool_call_id } = event.data
      yield {
        type: 'tool_result',
        tool: name,
        result: output,
        tool_call_id
      }
    }

    // LLM streaming chunks (最终回复)
    if (event.event === 'on_chat_model_stream') {
      const chunk = event.data?.chunk
      if (chunk?.content) {
        yield {
          type: 'delta',
          text: chunk.content
        }
      }
    }
  }
}
```

---

## Graph Structure Changes

### Phase 1 (Current)
```
__start__ → preprocess → agent → postprocess → END
```

### Phase 2 (With Tools)
```
__start__ → preprocess → agent → (条件路由)
                           ↓
                      [有 tool_calls?]
                       /          \
                     Yes           No
                      ↓             ↓
                    tools      postprocess → END
                      ↓
                    agent (循环回去)
```

### Router Logic

```typescript
function shouldContinue(state: AgentState): 'continue' | 'end' {
  const lastMessage = state.messages[state.messages.length - 1]

  if (lastMessage._getType() === 'ai') {
    const aiMessage = lastMessage as AIMessage
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      console.log('[Router] Agent called tools, continuing...')
      return 'continue'  // → 去 tools 节点
    }
  }

  console.log('[Router] No tool calls, ending...')
  return 'end'  // → 去 postprocess
}
```

---

## Type Definitions

### Extended Message Type

```typescript
export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  attachments: Attachment[]

  // Phase 2 新增字段
  tool_calls?: Array<{
    id: string
    name: string
    args: Record<string, any>
  }>
  tool_call_id?: string
  tool_name?: string

  createdAt: string
}
```

### Extended SSE Events

```typescript
export interface SSEThinkingEvent {
  type: 'thinking'
  message: string
  tools: Array<{
    name: string
    args: Record<string, any>
  }>
}

export interface SSEToolResultEvent {
  type: 'tool_result'
  tool: string
  args?: Record<string, any>
  result: string
  tool_call_id?: string
}

export type SSEEvent =
  | SSEConversationEvent
  | SSEDeltaEvent
  | SSEThinkingEvent      // ← 新增
  | SSEToolResultEvent    // ← 新增
  | SSEDoneEvent
  | SSEErrorEvent
```

---

## Implementation Checklist

### Database
- [ ] Add `tool_calls`, `tool_call_id`, `tool_name` columns to `agent_messages`
- [ ] Add `'tool'` value to `message_role` enum
- [ ] Update `createMessage` to accept tool-related fields
- [ ] Update `getConversationMessages` to return tool-related fields

### Backend
- [ ] Extend `Message` type in `types/agent.ts`
- [ ] Add SSE event types (`SSEThinkingEvent`, `SSEToolResultEvent`)
- [ ] Update `convertToLangChainMessages` to handle tool messages
- [ ] Implement `shouldContinue` router function
- [ ] Implement `toolsNode` for tool execution
- [ ] Update graph structure with conditional edges
- [ ] Update streaming logic to emit tool events
- [ ] Update save logic to persist tool messages

### Frontend
- [ ] Handle `thinking` SSE event
- [ ] Handle `tool_result` SSE event
- [ ] Add UI for collapsed tool display
- [ ] Add UI for expanded tool display
- [ ] Update message rendering to show tool info

---

## Key Benefits

1. **完整性**: DB 保存完整推理链，支持多轮对话上下文延续
2. **可追溯**: 用户可以看到 AI 的"思考过程"，提高信任度
3. **一致性**: 三层数据结构完全对应，无需特殊转换逻辑
4. **可扩展**: 新增 tool 只需在 `toolsNode` 中添加 case
5. **向后兼容**: Phase 1 消息(无 tool 字段)仍可正常读取

---

## Next Steps

1. 运行 DB migration (添加字段)
2. 实现 Phase 2 graph 结构
3. 实现第一个 tool (Tavily search 或 weather API)
4. 测试单轮和多轮 tool use
5. 前端适配新的 SSE events
