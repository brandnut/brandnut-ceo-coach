# 飞书集成系统数据库表结构

*生成时间: 2025-12-14*

## feishu_apps

### 基本信息

- **表名**: `feishu_apps`
- **主键**: `id`
- **字段数量**: 13
- **索引数量**: 6

### 字段详情

| 字段名 | 数据类型 | 长度 | 可空 | 默认值 |
|--------|----------|------|------|--------|
| `id` | uuid | - | 否 | gen_random_uuid() |
| `name` | character varying(100) | 100 | 否 | - |
| `app_id` | character varying(100) | 100 | 否 | - |
| `app_secret` | character varying(255) | 255 | 否 | - |
| `is_active` | boolean | - | 是 | true |
| `status` | character varying(20) | 20 | 是 | 'active'::character varying |
| `encrypt_key` | character varying(255) | 255 | 是 | - |
| `verification_token` | character varying(255) | 255 | 是 | - |
| `event_callback_url` | character varying(500) | 500 | 是 | - |
| `description` | text | - | 是 | - |
| `created_at` | timestamp with time zone | - | 是 | CURRENT_TIMESTAMP |
| `updated_at` | timestamp with time zone | - | 是 | CURRENT_TIMESTAMP |
| `last_sync_at` | timestamp with time zone | - | 是 | - |

### 索引信息

**feishu_apps_app_id_key**
```sql
CREATE UNIQUE INDEX feishu_apps_app_id_key ON public.feishu_apps USING btree (app_id)
```

**feishu_apps_pkey**
```sql
CREATE UNIQUE INDEX feishu_apps_pkey ON public.feishu_apps USING btree (id)
```

**idx_feishu_apps_app_id**
```sql
CREATE INDEX idx_feishu_apps_app_id ON public.feishu_apps USING btree (app_id)
```

**idx_feishu_apps_created_at**
```sql
CREATE INDEX idx_feishu_apps_created_at ON public.feishu_apps USING btree (created_at)
```

**idx_feishu_apps_is_active**
```sql
CREATE INDEX idx_feishu_apps_is_active ON public.feishu_apps USING btree (is_active)
```

**idx_feishu_apps_status**
```sql
CREATE INDEX idx_feishu_apps_status ON public.feishu_apps USING btree (status)
```

### 检查约束

**feishu_apps_status_check**
- 约束: `((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'error'::character varying])::text[]))`

**2200_20833_1_not_null**
- 约束: `id IS NOT NULL`

**2200_20833_2_not_null**
- 约束: `name IS NOT NULL`

**2200_20833_3_not_null**
- 约束: `app_id IS NOT NULL`

**2200_20833_4_not_null**
- 约束: `app_secret IS NOT NULL`

---

## feishu_user_tokens

### 基本信息

- **表名**: `feishu_user_tokens`
- **主键**: `id`
- **字段数量**: 21
- **索引数量**: 9

### 字段详情

| 字段名 | 数据类型 | 长度 | 可空 | 默认值 |
|--------|----------|------|------|--------|
| `id` | uuid | - | 否 | gen_random_uuid() |
| `user_id` | character varying | - | 否 | - |
| `user_access_token` | text | - | 是 | - |
| `user_access_token_expires_at` | timestamp with time zone | - | 是 | - |
| `refresh_token` | text | - | 是 | - |
| `refresh_token_expires_at` | timestamp with time zone | - | 是 | - |
| `tenant_access_token` | text | - | 是 | - |
| `tenant_access_token_expires_at` | timestamp with time zone | - | 是 | - |
| `is_active` | boolean | - | 是 | true |
| `feishu_user_id` | character varying(100) | 100 | 是 | - |
| `feishu_union_id` | character varying(100) | 100 | 是 | - |
| `feishu_open_id` | character varying(100) | 100 | 是 | - |
| `scopes` | text | - | 是 | - |
| `metadata` | text | - | 是 | - |
| `created_at` | timestamp with time zone | - | 是 | CURRENT_TIMESTAMP |
| `updated_at` | timestamp with time zone | - | 是 | CURRENT_TIMESTAMP |
| `last_used_at` | timestamp with time zone | - | 是 | - |
| `last_refresh_at` | timestamp with time zone | - | 是 | - |
| `refresh_failure_count` | integer | - | 是 | 0 |
| `auto_refresh_enabled` | boolean | - | 是 | true |
| `refresh_interval_minutes` | integer | - | 是 | 60 |

### 外键约束

| 字段名 | 引用表 | 引用字段 |
|--------|--------|----------|
| `user_id` | `users` | `id` |

### 索引信息

**feishu_user_tokens_pkey**
```sql
CREATE UNIQUE INDEX feishu_user_tokens_pkey ON public.feishu_user_tokens USING btree (id)
```

**idx_feishu_user_tokens_auto_refresh**
```sql
CREATE INDEX idx_feishu_user_tokens_auto_refresh ON public.feishu_user_tokens USING btree (is_active, auto_refresh_enabled, user_access_token_expires_at, refresh_interval_minutes)
```

**idx_feishu_user_tokens_created_at**
```sql
CREATE INDEX idx_feishu_user_tokens_created_at ON public.feishu_user_tokens USING btree (created_at)
```

**idx_feishu_user_tokens_expiration**
```sql
CREATE INDEX idx_feishu_user_tokens_expiration ON public.feishu_user_tokens USING btree (is_active, user_access_token_expires_at, refresh_token_expires_at, tenant_access_token_expires_at)
```

**idx_feishu_user_tokens_feishu_user_id**
```sql
CREATE INDEX idx_feishu_user_tokens_feishu_user_id ON public.feishu_user_tokens USING btree (feishu_user_id)
```

**idx_feishu_user_tokens_is_active**
```sql
CREATE INDEX idx_feishu_user_tokens_is_active ON public.feishu_user_tokens USING btree (is_active)
```

**idx_feishu_user_tokens_last_refresh**
```sql
CREATE INDEX idx_feishu_user_tokens_last_refresh ON public.feishu_user_tokens USING btree (last_refresh_at, refresh_failure_count)
```

**idx_feishu_user_tokens_last_used_at**
```sql
CREATE INDEX idx_feishu_user_tokens_last_used_at ON public.feishu_user_tokens USING btree (last_used_at)
```

**idx_feishu_user_tokens_user_id**
```sql
CREATE INDEX idx_feishu_user_tokens_user_id ON public.feishu_user_tokens USING btree (user_id)
```

### 检查约束

**2200_20867_1_not_null**
- 约束: `id IS NOT NULL`

**2200_20867_2_not_null**
- 约束: `user_id IS NOT NULL`

---

