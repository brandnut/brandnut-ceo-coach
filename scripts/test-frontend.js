const http = require('http');

const BASE_URL = 'localhost:3002';

// 辅助函数
function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL.split(':')[0],
      port: BASE_URL.split(':')[1],
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        let data = null;
        try {
          data = body ? JSON.parse(body) : null;
        } catch (e) {
          // 如果不是JSON，返回原始body
          data = { html: body.substring(0, 200) + '...' };
        }
        resolve({
          status: res.statusCode,
          data: data,
          headers: res.headers
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// 测试用例
async function runFrontendTests() {
  console.log('🚀 开始前端功能测试...\n');

  // 测试1: 登录页面可访问
  console.log('📝 测试1: 登录页面可访问性');
  try {
    const response = await makeRequest('/login');
    if (response.status === 200) {
      console.log('✅ 登录页面可正常访问');
    } else {
      console.log('❌ 登录页面访问失败:', response.status);
    }
  } catch (error) {
    console.log('❌ 登录页面访问错误:', error.message);
  }

  // 测试2: 受保护路由重定向
  console.log('\n📝 测试2: 未登录访问受保护路由');
  const protectedRoutes = ['/profile', '/admin/users'];

  for (const route of protectedRoutes) {
    try {
      const response = await makeRequest(route);
      if (response.status === 302 || response.status === 307) {
        console.log(`✅ ${route} 正确重定向到登录页面`);
      } else {
        console.log(`❌ ${route} 应该重定向但返回了:`, response.status);
      }
    } catch (error) {
      console.log(`❌ ${route} 访问错误:`, error.message);
    }
  }

  // 测试3: 静态资源加载
  console.log('\n📝 测试3: 静态资源');
  try {
    const response = await makeRequest('/_next/static/css/app/layout.css');
    if (response.status === 200) {
      console.log('✅ 静态CSS可正常加载');
    } else {
      console.log('⚠️ 静态CSS加载状态:', response.status);
    }
  } catch (error) {
    console.log('⚠️ 静态CSS加载错误:', error.message);
  }

  // 测试4: 主页面重定向
  console.log('\n📝 测试4: 未登录访问主页面');
  try {
    const response = await makeRequest('/');
    if (response.status === 302 || response.status === 307) {
      console.log('✅ 主页面正确重定向到登录');
    } else {
      console.log('❌ 主页面应该重定向但返回了:', response.status);
    }
  } catch (error) {
    console.log('❌ 主页面访问错误:', error.message);
  }

  // 测试5: 检查NextAuth路由
  console.log('\n📝 测试5: 认证API路由');
  try {
    const response = await makeRequest('/api/auth/session');
    if (response.status === 200) {
      console.log('✅ 认证API路由正常:', response.data);
    } else {
      console.log('❌ 认证API路由失败:', response.status);
    }
  } catch (error) {
    console.log('❌ 认证API路由错误:', error.message);
  }

  console.log('\n🎉 前端基础测试完成！');
  console.log('\n📋 手动测试说明:');
  console.log('1. 访问 http://localhost:3002/login');
  console.log('2. 使用 admin/admin123 登录');
  console.log('3. 检查右上角用户菜单：');
  console.log('   - 个人资料（所有用户）');
  console.log('   - 用户管理（仅admin）');
  console.log('4. 测试权限控制：');
  console.log('   - 普通用户无法访问 /admin/users');
  console.log('   - 未登录用户被重定向到 /login');
  console.log('5. 测试功能：');
  console.log('   - Admin可以创建/编辑/删除用户');
  console.log('   - 所有用户可以修改自己密码');
  console.log('\n📊 预期功能：');
  console.log('- ✅ 登录页面使用Ant Design');
  console.log('- ✅ 导航栏显示用户角色');
  console.log('- ✅ Admin有金色皇冠标识');
  console.log('- ✅ 路由权限控制正常');
  console.log('- ✅ 用户管理界面完整');
  console.log('- ✅ 个人资料页面可用');
}

runFrontendTests().catch(console.error);