import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 测试飞书配置API调用...');

    const result = await pool.query(
      'SELECT app_id, name, is_active, status FROM feishu_apps WHERE is_active = true AND status = \'active\' LIMIT 1'
    );

    console.log(`📊 查询结果: ${result.rows.length} 条记录`);

    if (result.rows.length > 0) {
      const app = result.rows[0];
      console.log('找到飞书应用:', app);

      return NextResponse.json({
        success: true,
        message: '找到飞书应用配置',
        app: {
          id: app.app_id,
          name: app.name,
          isActive: app.is_active,
          status: app.status,
          database_url: process.env.DATABASE_URL ? '已配置' : '未配置',
        }
      });
    } else {
      console.log('未找到飞书应用配置');
      return NextResponse.json({
        success: false,
        message: '未找到活跃的飞书应用配置',
        database_url: process.env.DATABASE_URL ? '已配置' : '未配置',
      });
    }

  } catch (error) {
    console.error('❌ 测试API失败:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
      database_url: process.env.DATABASE_URL ? '已配置' : '未配置',
    });
  } finally {
    // await pool.end();
  }
}