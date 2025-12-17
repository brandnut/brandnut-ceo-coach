import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Pool } from 'pg';
import { cookies } from 'next/headers';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface FeishuTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in: number;
  scope?: string;
  user_info?: {
    user_id: string;
    union_id: string;
    open_id: string;
    name?: string;
    en_name?: string;
    email?: string;
    mobile?: string;
    avatar_url?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // 处理授权错误
    if (error) {
      console.error('飞书授权失败:', error);
      return NextResponse.redirect(
        new URL('/login?error=feishu_auth_failed', request.url)
      );
    }

    if (!code || !state) {
      console.error('缺少必要参数: code或state');
      return NextResponse.redirect(
        new URL('/login?error=invalid_callback', request.url)
      );
    }

    // 安全校验：验证state参数
    const cookieStore = await cookies();
    const storedState = cookieStore.get('feishu_oauth_state')?.value;

    if (!storedState || storedState !== state) {
      console.error('State参数不匹配，可能存在CSRF攻击');
      return NextResponse.redirect(
        new URL('/login?error=invalid_state', request.url)
      );
    }

    // 清除state cookie
    cookieStore.delete('feishu_oauth_state');

    // 获取用户会话
    const session = await auth();
    if (!session?.user?.id) {
      console.error('用户未登录');
      return NextResponse.redirect(
        new URL('/login?error=not_authenticated', request.url)
      );
    }

    // 获取企业应用配置
    const appQuery = `
      SELECT app_id, app_secret
      FROM feishu_apps
      WHERE is_active = true AND status = 'active'
      LIMIT 1
    `;
    
    const appResult = await pool.query(appQuery);
    
    if (appResult.rows.length === 0) {
      console.error('未找到活跃的飞书应用配置');
      return NextResponse.redirect(
        new URL('/profile?error=app_not_configured', request.url)
      );
    }

    const appConfig = appResult.rows[0];

    // 用授权码换取Token
    const tokenResponse = await fetch('https://open.feishu.cn/open-apis/authen/v2/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: appConfig.app_id,
        client_secret: appConfig.app_secret,
        code: code,
        redirect_uri: process.env.FEISHU_REDIRECT_URI || `${process.env.NEXTAUTH_URL || process.env.VERCEL_URL}/api/feishu/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('换取Token失败:', errorData);
      return NextResponse.redirect(
        new URL('/profile?error=token_exchange_failed', request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    
    if (tokenData.code !== 0) {
      console.error('飞书API返回错误:', tokenData);
      return NextResponse.redirect(
        new URL('/profile?error=feishu_api_error', request.url)
      );
    }

    const tokenInfo: FeishuTokenResponse = tokenData.data;

    // 计算过期时间
    const now = new Date();
    const userAccessTokenExpiresAt = new Date(now.getTime() + tokenInfo.expires_in * 1000);
    const refreshTokenExpiresAt = new Date(now.getTime() + tokenInfo.refresh_token_expires_in * 1000);

    // 获取应用访问令牌
    let tenantAccessToken = null;
    let tenantAccessTokenExpiresAt = null;

    try {
      const tenantResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          app_id: appConfig.app_id,
          app_secret: appConfig.app_secret,
        }),
      });

      if (tenantResponse.ok) {
        const tenantData = await tenantResponse.json();
        if (tenantData.code === 0) {
          tenantAccessToken = tenantData.tenant_access_token;
          tenantAccessTokenExpiresAt = new Date(now.getTime() + tenantData.expires_in * 1000);
        }
      }
    } catch (error) {
      console.warn('获取应用访问令牌失败:', error);
      // 不影响主流程，继续执行
    }

    // 存储或更新Token信息
    const upsertQuery = `
      INSERT INTO feishu_user_tokens (
        user_id,
        user_access_token,
        user_access_token_expires_at,
        refresh_token,
        refresh_token_expires_at,
        tenant_access_token,
        tenant_access_token_expires_at,
        is_active,
        feishu_user_id,
        feishu_union_id,
        feishu_open_id,
        scopes,
        metadata,
        created_at,
        updated_at,
        last_refresh_at,
        refresh_failure_count,
        auto_refresh_enabled,
        refresh_interval_minutes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11, $12, NOW(), NOW(), NOW(), 0, true, 60
      )
      ON CONFLICT (user_id) 
      DO UPDATE SET
        user_access_token = EXCLUDED.user_access_token,
        user_access_token_expires_at = EXCLUDED.user_access_token_expires_at,
        refresh_token = EXCLUDED.refresh_token,
        refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
        tenant_access_token = EXCLUDED.tenant_access_token,
        tenant_access_token_expires_at = EXCLUDED.tenant_access_token_expires_at,
        is_active = true,
        feishu_user_id = EXCLUDED.feishu_user_id,
        feishu_union_id = EXCLUDED.feishu_union_id,
        feishu_open_id = EXCLUDED.feishu_open_id,
        scopes = EXCLUDED.scopes,
        metadata = EXCLUDED.metadata,
        updated_at = NOW(),
        last_refresh_at = NOW(),
        refresh_failure_count = 0,
        auto_refresh_enabled = true
      RETURNING id
    `;

    const metadata = JSON.stringify({
      user_info: tokenInfo.user_info,
      authorized_at: now.toISOString(),
    });

    const values = [
      session.user.id,
      tokenInfo.access_token,
      userAccessTokenExpiresAt,
      tokenInfo.refresh_token,
      refreshTokenExpiresAt,
      tenantAccessToken,
      tenantAccessTokenExpiresAt,
      tokenInfo.user_info?.user_id,
      tokenInfo.user_info?.union_id,
      tokenInfo.user_info?.open_id,
      tokenInfo.scope,
      metadata,
    ];

    const result = await pool.query(upsertQuery, values);

    if (result.rows.length === 0) {
      console.error('存储Token信息失败');
      return NextResponse.redirect(
        new URL('/profile?error=token_storage_failed', request.url)
      );
    }

    console.log(`用户 ${session.user.id} 飞书授权成功`);

    // 重定向到个人资料页面，表示授权成功
    return NextResponse.redirect(
      new URL('/profile?feishu_authorized=true', request.url)
    );

  } catch (error) {
    console.error('飞书OAuth回调处理失败:', error);
    return NextResponse.redirect(
      new URL('/profile?error=callback_failed', request.url)
    );
  }
}