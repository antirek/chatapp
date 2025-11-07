#!/usr/bin/env node

/**
 * Скрипт для инициализации тестовых пользователей
 * Создает 10 пользователей с именами и аватарами в chatpapp и Chat3 API
 * Для Иванова Ивана создает диалоги со всеми остальными пользователями
 */

import mongoose from 'mongoose';
import config from '../backend/src/config/index.js';
import User from '../backend/src/models/User.js';
import Chat3Client from '../backend/src/services/Chat3Client.js';

// Список тестовых пользователей
const TEST_USERS = [
  { lastName: 'Иванов', firstName: 'Иван' },
  { lastName: 'Петров', firstName: 'Петр' },
  { lastName: 'Сидоров', firstName: 'Сергей' },
  { lastName: 'Смирнов', firstName: 'Алексей' },
  { lastName: 'Кузнецов', firstName: 'Дмитрий' },
  { lastName: 'Попов', firstName: 'Андрей' },
  { lastName: 'Соколов', firstName: 'Михаил' },
  { lastName: 'Лебедев', firstName: 'Николай' },
  { lastName: 'Новиков', firstName: 'Владимир' },
  { lastName: 'Морозов', firstName: 'Александр' },
];

// Генерация уникального телефона
function generatePhone(index) {
  // Начинаем с 79100000000 + index
  return `7910000000${index.toString().padStart(2, '0')}`;
}

// Генерация SVG аватара с инициалами
function generateAvatarSVG(lastName, firstName, index) {
  const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
  
  // Генерируем цвет на основе индекса для разнообразия
  const colors = [
    { bg: '#4F46E5', text: '#FFFFFF' }, // Indigo
    { bg: '#059669', text: '#FFFFFF' }, // Emerald
    { bg: '#DC2626', text: '#FFFFFF' }, // Red
    { bg: '#D97706', text: '#FFFFFF' }, // Amber
    { bg: '#7C3AED', text: '#FFFFFF' }, // Violet
    { bg: '#0891B2', text: '#FFFFFF' }, // Cyan
    { bg: '#BE185D', text: '#FFFFFF' }, // Pink
    { bg: '#B91C1C', text: '#FFFFFF' }, // Rose
    { bg: '#1E40AF', text: '#FFFFFF' }, // Blue
    { bg: '#047857', text: '#FFFFFF' }, // Green
  ];
  
  const color = colors[index % colors.length];
  
  const svg = `
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="${color.bg}"/>
  <circle cx="100" cy="100" r="80" fill="${color.bg}" stroke="${color.text}" stroke-width="3"/>
  <text x="100" y="120" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="${color.text}" text-anchor="middle">${initials}</text>
</svg>
`.trim();
  
  // Конвертируем SVG в base64 data URL
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// Создание пользователя в локальной БД
async function createLocalUser(name, phone) {
  try {
    // Проверяем, существует ли пользователь
    let user = await User.findOne({ phone });
    
    if (user) {
      console.log(`⚠️  Пользователь с телефоном ${phone} уже существует, обновляем имя`);
      user.name = name;
      await user.save();
      return user;
    }
    
    // Создаем нового пользователя
    user = new User({
      phone,
      name,
      // Не устанавливаем verificationCode - это тестовые пользователи
    });
    
    await user.save();
    console.log(`✅ Создан пользователь в локальной БД: ${name} (${user.userId})`);
    return user;
  } catch (error) {
    console.error(`❌ Ошибка создания пользователя в локальной БД: ${name}`, error.message);
    throw error;
  }
}

// Создание пользователя в Chat3 API
async function createChat3User(chat3Client, userId, name, phone) {
  try {
    // Проверяем, существует ли пользователь в Chat3
    try {
      await chat3Client.getUser(userId);
      console.log(`⚠️  Пользователь ${userId} уже существует в Chat3 API`);
      return;
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
    }
    
    // Создаем пользователя в Chat3
    await chat3Client.createUser(userId, {
      name,
      phone,
    });
    
    console.log(`✅ Создан пользователь в Chat3 API: ${name} (${userId})`);
  } catch (error) {
    console.error(`❌ Ошибка создания пользователя в Chat3 API: ${name}`, error.message);
    throw error;
  }
}

// Загрузка аватара в Chat3
async function uploadAvatar(chat3Client, userId, avatar) {
  try {
    await chat3Client.setMeta('user', userId, 'avatar', { value: avatar });
    console.log(`✅ Аватар загружен для пользователя ${userId}`);
  } catch (error) {
    console.error(`❌ Ошибка загрузки аватара для пользователя ${userId}:`, error.message);
    throw error;
  }
}

// Создание диалога между двумя пользователями
async function createDialog(chat3Client, userId1, userId2, name1, name2) {
  try {
    // Создаем диалог
    const dialog = await chat3Client.createDialog({
      name: `Диалог с ${name2}`,
      createdBy: userId1,
    });
    
    const dialogId = dialog.data?.dialogId || dialog.data?._id || dialog.dialogId || dialog._id;
    
    if (!dialogId) {
      throw new Error('Не удалось получить dialogId из ответа');
    }
    
    // Добавляем участников
    await chat3Client.addDialogMember(dialogId, userId1);
    await chat3Client.addDialogMember(dialogId, userId2);
    
    console.log(`✅ Создан диалог между ${name1} и ${name2} (${dialogId})`);
    return dialogId;
  } catch (error) {
    console.error(`❌ Ошибка создания диалога между ${name1} и ${name2}:`, error.message);
    throw error;
  }
}

// Основная функция
async function main() {
  console.log('🚀 Начало инициализации тестовых пользователей...\n');
  
  try {
    // Подключаемся к MongoDB
    console.log('📦 Подключение к MongoDB...');
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ Подключено к MongoDB\n');
    
    // Инициализируем Chat3Client (глобально используется в функциях)
    const chat3Client = new Chat3Client();
    
    const createdUsers = [];
    
    // Создаем пользователей
    console.log('👥 Создание пользователей...\n');
    for (let i = 0; i < TEST_USERS.length; i++) {
      const { lastName, firstName } = TEST_USERS[i];
      const name = `${lastName} ${firstName}`;
      const phone = generatePhone(i);
      
      console.log(`\n[${i + 1}/${TEST_USERS.length}] Создание пользователя: ${name}`);
      
      // 1. Создаем в локальной БД
      const user = await createLocalUser(name, phone);
      
      // 2. Создаем в Chat3 API
      await createChat3User(chat3Client, user.userId, name, phone);
      
      // 3. Генерируем и загружаем аватар
      const avatar = generateAvatarSVG(lastName, firstName, i);
      await uploadAvatar(chat3Client, user.userId, avatar);
      
      createdUsers.push({
        userId: user.userId,
        name,
        phone,
        lastName,
        firstName,
      });
      
      // Небольшая задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('\n✅ Все пользователи созданы!\n');
    
    // Находим Иванова Ивана
    const ivanov = createdUsers.find(u => u.lastName === 'Иванов' && u.firstName === 'Иван');
    
    if (!ivanov) {
      console.error('❌ Не найден Иванов Иван!');
      return;
    }
    
    console.log(`💬 Создание диалогов для ${ivanov.name} со всеми остальными пользователями...\n`);
    
    // Создаем диалоги для Иванова со всеми остальными
    for (const otherUser of createdUsers) {
      if (otherUser.userId === ivanov.userId) {
        continue;
      }
      
      try {
        await createDialog(chat3Client, ivanov.userId, otherUser.userId, ivanov.name, otherUser.name);
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`⚠️  Пропущен диалог с ${otherUser.name}:`, error.message);
      }
    }
    
    console.log('\n✅ Все диалоги созданы!\n');
    
    // Выводим итоговую информацию
    console.log('📊 Итоговая информация:');
    console.log(`   - Создано пользователей: ${createdUsers.length}`);
    console.log(`   - Создано диалогов для ${ivanov.name}: ${createdUsers.length - 1}`);
    console.log('\n👤 Список пользователей:');
    createdUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.userId}) - ${user.phone}`);
    });
    
    console.log('\n✅ Инициализация завершена успешно!');
    
  } catch (error) {
    console.error('\n❌ Ошибка при инициализации:', error);
    process.exit(1);
  } finally {
    // Закрываем соединение с MongoDB
    await mongoose.disconnect();
    console.log('\n📦 Соединение с MongoDB закрыто');
  }
}

// Запускаем скрипт
main().catch(console.error);

