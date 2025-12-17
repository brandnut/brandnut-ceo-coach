import { NextRequest, NextResponse } from 'next/server';
import { checkAndRefreshAllTokens } from '@/lib/feishu-token-service';

export async function GET(request: NextRequest) {
  try {
    // 安全校验：验证cron密钥
    const searchParams = request.nextUrl.searchParams;
    const cronSecret = searchParams.get('cron_secret');
    
    const expectedSecret = process.env.CRON_SECRET;
    
    if (!expectedSecret) {
      console.error('CRON_SECRET环境变量未设置');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (cronSecret !== expectedSecret) {
      console.error('无效的cron密钥');
      return NextResponse.json(
        { error: 'Invalid cron secret' },
        { status: 401 }
      );
    }

    console.log('开始执行飞书Token刷新任务...');

    // 执行Token刷新任务
    const summary = await checkAndRefreshAllTokens();

    console.log('飞书Token刷新任务完成:', summary);

    return NextResponse.json({
      success: true,
      message: 'Token refresh job completed',
      summary,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('飞书Token刷新任务执行失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred during the token refresh process',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}