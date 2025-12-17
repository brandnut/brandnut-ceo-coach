'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';

interface InitStatusResponse {
  featureEnabled: boolean;
  userAuthorized: boolean;
  appId: string | null;
  appName?: string;
  expiresSoon?: boolean;
  tokenInfo?: {
    user_access_token_expires_at: string;
    auto_refresh_enabled: boolean;
    refresh_failure_count: number;
  };
  error?: string;
}

export function FeishuSwitch() {
  const { data: session, status } = useSession();
  const [initStatus, setInitStatus] = useState<InitStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取初始化状态
  useEffect(() => {
    if (status === 'authenticated') {
      fetchInitStatus();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status]);

  const fetchInitStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/feishu/init-status');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '获取状态失败');
      }
      
      setInitStatus(data);
      setError(null);
    } catch (err) {
      console.error('获取飞书状态失败:', err);
      setError(err instanceof Error ? err.message : '获取状态失败');
    } finally {
      setLoading(false);
    }
  };

  // 生成OAuth授权链接
  const generateAuthUrl = () => {
    if (!initStatus?.appId) return null;

    // 生成高熵随机字符串作为state
    const state = crypto.randomUUID();
    
    // 将state存储到cookie中（安全存储）
    document.cookie = `feishu_oauth_state=${state}; path=/; max-age=300; secure; samesite=lax`;
    
    const baseUrl = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize';
    const redirectUri = encodeURIComponent('https://brandnut.cn/ops/api/v1/feishu/callback');
    const scopes = encodeURIComponent([
    // 用户信息相关
    'contact:user.id:readonly',

    // 组织架构相关 - 只保留基础读取权限
    'directory:department:read',
    'directory:department:list',
    'directory:employee:read',
    'directory:employee:list',
    'directory:employee:search',

    // 多维表格相关 - 保留核心权限
    'bitable:app',
    'bitable:app:readonly',
    'base:app:read',
    'base:table:read',
    'base:record:read',
    'base:view:read',

    // 文档相关 - 保留基础权限
    'docs:doc:readonly',
    'docs:document.content:read',
    'docs:document.media:download',

    // 云文档相关 - 保留基础权限
    'drive:drive:readonly',
    'drive:file:readonly',
    'drive:file:download',

    // 消息相关 - 保留核心权限
    'im:chat:readonly',
    'im:message:readonly',
    'im:message.p2p_msg:readonly',
    'im:message.group_msg',

    // 日历相关 - 只保留读取权限
    'calendar:calendar:readonly',

    // 知识库相关 - 保留基础权限
    'wiki:wiki:readonly',
    'wiki:space:read',
    'wiki:node:read',

    // 离线访问权限（必需）
    'offline_access'
  ].join(' '));
    
    return `${baseUrl}?client_id=${initStatus.appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}&state=${state}`;
  };

  // 处理开关切换
  const handleSwitchChange = async (checked: boolean) => {
    if (checked && !initStatus?.userAuthorized) {
      // 用户想要开启功能但未授权，显示授权对话框
      setShowAuthDialog(true);
      return;
    }

    if (!checked && initStatus?.userAuthorized) {
      // 用户想要关闭功能，这里可以实现断开连接的逻辑
      // 根据文档，暂时不实现断开连接功能
      return;
    }
  };

  // 跳转到飞书授权
  const handleAuthorize = () => {
    const authUrl = generateAuthUrl();
    if (authUrl) {
      window.location.href = authUrl;
    }
  };

  // 刷新状态
  const handleRefresh = () => {
    fetchInitStatus();
  };

  // 如果用户未登录或正在加载，不显示组件
  if (status !== 'authenticated' || loading) {
    return null;
  }

  // 如果功能未启用或发生错误，不显示组件
  if (error || !initStatus?.featureEnabled) {
    return null;
  }

  const isAuthorized = initStatus.userAuthorized;
  const expiresSoon = initStatus.expiresSoon;
  const tokenInfo = initStatus.tokenInfo;

  return (
    <>
      <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <Switch
              checked={isAuthorized}
              onCheckedChange={handleSwitchChange}
              disabled={switchLoading}
            />
            <span className="font-medium">飞书集成</span>
            {expiresSoon && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                即将过期
              </span>
            )}
          </div>
          
          {isAuthorized && tokenInfo && (
            <div className="mt-2 text-xs text-muted-foreground">
              <div>自动刷新: {tokenInfo.auto_refresh_enabled ? '已启用' : '已禁用'}</div>
              <div>失败次数: {tokenInfo.refresh_failure_count}</div>
              <div>过期时间: {new Date(tokenInfo.user_access_token_expires_at).toLocaleString()}</div>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={switchLoading}
        >
          <RefreshCw className={`h-4 w-4 ${switchLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* 授权对话框 */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>连接飞书账号</DialogTitle>
            <DialogDescription>
              点击下方按钮跳转到飞书授权页面，完成授权后自动返回本应用。
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-sm text-amber-600 bg-amber-50 p-3 rounded">
              <AlertCircle className="h-4 w-4" />
              <span>
                授权后，系统将自动管理您的访问令牌，确保长期稳定使用。
              </span>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowAuthDialog(false)}
              >
                取消
              </Button>
              <Button onClick={handleAuthorize}>
                <ExternalLink className="h-4 w-4 mr-2" />
                前往授权
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}