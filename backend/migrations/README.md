# Database Migrations

Скрипты миграции базы данных.

## Как запустить миграцию

```bash
# Убедитесь что MongoDB запущена и .env настроен
cd backend

# Запустить миграцию
node migrations/add-userId.js
```

## Доступные миграции

### add-userId.js

**Описание:** Добавляет кастомное поле `userId` (формат: `usr_XXXXXXXX`) для всех существующих пользователей.

**Когда использовать:** При обновлении с версии без `userId` на версию с `userId`.

**Безопасность:**
- ✅ Не удаляет данные
- ✅ Только добавляет новое поле
- ✅ Проверяет уникальность userId
- ✅ Показывает прогресс выполнения

**Пример вывода:**
```
🔌 Connecting to MongoDB: mongodb://localhost:27017/chatpapp
✅ Connected to MongoDB

📊 Found 3 users without userId

🔄 Starting migration...

✅ 79123456789 -> usr_a3f9k2p1
✅ 79987654321 -> usr_b7x2m5n9
✅ 79555555555 -> usr_c1d8p4q7

📈 Migration Summary:
   ✅ Success: 3
   ❌ Failed: 0
   📊 Total: 3

✨ Migration completed successfully! All users have userId.

🔌 Disconnecting from MongoDB...
✅ Done!
```

## Откат миграции

Если нужно откатить миграцию:

```javascript
// rollback-userId.js
import mongoose from 'mongoose';

await mongoose.connect('mongodb://localhost:27017/chatpapp');

const User = mongoose.model('User', new mongoose.Schema({
  userId: String
}));

// Удалить поле userId у всех пользователей
await User.updateMany({}, { $unset: { userId: '' } });

console.log('✅ Rollback complete');
await mongoose.disconnect();
```

## Создание новой миграции

1. Создайте файл в `migrations/` с описательным именем
2. Используйте формат: `action-description.js`
3. Добавьте описание в этот README
4. Используйте существующие миграции как шаблон

### Шаблон миграции

```javascript
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected');
    
    // Ваша логика миграции здесь
    
    console.log('✅ Migration complete');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
```

