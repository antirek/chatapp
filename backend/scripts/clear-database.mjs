#!/usr/bin/env node

/**
 * Скрипт для очистки базы данных
 * Удаляет всех пользователей из MongoDB
 */

import mongoose from 'mongoose';
import config from '../src/config/index.js';
import User from '../src/models/User.js';

async function main() {
  console.log('🧹 Очистка базы данных...\n');
  
  try {
    // Подключаемся к MongoDB
    console.log('📦 Подключение к MongoDB...');
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ Подключено к MongoDB\n');
    
    // Удаляем всех пользователей
    const result = await User.deleteMany({});
    console.log(`✅ Удалено пользователей из локальной БД: ${result.deletedCount}`);
    
    console.log('\n✅ База данных очищена!');
    
  } catch (error) {
    console.error('\n❌ Ошибка при очистке базы данных:', error);
    process.exit(1);
  } finally {
    // Закрываем соединение с MongoDB
    await mongoose.disconnect();
    console.log('\n📦 Соединение с MongoDB закрыто');
  }
}

// Запускаем скрипт
main().catch(console.error);

