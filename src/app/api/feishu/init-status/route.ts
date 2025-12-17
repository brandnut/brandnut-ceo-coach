import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: NextRequest) {
  try {
    // 查询企业配置 - 确保App ID不为空
    const appQuery = `
      SELECT app_id, name
      FROM feishu_apps
      WHERE is_active = true
        AND status = 'active'
        AND app_id IS NOT NULL
        AND app_id != ''
      ORDER BY created_at DESC
      LIMIT 1
    `;

    console.log('🔍 查询飞书应用配置...');
    const appResult = await pool.query(appQuery);
    console.log(`📊 查询结果: ${appResult.rows.length} 条记录`);

    if (appResult.rows.length === 0) {
      // 企业未配置飞书应用
      console.log('❌ 企业未配置飞书应用或App ID为空');
      return NextResponse.json({
        featureEnabled: false,
        userAuthorized: false,
        appId: null,
      });
    }

    const appConfig = {
      appId: appResult.rows[0].app_id,
      appName: appResult.rows[0].name,
    };

    console.log('✅ 找到飞书应用配置:', appConfig);

    // 对于简化版本，我们假设用户未授权（因为我们还没有飞书Token）
    return NextResponse.json({
      featureEnabled: true,
      userAuthorized: false,
      appId: appConfig.appId,
      appName: appConfig.appName,
      expiresSoon: false,
      tokenInfo: null,
    });

  } catch (error) {
    console.error('❌ 获取飞书初始化状态失败:', error);
    return NextResponse.json(
      { error: 'Database query failed', details: error.message },
      { status: 500 }
    );
  }
}