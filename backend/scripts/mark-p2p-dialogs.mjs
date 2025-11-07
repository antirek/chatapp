#!/usr/bin/env node

/**
 * Скрипт для маркировки существующих диалогов как P2P
 * Устанавливает мета-тег type=p2p для всех диалогов с 2 участниками
 */

import mongoose from 'mongoose';
import config from '../src/config/index.js';
import User from '../src/models/User.js';
import chat3ClientInstance from '../src/services/Chat3Client.js';

// Используем существующий экземпляр Chat3Client
const chat3Client = chat3ClientInstance;

// Получение всех диалогов пользователя
async function getUserAllDialogs(userId) {
  const allDialogs = [];
  let page = 1;
  const limit = 100;
  
  while (true) {
    try {
      const result = await chat3Client.getUserDialogs(userId, {
        page,
        limit,
      });
      
      if (!result.data || result.data.length === 0) {
        break;
      }
      
      allDialogs.push(...result.data);
      
      // Проверяем, есть ли еще страницы
      if (!result.pagination || result.pagination.hasNextPage === false) {
        break;
      }
      
      page++;
    } catch (error) {
      console.error(`Ошибка получения диалогов для пользователя ${userId}:`, error.message);
      break;
    }
  }
  
  return allDialogs;
}

// Получение полной информации о диалоге
async function getDialogInfo(dialogId) {
  try {
    const dialog = await chat3Client.getDialog(dialogId);
    return dialog.data || dialog;
  } catch (error) {
    console.error(`Ошибка получения диалога ${dialogId}:`, error.message);
    return null;
  }
}

// Установка мета-тега type=p2p для диалога
async function setDialogType(dialogId, type) {
  try {
    await chat3Client.setMeta('dialog', dialogId, 'type', { value: type });
    return true;
  } catch (error) {
    console.error(`Ошибка установки мета-тега для диалога ${dialogId}:`, error.message);
    return false;
  }
}

// Проверка, установлен ли уже мета-тег type
async function hasDialogType(dialogId) {
  try {
    const meta = await chat3Client.getMeta('dialog', dialogId);
    return meta?.type !== undefined;
  } catch (error) {
    // Если мета-тег не найден, возвращаем false
    return false;
  }
}

// Основная функция
async function main() {
  console.log('🚀 Начало маркировки диалогов как P2P...\n');
  
  try {
    // Подключаемся к MongoDB
    console.log('📦 Подключение к MongoDB...');
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ Подключено к MongoDB\n');
    
    // Получаем всех пользователей
    const users = await User.find({}).select('userId name');
    console.log(`👥 Найдено пользователей: ${users.length}\n`);
    
    const processedDialogs = new Set(); // Для отслеживания уже обработанных диалогов
    let markedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Обрабатываем диалоги для каждого пользователя
    for (const user of users) {
      console.log(`\n📋 Обработка диалогов пользователя: ${user.name} (${user.userId})`);
      
      try {
        // Получаем все диалоги пользователя
        const dialogs = await getUserAllDialogs(user.userId);
        console.log(`   Найдено диалогов: ${dialogs.length}`);
        
        for (const dialog of dialogs) {
          const dialogId = dialog.dialogId || dialog._id;
          
          if (!dialogId) {
            console.warn(`   ⚠️  Пропущен диалог без ID`);
            continue;
          }
          
          // Пропускаем, если уже обработали этот диалог
          if (processedDialogs.has(dialogId)) {
            continue;
          }
          
          processedDialogs.add(dialogId);
          
          // Проверяем, установлен ли уже мета-тег type
          const hasType = await hasDialogType(dialogId);
          if (hasType) {
            console.log(`   ⏭️  Диалог ${dialogId} уже имеет мета-тег type, пропускаем`);
            skippedCount++;
            continue;
          }
          
          // Получаем полную информацию о диалоге
          const dialogInfo = await getDialogInfo(dialogId);
          if (!dialogInfo) {
            console.warn(`   ⚠️  Не удалось получить информацию о диалоге ${dialogId}`);
            errorCount++;
            continue;
          }
          
          // Проверяем количество участников
          const members = dialogInfo.members || [];
          const memberCount = members.length;
          
          console.log(`   📊 Диалог ${dialogId}: ${memberCount} участников`);
          
          // Если участников 2, устанавливаем мета-тег type=p2p
          if (memberCount === 2) {
            const success = await setDialogType(dialogId, 'p2p');
            if (success) {
              console.log(`   ✅ Установлен мета-тег type=p2p для диалога ${dialogId}`);
              markedCount++;
            } else {
              console.warn(`   ⚠️  Не удалось установить мета-тег для диалога ${dialogId}`);
              errorCount++;
            }
          } else {
            console.log(`   ℹ️  Диалог ${dialogId} имеет ${memberCount} участников, пропускаем (не P2P)`);
            skippedCount++;
          }
          
          // Небольшая задержка между запросами
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`   ❌ Ошибка обработки диалогов пользователя ${user.userId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n✅ Маркировка завершена!\n');
    console.log('📊 Итоговая информация:');
    console.log(`   - Обработано уникальных диалогов: ${processedDialogs.size}`);
    console.log(`   - Помечено как P2P: ${markedCount}`);
    console.log(`   - Пропущено (уже имеет тип или не P2P): ${skippedCount}`);
    console.log(`   - Ошибок: ${errorCount}`);
    
  } catch (error) {
    console.error('\n❌ Ошибка при маркировке диалогов:', error);
    process.exit(1);
  } finally {
    // Закрываем соединение с MongoDB
    await mongoose.disconnect();
    console.log('\n📦 Соединение с MongoDB закрыто');
  }
}

// Запускаем скрипт
main().catch(console.error);

