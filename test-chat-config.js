const { getUserChatConfig } = require('./src/lib/db/queries.ts');

async function testChatConfig() {
  try {
    const userId = '545b8fda-9baa-430b-945f-a27474c3a445'; // keith的用户ID

    console.log('Testing getUserChatConfig for user:', userId);

    const config = await getUserChatConfig(userId);

    if (config) {
      console.log('✅ Chat config found:');
      console.log('  Organization:', config.organization_name);
      console.log('  API URL:', config.chat_api_url);
      console.log('  API Key (masked):', config.chat_api_key.slice(0, 4) + '...' + config.chat_api_key.slice(-4));
      console.log('  Organization ID:', config.organization_id);
    } else {
      console.log('❌ No chat config found for user');
    }
  } catch (error) {
    console.error('Error testing chat config:', error);
  }
}

testChatConfig();