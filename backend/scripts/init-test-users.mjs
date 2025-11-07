#!/usr/bin/env node

/**
 * Скрипт для инициализации тестовых пользователей
 * Создает 10 пользователей с именами и аватарами в chatpapp и Chat3 API
 * Для Иванова Ивана создает диалоги со всеми остальными пользователями
 */

import mongoose from 'mongoose';
import config from '../src/config/index.js';
import User from '../src/models/User.js';
import chat3ClientInstance from '../src/services/Chat3Client.js';

// Chat3Client экспортируется как экземпляр, используем его напрямую
const chat3Client = chat3ClientInstance;

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
// Формат: 79 + 9 цифр (всего 11 символов)
function generatePhone(index) {
  // Начинаем с 7910000000 + index (79 + 100000000 + index)
  // 79 + 100000000 = 79100000000 (11 символов), добавляем index (0-9) = 11 символов
  // Для индекса 0-9: 79100000000 - 79100000009
  return `791000000${index.toString().padStart(2, '0')}`;
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
    
    // Устанавливаем мета-тег type=p2p для диалога
    try {
      await chat3Client.setMeta('dialog', dialogId, 'type', { value: 'p2p' });
      console.log(`✅ Установлен мета-тег type=p2p для диалога ${dialogId}`);
    } catch (metaError) {
      console.warn(`⚠️  Не удалось установить мета-тег type=p2p для диалога ${dialogId}:`, metaError.message);
    }
    
    console.log(`✅ Создан диалог между ${name1} и ${name2} (${dialogId})`);
    return dialogId;
  } catch (error) {
    console.error(`❌ Ошибка создания диалога между ${name1} и ${name2}:`, error.message);
    throw error;
  }
}

// Создание группы с несколькими участниками
async function createGroup(chat3Client, ownerId, ownerName, groupName, memberIds) {
  try {
    // Создаем диалог (группу)
    const dialog = await chat3Client.createDialog({
      name: groupName,
      createdBy: ownerId,
    });
    
    const dialogId = dialog.data?.dialogId || dialog.data?._id || dialog.dialogId || dialog._id;
    
    if (!dialogId) {
      throw new Error('Не удалось получить dialogId из ответа');
    }
    
    // Добавляем создателя как участника
    await chat3Client.addDialogMember(dialogId, ownerId);
    
    // Добавляем остальных участников
    for (const memberId of memberIds) {
      await chat3Client.addDialogMember(dialogId, memberId);
    }
    
    // Устанавливаем мета-тег type=group для диалога
    try {
      await chat3Client.setMeta('dialog', dialogId, 'type', { value: 'group' });
      console.log(`✅ Установлен мета-тег type=group для группы ${dialogId}`);
    } catch (metaError) {
      console.warn(`⚠️  Не удалось установить мета-тег type=group для группы ${dialogId}:`, metaError.message);
    }
    
    // Устанавливаем мета-тег role=owner для создателя
    try {
      await chat3Client.setMeta('dialogMember', `${dialogId}:${ownerId}`, 'role', { value: 'owner' });
      console.log(`✅ Установлен мета-тег role=owner для создателя ${ownerName} в группе ${dialogId}`);
    } catch (roleError) {
      console.warn(`⚠️  Не удалось установить мета-тег role=owner для создателя в группе ${dialogId}:`, roleError.message);
    }
    
    console.log(`✅ Создана группа "${groupName}" (${dialogId}) с ${memberIds.length + 1} участниками`);
    return dialogId;
  } catch (error) {
    console.error(`❌ Ошибка создания группы "${groupName}":`, error.message);
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
    
    // Используем существующий экземпляр Chat3Client (уже настроен с конфигурацией)
    
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
    
    // Создаем две группы с несколькими участниками
    console.log(`👥 Создание групп для ${ivanov.name}...\n`);
    
    // Группа 1: Первые 4 участника (кроме Иванова)
    const group1Members = createdUsers
      .filter(u => u.userId !== ivanov.userId)
      .slice(0, 4)
      .map(u => u.userId);
    
    if (group1Members.length > 0) {
      try {
        await createGroup(
          chat3Client,
          ivanov.userId,
          ivanov.name,
          'Тестовая группа 1',
          group1Members
        );
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`⚠️  Пропущена группа 1:`, error.message);
      }
    }
    
    // Группа 2: Следующие 3 участника (если есть)
    const group2Members = createdUsers
      .filter(u => u.userId !== ivanov.userId)
      .slice(4, 7)
      .map(u => u.userId);
    
    if (group2Members.length > 0) {
      try {
        await createGroup(
          chat3Client,
          ivanov.userId,
          ivanov.name,
          'Тестовая группа 2',
          group2Members
        );
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`⚠️  Пропущена группа 2:`, error.message);
      }
    }
    
    console.log('\n✅ Все группы созданы!\n');
    
    // Выводим итоговую информацию
    console.log('📊 Итоговая информация:');
    console.log(`   - Создано пользователей: ${createdUsers.length}`);
    console.log(`   - Создано P2P диалогов для ${ivanov.name}: ${createdUsers.length - 1}`);
    console.log(`   - Создано групп: 2`);
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

