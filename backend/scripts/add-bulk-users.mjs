#!/usr/bin/env node

/**
 * Скрипт для массового добавления тестовых пользователей и создания P2P-диалогов
 * с Ивановым Иваном.
 *
 * Использование:
 *   node scripts/add-bulk-users.mjs [количество]
 *
 * По умолчанию создаётся 300 пользователей.
 */

import mongoose from 'mongoose';
import config from '../src/config/index.js';
import User from '../src/models/User.js';
import chat3ClientInstance from '../src/services/Chat3Client.js';
import { updateP2PPersonalization } from '../src/utils/p2pPersonalization.js';

const chat3Client = chat3ClientInstance;

const TARGET_COUNT = parseInt(process.argv[2] ?? '300', 10);
if (Number.isNaN(TARGET_COUNT) || TARGET_COUNT <= 0) {
  console.error('❌ Некорректное количество пользователей. Использование: node scripts/add-bulk-users.mjs [количество]');
  process.exit(1);
}

const COLORS = [
  { bg: '#4F46E5', text: '#FFFFFF' },
  { bg: '#2563EB', text: '#FFFFFF' },
  { bg: '#D97706', text: '#FFFFFF' },
  { bg: '#047857', text: '#FFFFFF' },
  { bg: '#0891B2', text: '#FFFFFF' },
  { bg: '#DC2626', text: '#FFFFFF' },
  { bg: '#7C3AED', text: '#FFFFFF' },
  { bg: '#BE185D', text: '#FFFFFF' },
  { bg: '#1D4ED8', text: '#FFFFFF' },
  { bg: '#6D28D9', text: '#FFFFFF' },
];

function padNumber(num, width = 3) {
  return num.toString().padStart(width, '0');
}

function buildName(index) {
  const formatted = padNumber(index + 1, 4);
  const lastName = `Тестов${formatted}`;
  const firstName = `Пользователь${formatted}`;
  const name = `${lastName} ${firstName}`;
  return { firstName, lastName, name };
}

function generateAvatarSVG(lastName, firstName, index) {
  const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
  const color = COLORS[index % COLORS.length];

  const svg = `
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="${color.bg}"/>
  <circle cx="100" cy="100" r="80" fill="${color.bg}" stroke="${color.text}" stroke-width="3"/>
  <text x="100" y="120" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="${color.text}" text-anchor="middle">${initials}</text>
</svg>
`.trim();

  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

async function createLocalUser(name, phone) {
  const existing = await User.findOne({ phone });
  if (existing) {
    console.log(`⚠️  Пользователь с телефоном ${phone} уже существует, пропускаем`);
    return null;
  }

  const user = new User({ phone, name });
  await user.save();
  console.log(`✅ Создан пользователь в локальной БД: ${name} (${user.userId})`);
  return user;
}

async function ensureChat3User(userId, name, phone) {
  try {
    await chat3Client.getUser(userId);
    console.log(`⚠️  Пользователь ${userId} уже существует в Chat3 API`);
    return;
  } catch (error) {
    if (error.response?.status !== 404) {
      throw error;
    }
  }

  await chat3Client.createUser(userId, { name, phone });
  console.log(`✅ Создан пользователь в Chat3 API: ${name} (${userId})`);
}

async function uploadAvatar(userId, avatar) {
  await chat3Client.setMeta('user', userId, 'avatar', { value: avatar });
  console.log(`✅ Аватар загружен для пользователя ${userId}`);
}

async function createP2PDialog(ivanovId, ivanovName, userId, userName) {
  const dialogResponse = await chat3Client.createDialog({
    name: `Диалог с ${userName}`,
    createdBy: ivanovId,
  });

  const dialogId =
    dialogResponse.data?.dialogId ||
    dialogResponse.data?._id ||
    dialogResponse.dialogId ||
    dialogResponse._id;

  if (!dialogId) {
    throw new Error('Не удалось получить dialogId из ответа Chat3');
  }

  await chat3Client.addDialogMember(dialogId, ivanovId);
  await chat3Client.addDialogMember(dialogId, userId);

  try {
    await chat3Client.setMeta('dialog', dialogId, 'type', { value: 'p2p' });
  } catch (error) {
    console.warn(`⚠️  Не удалось установить мета-тег type=p2p для диалога ${dialogId}:`, error.message);
  }

  await updateP2PPersonalization(dialogId, ivanovId, userId);

  console.log(`💬 Создан P2P диалог между ${ivanovName} и ${userName} (${dialogId})`);
  return dialogId;
}

async function main() {
  console.log(`🚀 Запуск массового создания ${TARGET_COUNT} пользователей...`);

  try {
    console.log('📦 Подключение к MongoDB...');
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ Подключено к MongoDB\n');

    const ivanov = await User.findOne({ name: 'Иванов Иван' });
    if (!ivanov) {
      console.error('❌ Иванов Иван не найден. Убедитесь, что базовые пользователи созданы.');
      process.exit(1);
    }

    console.log(`👤 Найден Иванов Иван: ${ivanov.userId}\n`);

    const existingUsersCount = await User.countDocuments();
    const startIndex = existingUsersCount + 1;
    const createdUsers = [];

    let attempt = 0;
    while (createdUsers.length < TARGET_COUNT) {
      const index = startIndex + attempt;
      const { firstName, lastName, name } = buildName(index);

      const phoneNumber = (BigInt('79600000000') + BigInt(index)).toString();
      attempt += 1;

      try {
        const localUser = await createLocalUser(name, phoneNumber);
        if (!localUser) {
          continue;
        }

        await ensureChat3User(localUser.userId, name, phoneNumber);

        const avatar = generateAvatarSVG(lastName, firstName, index);
        await uploadAvatar(localUser.userId, avatar);

        createdUsers.push({
          userId: localUser.userId,
          name,
          phone: phoneNumber,
        });

        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch (error) {
        console.error(`❌ Ошибка при создании пользователя ${name}:`, error.message);
      }
    }

    console.log(`\n✅ Создано ${createdUsers.length} пользователей. Создание диалогов...\n`);

    let dialogsCreated = 0;
    for (const user of createdUsers) {
      try {
        await createP2PDialog(ivanov.userId, ivanov.name, user.userId, user.name);
        dialogsCreated += 1;
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`⚠️  Не удалось создать диалог с ${user.name}:`, error.message);
      }
    }

    console.log('\n📊 Итог:');
    console.log(`   • Пользователи созданы: ${createdUsers.length}`);
    console.log(`   • Диалогов создано:     ${dialogsCreated}`);
    console.log(`   • Иванов Иван:           ${ivanov.userId}`);
    console.log('   • Первые 5 новых пользователей:');
    createdUsers.slice(0, 5).forEach((user, idx) => {
      console.log(`     ${idx + 1}. ${user.name} (${user.userId}) — ${user.phone}`);
    });

    console.log('\n✅ Массовое создание пользователей завершено успешно.');
  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Соединение с MongoDB закрыто');
  }
}

main().catch((error) => {
  console.error('❌ Неперехваченное исключение:', error);
  process.exit(1);
});


