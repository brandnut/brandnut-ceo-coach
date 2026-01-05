# Agent Chat API Documentation

Version: 1.0
Last Updated: 2026-01-05

---

## Overview

LangGraph-based chat service with OpenRouter + Claude 4.5 Sonnet.

**Key Features**:
- ✅ SSE streaming responses
- ✅ Multimodal support (images, PDFs)
- ✅ Automatic conversation management
- ✅ Message history consistency
- ✅ All historical attachments preserved

**Base URL**: `/api/agent`

**Authentication**: Required for all endpoints
Header: `Authorization: Bearer <access_token>`

---

## Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/agent/chat` | Send message, receive SSE stream |
| GET | `/agent/conversations` | List user's conversations |
| GET | `/agent/conversations/:id/messages` | Get conversation messages |
| POST | `/upload` | Upload files (images/PDFs) |

---

## 1. Chat Endpoint

### `POST /api/agent/chat`

Send a message and receive streaming response via Server-Sent Events (SSE).

#### Request Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

#### Request Body

```typescript
{
  message: string                 // Required. User message text
  conversationId?: string         // Optional. Omit for new conversation
  attachments?: Array<{
    type: 'image' | 'pdf'         // Required. File type
    url: string                    // Required. File URL (public or local)
    mimeType: string               // Required. MIME type
    name: string                   // Required. Display name
  }>
}
```

#### Request Validation

| Field | Rules | Error Response |
|-------|-------|----------------|
| `message` | Non-empty string | 400: "message is required" |
| `conversationId` | Valid UUID or undefined | 404: "Conversation not found" |
| `conversationId` | Must belong to authenticated user | 404: "Conversation not found" |
| `attachments[].type` | Must be 'image' or 'pdf' | N/A (ignored silently) |
| `attachments[].url` | Valid URL string | N/A (processed by LLM) |

#### Response: Server-Sent Events (SSE)

**Headers**:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Event Types**:

##### 1. `conversation` Event

Sent **only for new conversations** (when `conversationId` is not provided).

```
event: conversation
data: {"type":"conversation","conversationId":"<uuid>"}
```

**When it's sent**:
- ✅ First message in a new conversation
- ❌ Continuing an existing conversation

**Frontend action**: Store `conversationId` for subsequent messages.

##### 2. `delta` Event

Sent for each text chunk during streaming.

```
event: delta
data: {"type":"delta","text":"<chunk>"}
```

**Characteristics**:
- Multiple events per response
- Chunks may be partial words or sentences
- Accumulate all chunks to build full response

##### 3. `done` Event

Sent once at the end of streaming.

```
event: done
data: {
  "type": "done",
  "message": {
    "id": "<uuid>",
    "conversationId": "<uuid>",
    "role": "assistant",
    "content": "<full_response>",
    "attachments": [],
    "createdAt": "<ISO8601>"
  }
}
```

**Key property**: The `message` object matches the format returned by the message history API (GET `/conversations/:id/messages`).

**Frontend action**:
- Replace accumulated delta text with `message.content`
- Store `message.id` and `message.createdAt` for consistency

##### 4. `error` Event

Sent when an error occurs during streaming.

```
event: error
data: {"type":"error","error":"<error_message>"}
```

**When it's sent**:
- LLM API errors (rate limit, timeout, etc.)
- Database write failures
- File processing errors

**Frontend action**: Display error message, stop streaming UI.

#### Edge Cases

##### Case 1: Empty Message

**Request**:
```json
{"message": ""}
```

**Response**: `400 Bad Request`
```json
{"error": "Invalid request", "message": "message is required"}
```

##### Case 2: Invalid Conversation ID

**Request**:
```json
{"message": "Hello", "conversationId": "invalid-uuid"}
```

**Response**: `404 Not Found`
```json
{"error": "Not found", "message": "Conversation not found"}
```

##### Case 3: Conversation Belongs to Another User

**Request**:
```json
{"message": "Hello", "conversationId": "<other_user_conversation_id>"}
```

**Response**: `404 Not Found`
```json
{"error": "Not found", "message": "Conversation not found"}
```

**Rationale**: Security through obscurity. Don't reveal if conversation exists.

##### Case 4: Attachment URL Inaccessible

**Request**:
```json
{
  "message": "Describe this",
  "attachments": [{"type": "image", "url": "https://broken-link.com/image.jpg", ...}]
}
```

**Response**: SSE stream with `error` event
```
event: error
data: {"type":"error","error":"Failed to process image"}
```

**Behavior**: OpenRouter/Claude will fail to fetch the image. Error propagates to frontend.

##### Case 5: Client Disconnects Mid-Stream

**Scenario**: User closes browser or navigates away while streaming.

**Backend behavior**:
- User message: ✅ Already saved to DB
- AI response: ✅ **Partial response saved to DB** (up to point of abort)
- `done` event: ❌ Not sent (controller already closed)

**Implementation**:
- Uses `try-finally` block to ensure partial responses are persisted
- Detects controller closure via `ERR_INVALID_STATE` error
- Sets `wasAborted` flag to prevent sending `done` event to closed controller

**Implications**:
- Next message in same conversation **will** include partial AI response in history
- User will see their message and partial AI response (no indication it was incomplete)
- This is **by design** to preserve all generated content

**Frontend handling**:
- Incomplete responses will not have a `done` event
- Frontend should mark messages without `done` event as "interrupted" or "incomplete"
- Consider showing UI indicator (e.g., "Response interrupted")

##### Case 6: Extremely Long Message

**Request**:
```json
{"message": "<10,000 character string>"}
```

**Behavior**:
- ✅ Request accepted (no length limit enforced by API)
- ⚠️ May exceed LLM context window
- ⚠️ Higher latency and cost

**Best Practice**: Frontend should impose reasonable limits (e.g., 4000 characters).

##### Case 7: Attachment Without Message

**Request**:
```json
{
  "message": "",
  "attachments": [{"type": "image", "url": "...", ...}]
}
```

**Response**: `400 Bad Request`
```json
{"error": "Invalid request", "message": "message is required"}
```

**Rationale**: Message text is required even with attachments.

##### Case 8: Multiple Attachments

**Request**:
```json
{
  "message": "Compare these",
  "attachments": [
    {"type": "image", "url": "image1.jpg", ...},
    {"type": "image", "url": "image2.jpg", ...},
    {"type": "pdf", "url": "doc.pdf", ...}
  ]
}
```

**Behavior**:
- ✅ All attachments sent to LLM in a single request
- ✅ Stored in DB as JSONB array
- ⚠️ Cost increases with number of attachments

**Limit**: No hard limit enforced, but recommend ≤ 5 attachments per message.

#### Complete Example

**Request**:
```bash
curl -N -X POST https://api.example.com/api/agent/chat \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is in this image?",
    "attachments": [{
      "type": "image",
      "url": "https://example.com/dice.png",
      "mimeType": "image/png",
      "name": "dice.png"
    }]
  }'
```

**Response** (SSE stream):
```
event: conversation
data: {"type":"conversation","conversationId":"abc-123"}

event: delta
data: {"type":"delta","text":"This image"}

event: delta
data: {"type":"delta","text":" shows four"}

event: delta
data: {"type":"delta","text":" colorful dice."}

event: done
data: {"type":"done","message":{"id":"msg-456","conversationId":"abc-123","role":"assistant","content":"This image shows four colorful dice.","attachments":[],"createdAt":"2026-01-05T08:00:00.000Z"}}
```

---

## 2. List Conversations

### `GET /api/agent/conversations`

Retrieve a paginated list of user's conversations, sorted by most recently updated.

#### Request Headers

```
Authorization: Bearer <access_token>
```

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | No | 20 | Number of conversations to return |
| `offset` | integer | No | 0 | Number of conversations to skip |

**Constraints**:
- `limit`: Min 1, Max 100
- `offset`: Min 0

#### Response: 200 OK

```typescript
{
  conversations: Array<{
    id: string                    // UUID
    userId: string                // UUID
    title: string | null          // Auto-generated or user-set
    createdAt: string             // ISO8601 timestamp
    updatedAt: string             // ISO8601 timestamp (last message time)
  }>,
  total: number                   // Total conversation count (for pagination)
}
```

**Sorting**: By `updatedAt` DESC (most recent first).

#### Edge Cases

##### Case 1: User Has No Conversations

**Response**: `200 OK`
```json
{
  "conversations": [],
  "total": 0
}
```

##### Case 2: Offset Exceeds Total

**Request**: `?offset=1000` (user has 10 conversations)

**Response**: `200 OK`
```json
{
  "conversations": [],
  "total": 10
}
```

##### Case 3: Invalid Query Parameters

**Request**: `?limit=-5`

**Response**: `200 OK` (treated as default)
```json
{
  "conversations": [...],
  "total": <count>
}
```

**Rationale**: Be lenient with invalid params, use defaults.

#### Complete Example

**Request**:
```bash
curl https://api.example.com/api/agent/conversations?limit=5&offset=0 \
  -H "Authorization: Bearer eyJhbGc..."
```

**Response**:
```json
{
  "conversations": [
    {
      "id": "abc-123",
      "userId": "user-456",
      "title": null,
      "createdAt": "2026-01-05T07:00:00.000Z",
      "updatedAt": "2026-01-05T07:30:00.000Z"
    },
    {
      "id": "def-789",
      "userId": "user-456",
      "title": null,
      "createdAt": "2026-01-04T10:00:00.000Z",
      "updatedAt": "2026-01-04T10:15:00.000Z"
    }
  ],
  "total": 2
}
```

---

## 3. Get Conversation Messages

### `GET /api/agent/conversations/:id/messages`

Retrieve all messages in a conversation, including user messages and AI responses.

#### Request Headers

```
Authorization: Bearer <access_token>
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Conversation UUID |

#### Response: 200 OK

```typescript
{
  conversation: {
    id: string                    // UUID
    userId: string                // UUID
    title: string | null
    createdAt: string             // ISO8601
    updatedAt: string             // ISO8601
  },
  messages: Array<{
    id: string                    // UUID
    conversationId: string        // UUID
    role: 'user' | 'assistant' | 'system'
    content: string               // Message text
    attachments: Array<{
      type: 'image' | 'pdf'
      url: string
      mimeType: string
      name: string
    }>
    createdAt: string             // ISO8601
  }>
}
```

**Sorting**: Messages sorted by `createdAt` ASC (chronological order).

**Key property**: Message format matches the `done` event from SSE streaming.

#### Edge Cases

##### Case 1: Conversation Not Found

**Response**: `404 Not Found`
```json
{
  "error": "Not found",
  "message": "Conversation not found"
}
```

##### Case 2: Conversation Belongs to Another User

**Response**: `404 Not Found`
```json
{
  "error": "Not found",
  "message": "Conversation not found"
}
```

**Rationale**: Same as chat endpoint - don't reveal existence.

##### Case 3: Conversation Exists But Has No Messages

**Scenario**: Conversation created but no messages yet (should not happen in normal flow, but possible if user message save fails).

**Response**: `200 OK`
```json
{
  "conversation": {...},
  "messages": []
}
```

##### Case 4: Very Long Conversation

**Scenario**: Conversation with 1000+ messages.

**Current behavior**:
- ✅ All messages returned (no pagination)
- ⚠️ Large response payload (could be 10+ MB)

**Recommendation**: Implement pagination in future version if conversations exceed 100 messages.

#### Complete Example

**Request**:
```bash
curl https://api.example.com/api/agent/conversations/abc-123/messages \
  -H "Authorization: Bearer eyJhbGc..."
```

**Response**:
```json
{
  "conversation": {
    "id": "abc-123",
    "userId": "user-456",
    "title": null,
    "createdAt": "2026-01-05T07:00:00.000Z",
    "updatedAt": "2026-01-05T07:30:00.000Z"
  },
  "messages": [
    {
      "id": "msg-001",
      "conversationId": "abc-123",
      "role": "user",
      "content": "Hello!",
      "attachments": [],
      "createdAt": "2026-01-05T07:00:00.000Z"
    },
    {
      "id": "msg-002",
      "conversationId": "abc-123",
      "role": "assistant",
      "content": "Hello there!",
      "attachments": [],
      "createdAt": "2026-01-05T07:00:05.000Z"
    },
    {
      "id": "msg-003",
      "conversationId": "abc-123",
      "role": "user",
      "content": "Describe this image.",
      "attachments": [
        {
          "type": "image",
          "url": "/uploads/dice.png",
          "mimeType": "image/png",
          "name": "dice.png"
        }
      ],
      "createdAt": "2026-01-05T07:30:00.000Z"
    },
    {
      "id": "msg-004",
      "conversationId": "abc-123",
      "role": "assistant",
      "content": "This image shows four colorful dice.",
      "attachments": [],
      "createdAt": "2026-01-05T07:30:20.000Z"
    }
  ]
}
```

---

## 4. File Upload

### `POST /api/upload`

Upload an image or PDF file. Returns a URL that can be used in chat attachments.

#### Request Headers

```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

#### Request Body

```
Form field: "file"
Type: File (binary)
```

#### Request Validation

| Constraint | Limit | Error Response |
|------------|-------|----------------|
| File required | - | 400: "No file provided" |
| File type | image/png, image/jpeg, image/jpg, image/webp, image/gif, application/pdf | 400: "Invalid file type" |
| File size | Max 10 MB | 400: "File too large" |

#### Response: 200 OK

```typescript
{
  success: true,
  file: {
    url: string                   // Relative URL: "/ceo/uploads/<filename>"
    name: string                  // Original filename
    type: string                  // MIME type
    size: number                  // File size in bytes
  }
}
```

**File naming**: `<timestamp>-<random>.<extension>`
Example: `1767599954144-n1s3ej.pdf`

**Storage location**: `public/uploads/` (served by Next.js)

#### Edge Cases

##### Case 1: No File Provided

**Response**: `400 Bad Request`
```json
{
  "error": "No file provided"
}
```

##### Case 2: Unsupported File Type

**Request**: Upload `.txt` file

**Response**: `400 Bad Request`
```json
{
  "error": "Invalid file type",
  "message": "Allowed types: image/png, image/jpeg, image/jpg, image/webp, image/gif, application/pdf"
}
```

##### Case 3: File Too Large

**Request**: Upload 15 MB file

**Response**: `400 Bad Request`
```json
{
  "error": "File too large",
  "message": "Max file size: 10MB"
}
```

##### Case 4: Disk Write Failure

**Scenario**: Server disk full or permission issues.

**Response**: `500 Internal Server Error`
```json
{
  "error": "Upload failed",
  "message": "<system_error>"
}
```

##### Case 5: Duplicate Filename

**Scenario**: Two users upload files at same millisecond.

**Behavior**: Random suffix ensures uniqueness (`<timestamp>-<random>`).

**Probability of collision**: ~1 in 1 million with 6-char random suffix.

##### Case 6: Malicious Filename

**Request**: File with name `../../etc/passwd.jpg`

**Behavior**:
- ✅ Original filename stored in DB (`../../etc/passwd.jpg`)
- ✅ Saved with safe generated name (`1234567-abc123.jpg`)
- ✅ Path traversal prevented by `path.join()`

#### Complete Example

**Request**:
```bash
curl -X POST https://api.example.com/api/upload \
  -H "Authorization: Bearer eyJhbGc..." \
  -F "file=@/path/to/image.png"
```

**Response**:
```json
{
  "success": true,
  "file": {
    "url": "/ceo/uploads/1767599954144-n1s3ej.png",
    "name": "image.png",
    "type": "image/png",
    "size": 524288
  }
}
```

**Usage in chat**:
```json
{
  "message": "Describe this image",
  "attachments": [{
    "type": "image",
    "url": "http://localhost:3000/ceo/uploads/1767599954144-n1s3ej.png",
    "mimeType": "image/png",
    "name": "image.png"
  }]
}
```

---

## Authentication

All endpoints require a valid JWT access token.

### Request Header

```
Authorization: Bearer <access_token>
```

### Token Validation

- Token must be valid (signature verified)
- Token type must be `access` (not `refresh`)
- User account must be active (`is_active = true`)
- Token must not be expired

### Error Responses

#### 401 Unauthorized - Invalid Token

```json
{
  "error": "Unauthorized",
  "message": "Valid authentication token required",
  "code": "INVALID_TOKEN"
}
```

**Causes**:
- Missing `Authorization` header
- Malformed token
- Invalid signature
- Wrong token type (e.g., refresh token)

#### 401 Unauthorized - Expired Token

```json
{
  "error": "Unauthorized",
  "message": "Token has expired",
  "code": "TOKEN_EXPIRED"
}
```

**Frontend action**: Refresh token or redirect to login.

#### 403 Forbidden - Inactive Account

```json
{
  "error": "Forbidden",
  "message": "Account is not active",
  "code": "ACCOUNT_INACTIVE"
}
```

**Causes**:
- User account deactivated
- User banned

---

## Error Handling

### Standard Error Response Format

All error responses follow this structure:

```typescript
{
  error: string                   // Error category
  message: string                 // Human-readable description
  code?: string                   // Machine-readable code (auth errors only)
}
```

### HTTP Status Codes

| Status | Meaning | When It's Used |
|--------|---------|----------------|
| 200 | OK | Successful request |
| 400 | Bad Request | Invalid request body/params |
| 401 | Unauthorized | Missing or invalid auth token |
| 403 | Forbidden | Valid token but insufficient permissions |
| 404 | Not Found | Resource not found or not accessible |
| 500 | Internal Server Error | Unexpected server error |

### Error Categories

#### Client Errors (4xx)

**Responsibility**: Frontend/client issue

**Action**: Display error message, fix request, or redirect user.

#### Server Errors (5xx)

**Responsibility**: Backend/infrastructure issue

**Action**: Retry request (with exponential backoff) or show generic error message.

---

## Rate Limiting

**Current Status**: Not implemented.

**Recommended Limits** (future):
- Chat endpoint: 60 requests/minute per user
- Upload endpoint: 20 requests/minute per user
- List/get endpoints: 120 requests/minute per user

**Headers** (when implemented):
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1609459200
```

---

## Multimodal Behavior

### Attachment Handling in Multi-Turn Conversations

**Key principle**: All historical messages carry their attachments.

#### Example Scenario

```
Turn 1:
User: "Describe this image" + [dice.png]
AI: "Four colorful dice"

Turn 2:
User: "What colors are they?"
AI: "Red, blue, green, yellow"
```

**LLM receives** (Turn 2):
```json
[
  {
    "role": "user",
    "content": [
      {"type": "text", "text": "Describe this image"},
      {"type": "image_url", "image_url": {"url": "dice.png"}}
    ]
  },
  {
    "role": "assistant",
    "content": "Four colorful dice"
  },
  {
    "role": "user",
    "content": "What colors are they?"
  }
]
```

**Note**: Image from Turn 1 is re-sent in Turn 2.

### Cost Implications

**Images**: Charged per image per request
**PDFs**: Charged per page per request

**Example**:
- Turn 1 with 1 image: ~$0.01
- Turn 2 (same conversation): ~$0.01 (image re-sent)
- 10-turn conversation: ~$0.10

**Optimization** (future): Implement OpenRouter prompt caching to reduce costs by 90% for repeated content.

---

## Data Models

### Conversation

```typescript
interface Conversation {
  id: string                      // UUID (primary key)
  userId: string                  // UUID (foreign key to users)
  title: string | null            // Display name
  createdAt: string               // ISO8601
  updatedAt: string               // ISO8601 (auto-updated on new message)
}
```

### Message

```typescript
interface Message {
  id: string                      // UUID (primary key)
  conversationId: string          // UUID (foreign key to conversations)
  role: 'user' | 'assistant' | 'system'
  content: string                 // Message text
  attachments: Attachment[]       // JSONB array
  createdAt: string               // ISO8601
}
```

### Attachment

```typescript
interface Attachment {
  type: 'image' | 'pdf'           // File type
  url: string                     // File URL
  mimeType: string                // MIME type
  name: string                    // Display name
}
```

---

## Frontend Integration Guide

### 1. Starting a New Conversation

```typescript
// No prep needed, just send the first message
const response = await fetch('/api/agent/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "Hello!"
    // No conversationId
  })
})

// Handle SSE
const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const text = decoder.decode(value)

  // Parse events
  if (text.includes('event: conversation')) {
    const data = JSON.parse(text.split('data: ')[1])
    saveConversationId(data.conversationId)  // Store for next message
  }

  if (text.includes('event: delta')) {
    const data = JSON.parse(text.split('data: ')[1])
    appendToUI(data.text)
  }

  if (text.includes('event: done')) {
    const data = JSON.parse(text.split('data: ')[1])
    replaceWithFinalMessage(data.message)
  }
}
```

### 2. Continuing a Conversation

```typescript
// Same as above, but include conversationId
body: JSON.stringify({
  message: "Tell me more",
  conversationId: savedConversationId  // From first message
})
```

### 3. Loading Message History

```typescript
const response = await fetch(`/api/agent/conversations/${conversationId}/messages`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

const { conversation, messages } = await response.json()

// Render messages
messages.forEach(msg => {
  renderMessage(msg)  // Format matches SSE 'done' event
})
```

### 4. Uploading Files

```typescript
// Step 1: Upload file
const formData = new FormData()
formData.append('file', fileInput.files[0])

const uploadRes = await fetch('/api/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
})

const { file } = await uploadRes.json()

// Step 2: Send message with attachment
await fetch('/api/agent/chat', {
  method: 'POST',
  body: JSON.stringify({
    message: "Analyze this",
    conversationId: savedConversationId,
    attachments: [{
      type: file.type.startsWith('image') ? 'image' : 'pdf',
      url: `${window.location.origin}${file.url}`,  // Convert to absolute URL
      mimeType: file.type,
      name: file.name
    }]
  })
})
```

---

## Testing

### Manual Testing with cURL

#### Test 1: New Conversation

```bash
curl -N -X POST http://localhost:3000/api/agent/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

#### Test 2: Continue Conversation

```bash
curl -N -X POST http://localhost:3000/api/agent/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Continue", "conversationId": "abc-123"}'
```

#### Test 3: Upload File

```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@image.png"
```

#### Test 4: Multimodal Chat

```bash
curl -N -X POST http://localhost:3000/api/agent/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Describe this",
    "attachments": [{
      "type": "image",
      "url": "https://example.com/image.png",
      "mimeType": "image/png",
      "name": "image.png"
    }]
  }'
```

---

## Changelog

### Version 1.0 (2026-01-05)

**Initial release**:
- ✅ SSE streaming chat
- ✅ Multimodal support (images, PDFs)
- ✅ Automatic conversation management
- ✅ Message history API
- ✅ File upload API
- ✅ All historical attachments preserved in multi-turn conversations

---

## Known Limitations

1. **No pagination for message history**: All messages returned in single response. May cause performance issues for conversations with 500+ messages.

2. **No conversation title auto-generation**: `title` field is always `null`. Future version should auto-generate from first message.

3. **No file cleanup**: Uploaded files stored indefinitely. Recommend implementing cleanup job for old files (e.g., delete after 30 days).

4. **No rate limiting**: API vulnerable to abuse. Recommend implementing per-user rate limits.

5. **Local file storage**: Files stored in `public/uploads/`. For production, migrate to object storage (S3, Aliyun OSS, etc.).

6. **No prompt caching**: Historical attachments re-sent on every request, increasing costs. Implement OpenRouter prompt caching for 90% cost reduction.

7. **No image optimization**: Large images sent as-is. Consider resizing/compressing before sending to LLM.

---

## Security Considerations

### Authentication

- ✅ All endpoints require valid JWT
- ✅ Conversation access checked (user can only access own conversations)
- ✅ File uploads restricted to authenticated users

### File Upload

- ✅ File type validation (whitelist)
- ✅ File size limit (10 MB)
- ✅ Path traversal protection (generated filenames)
- ⚠️ No virus scanning
- ⚠️ No image content validation (could upload malicious SVG)

### Data Privacy

- ✅ Messages stored in PostgreSQL (encrypted at rest if configured)
- ⚠️ Attachments sent to OpenRouter (third-party service)
- ⚠️ No data retention policy

### Recommendations

1. Implement virus scanning for uploaded files
2. Add Content-Security-Policy headers for uploaded files
3. Implement data retention policy (auto-delete old conversations)
4. Add audit logging for sensitive operations
5. Encrypt attachment URLs in database

---

## Support

For issues or questions:
- GitHub: [repository URL]
- Email: [support email]

---

**Last Updated**: 2026-01-05
**Version**: 1.0
**Status**: Production Ready
