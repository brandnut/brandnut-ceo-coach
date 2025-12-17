# 飞书Token管理优化 - 开发文档

## 1. 需求概述

优化飞书集成中的token管理机制，明确区分用户token和应用token，并添加自动刷新功能，确保长期稳定运行。

### 核心目标
- **Token类型区分**: 明确区分`用户Token对` (`user_access_token` + `refresh_token`) 和`应用Token` (`tenant_access_token`)。
- **自动刷新**: 实现token过期前自动刷新，检查频率为1小时。
- **服务生命周期**: 自动刷新服务最长支持365天，之后需用户重新授权。

---

## 2. 核心概念

- **用户Token对**: 代表用户授权，用于调用用户相关的飞书API。
  - `user_access_token`: 有效期7200秒。
  - `refresh_token`: 用于获取新的`user_access_token`。
- **应用Token**: 代表应用权限，用于调用应用级别的飞书API。
  - `tenant_access_token`: 有效期7200秒。
- **自动刷新规则**:
  - **检查频率**: 每1小时执行一次。
  - **刷新触发**: 检查token在1小时内是否会过期。
  - **服务期限**: 从首次授权开始计算，365天后停止自动刷新。

---

## 3. 数据库结构 (当前版本)

### `feishu_apps`

- **用途**: 存储企业级的飞书应用配置信息。

| 字段名 | 数据类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `uuid` | 主键 |
| `name` | `varchar(100)` | 应用名称 |
| `app_id` | `varchar(100)` | 飞书应用的App ID |
| `app_secret` | `varchar(255)` | 飞书应用的App Secret |
| `is_active` | `boolean` | 应用是否激活 |
| `status` | `varchar(20)` | 状态 ('active', 'inactive', 'error') |
| `encrypt_key` | `varchar(255)` | 加密密钥 (可选) |
| `verification_token` | `varchar(255)` | 事件订阅的Verification Token (可选) |
| `event_callback_url` | `varchar(500)` | 事件回调URL (可选) |
| `created_at` | `timestamp` | 创建时间 |
| `updated_at` | `timestamp` | 更新时间 |

### `feishu_user_tokens`

- **用途**: 存储每个用户授权后的飞书Token信息。

| 字段名 | 数据类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `uuid` | 主键 |
| `user_id` | `varchar` | 关联到系统内的用户ID |
| `user_access_token` | `text` | **用户访问令牌** |
| `user_access_token_expires_at` | `timestamp` | **用户访问令牌过期时间** |
| `refresh_token` | `text` | **用户刷新令牌** |
| `refresh_token_expires_at` | `timestamp` | **用户刷新令牌过期时间** |
| `tenant_access_token` | `text` | **应用/租户访问令牌** |
| `tenant_access_token_expires_at` | `timestamp` | **应用/租户访问令牌过期时间** |
| `is_active` | `boolean` | Token是否有效 |
| `feishu_user_id` | `varchar(100)` | 飞书用户ID |
| `feishu_union_id` | `varchar(100)` | 飞书Union ID |
| `feishu_open_id` | `varchar(100)` | 飞书Open ID |
| `scopes` | `text` | 授权范围 |
| `created_at` | `timestamp` | 创建时间 |
| `updated_at` | `timestamp` | 更新时间 |
| `last_refresh_at` | `timestamp` | **最后刷新时间** |
| `refresh_failure_count` | `integer` | **连续刷新失败次数** |
| `auto_refresh_enabled` | `boolean` | **自动刷新开关** |
| `refresh_interval_minutes` | `integer` | **刷新检查间隔 (分钟)** |



---

## 5. 全栈功能实现路径

我们将以功能为驱动，描述从前端交互到后端处理的完整开发流程。

### 步骤 1: 初始化状态检查 (页面加载)

**目标**: 页面加载时，动态决定是否显示飞书功能开关，并确定其初始状态 (开/关)。

1.  **前端 - 组件加载**:
    - **组件**: `src/components/ai-elements/FeishuSwitch.tsx` (待创建)
    - **逻辑**: 组件加载时，立即向后端发起一个 `GET` 请求，获取初始化状态。
    - **API调用**: `GET /api/feishu/init-status`

2.  **后端 - 创建 `init-status` 接口**:
    - **文件**: `src/app/api/feishu/init-status/route.ts` (待创建)
    - **API Contract (Response)**:
        ```typescript
        // 成功
        type InitStatusSuccess = {
          featureEnabled: true;
          userAuthorized: boolean;
          appId: string;
        } | {
          featureEnabled: false;
          userAuthorized: false;
          appId: null;
        };

        // 失败
        type InitStatusError = {
          error: string;
        };

        type InitStatusResponse = InitStatusSuccess | InitStatusError;
        ```
    - **逻辑**:
        a.  **验证用户身份**: 从 `next-auth` session 中获取 `userId`。如果获取不到，返回401 Unauthorized。
        b.  **查询企业配置**: 查询 `feishu_apps` 表，检查当前企业是否已配置并激活了飞书应用。
        c.  **处理企业未配置**: 如果未配置或未激活，直接返回 `{ "featureEnabled": false, "userAuthorized": false, "appId": null }`。
        d.  **查询用户Token**: 如果企业已配置，继续根据 `userId` 查询 `feishu_user_tokens` 表，检查是否存在有效 (未过期) 的 `user_access_token`。
    - **返回值**:
        - **企业已配置，用户已授权**: `200 OK` with `{ "featureEnabled": true, "userAuthorized": true, "appId": "..." }`
        - **企业已配置，用户未授权**: `200 OK` with `{ "featureEnabled": true, "userAuthorized": false, "appId": "..." }`
    - **Error Handling**:
        - **用户未登录**: 返回 `401 Unauthorized` with `{ error: "User not authenticated" }`。
        - **数据库查询失败**: 返回 `500 Internal Server Error` with `{ error: "Database query failed" }`。

3.  **前端 - 渲染UI**:
    - **逻辑**: 根据 `init-status` 接口的返回结果：
        - 如果请求失败或 `featureEnabled` 为 `false`，则**不渲染**开关组件。
        - 如果 `featureEnabled` 为 `true`，则**渲染**开关组件，其初始状态由 `userAuthorized` 的值决定 (true为开, false为关)。
        - 将返回的 `appId` 存储在组件状态中，以备后续使用。

### 步骤 2: 用户授权流程 (开启开关)

**目标**: 当用户首次打开功能开关时，引导其完成飞书授权并返回。此流程严格遵循飞书官方的OAuth 2.0授权码模式。

#### 2.1 前端: 构建授权链接并跳转

- **组件**: `FeishuSwitch.tsx`
- **触发**: 用户点击开关，且开关的当前状态为“关”。
- **逻辑**:
    1.  **阻止UI立即更新**: 阻止开关状态在前端立即变为“开”。
    2.  **生成并存储`state`**:
        -  调用 `crypto.randomUUID()` 或类似方法生成一个高熵的随机字符串作为 `state`。
        -  **安全存储**: 将 `state` 值存入一个 `httpOnly`, `secure`, `sameSite: 'lax'` 的 cookie 中，并设置一个较短的过期时间（如5分钟）。这比 `localStorage` 更安全，可以有效防止CSRF攻击。
    3.  **构建URL**: 使用在**步骤1**中获取的 `appId` 和预先配置的 `redirect_uri` (`/api/feishu/callback`)，动态构建飞书授权URL。
        - **基础URL**: `https://accounts.feishu.cn/open-apis/authen/v1/authorize`
        - **查询参数**:
            - `client_id`: 从 `init-status` 接口获取的 `appId`。
            - `redirect_uri`: 应用中用于接收回调的URL，必须经过URL编码，例如 `encodeURIComponent('https://<your_domain>/api/feishu/callback')`。此URL必须预先在飞书开发者后台配置。
            - `response_type`: 固定值为 `code`。
            - `scope`: 应用所需的权限范围，以空格分隔。**为确保能自动续期，必须包含 `offline_access` 权限**。
            - `state`: 上一步生成的随机字符串。
    4.  **跳转**: 将用户重定向到构建好的授权URL。

#### 2.2 后端: 处理OAuth回调

- **文件**: `src/app/api/feishu/callback/route.ts` (已存在，逻辑按计划更新)
- **API Contract (Request)**:
    - **Method**: `GET`
    - **Query Parameters**:
        ```typescript
        interface CallbackQuery {
          code: string; // 飞书返回的授权码
          state: string; // 前端发送的随机状态值
        }
        ```
- **逻辑**:
    1.  **接收请求**: 从 `request.nextUrl.searchParams` 中解析 `code` 和 `state`。
    2.  **安全校验**:
        - 从请求的 cookie 中读取之前存储的 `state` 值。
        - 比较 cookie 中的 `state` 和查询参数中的 `state` 是否完全一致。
        - **如果不一致，立即中止流程**，返回 `400 Bad Request`，这可能是一次CSRF攻击。
        - 校验成功后，立即删除该 cookie。
    3.  **用授权码换取Token**:
        - **请求目标**: 后端向 `https://open.feishu.cn/open-apis/authen/v2/oauth/token` 发送一个 `POST` 请求。
        - **请求头**: `Content-Type: application/json; charset=utf-8`
        - **请求体 (Body)**:
            ```json
            {
              "grant_type": "authorization_code",
              "client_id": "企业的 app_id (从数据库查询)",
              "client_secret": "企业的 app_secret (从数据库查询)",
              "code": "从回调URL中获取的授权码",
              "redirect_uri": "与2.1中完全相同的回调URL"
            }
            ```
    4.  **处理响应**:
        - 飞书服务器会返回一个包含 `access_token`, `refresh_token`, `expires_in`, `refresh_token_expires_in` 等信息的JSON对象。
    5.  **存储Token**:
        - 计算精确的过期时间戳，例如 `expires_at = NOW() + expires_in * 1000`。
        - 将新的 `access_token`, `refresh_token` 及其过期时间戳存入数据库的 `feishu_user_tokens` 表中，与当前用户关联。
    6.  **重定向用户**: 将用户重定向回应用的主页面或个人资料页。
- **Error Handling**:
    - **State不匹配**: 返回 `400 Bad Request` with `{ error: "Invalid state parameter. CSRF attack suspected." }`。
    - **飞书API错误**: 如果换取Token的请求失败（如`code`无效或过期），记录详细错误日志，并重定向用户到一个错误页面，提示“授权失败，请重试”。
    - **数据库写入失败**: 记录严重错误日志，重定向用户到错误页面，提示“授权信息保存失败，请联系管理员”。

#### 2.3 前端: 完成流程

- **逻辑**: 页面被重定向回来后，`FeishuSwitch` 组件会重新加载，再次执行**步骤1**的初始化逻辑。此时 `init-status` 接口应返回 `userAuthorized: true`，开关会自然显示为“开”状态，流程闭环。

### 步骤 3: 后台自动续期 (定时任务)

**目标**: 系统在后台自动为已授权用户刷新即将过期的Token，无需用户干预。

1.  **后端 - 创建Token检查服务**:
    - **文件**: `src/lib/feishu-token-service.ts` (待创建)
    - **核心函数**: `checkAndRefreshAllTokens()`
    - **逻辑**:
        a.  **查询目标**: 从 `feishu_user_tokens` 表中查询所有满足以下条件的记录：
            - `auto_refresh_enabled = true`
            - `user_access_token_expires_at` < (NOW() + 1 hour)
            - `created_at` > (NOW() - 365 days)
        b.  **并发处理**: 使用 `Promise.allSettled` 或类似机制并发处理所有需要刷新的Token，以提高效率。
        c.  **单个Token刷新逻辑**:
            - 对于每条记录，使用其 `refresh_token` 向飞书 `https://open.feishu.cn/open-apis/authen/v1/refresh_access_token` 接口请求新的 `access_token`。
            - **成功**: 更新数据库中的 `access_token`, `expires_at`, `refresh_token` (如果返回了新的), `last_refresh_at`，并将 `refresh_failure_count` 重置为 0。
            - **失败**:
                - **可恢复错误** (如网络波动、飞书服务器临时错误): 递增 `refresh_failure_count`。
                - **不可恢复错误** (如 `refresh_token` 失效): 将 `auto_refresh_enabled` 设为 `false`，并记录详细错误日志。
        d.  **服务到期处理**: 如果 `created_at` 超过365天，也将 `auto_refresh_enabled` 设为 `false`。
    - **返回值**: 函数应返回一个包含处理结果摘要的对象，例如 `{ totalChecked: number, refreshed: number, failed: number, deactivated: number }`。

2.  **后端 - 创建Cron Job接口**:
    - **文件**: `src/app/api/cron/feishu-token-check/route.ts` (已存在，逻辑按计划更新)
    - **API Contract**:
        - **Method**: `GET`
        - **Query Parameters**: `cron_secret: string`
        - **Response (Success)**: `200 OK` with `{ success: true, message: "Token refresh job completed.", summary: { ... } }`
        - **Response (Error)**: `401 Unauthorized` or `500 Internal Server Error`
    - **逻辑**:
        a.  **安全校验**: 从查询参数中获取 `cron_secret`，并与服务器端存储的环境变量 `CRON_SECRET` 进行比较。如果不匹配，立即返回 `401 Unauthorized`。
        b.  **执行服务**: 调用 `checkAndRefreshAllTokens()` 函数来执行刷新任务。
        c.  **记录与响应**: 记录任务执行结果的摘要，并将其作为响应返回。
    - **Error Handling**:
        - **密钥不匹配**: 返回 `401 Unauthorized` with `{ error: "Invalid cron secret" }`。
        - **服务执行异常**: 如果 `checkAndRefreshAllTokens` 抛出未捕获的异常，返回 `500 Internal Server Error` with `{ error: "An unexpected error occurred during the token refresh process." }`。

3.  **部署 - 配置定时任务**:
    - **方式**: 在服务器环境中使用标准的 `cron` 服务。
    - **命令**: `0 * * * * curl "https://<your_domain>/api/cron/feishu-token-check?cron_secret=<your_secret>"`
    - **说明**: 此命令会每小时触发一次Token检查和刷新流程。
