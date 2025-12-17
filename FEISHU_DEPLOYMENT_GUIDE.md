# 🎉 飞书集成功能部署指南

## ✅ 功能开发完成状态

**所有核心功能已实现完成！**

根据 `FEISHU_INTEGRATION_DEV_PLAN.md` 中的开发计划，以下功能已经全部实现：

### 已完成功能清单

1. ✅ **Token管理服务** (`src/lib/feishu-token-service.ts`)
   - 支持用户Token和应用Token的自动刷新
   - 365天服务生命周期管理
   - 失败重试和自动停用机制

2. ✅ **初始化状态接口** (`/api/feishu/init-status`)
   - 动态检查企业和用户授权状态
   - 返回Token过期信息和刷新状态

3. ✅ **OAuth回调处理** (`/api/feishu/callback`)
   - 完整的OAuth 2.0授权码模式
   - 安全的state参数验证
   - Token存储和用户信息获取

4. ✅ **定时任务接口** (`/api/cron/feishu-token-check`)
   - 每小时自动检查和刷新Token
   - 完整的错误处理和日志记录

5. ✅ **前端UI组件** (`src/components/ai-elements/FeishuSwitch.tsx`)
   - 智能显示/隐藏开关
   - 授权对话框和状态展示
   - 实时状态更新

6. ✅ **数据库表结构** (`feishu_tables.sql`)
   - `feishu_apps` 和 `feishu_user_tokens` 表
   - 完整的索引和触发器

---

## 🚀 部署步骤

### 第一步：执行数据库迁移

```bash
# 在PostgreSQL数据库中执行SQL文件
psql -d your_database_name -f feishu_tables.sql
```

或者使用你喜欢的数据库管理工具执行 `feishu_tables.sql` 文件。

### 第二步：配置飞书应用

1. **在飞书开发者后台创建应用**
   - 访问 [飞书开放平台](https://open.feishu.cn/)
   - 创建企业自建应用

2. **配置应用权限**
   - 必须包含 `offline_access` 权限以支持自动刷新
   - 根据需要添加其他权限：
     - `contact:base` - 基础联系人信息
     - `contact:user` - 用户详细信息
     - `email:base` - 邮箱信息
     - `calendar:calendar:readonly` - 日历只读权限

3. **配置回调地址**
   - 重定向URL：`https://your-domain.com/api/feishu/callback`
   - 请将 `your-domain.com` 替换为你的实际域名

### 第三步：插入应用配置

在数据库中插入你的飞书应用配置：

```sql
-- 更新现有的应用配置
UPDATE feishu_apps
SET
    name = '你的应用名称',
    app_id = 'cli_xxxxxxxxxxxxxxxx',  -- 你的飞书App ID
    app_secret = 'xxxxxxxxxxxxxxxxxx', -- 你的飞书App Secret
    is_active = true,
    status = 'active'
WHERE id = (SELECT id FROM feishu_apps LIMIT 1);
```

### 第四步：配置环境变量

在你的 `.env` 文件中添加：

```env
# 飞书集成相关配置
DATABASE_URL=postgresql://username:password@localhost:5432/your_database
CRON_SECRET=your-very-secure-random-string-for-cron-jobs

# NextAuth配置（如果还没有）
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-nextauth-secret
```

### 第五步：设置定时任务

在你的服务器上设置每小时执行的定时任务：

```bash
# 编辑crontab
crontab -e

# 添加以下行（每小时执行一次）
0 * * * * curl "https://your-domain.com/api/cron/feishu-token-check?cron_secret=your-very-secure-random-string-for-cron-jobs"
```

### 第六步：重启应用

```bash
# 重启你的Next.js应用
npm run dev  # 开发环境
# 或
npm run build && npm start  # 生产环境
```

---

## 🔧 功能验证

### 1. 检查应用状态
访问个人资料页面 (`/profile`)，你应该能看到：
- 如果企业未配置：不显示飞书开关
- 如果企业已配置：显示飞书开关，初始状态根据用户授权情况

### 2. 测试授权流程
1. 点击飞书开关到"开启"位置
2. 应该弹出授权对话框
3. 点击"前往授权"跳转到飞书授权页面
4. 完成授权后自动返回应用，开关显示为"开启"状态

### 3. 验证API接口
```bash
# 检查初始化状态（需要先登录）
curl -H "Cookie: your-session-cookie" \
  https://your-domain.com/api/feishu/init-status

# 测试定时任务（需要CRON_SECRET）
curl "https://your-domain.com/api/cron/feishu-token-check?cron_secret=your-cron-secret"
```

---

## 🐛 常见问题排查

### 问题1：TypeScript编译错误
**已解决** - 所有TypeScript错误已修复

### 问题2：飞书开关不显示
- 检查数据库中是否有活跃的飞书应用配置
- 确认用户已登录
- 检查浏览器控制台是否有错误

### 问题3：授权失败
- 确认飞书应用的回调URL配置正确
- 检查App ID和App Secret是否正确
- 确认应用权限配置包含所需权限

### 问题4：Token自动刷新不工作
- 检查定时任务是否正确设置
- 确认 `CRON_SECRET` 环境变量已设置
- 查看服务器日志中的错误信息

---

## 📊 监控和维护

### 日志监控
定时任务会自动记录执行日志，包括：
- 检查的Token数量
- 成功刷新的数量
- 失败和停用的数量
- 详细的错误信息

### 数据库维护
- Token记录会自动清理过期和失效的记录
- 建议定期监控 `feishu_user_tokens` 表的数据量

### 性能优化
- Token刷新使用并发处理，提高效率
- 数据库索引优化查询性能
- 自动停用频繁失败的Token，减少无效请求

---

## 🎯 下一步优化建议

1. **添加管理员界面** - 用于配置飞书应用和管理用户授权
2. **增强错误处理** - 更友好的错误提示和重试机制
3. **监控仪表板** - 实时查看Token状态和系统健康度
4. **批量管理** - 支持批量撤销用户授权
5. **API限流** - 防止飞书API调用频率超限

---

## 🆘 技术支持

如果在部署过程中遇到问题，请：

1. 检查服务器日志中的详细错误信息
2. 确认所有环境变量配置正确
3. 验证数据库连接和表结构
4. 查看飞书开发者后台的应用配置

---

## 🎊 恭喜！

**🎉 你的飞书集成功能已经完全准备就绪！**

所有核心功能已实现，包括：
- ✅ 完整的OAuth 2.0授权流程
- ✅ 自动Token刷新机制
- ✅ 用户友好的界面组件
- ✅ 完善的错误处理和监控
- ✅ 安全的定时任务系统

现在你可以开始享受飞书集成带来的便利了！