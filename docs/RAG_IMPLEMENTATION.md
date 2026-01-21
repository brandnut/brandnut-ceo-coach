# RAG 系统完整实现文档

## 概述

BrandNut CEO Coach 项目已集成完整的 RAG (Retrieval Augmented Generation) 系统，支持：

✅ **自动文件索引**：上传文档后自动生成摘要和向量索引

✅ **智能检索**：聊天时自动检索相关文档片段

✅ **Tool 模式**：RAG 作为 Agent Tool，由 LLM 决定何时调用

✅ **跨对话检索**：可以找到历史对话中的相关文档

✅ **可配置参数**：所有关键参数都支持环境变量调整

---

## 目录
- [Tool Prompt](#tool-prompt)
- [架构设计](#架构设计)
- [Agent Tool 集成](#agent-tool-集成)
- [核心文件说明](#核心文件说明)
- [部署步骤](#部署步骤)
- [使用方法](#使用方法)
- [工作流程示例](#工作流程示例)
- [配置调优建议](#配置调优建议)
- [监控与调试](#监控与调试)
- [成本估算](#成本估算)
- [故障排查](#故障排查)
- [下一步优化方向](#下一步优化方向)

---
## Tool Prompt
需要添加到System Prompt中
```md
## RAG 文档搜索 - 优先查找用户上传的文档。
你有权访问用户上传的企业文档，包括战略文档、访谈记录、业务数据等。

1. 你需要编写高质量的 RAG Query
- **关键词提取**：提取问题中的 2-4 个核心概念
- **同义词扩展**：考虑文档中可能的不同表述方式
- **分面搜索**：复杂问题拆分成多个独立的 query
- **由宽到窄**：先搜索背景框架，再搜索具体细节
- **推荐写法**："企业战略 品牌定位 核心业务" （用空格分隔关键词、聚焦具体维度、加入同义词）
2. 如果搜索结果不理想，可以调整参数：
- `threshold`: 相似度阈值（默认 0.7）
  - 降低到 0.5-0.6 可获得更多结果
  - 提高到 0.8-0.9 可获得更精准的结果
- `maxResults`: 返回结果数量（默认 5）
  - 增加到 8-10 获得更多参考
  - 减少到 2-3 获得最相关的结果
```
## 架构设计

### 整体数据流

```
文件上传 → 文本提取 → RAG 处理（异步）
           ↓
    生成摘要（>50KB）+ 向量索引（>50KB）
           ↓
    存储到 PostgreSQL + pgvector
           ↓
用户提问 → Agent LLM → 决定是否需要 RAG
           ↓
    调用 rag_search tool → 语义检索 → Top-K 相关片段
           ↓
    返回结果 → LLM 结合上下文生成回答
```

### Agent Graph 流程

```
┌─────────────────────────────────────────────────────────────┐
│                      用户消息                                   │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  preprocessNode (预处理)                       │
├─────────────────────────────────────────────────────────────┤
│ 1. System Prompt Injection                                   │
│    ├─ 添加时间戳                                              │
│    └─ 注入系统提示词                                          │
│                                                              │
│ 2. Memory Lookup                                             │
│    ├─ 搜索用户偏好                                            │
│    └─ 检索历史记忆                                            │
│                                                              │
│ 3. Attachment Hint                                           │
│    └─ 提示用户有上传文档可用 rag_search                        │
│                                                              │
│ 4. Message Augmentation                                     │
│    └─ 注入 Memory + 提示到用户消息                            │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   agentNode (LLM 推理)                        │
├─────────────────────────────────────────────────────────────┤
│ • 收到增强后的消息（包含附件提示）                              │
│ • 基于用户问题进行推理                                        │
│ • 决定是否需要调用 rag_search tool                           │
│                                                              │
│ 决策点:                                                      │
│ ├─ 文档相关 → 调用 rag_search                                │
│ └─ 不相关 → 直接回答或调用其他 tools                         │
└─────────────┬──────────────────────┬──────────────────────────┘
              ↓ (直接回答)            ↓ (调用 rag_search)
         ┌──────────┐          ┌────────────────────────────┐
         │ Postprocess│          │     toolsNode             │
         │   (保存)   │          ├────────────────────────────┤
         │          │          │ • rag_search (文档搜索) ⭐  │
         │          │          │ • bocha_search (网页搜索)   │
         │          │          │ • brandnut_tools (业务API)  │
         └──────────┘          └────────────┬───────────────┘
                                          ↓
                                   ┌──────────────┐
                                   │ agentNode    │ (第二轮推理)
                                   │ (结合RAG结果) │
                                   └──────┬───────┘
                                          ↓
                                   ┌──────────────┐
                                   │ Postprocess  │
                                   │ (保存对话)   │
                                   └──────────────┘
```

---

## Agent Tool 集成

### 1. RAG Tool 的实现

**文件**: `src/lib/agent/nodes/tools.ts:123-201`

RAG 已被实现为一个 Agent Tool，名为 `rag_search`，具有以下特点：

#### Tool 定义

```typescript
tool(
  async ({ query, maxResults, threshold }) => {
    return await ragSearch({ query, maxResults, threshold }, conversationId)
  },
  {
    name: 'rag_search',
    description: '搜索用户上传的文档，基于语义相似度查找相关内容...',
    schema: z.object({
      query: z.string().describe('搜索问题或关键词'),
      maxResults: z.number().min(1).max(10).optional().describe('返回结果数量（默认5条）'),
      threshold: z.number().min(0).max(1).optional().describe('相似度阈值（0-1，默认0.7）'),
    }),
  }
)
```

#### Tool 工作流程

```typescript
async function ragSearch(args, conversationId) {
  // 1. 检查 RAG 功能是否启用
  if (!config.features.enableRAG) {
    return 'Error: RAG feature is disabled'
  }

  // 2. 从数据库加载对话的附件
  const attachQuery = `
    SELECT file_extraction_id
    FROM conversation_attachments
    WHERE conversation_id = $1
    ORDER BY attached_at ASC
  `
  const attachResult = await pool.query(attachQuery, [conversationId])
  const attachmentIds = attachResult.rows.map(row => row.file_extraction_id)

  // 3. 检查是否有附件
  if (attachmentIds.length === 0) {
    return '当前对话没有上传的文档，无法使用文档搜索。请先上传文档。'
  }

  // 4. 执行向量搜索
  const results = await searchSimilarChunks(args.query, {
    conversationId,
    fileIds: attachmentIds,
    maxResults: args.maxResults || config.retrieval.currentConvMaxResults,
    threshold: args.threshold || config.retrieval.currentConvThreshold
  })

  // 5. 格式化并返回结果
  return formattedResults
}
```

### 2. 与 Preprocess 的协作

**文件**: `src/lib/agent/nodes/preprocess.ts:124-127`

Preprocess 节点会在用户消息中添加附件提示：

```typescript
// Add hint about available attachments
if (state.attachmentIds && state.attachmentIds.length > 0) {
  contexts.push(`[系统提示] 当前对话中有 ${state.attachmentIds.length} 个上传的文档。你可以使用 "rag_search" 工具来搜索这些文档的内容。`)
}
```

### 3. 与其他 Tools 的协作

RAG 和其他 Tools 是**互补关系**，各自解决不同的问题：

#### RAG 的优势

✅ **私有数据**：访问用户上传的文档
✅ **精准检索**：基于语义相似度
✅ **即时可用**：无需外部调用
✅ **成本更低**：不消耗外部 API 配额

#### RAG 的局限

❌ **数据时效**：文档可能有滞后
❌ **覆盖范围**：仅限于已上传的文档
❌ **外部信息**：无法获取实时数据

#### Web Search 的优势

✅ **实时数据**：网页搜索获取最新信息
✅ **外部API**：访问业务系统
✅ **补充验证**：交叉验证文档内容

#### 协作场景示例

**场景 1: 文档内容足够**
```
用户："年假有多少天？"

Agent:
  ├─ 判断：需要文档信息
  ├─ 调用: rag_search(query="年假 制度")
  └─ 收到结果 → 直接回答

无需调用 web search ✅
```

**场景 2: 需要验证和补充**
```
用户："文档中的数据是最新的吗？"

Agent:
  ├─ 调用: rag_search(query="数据发布 时间")
  ├─ 看到文档是2023年的
  ├─ 判断：需要验证是否最新
  ├─ 调用: bocha_search(query="最新数据 2024")
  └─ 结合两者回答
```

**场景 3: 文档中没有相关信息**
```
用户："今天的天气怎么样？"

Agent:
  ├─ 调用: rag_search → 无结果
  ├─ 判断：需要实时信息
  ├─ 调用: bocha_search(query="今天天气")
  └─ 回答
```

### 4. 为什么选择 Tool 模式？

**设计选择**: RAG 作为 Tool，而非自动注入

**原因**：

✅ **LLM 决策**: LLM 可以判断是否需要搜索文档
✅ **灵活性**: 可以多次调用，每次查询不同角度
✅ **透明性**: 用户可以看到 LLM 何时调用了文档搜索
✅ **可控性**: 可以通过参数调整搜索精度和范围

**对比：如果 RAG 在 Preprocess 中自动注入**

```
用户："年假有多少天？"

Preprocess (自动注入):
  ├─ 自动检索文档
  └─ 将结果注入到上下文

Agent:
  ├─ 看到完整答案
  └─ 直接回答

问题:
- 无法控制是否检索
- 每次都检索，可能浪费资源
- LLM 无法根据需要调整查询
```

**对比：RAG 作为 Tool**

```
用户："年假有多少天？"

Agent:
  ├─ 判断需要文档信息
  ├─ 调用 rag_search(query="年假")
  ├─ 如果结果不够
  ├─ 可以再次调用 rag_search(query="请假制度")
  └─ 结合多次结果回答

优势:
- LLM 控制何时调用
- 可以多次调用，逐步深入
- 参数可调（threshold, maxResults）
```

### 5. 关键设计决策

#### 后端查询数据库

**设计**: 后端自动查询 `conversation_attachments` 表

**原因**：

✅ **持久化**：刷新页面不丢失
✅ **简单性**：前端无需维护状态
✅ **一致性**：所有对话都从同一个数据源获取

#### RAG vs 其他 Tools

| 维度 | RAG (Tool) | Web Search | Business APIs |
|------|-----------|------------|---------------|
| **触发方式** | LLM 决定调用 | LLM 决定调用 | LLM 决定调用 |
| **执行时机** | LLM 推理后 | LLM 推理后 | LLM 推理后 |
| **目的** | 获取私有文档 | 获取外部数据 | 调用业务逻辑 |
| **数据来源** | 用户文档 | 实时互联网 | 业务系统 |
| **成本** | 低（数据库） | 中（API） | 变化 |
| **实时性** | 低 | 高 | 高 |

---

## 核心文件说明

### 1. 配置文件
- **[src/lib/rag/config.ts](src/lib/rag/config.ts)** - RAG 配置（支持环境变量覆盖）
- **[.env.example.rag](.env.example.rag)** - 环境变量示例文件

### 2. RAG 核心库
- **[src/lib/rag/embeddings.ts](src/lib/rag/embeddings.ts)** - OpenRouter Embedding 客户端
- **[src/lib/rag/chunking.ts](src/lib/rag/chunking.ts)** - 智能文本分块（600 tokens，100 tokens 重叠）
- **[src/lib/rag/vector-db.ts](src/lib/rag/vector-db.ts)** - pgvector 查询封装
- **[src/lib/rag/file-processor.ts](src/lib/rag/file-processor.ts)** - 文件处理流水线

### 3. Agent Tool
- **[src/lib/agent/nodes/tools.ts](src/lib/agent/nodes/tools.ts)** - RAG Tool 实现 (lines 123-227)
- **[src/lib/agent/nodes/preprocess.ts](src/lib/agent/nodes/preprocess.ts)** - 附件提示注入 (lines 124-127)
- **[src/lib/agent/nodes/agent.ts](src/lib/agent/nodes/agent.ts)** - Agent 节点（LLM 推理）

### 4. API 端点
- **[src/app/api/files/process/route.ts](src/app/api/files/process/route.ts)** - 手动触发文件处理
- **[src/app/api/upload/route.ts](src/app/api/upload/route.ts)** - 已集成自动触发 RAG
- **[src/app/api/conversations/[id]/attachments/route.ts](src/app/api/conversations/[id]/attachments/route.ts)** - 查询对话附件

### 5. 数据库
- **[migrations/002_add_rag_support.sql](migrations/002_add_rag_support.sql)** - RAG 基础表结构
- **[migrations/007_add_conversation_attachments.sql](migrations/007_add_conversation_attachments.sql)** - 附件持久化

---

## 部署步骤

### Step 1: 安装 pgvector 扩展

如果你的 PostgreSQL 还没有安装 pgvector：

#### Docker 环境
```yaml
# docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg16  # 或其他版本
    # 或者
    command: postgres -c shared_preload_libraries=vector
```

#### 本地安装
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-16-pgvector

# macOS (Homebrew)
brew install pgvector
```

### Step 2: 运行数据库迁移

```bash
# RAG 基础支持
psql -U your_user -d your_db -f migrations/002_add_rag_support.sql

# 附件持久化
psql -U your_user -d your_db -f migrations/007_add_conversation_attachments.sql
```

迁移会创建：
- `file_chunks` 表（存储文本块和向量）
- `file_extractions` 表新增字段（summary, processed, should_index, conversation_id）
- `conversation_attachments` 表（附件与对话的关联）
- 向量相似度索引
- 辅助函数和视图

### Step 3: 配置环境变量

复制示例配置到你的 `.env.local`：

```bash
cp .env.example.rag >> .env.local
```

然后编辑 `.env.local`，添加以下配置：

```env
# RAG 功能开关
RAG_ENABLED=true

# Embedding 模型（使用 OpenRouter）
RAG_EMBEDDING_MODEL=openai/text-embedding-3-small

# 分块配置
RAG_CHUNK_SIZE=600
RAG_CHUNK_OVERLAP=100

# 长文档阈值（字节）
RAG_LONG_FILE_THRESHOLD=50000

# 跨对话检索
RAG_CROSS_CONV_ENABLED=true

# 功能开关
RAG_ENABLE_SUMMARIZATION=true
RAG_ENABLE_VECTOR_INDEX=true
```

### Step 4: 重启应用

```bash
npm run dev
```

---

## 使用方法

### 自动流程（推荐）

上传文件后，RAG 处理会**自动触发**：

```typescript
// 用户上传文件 → API 返回 file ID
// 后台自动：
// 1. 提取文本
// 2. 判断是否 > 50KB
// 3. 如果是 → 生成摘要 + 创建向量索引
// 4. 关联到当前对话
```

### 手动触发（可选）

如果需要手动处理文件：

```bash
curl -X POST http://localhost:3000/api/files/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fileId": "uuid-here",
    "conversationId": "conversation-uuid",
    "force": false
  }'
```

响应示例：
```json
{
  "success": true,
  "message": "Successfully processed 1 file(s)",
  "results": [
    {
      "fileId": "uuid",
      "success": true,
      "action": "both",
      "summary": "文档摘要...",
      "chunkCount": 42
    }
  ]
}
```

### 使用 RAG Tool

用户发送消息时：

```typescript
// 1. 用户发送消息
POST /api/agent/chat
{
  "message": "这个文档提到的预算是多少？",
  "conversationId": "conv-uuid"
  // attachmentIds 会自动从数据库加载
}

// 2. Preprocess 添加提示
[系统提示] 当前对话中有 1 个上传的文档。你可以使用 "rag_search" 工具来搜索这些文档的内容。

// 3. Agent 判断需要调用 rag_search
tool_calls: [{
  name: "rag_search",
  arguments: {
    query: "预算 财务"
  }
}]

// 4. RAG Tool 返回结果
在文档中找到 3 条相关内容：

[1] 财务报告.pdf
相似度: 85.3%
内容: 2024年总预算为500万美元，同比增长15%...

// 5. Agent 基于结果生成回答
```

---

## 工作流程示例

### 场景：用户上传并询问长文档

```typescript
// 1. 用户上传 80KB 的 PDF
POST /api/upload
→ 返回 fileId: "abc-123"

// 2. 后台自动处理（异步）
- 提取文本
- 生成摘要（3-5 句话）
- 分块：600 tokens/chunk，100 tokens 重叠
- 生成 embeddings（OpenRouter API）
- 存储到 pgvector
- 关联到当前对话

// 3. 用户发送消息
POST /api/agent/chat
{
  "message": "这个文档提到的预算是多少？",
  "conversationId": "conv-uuid"
  // 附件自动从数据库加载
}

// 4. Preprocess 节点
- 加载对话附件: ["abc-123"]
- 添加提示: "当前对话中有 1 个上传的文档..."
- 注入 Memory 上下文

// 5. Agent 节点
- LLM 收到提示
- 判断需要文档信息
- 调用 rag_search(query="预算 财务数据")

// 6. RAG Tool 执行
- 查询数据库获取附件
- 生成查询 embedding
- 向量搜索: top-5 chunks (相似度 > 70%)
- 格式化返回结果

// 7. Agent (第二轮)
- 收到 RAG 搜索结果
- 结合结果生成回答
- "根据文档，2024年预算为500万美元..."
```

### 多次调用示例

```typescript
// 用户：详细分析一下公司的财务状况

// Agent 第 1 次调用
rag_search(query="财务状况 收入结构")
→ 返回：收入来源、成本分析

// Agent 第 2 次调用
rag_search(query="利润率 盈利能力")
→ 返回：毛利率、净利率数据

// Agent 第 3 次调用（调整参数）
rag_search(
  query="现金流 资金状况",
  threshold: 0.6,  // 降低阈值获取更多结果
  maxResults: 8    // 增加结果数量
)
→ 返回：现金流相关数据

// Agent 综合三次结果
生成完整的财务分析报告
```

---

## 配置调优建议

### 分块大小

| 场景 | 推荐配置 | 理由 |
|------|---------|------|
| **商业文档（默认）** | 600 tokens, 100 overlap | 平衡精度和召回率 |
| **技术文档** | 800 tokens, 150 overlap | 需要更大上下文 |
| **快速检索** | 400 tokens, 50 overlap | 提高检索精度 |
| **长文档** | 1000 tokens, 200 overlap | 减少片段数量 |

修改方式：
```env
RAG_CHUNK_SIZE=800
RAG_CHUNK_OVERLAP=150
```

### 相似度阈值

| 阈值 | 适用场景 |
|------|---------|
| **0.70 (默认)** | 当前对话 - 平衡召回率和精度 |
| **0.60** | 探索性搜索，提高召回率 |
| **0.85** | 精确匹配，减少噪声 |

修改方式：
```typescript
// 在调用 rag_search 时传入
rag_search({
  query: "关键词",
  threshold: 0.6  // 降低阈值
})
```

### RAG Tool 参数调优

**maxResults**:
- 默认: 5
- 范围: 1-10
- 用法:
  ```typescript
  rag_search({
    query: "关键词",
    maxResults: 8  // 获取更多结果
  })
  ```

**threshold**:
- 默认: 0.7
- 范围: 0-1
- 用法:
  ```typescript
  rag_search({
    query: "关键词",
    threshold: 0.85  // 提高精度
  })
  ```

**组合调优策略**:
```typescript
// 第一次调用：广度搜索
rag_search({
  query: "财务状况",
  maxResults: 8,
  threshold: 0.6
})

// 第二次调用：深度搜索
rag_search({
  query: "现金流分析 具体数据",
  maxResults: 3,
  threshold: 0.8
})
```

---

## 监控与调试

### 关键日志

**Preprocess 节点**：
```
[Preprocess] Starting preprocessing {
  userId: '...',
  conversationId: '...',
  hasAttachmentIds: true,           ← 有附件
  attachmentCount: 1,               ← 1个附件
  attachmentIds: ['abc-123']
}

[Preprocess] Final augmentation: {
  hasMemory: true,
  hasAttachmentHint: true,          ← 添加了附件提示
  attachmentCount: 1,
  totalLength: 10618
}
```

**Agent 节点**：
```
[Agent] Starting LLM inference {
  model: 'google/gemini-3-pro-preview',
  availableTools: [                  ← 可用工具列表
    'rag_search',                    ← RAG 工具
    'bocha_search',
    'brandnut_tools'
  ],
  toolCount: 3,
  hasAttachments: true,
  attachmentCount: 1
}

[Agent] LLM response received {
  hasToolCalls: true,
  toolCallCount: 1,
  tools: ['rag_search']              ← 调用了 RAG
}
```

**RAG Tool 执行**：
```
[RAG Tool] Searching documents: {
  conversationId: '...',
  attachmentIds: ['abc-123'],
  query: '预算 财务',
  maxResults: 5,
  threshold: 0.7
}

[RAG Tool] Search results: {
  resultCount: 3,                    ← 找到3条结果
  results: [
    { file: 'report.pdf', similarity: 0.85 },
    { file: 'summary.docx', similarity: 0.72 },
    { file: 'data.xlsx', similarity: 0.68 }
  ]
}
```

### 查看文件处理状态

```bash
# 使用 API
GET /api/files/process?fileId=uuid-here

# 或查询数据库
SELECT * FROM v_file_processing_status
WHERE id = 'uuid-here';
```

响应示例：
```json
{
  "success": true,
  "file": {
    "id": "uuid",
    "file_name": "report.pdf",
    "processed": true,
    "processing_status": "completed",
    "indexed_at": "2025-01-16T10:30:00Z",
    "summary": "这是一份年度财务报告...",
    "chunk_count": 42
  }
}
```

### 查看向量索引质量

```sql
-- 查看某个文件的 chunks
SELECT
  chunk_index,
  LENGTH(chunk_text) as text_length,
  metadata
FROM file_chunks
WHERE file_extraction_id = 'uuid'
ORDER BY chunk_index;

-- 查看对话的附件
SELECT
  ca.conversation_id,
  ca.file_extraction_id,
  fe.file_name,
  ca.attached_at
FROM conversation_attachments ca
JOIN file_extractions fe ON ca.file_extraction_id = fe.id
WHERE ca.conversation_id = 'conv-uuid'
ORDER BY ca.attached_at ASC;

-- 查看未处理的文件
SELECT file_name, file_size, processing_status, processing_error
FROM file_extractions
WHERE should_index = TRUE AND processed = FALSE;

-- 统计索引情况
SELECT
  COUNT(*) as total_files,
  COUNT(*) FILTER (WHERE processed = TRUE) as indexed_files,
  SUM(chunk_count) as total_chunks
FROM v_file_processing_status;
```

### 调试常见问题

#### 问题 1: LLM 不调用 rag_search

**症状**: Agent 不调用 tool，直接回答

**可能原因**:
1. Tool 描述不够清晰
2. 用户消息已经包含文档内容
3. LLM 不认为需要搜索

**解决方案**:
```typescript
// 1. 检查 logs 中是否有附件提示
[Preprocess] hasAttachmentHint: true

// 2. 检查 Agent 是否收到工具列表
[Agent] availableTools: ['rag_search', ...]

// 3. 改进 system prompt，强调使用 RAG
"[系统提示] 当前对话中有 1 个上传的文档。
 你可以使用 "rag_search" 工具来搜索这些文档的内容。
 当用户询问文档相关问题时，必须优先使用 rag_search 工具！"
```

#### 问题 2: rag_search 返回 0 条结果

**症状**: `resultCount: 0`

**可能原因**:
- 相似度阈值太高
- 查询关键词与文档内容不匹配
- 文档尚未完成索引

**解决方案**:
```typescript
// 1. 降低阈值
rag_search({
  query: "关键词",
  threshold: 0.5  // 降低到 0.5
})

// 2. 调整查询关键词
// ❌ "那个事" (太模糊)
// ✅ "财务预算" (具体关键词)

// 3. 检查文档是否已索引
SELECT processed, chunk_count
FROM file_extractions
WHERE id = 'uuid';
```

#### 问题 3: 搜索结果不相关

**症状**: 返回了结果，但 similarity 很低 (< 0.6)

**解决方案**:
```typescript
// 1. 使用多个关键词
rag_search({
  query: "团队 管理 协作 问题",  // 多个关键词
  maxResults: 10
})

// 2. 分步搜索
// 第一次: 宏观搜索
rag_search({ query: "团队管理" })

// 第二次: 具体搜索
rag_search({ query: "部门协作 组织架构" })
```

---

## 成本估算

### Embedding API 成本（使用 OpenRouter）

使用 `openai/text-embedding-3-small`：

- **价格**：$0.02 / 1M tokens
- **文档**：80KB ≈ 20,000 tokens ≈ 30 个 chunks (600 tokens)
- **单次处理成本**：20,000 tokens × $0.02 / 1M = **$0.0004** (不到半美分)
- **查询成本**：1 个查询 embedding ≈ 50 tokens ≈ **$0.000001**

**结论**：成本非常低，几乎可以忽略不计。

### RAG Tool 调用成本

```typescript
// 每次调用 rag_search 的成本
- 查询 embedding: ~$0.000001
- 数据库查询: ~$0.00001 (计算成本)
- 总计: ~$0.00001/次

// 即使调用 100 次
$0.00001 × 100 = $0.001 (1/10 美分)
```

### 存储成本

每个 chunk 存储：
- 文本：~2KB
- 向量 (1024维 × 4字节)：~4KB
- 元数据：~1KB
- **总计**：~7KB/chunk

80KB 文档 → 30 chunks → **~210KB** 存储空间

---

## 故障排查

### 问题 1：RAG Tool 返回错误

**错误信息**：
```
Error: RAG feature is disabled
```

**解决方案**：
```env
# 检查 .env.local
RAG_ENABLED=true

# 或检查代码配置
// src/lib/rag/config.ts
features: {
  enableRAG: true
}
```

### 问题 2：数据库查询失败

**错误信息**：
```
Error: Database not available
```

**解决方案**：
```typescript
// 检查数据库连接
// src/lib/db.ts
export const pool = new Pool({
  // ... 确认配置正确
})

// 检查 conversation_attachments 表是否存在
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'conversation_attachments';
```

### 问题 3：pgvector 扩展未安装

**错误信息**：
```
type "vector" does not exist
```

**解决方案**：
```sql
-- 检查 pgvector 是否安装
SELECT extversion FROM pg_extension WHERE extname = 'vector';

-- 如果没有，安装
CREATE EXTENSION IF NOT EXISTS vector;
```

### 问题 4：OpenRouter API 失败

**错误信息**：
```
OpenRouter API key is invalid or missing
```

**解决方案**：
```env
# 检查 .env.local
OPENROUTER_API_KEY=sk-or-...

# 确认密钥格式（OpenRouter 密钥以 sk-or- 开头）
```

---

## 下一步优化方向

### 1. 高级功能（可选）

- **查询优化**：自动将用户问题转换为更好的搜索查询
  - 关键词提取
  - 同义词扩展
  - 多轮查询策略
- **重排序（Reranking）**：用更强的模型对检索结果重排序
- **查询扩展**：自动生成多个查询变体提高召回率
- **多模态 RAG**：支持图片的语义检索

### 2. 性能优化

- **批量查询**：一次调用中搜索多个话题
- **结果缓存**：缓存相似查询的结果
- **并行搜索**：同时搜索多个附件

### 3. 用户体验

- **可视化**：前端显示 RAG 调用状态和结果
- **引用链接**：点击 AI 回答中的引用跳转到文档位置
- **搜索历史**：显示之前的 RAG 搜索记录

---

## 技术栈总结

- **向量数据库**：pgvector (PostgreSQL 扩展)
- **Embedding 模型**：OpenAI text-embedding-3-small (via OpenRouter)
- **分块策略**：600 tokens，100 tokens 重叠
- **相似度算法**：余弦相似度 (cosine similarity)
- **检索策略**：Tool 模式，LLM 决定何时调用
- **Agent 框架**：LangGraph with Tool Calling

---

## 需要帮助？

如果遇到问题，请检查：
1. 数据库迁移是否成功运行
2. pgvector 扩展是否已安装
3. 环境变量是否正确配置
4. OpenRouter API 密钥是否有效
5. 查看日志获取更多调试信息

查看日志获取更多调试信息。
