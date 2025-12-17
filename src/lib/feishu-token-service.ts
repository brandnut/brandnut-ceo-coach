import { Pool } from 'pg';

interface TokenRefreshResult {
  totalChecked: number;
  refreshed: number;
  failed: number;
  deactivated: number;
  errors: string[];
}

interface FeishuTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_token_expires_in?: number;
}

interface FeishuAppConfig {
  app_id: string;
  app_secret: string;
}

interface UserTokenRecord {
  id: string;
  user_id: string;
  user_access_token: string;
  user_access_token_expires_at: Date;
  refresh_token: string;
  refresh_token_expires_at: Date;
  tenant_access_token?: string;
  tenant_access_token_expires_at?: Date;
  is_active: boolean;
  auto_refresh_enabled: boolean;
  refresh_failure_count: number;
  created_at: Date;
  last_refresh_at: Date;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * 获取活跃的飞书应用配置
 */
async function getActiveFeishuApp(): Promise<FeishuAppConfig | null> {
  const query = `
    SELECT app_id, app_secret 
    FROM feishu_apps 
    WHERE is_active = true AND status = 'active' 
    LIMIT 1
  `;
  
  const result = await pool.query(query);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return {
    app_id: result.rows[0].app_id,
    app_secret: result.rows[0].app_secret,
  };
}

/**
 * 刷新用户访问令牌
 */
async function refreshUserAccessToken(
  refreshToken: string,
  appConfig: FeishuAppConfig
): Promise<FeishuTokenResponse> {
  const response = await fetch('https://open.feishu.cn/open-apis/authen/v1/refresh_access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: appConfig.app_id,
      client_secret: appConfig.app_secret,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`飞书API错误: ${response.status} - ${errorData.error || '未知错误'}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * 获取应用访问令牌
 */
async function getTenantAccessToken(appConfig: FeishuAppConfig): Promise<FeishuTokenResponse> {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      app_id: appConfig.app_id,
      app_secret: appConfig.app_secret,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`飞书API错误: ${response.status} - ${errorData.error || '未知错误'}`);
  }

  const data = await response.json();
  return data;
}

/**
 * 更新数据库中的Token记录
 */
async function updateTokenRecord(
  tokenId: string,
  tokenData: FeishuTokenResponse,
  isUserToken: boolean = true
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + tokenData.expires_in * 1000);
  
  if (isUserToken) {
    let refreshExpiresAt: Date | null = null;
    if (tokenData.refresh_token_expires_in) {
      refreshExpiresAt = new Date(now.getTime() + tokenData.refresh_token_expires_in * 1000);
    }

    const query = `
      UPDATE feishu_user_tokens 
      SET 
        user_access_token = $1,
        user_access_token_expires_at = $2,
        refresh_token = COALESCE($3, refresh_token),
        refresh_token_expires_at = COALESCE($4, refresh_token_expires_at),
        last_refresh_at = $5,
        refresh_failure_count = 0,
        updated_at = $6
      WHERE id = $7
    `;
    
    await pool.query(query, [
      tokenData.access_token,
      expiresAt,
      tokenData.refresh_token || null,
      refreshExpiresAt,
      now,
      now,
      tokenId,
    ]);
  } else {
    const query = `
      UPDATE feishu_user_tokens 
      SET 
        tenant_access_token = $1,
        tenant_access_token_expires_at = $2,
        updated_at = $3
      WHERE id = $4
    `;
    
    await pool.query(query, [
      tokenData.access_token,
      expiresAt,
      now,
      tokenId,
    ]);
  }
}

/**
 * 停用Token记录
 */
async function deactivateTokenRecord(tokenId: string, reason: string): Promise<void> {
  const query = `
    UPDATE feishu_user_tokens 
    SET 
      auto_refresh_enabled = false,
      is_active = false,
      updated_at = $1
    WHERE id = $2
  `;
  
  await pool.query(query, [new Date(), tokenId]);
  console.log(`Token ${tokenId} 已停用，原因: ${reason}`);
}

/**
 * 增加刷新失败计数
 */
async function incrementRefreshFailureCount(tokenId: string): Promise<void> {
  const query = `
    UPDATE feishu_user_tokens 
    SET 
      refresh_failure_count = refresh_failure_count + 1,
      updated_at = $1
    WHERE id = $2
  `;
  
  await pool.query(query, [new Date(), tokenId]);
}

/**
 * 检查并刷新所有Token
 */
export async function checkAndRefreshAllTokens(): Promise<TokenRefreshResult> {
  const result: TokenRefreshResult = {
    totalChecked: 0,
    refreshed: 0,
    failed: 0,
    deactivated: 0,
    errors: [],
  };

  try {
    // 获取活跃的应用配置
    const appConfig = await getActiveFeishuApp();
    if (!appConfig) {
      result.errors.push('未找到活跃的飞书应用配置');
      return result;
    }

    // 查询需要刷新的Token
    const query = `
      SELECT *
      FROM feishu_user_tokens
      WHERE 
        auto_refresh_enabled = true
        AND is_active = true
        AND user_access_token_expires_at < NOW() + INTERVAL '1 hour'
        AND created_at > NOW() - INTERVAL '365 days'
      ORDER BY user_access_token_expires_at ASC
    `;

    const tokensResult = await pool.query(query);
    const tokens: UserTokenRecord[] = tokensResult.rows;
    result.totalChecked = tokens.length;

    console.log(`找到 ${tokens.length} 个需要检查的Token`);

    // 并发处理Token刷新
    const refreshPromises = tokens.map(async (token) => {
      try {
        // 检查refresh_token是否过期
        if (token.refresh_token_expires_at && token.refresh_token_expires_at <= new Date()) {
          await deactivateTokenRecord(token.id, 'refresh_token已过期');
          result.deactivated++;
          return;
        }

        // 刷新用户访问令牌
        const tokenData = await refreshUserAccessToken(token.refresh_token, appConfig);
        await updateTokenRecord(token.id, tokenData, true);
        result.refreshed++;
        
        console.log(`成功刷新用户 ${token.user_id} 的访问令牌`);

        // 检查是否需要刷新应用令牌
        if (!token.tenant_access_token || 
            (token.tenant_access_token_expires_at && token.tenant_access_token_expires_at <= new Date())) {
          try {
            const tenantTokenData = await getTenantAccessToken(appConfig);
            await updateTokenRecord(token.id, tenantTokenData, false);
            console.log(`成功刷新用户 ${token.user_id} 的应用令牌`);
          } catch (error) {
            console.warn(`刷新用户 ${token.user_id} 的应用令牌失败:`, error);
            // 应用令牌刷新失败不影响用户令牌的刷新结果
          }
        }

      } catch (error) {
        const errorMessage = `刷新用户 ${token.user_id} 的Token失败: ${error instanceof Error ? error.message : '未知错误'}`;
        console.error(errorMessage);
        result.errors.push(errorMessage);
        result.failed++;

        // 增加失败计数
        await incrementRefreshFailureCount(token.id);

        // 如果连续失败次数过多，停用自动刷新
        if (token.refresh_failure_count >= 5) {
          await deactivateTokenRecord(token.id, '连续刷新失败次数过多');
          result.deactivated++;
        }
      }
    });

    await Promise.allSettled(refreshPromises);

    console.log(`Token刷新任务完成: 检查 ${result.totalChecked} 个，成功 ${result.refreshed} 个，失败 ${result.failed} 个，停用 ${result.deactivated} 个`);

  } catch (error) {
    const errorMessage = `Token刷新服务执行失败: ${error instanceof Error ? error.message : '未知错误'}`;
    console.error(errorMessage);
    result.errors.push(errorMessage);
  }

  return result;
}

/**
 * 检查特定用户的Token状态
 */
export async function checkUserTokenStatus(userId: string): Promise<{
  authorized: boolean;
  expiresSoon?: boolean;
  tokenInfo?: {
    user_access_token_expires_at: Date;
    auto_refresh_enabled: boolean;
    refresh_failure_count: number;
  };
}> {
  const query = `
    SELECT 
      user_access_token_expires_at,
      auto_refresh_enabled,
      refresh_failure_count,
      is_active
    FROM feishu_user_tokens
    WHERE user_id = $1 AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [userId]);

  if (result.rows.length === 0) {
    return { authorized: false };
  }

  const token = result.rows[0];
  const now = new Date();
  const expiresAt = new Date(token.user_access_token_expires_at);
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    authorized: true,
    expiresSoon: expiresAt <= oneHourFromNow,
    tokenInfo: {
      user_access_token_expires_at: expiresAt,
      auto_refresh_enabled: token.auto_refresh_enabled,
      refresh_failure_count: token.refresh_failure_count,
    },
  };
}