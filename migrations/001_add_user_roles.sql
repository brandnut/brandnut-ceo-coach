-- 添加用户角色字段
-- 这个脚本添加role字段到users表，默认为'user'
-- Never break userspace - 所有现有用户自动变为普通用户

-- 第一步：添加role字段，默认为'user'
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';

-- 第二步：添加约束确保角色值有效
ALTER TABLE users ADD CONSTRAINT valid_role CHECK (role IN ('user', 'admin'));

-- 第三步：为查询性能添加索引（可选但推荐）
CREATE INDEX idx_users_role ON users(role);

-- 验证修改
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'role';