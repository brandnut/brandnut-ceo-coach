# LangGraph Refactoring - 2026-01-06

## 问题

**核心 bug**: `reducer: (_, y) => y` 完全破坏了 LangGraph 的消息管理。

```typescript
// state.ts - 错误的实现
messages: Annotation<BaseMessage[]>({
  reducer: (_, y) => y,  // ← 每次都替换整个数组！
  default: () => [],
})
```

这导致每个 node 必须手动 `[...state.messages, newMessage]`，完全违背了 LangGraph 的设计。

## 重构内容

### 1. 修复 State Reducer

**之前**:
```typescript
reducer: (_, y) => y  // 错误：完全替换
```

**之后**:
```typescript
reducer: (x, y) => {
  if (y.length > 0 && y[0]._getType() === 'system') {
    return y  // 第一次调用：preprocess 替换原始消息
  }
  return x.concat(y)  // 后续调用：agent/tools 追加
}
```

### 2. 简化 Node 返回值

**之前** (手动管理):
```typescript
// agent.ts, tools.ts
return {
  messages: [...state.messages, response],  // 手动 append
}
```

**之后** (让 LangGraph 自动处理):
```typescript
// agent.ts
return { messages: [response] }  // 只返回新消息

// tools.ts
return { messages: toolMessages }  // 只返回新消息
```

### 3. 删除不必要的代码

| 文件 | 变化 | 原因 |
|------|------|------|
| `postprocess.ts` | 删除 (31 行) | 只打日志，无实际功能 |
| `router.ts` | 删除 (36 行) | 内联到 `graph.ts` |
| `tools.ts` | 简化 (180 → 139 行) | 用 LangGraph 的 `ToolNode` |
| `agent.ts` | 简化 (160 → 100 行) | 用标准 `.bindTools()` |

### 4. 使用 LangGraph 标准写法

**Tool 定义**:
```typescript
// 之前：DynamicTool + JSON.parse
new DynamicTool({
  func: async (input: string) => {
    const args = JSON.parse(input)  // ← 容易出错
    return await bochaSearch(args)
  },
})

// 之后：structured tool + zod
tool(
  async ({ query, summary, freshness, count }) => {
    return await bochaSearch({ query, summary, freshness, count })
  },
  {
    schema: z.object({
      query: z.string(),
      summary: z.boolean().optional(),
      // ...
    })
  }
)
```

**Tool 执行**:
```typescript
// 之前：自定义 node (180 行)
export async function toolsNode(state: AgentState) {
  // 手动提取 tool_calls
  // 并行执行
  // 构建 ToolMessage
  // 手动返回
}

// 之后：ToolNode (1 行)
export const toolsNode = new ToolNode(tools)
```

## 代码行数变化

```
原始: 841 行
现在: 548 行
减少: 293 行 (35%)
```

## 功能验证

### ✅ 保留的功能

1. **System prompt 注入** - preprocess.ts, 带本地时间戳
2. **Memory lookup** - preprocess.ts, 查询并注入到 HumanMessage
3. **LLM 调用** - agent.ts, 用 bindTools 绑定工具
4. **Tool 执行** - tools.ts, ToolNode 自动处理
5. **Router 逻辑** - graph.ts 内联, 检查 tool_calls
6. **Streaming** - stream.ts, 提取 text/tool_call/tool_result
7. **日志记录** - 各节点 console.log + 数据库
8. **错误处理** - try-catch + error logging

### ❌ 删除的功能

1. **postprocess node** - 确认只打日志,无业务逻辑

## 测试检查清单

- [ ] 普通对话（无工具）
- [ ] 工具调用（搜索）
- [ ] 多轮工具循环
- [ ] Memory 注入
- [ ] 时间戳正确（本地时区）
- [ ] Stream events 正常
- [ ] 错误处理（API 失败）

## 关键改进

### 1. 不再重复造轮子

| 功能 | 之前 | 之后 |
|------|------|------|
| Tool 执行 | 自定义 180 行 | ToolNode 1 行 |
| Router | 独立文件 36 行 | 内联函数 18 行 |
| Tool 绑定 | modelKwargs | bindTools |

### 2. 数据结构更清晰

**Preprocess**: 只在第一次调用时返回新消息（替换）
**Agent/Tools**: 只返回新增消息（追加）
**Reducer**: 根据消息类型自动选择 replace 或 append

### 3. 代码更易维护

- 删除 postprocess 和 router 两个文件
- 使用 LangChain/LangGraph 标准写法
- 减少 293 行代码
- 逻辑更集中

## 注意事项

1. **Reducer 逻辑**: preprocess 必须返回以 SystemMessage 开头的消息数组，才能触发 replace
2. **Preprocess 跳过**: 通过检查 `state.messages[0]._getType() === 'system'` 来避免在工具循环中重复处理
3. **时区修复**: 时间戳现在使用本地时间，而不是 UTC
4. **Tool 参数**: 使用 zod schema 定义，LangChain 自动解析和验证

## 后续优化建议

1. 考虑使用 `createReactAgent` 预构建 agent（如果不需要自定义 preprocess）
2. 用 `streamMode: 'messages'` 简化 streaming（需要测试兼容性）
3. 考虑将 memory lookup 移到独立的 node
