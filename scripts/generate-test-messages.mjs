#!/usr/bin/env node

/**
 * Script to generate test messages in a group for testing infinite scroll
 * Usage: node scripts/generate-test-messages.mjs <groupName> <messageCount>
 */

import Chat3Client from '../backend/src/services/Chat3Client.js';
import config from '../backend/src/config/index.js';

const GROUP_NAME = process.argv[2] || 'Публичная группа Пользователя 2';
const MESSAGE_COUNT = parseInt(process.argv[3] || '300', 10);

const messages = [
  'Привет всем!',
  'Как дела?',
  'Отличная группа!',
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
  'Это важно знать',
  'Спасибо за ответ',
  'Понял, спасибо',
  'Отлично!',
  'Продолжаем обсуждение',
  'Интересная точка зрения',
  'Согласен',
  'Хорошая идея',
  'Давайте обсудим детали',
  'Спасибо за информацию',
];

function getRandomMessage() {
  return messages[Math.floor(Math.random() * messages.length)];
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findGroup(groupName) {
  console.log(`🔍 Searching for group: "${groupName}"...`);
  
  try {
    // Search for public groups
    const response = await Chat3Client.client.get('/dialogs', {
      params: {
        type: 'group:public',
        limit: 100
      }
    });
    
    const groups = response.data?.data || [];
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
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

async function getGroupMembers(dialogId) {
  console.log(`👥 Getting members for dialog ${dialogId}...`);
  
  try {
    const response = await Chat3Client.client.get(`/dialogs/${dialogId}/members`, {
      params: {
        limit: 100
      }
    });
    
    const members = response.data?.data || response.data || [];
    console.log(`✅ Found ${members.length} members`);
    
    if (members.length === 0) {
      console.error('❌ No members found in group');
      process.exit(1);
    }
    
    return members;
  } catch (error) {
    console.error('❌ Error getting members:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

async function sendMessage(dialogId, senderId, content, index) {
  try {
    const response = await Chat3Client.client.post(`/dialogs/${dialogId}/messages`, {
      senderId,
      type: 'internal.text',
      content: `${content} [${index}]`
    });
    
    return response.data;
  } catch (error) {
    console.error(`❌ Error sending message ${index}:`, error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    throw error;
  }
}

async function main() {
  console.log(`🚀 Starting message generation...`);
  console.log(`   Group: ${GROUP_NAME}`);
  console.log(`   Messages: ${MESSAGE_COUNT}`);
  console.log('');
  
  // Find the group
  const group = await findGroup(GROUP_NAME);
  const dialogId = group.dialogId;
  
  // Get members
  const members = await getGroupMembers(dialogId);
  
  if (members.length === 0) {
    console.error('❌ No members found in group');
    process.exit(1);
  }
  
  console.log('');
  console.log(`📨 Sending ${MESSAGE_COUNT} messages...`);
  console.log('');
  
  let successCount = 0;
  let errorCount = 0;
  
  // Send messages with delay to avoid rate limiting
  for (let i = 1; i <= MESSAGE_COUNT; i++) {
    // Pick random member
    const member = members[Math.floor(Math.random() * members.length)];
    const senderId = member.userId;
    const content = getRandomMessage();
    
    try {
      await sendMessage(dialogId, senderId, content, i);
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
      console.error(`   ❌ Failed to send message ${i}:`, error.message);
      
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

