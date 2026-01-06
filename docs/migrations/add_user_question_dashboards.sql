-- 创建用户个性化问题仪表盘表
CREATE TABLE IF NOT EXISTS user_question_dashboards (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  questions_jsonb JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_generating BOOLEAN DEFAULT false,
  UNIQUE (user_id, organization_id)
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_user_question_dashboards_updated
  ON user_question_dashboards(user_id, updated_at DESC);

-- 添加表注释
COMMENT ON TABLE user_question_dashboards IS '用户个性化问题仪表盘';
COMMENT ON COLUMN user_question_dashboards.questions_jsonb IS '7个分类的问题列表（JSON格式）';
COMMENT ON COLUMN user_question_dashboards.is_generating IS '并发控制标志，防止重复生成';
COMMENT ON COLUMN user_question_dashboards.updated_at IS '最后更新时间，用于判断是否需要刷新（7天）';
