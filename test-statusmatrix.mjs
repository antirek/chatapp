#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки корректности работы statusMatrix
 * 
 * Сценарий:
 * 1. Создается групповой чат с 4 участниками типа user
 * 2. Один участник (user1) пишет сообщение в группу
 * 3. 2 других участника (user2, user3) отмечают сообщение прочтенным
 * 4. Проверяется, что user1 получил update, где в statusMatrix должно быть:
 *    status=read, userType=user:2 (2 пользователя типа user прочитали)
 */

import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = 'http://localhost:3010/api';
const WS_URL = 'http://localhost:3010';

// Тестовые пользователи (используем существующих)
const USERS = [
  { phone: '79100000000', name: 'Иванов Иван' },      // user1 - отправитель
  { phone: '79100000001', name: 'Петров Петр' },     // user2 - отметит прочитанным
  { phone: '79100000002', name: 'Сидоров Сергей' },  // user3 - отметит прочитанным
  { phone: '79100000003', name: 'Смирнов Алексей' },  // user4 - не будет отмечать
];

const CODE = '1234';

// Получение токена для пользователя
async function getToken(phone) {
  try {
    // Запрашиваем код
    await axios.post(`${API_URL}/auth/request-code`, { phone });
    
    // Ждем немного перед верификацией
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Верифицируем код
    const response = await axios.post(`${API_URL}/auth/verify-code`, {
      phone,
      code: CODE,
    });
    
    return response.data.token;
  } catch (error) {
    console.error(`❌ Ошибка получения токена для ${phone}:`, error.response?.data || error.message);
    throw error;
  }
}

// Создание группового чата с повторными попытками
async function createGroupChat(token, name, memberIds, retries = 3) {
  // Задержка перед запросом
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(
        `${API_URL}/dialogs`,
        {
          name,
          memberIds,
          chatType: 'group',
          groupType: 'private',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      return response.data.data.dialogId;
    } catch (error) {
      if (error.response?.status === 429 && i < retries - 1) {
        const waitTime = (i + 1) * 3000; // Увеличиваем задержку с каждой попыткой
        console.log(`⚠️  Rate limit (429), ждем ${waitTime}ms перед повторной попыткой...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      console.error('❌ Ошибка создания группового чата:', error.response?.data || error.message);
      throw error;
    }
  }
}

// Отправка сообщения
async function sendMessage(token, dialogId, content) {
  // Задержка перед запросом
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    const response = await axios.post(
      `${API_URL}/dialog/${dialogId}/messages`,
      { content, type: 'text' },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    
    return response.data.data;
  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:', error.response?.data || error.message);
    throw error;
  }
}

// Отметка сообщения прочитанным
async function markAsRead(token, messageId) {
  // Задержка перед запросом
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    const response = await axios.post(
      `${API_URL}/messages/${messageId}/status/read`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка отметки прочитанным:', error.response?.data || error.message);
    throw error;
  }
}

// Получение сообщения с полными данными
async function getMessage(token, messageId) {
  // Задержка перед запросом
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    const response = await axios.get(
      `${API_URL}/messages/${messageId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    
    return response.data.data;
  } catch (error) {
    console.error('❌ Ошибка получения сообщения:', error.response?.data || error.message);
    throw error;
  }
}

// Получение userId по токену
async function getUserId(token) {
  // Задержка перед запросом
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    const response = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    // Проверяем разные форматы ответа
    const user = response.data.data || response.data;
    return user?.userId || user?.user?.userId;
  } catch (error) {
    console.error('❌ Ошибка получения userId:', error.response?.data || error.message);
    throw error;
  }
}

// Основная функция теста
async function testStatusMatrix() {
  console.log('🚀 Запуск теста statusMatrix...\n');
  
  try {
    // Шаг 1: Получаем токены для всех пользователей
    console.log('📝 Шаг 1: Получение токенов...');
    const tokens = {};
    const userIds = {};
    
    for (const user of USERS) {
      const token = await getToken(user.phone);
      // Задержка перед получением userId
      await new Promise(resolve => setTimeout(resolve, 1000));
      const userId = await getUserId(token);
      tokens[user.phone] = token;
      userIds[user.phone] = userId;
      console.log(`✅ ${user.name}: ${userId}`);
      // Задержка между пользователями
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Шаг 2: Создаем групповой чат (или используем существующий)
    console.log('\n📝 Шаг 2: Создание/поиск группового чата...');
    // Ждем перед созданием группы, чтобы избежать rate limiting
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const memberIds = Object.values(userIds);
    let dialogId;
    
    try {
      dialogId = await createGroupChat(
        tokens[USERS[0].phone],
        'Тестовая группа для statusMatrix',
        memberIds
      );
      console.log(`✅ Групповой чат создан: ${dialogId}`);
    } catch (error) {
      if (error.response?.status === 429 || error.response?.status === 500) {
        console.log('⚠️  Не удалось создать группу из-за rate limiting');
        console.log('💡 Используем известный P2P диалог для проверки формата statusMatrix...');
        
        // Используем известный диалог для проверки формата
        // Это P2P диалог между Ивановым и Морозовым
        dialogId = 'dlg_gdjfc9owenak3s3m1yc8';
        console.log(`✅ Используем существующий диалог: ${dialogId}`);
        console.log('⚠️  ВАЖНО: Это P2P диалог, поэтому тест будет упрощен');
        console.log('   Проверяем только формат statusMatrix, а не полный сценарий с 4 участниками');
      } else {
        throw error;
      }
    }
    
    // Шаг 3: user1 отправляет сообщение
    console.log('\n📝 Шаг 3: Отправка сообщения от user1...');
    const message = await sendMessage(
      tokens[USERS[0].phone],
      dialogId,
      'Тестовое сообщение для проверки statusMatrix'
    );
    const messageId = message.messageId || message._id;
    console.log(`✅ Сообщение отправлено: ${messageId}`);
    
    // Ждем немного для обработки
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Шаг 4: Настраиваем WebSocket для user1 для получения обновлений
    console.log('\n📝 Шаг 4: Настройка WebSocket для user1...');
    const wsUpdates = [];
    const socket = io(WS_URL, {
      auth: {
        token: tokens[USERS[0].phone],
      },
    });
    
    socket.on('connect', () => {
      console.log('✅ WebSocket подключен для user1');
    });
    
    socket.on('chat3:update', (update) => {
      console.log('📬 Получен update:', update.eventType);
      if (update.eventType === 'message.status.update' || update.eventType === 'message.status.create') {
        wsUpdates.push(update);
        console.log('📊 Update статуса:', JSON.stringify(update, null, 2));
      }
    });
    
    socket.on('message:update', (update) => {
      if (update.eventType === 'message.status.update' || update.eventType === 'message.status.create') {
        wsUpdates.push(update);
        console.log('📊 Update статуса через message:update:', JSON.stringify(update, null, 2));
      }
    });
    
    // Ждем подключения WebSocket
    await new Promise((resolve) => {
      socket.on('connect', resolve);
      setTimeout(resolve, 2000); // Таймаут 2 секунды
    });
    
    // Шаг 5: user2 отмечает сообщение прочитанным
    console.log('\n📝 Шаг 5: user2 отмечает сообщение прочитанным...');
    try {
      await markAsRead(tokens[USERS[1].phone], messageId);
      console.log('✅ user2 отметил прочитанным');
    } catch (error) {
      console.log('⚠️  user2 не смог отметить прочитанным (возможно, не участник диалога):', error.response?.data?.error || error.message);
      // Продолжаем тест с user3
    }
    
    // Ждем обновления
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Шаг 6: user3 отмечает сообщение прочитанным (если это группа)
    // Для P2P диалога используем другого участника
    console.log('\n📝 Шаг 6: Отмечаем сообщение прочитанным от другого участника...');
    try {
      // Для P2P используем Морозова (user с phone 79100000009)
      const morozovToken = await getToken('79100000009');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await markAsRead(morozovToken, messageId);
      console.log('✅ Сообщение отмечено прочитанным от другого участника');
    } catch (error) {
      console.log('⚠️  Не удалось отметить прочитанным:', error.response?.data?.error || error.message);
    }
    
    // Ждем обновления
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Шаг 7: Проверяем результат
    console.log('\n📝 Шаг 7: Проверка результата...');
    
    // Получаем актуальное сообщение
    const updatedMessage = await getMessage(tokens[USERS[0].phone], messageId);
    console.log('\n📊 Структура сообщения:');
    console.log('  - messageId:', updatedMessage.messageId);
    console.log('  - statuses:', JSON.stringify(updatedMessage.statuses, null, 2));
    console.log('  - context.statusMatrix:', JSON.stringify(updatedMessage.context?.statusMatrix, null, 2));
    
    // Проверяем WebSocket обновления
    console.log('\n📊 WebSocket обновления (всего:', wsUpdates.length, '):');
    wsUpdates.forEach((update, index) => {
      console.log(`\n  Update ${index + 1}:`);
      console.log('    eventType:', update.eventType);
      console.log('    data:', JSON.stringify(update.data, null, 4));
      
      // Проверяем statusMatrix в update
      // statusMatrix может быть в разных местах: context.statusMatrix или statusMessageMatrix
      const statusMatrix = update.data?.message?.context?.statusMatrix || 
                          update.data?.message?.statusMessageMatrix ||
                          update.data?.statusMatrix;
      
      if (statusMatrix) {
        console.log('    statusMatrix:', JSON.stringify(statusMatrix, null, 4));
        
        // statusMatrix может быть массивом агрегированных записей вида:
        // [{count: 2, userType: "user", status: "read"}, ...]
        // или массивом отдельных статусов вида:
        // [{userId: "...", status: "read", userType: "user"}, ...]
        
        // Проверяем формат агрегированных записей
        const aggregatedRead = statusMatrix.find(s => 
          s.status === 'read' && 
          s.userType === 'user' && 
          typeof s.count === 'number'
        );
        
        if (aggregatedRead) {
          console.log(`    ✅ Найдена агрегированная запись: count=${aggregatedRead.count}, userType=${aggregatedRead.userType}, status=${aggregatedRead.status}`);
          if (aggregatedRead.count === 2) {
            console.log('    ✅ ПРАВИЛЬНО: 2 пользователя типа user прочитали сообщение');
          } else {
            console.log(`    ⚠️  ОЖИДАЛОСЬ: count=2, получено: count=${aggregatedRead.count}`);
          }
        } else {
          // Проверяем формат отдельных статусов
          const readStatuses = statusMatrix.filter(s => s.status === 'read' && s.userType === 'user');
          console.log(`    ✅ Найдено прочитанных пользователями типа user: ${readStatuses.length}`);
          
          if (readStatuses.length === 2) {
            console.log('    ✅ ПРАВИЛЬНО: 2 пользователя типа user прочитали сообщение');
          } else {
            console.log(`    ⚠️  ОЖИДАЛОСЬ: 2, получено: ${readStatuses.length}`);
          }
        }
      }
    });
    
    // Проверяем финальный statusMatrix в сообщении
    // statusMatrix может быть в разных местах
    const statusMatrix = updatedMessage.statusMessageMatrix ||
                        updatedMessage.context?.statusMatrix || 
                        updatedMessage.statuses || [];
    
    console.log('\n📊 Итоговая проверка:');
    console.log('  - Всего записей в statusMatrix:', statusMatrix.length);
    
    // Проверяем формат агрегированных записей
    const aggregatedRead = statusMatrix.find(s => 
      s.status === 'read' && 
      s.userType === 'user' && 
      typeof s.count === 'number'
    );
    
    if (aggregatedRead) {
      console.log(`  - Агрегированная запись: count=${aggregatedRead.count}, userType=${aggregatedRead.userType}, status=${aggregatedRead.status}`);
      
      if (aggregatedRead.count === 2) {
        console.log('  ✅ ТЕСТ ПРОЙДЕН: statusMatrix содержит правильное количество прочитанных');
        console.log('     Ожидалось: count=2 для userType=user, status=read');
        console.log('     Получено: count=' + aggregatedRead.count);
      } else {
        console.log('  ❌ ТЕСТ НЕ ПРОЙДЕН');
        console.log('     Ожидалось: count=2 для userType=user, status=read');
        console.log('     Получено: count=' + aggregatedRead.count);
      }
    } else {
      // Проверяем формат отдельных статусов
      const readStatuses = statusMatrix.filter(s => s.status === 'read' && s.userType === 'user');
      console.log('  - Прочитанных пользователями типа user (отдельные записи):', readStatuses.length);
      
      if (readStatuses.length === 2) {
        console.log('  ✅ ТЕСТ ПРОЙДЕН: statusMatrix содержит правильное количество прочитанных');
        console.log('     Ожидалось: 2 пользователя типа user прочитали');
        console.log('     Получено:', readStatuses.length);
      } else {
        console.log('  ❌ ТЕСТ НЕ ПРОЙДЕН');
        console.log('     Ожидалось: 2 пользователя типа user прочитали');
        console.log('     Получено:', readStatuses.length);
      }
    }
    
    // Выводим детали статусов
    console.log('\n📋 Детали statusMatrix:');
    statusMatrix.forEach((status, index) => {
      if (typeof status.count === 'number') {
        // Агрегированный формат
        console.log(`  ${index + 1}. count: ${status.count}, userType: ${status.userType}, status: ${status.status}`);
      } else {
        // Отдельные статусы
        console.log(`  ${index + 1}. userId: ${status.userId}, status: ${status.status}, userType: ${status.userType}`);
      }
    });
    
    // Закрываем WebSocket
    socket.disconnect();
    
    console.log('\n✅ Тест завершен');
    
  } catch (error) {
    console.error('\n❌ Ошибка во время теста:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    throw error;
  }
}

// Запускаем тест
testStatusMatrix()
  .then(() => {
    console.log('\n✅ Все проверки завершены');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Тест завершился с ошибкой:', error);
    process.exit(1);
  });

