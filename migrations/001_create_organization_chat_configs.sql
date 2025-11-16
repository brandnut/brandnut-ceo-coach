-- 创建组织聊天配置表
CREATE TABLE IF NOT EXISTS organization_chat_configs (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id VARCHAR(36) NOT NULL,
    chat_api_url VARCHAR(500) NOT NULL,
    chat_api_key VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    CONSTRAINT fk_org_chat_configs_org
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    CONSTRAINT uk_org_chat_configs_org
        UNIQUE(organization_id)
);

-- 创建索引提升查询性能
CREATE INDEX IF NOT EXISTS idx_org_chat_configs_org_id
    ON organization_chat_configs(organization_id);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organization_chat_configs_updated_at
    BEFORE UPDATE ON organization_chat_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE organization_chat_configs IS '组织聊天配置表';
COMMENT ON COLUMN organization_chat_configs.id IS '主键ID';
COMMENT ON COLUMN organization_chat_configs.organization_id IS '组织ID';
COMMENT ON COLUMN organization_chat_configs.chat_api_url IS '聊天API地址';
COMMENT ON COLUMN organization_chat_configs.chat_api_key IS '聊天API密钥';
COMMENT ON COLUMN organization_chat_configs.is_active IS '是否激活';
COMMENT ON COLUMN organization_chat_configs.created_at IS '创建时间';
COMMENT ON COLUMN organization_chat_configs.updated_at IS '更新时间';