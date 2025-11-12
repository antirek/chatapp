#!/usr/bin/env node

/**
 * Script to generate test messages in a group for testing infinite scroll
 * Uses our backend API (requires authentication)
 * Usage: node scripts/generate-test-messages-simple.mjs <groupName> <messageCount> <phone> <code>
 */

// Using native fetch (Node.js 18+)

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001/api';
const GROUP_NAME = process.argv[2] || 'Публичная группа Пользователя 2';
const MESSAGE_COUNT = parseInt(process.argv[3] || '300', 10);
const PHONE = (process.argv[4] || '79111111111').replace(/^\+/, ''); // Remove + if present
const CODE = process.argv[5] || null;

const messages = [
  'Привет всем!',
  'Как дела?',
  'Отлично работает!',
  'Спасибо за информацию',
  'Интересная тема',
  'Согласен с вами',
  'Хорошая идея',
  'Давайте обсудим',
  'Это важно',
  'Понятно, спасибо',
  'Отлично работает',
  'Продолжаем обсуждение',
  'Новая информация',
  'Интересный вопрос',
  'Давайте разберемся',
  'Спасибо за помощь',
  'Все понятно',
  'Отличный результат',
  'Продолжаем',
  'Хорошая работа',
];

function getRandomMessage() {
  return messages[Math.floor(Math.random() * messages.length)];
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestCode(phone) {
  console.log(`📱 Requesting code for ${phone}...`);
  
  try {
    const response = await fetch(`${BACKEND_URL}/auth/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`⚠️  Request code response: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Code requested. Using default code '1234' for mock mode.`);
      return '1234';
    }
    
    // Even if request fails, try default code in mock mode
    console.log(`⚠️  Request code returned: ${JSON.stringify(data)}`);
    return '1234';
  } catch (error) {
    console.error('❌ Error requesting code:', error.message);
    // In mock mode, try default code anyway
    console.log(`⚠️  Using default code '1234' for mock mode`);
    return '1234';
  }
}

async function authenticate(phone, code) {
  console.log(`🔐 Authenticating as ${phone}...`);
  
  try {
    const response = await fetch(`${BACKEND_URL}/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });
    
    const data = await response.json();
    
    if (data.success && data.token) {
      console.log(`✅ Authenticated as ${data.user.name || phone}`);
      return data.token;
    }
    
    throw new Error('Authentication failed: ' + (data.message || 'Unknown error'));
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    process.exit(1);
  }
}

async function findGroup(groupName, token) {
  console.log(`🔍 Searching for group: "${groupName}"...`);
  
  try {
    const url = new URL(`${BACKEND_URL}/dialogs`);
    url.searchParams.set('type', 'group:public');
    url.searchParams.set('limit', '100');
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const result = await response.json();
    const groups = result?.data || [];
    const group = groups.find(g => g.name === groupName || g.dialogName === groupName);
    
    if (!group) {
      console.error(`❌ Group "${groupName}" not found`);
      console.log('Available groups:');
      groups.forEach(g => console.log(`  - ${g.name || g.dialogName} (${g.dialogId})`));
      process.exit(1);
    }
    
    console.log(`✅ Found group: ${group.name || group.dialogName} (${group.dialogId})`);
    return group;
  } catch (error) {
    console.error('❌ Error searching for group:', error.message);
    process.exit(1);
  }
}

async function getGroupMembers(dialogId, token) {
  console.log(`👥 Getting members for dialog ${dialogId}...`);
  
  try {
    const url = new URL(`${BACKEND_URL}/dialogs/${dialogId}/members`);
    url.searchParams.set('limit', '100');
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const result = await response.json();
    const members = result?.data || [];
    console.log(`✅ Found ${members.length} members`);
    
    if (members.length === 0) {
      console.error('❌ No members found in group');
      process.exit(1);
    }
    
    return members;
  } catch (error) {
    console.error('❌ Error getting members:', error.message);
    process.exit(1);
  }
}

async function sendMessage(dialogId, content, token, index) {
  try {
    const response = await fetch(`${BACKEND_URL}/dialog/${dialogId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        content: `${content} [${index}]`,
        type: 'text'
      })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Error sending message ${index}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log(`🚀 Starting message generation...`);
  console.log(`   Backend: ${BACKEND_URL}`);
  console.log(`   Group: ${GROUP_NAME}`);
  console.log(`   Messages: ${MESSAGE_COUNT}`);
  console.log(`   Phone: ${PHONE}`);
  console.log('');
  
  // Request code if not provided
  let code = CODE;
  if (!code) {
    code = await requestCode(PHONE);
    await delay(1000); // Wait a bit for code to be processed
  }
  
  // Authenticate
  const token = await authenticate(PHONE, code);
  
  // Find the group
  const group = await findGroup(GROUP_NAME, token);
  const dialogId = group.dialogId;
  
  // Get members (for reference, but we'll send as authenticated user)
  const members = await getGroupMembers(dialogId, token);
  
  console.log('');
  console.log(`📨 Sending ${MESSAGE_COUNT} messages...`);
  console.log('');
  
  let successCount = 0;
  let errorCount = 0;
  
  // Send messages with delay to avoid rate limiting
  for (let i = 1; i <= MESSAGE_COUNT; i++) {
    const content = getRandomMessage();
    
    try {
      await sendMessage(dialogId, content, token, i);
      successCount++;
      
      if (i % 50 === 0) {
        console.log(`   ✅ Sent ${i}/${MESSAGE_COUNT} messages...`);
      }
      
      // Small delay to avoid overwhelming the API
      if (i < MESSAGE_COUNT) {
        await delay(50); // 50ms delay between messages
      }
    } catch (error) {
      errorCount++;
      
      // Continue even if some messages fail
      if (errorCount > 10) {
        console.error('❌ Too many errors, stopping...');
        break;
      }
    }
  }
  
  console.log('');
  console.log(`✅ Done!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Group ID: ${dialogId}`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

