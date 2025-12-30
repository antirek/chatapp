#!/usr/bin/env node

/**
 * Скрипт для добавления тестовых сообщений в диалоги между пользователями
 * Использует Chat3Client напрямую
 */

import mongoose from 'mongoose';
import config from '../src/config/index.js';
import User from '../src/models/User.js';
import chat3ClientInstance from '../src/services/Chat3Client.js';

const DEFAULT_ACCOUNT_ID = 'test_account_1';
const MESSAGES_PER_DIALOG = 10; // Количество сообщений в каждом диалоге

const testMessages = [
  'Привет! Как дела?',
  'Отлично, спасибо! А у тебя?',
  'Всё хорошо, работаю над проектом',
  'Интересно! Расскажи подробнее',
  'Делаю чат-приложение на Vue и Node.js',
  'Звучит круто! Когда планируешь запустить?',
  'Думаю, через пару недель будет готово',
  'Класс! Обязательно покажи, когда будет готово',
  'Конечно! Напишу тебе первым',
  'Спасибо за поддержку!',
  'Всегда рад помочь другу',
  'Ты лучший!',
  'Спасибо! 😊',
  'Что планируешь на выходные?',
  'Ничего особенного, отдохнуть хочу',
  'Понятно, нужно иногда расслабляться',
  'Точно! Работа не волк, в лес не убежит',
  'Ха-ха, точно подмечено',
  'Кстати, видел новую фичу в приложении?',
  'Да, она классная!',
];

function getRandomMessage() {
  return testMessages[Math.floor(Math.random() * testMessages.length)];
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getUserDialogs(userId) {
  try {
    const response = await chat3ClientInstance.getUserDialogs(userId, {
      limit: 100,
    });
    return response.data || [];
  } catch (error) {
    console.error(`❌ Ошибка получения диалогов для ${userId}:`, error.message);
    return [];
  }
}

async function getDialogMembers(dialogId) {
  try {
    const response = await chat3ClientInstance.client.get(
      `/dialogs/${dialogId}/members`,
      {
        params: { limit: 100 },
      },
    );
    return response.data?.data || response.data || [];
  } catch (error) {
    console.error(`❌ Ошибка получения участников диалога ${dialogId}:`, error.message);
    return [];
  }
}

async function sendMessage(dialogId, userId, content) {
  try {
    // Используем метод createMessage из Chat3Client
    const response = await chat3ClientInstance.createMessage(dialogId, {
      content,
      type: 'user.text', // Chat3 требует user.text вместо text
      senderId: userId,  // Chat3 требует senderId вместо createdBy
    });
    return response;
  } catch (error) {
    if (error.response) {
      console.error(`❌ Ошибка отправки сообщения: ${error.response.status} - ${error.response.data?.message || error.message}`);
    } else {
      console.error(`❌ Ошибка отправки сообщения:`, error.message);
    }
    throw error;
  }
}

async function addMessagesToDialog(dialogId, members) {
  if (members.length < 2) {
    console.log(`⚠️  В диалоге ${dialogId} недостаточно участников`);
    return 0;
  }

  const [user1, user2] = members;
  let sentCount = 0;

  // Чередуем отправку сообщений между участниками
  for (let i = 0; i < MESSAGES_PER_DIALOG; i++) {
    const sender = i % 2 === 0 ? user1 : user2;
    const content = getRandomMessage();

    try {
      await sendMessage(dialogId, sender.userId || sender._id, content);
      sentCount++;
      await delay(200); // Задержка между сообщениями
    } catch (error) {
      // Продолжаем, даже если одно сообщение не отправилось
      console.error(`   ⚠️  Не удалось отправить сообщение ${i + 1}`);
    }
  }

  return sentCount;
}

async function main() {
  console.log('🚀 Начало добавления тестовых сообщений...\n');

  try {
    // Подключаемся к MongoDB
    console.log('📦 Подключение к MongoDB...');
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ Подключено к MongoDB\n');

    // Находим Иванова (у него есть диалоги со всеми)
    const ivanov = await User.findOne({
      accountId: DEFAULT_ACCOUNT_ID,
      phone: '79100000000',
    });

    if (!ivanov) {
      console.error('❌ Иванов Иван не найден! Запустите сначала init-test-users.mjs');
      process.exit(1);
    }

    console.log(`👤 Найден пользователь: ${ivanov.name} (${ivanov.userId})\n`);

    // Получаем все диалоги Иванова
    console.log('🔍 Получение диалогов...');
    const dialogs = await getUserDialogs(ivanov.userId);
    console.log(`✅ Найдено диалогов: ${dialogs.length}\n`);

    if (dialogs.length === 0) {
      console.log('⚠️  Диалоги не найдены! Создайте их сначала через init-test-users.mjs');
      process.exit(0);
    }

    let totalMessages = 0;

    // Добавляем сообщения в каждый диалог
    for (let i = 0; i < dialogs.length; i++) {
      const dialog = dialogs[i];
      const dialogId = dialog.dialogId || dialog._id;

      console.log(`[${i + 1}/${dialogs.length}] Обработка диалога ${dialogId}...`);

      // Получаем участников диалога
      const members = await getDialogMembers(dialogId);
      console.log(`   👥 Участников: ${members.length}`);

      if (members.length >= 2) {
        const sentCount = await addMessagesToDialog(dialogId, members);
        totalMessages += sentCount;
        console.log(`   ✅ Отправлено сообщений: ${sentCount}\n`);
      } else {
        console.log(`   ⚠️  Пропущен (недостаточно участников)\n`);
      }

      // Задержка между диалогами
      if (i < dialogs.length - 1) {
        await delay(500);
      }
    }

    console.log('\n📊 Итоговая статистика:');
    console.log(`   - Обработано диалогов: ${dialogs.length}`);
    console.log(`   - Всего отправлено сообщений: ${totalMessages}`);
    console.log(`   - Среднее на диалог: ${Math.round(totalMessages / dialogs.length)}`);
    console.log('\n✅ Готово!');

  } catch (error) {
    console.error('\n❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Соединение с MongoDB закрыто');
  }
}

main().catch(console.error);

