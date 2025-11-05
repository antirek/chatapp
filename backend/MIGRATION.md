# Migration Guide: Custom userId

## Обзор изменений

В модель `User` добавлено новое поле `userId` с автоматической генерацией кастомного ID в формате: `usr_XXXXXXXX`

- `usr_` - префикс
- `XXXXXXXX` - 8 случайных символов (строчные английские буквы и цифры)

## Изменения в API

### Формат ответа авторизации

**Было:**
```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "phone": "79123456789",
    "name": "Test User"
  }
}
```

**Стало:**
```json
{
  "user": {
    "userId": "usr_a3f9k2p1",
    "phone": "79123456789",
    "name": "Test User"
  }
}
```

### JWT токен

**Было:**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "phone": "79123456789"
}
```

**Стало:**
```json
{
  "userId": "usr_a3f9k2p1",
  "phone": "79123456789"
}
```

## Миграция данных

Если у вас есть существующие пользователи в базе данных, выполните следующую миграцию:

```javascript
// migration-add-userId.js
import mongoose from 'mongoose';
import crypto from 'crypto';

// Connect to MongoDB
await mongoose.connect('mongodb://localhost:27017/chatpapp');

function generateUserId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'usr_';
  const randomBytes = crypto.randomBytes(8);
  
  for (let i = 0; i < 8; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  
  return result;
}

// Get User model
const User = mongoose.model('User');

// Find all users without userId
const users = await User.find({ userId: { $exists: false } });

console.log(`Found ${users.length} users without userId`);

for (const user of users) {
  let userId;
  let attempts = 0;
  
  // Generate unique userId
  while (attempts < 10) {
    userId = generateUserId();
    const existing = await User.findOne({ userId });
    
    if (!existing) {
      user.userId = userId;
      await user.save();
      console.log(`✅ Updated user ${user.phone} -> ${userId}`);
      break;
    }
    
    attempts++;
  }
  
  if (attempts >= 10) {
    console.error(`❌ Failed to generate userId for ${user.phone}`);
  }
}

console.log('Migration complete!');
await mongoose.disconnect();
```

## Использование в коде

### Frontend

**Было:**
```javascript
const userId = user.id; // or user._id
```

**Стало:**
```javascript
const userId = user.userId;
```

### Backend

Все роуты теперь используют `req.user.userId`:

```javascript
// Было
const result = await Chat3Client.createMessage(dialogId, {
  senderId: req.user.id
});

// Стало
const result = await Chat3Client.createMessage(dialogId, {
  senderId: req.user.userId
});
```

## Преимущества

1. **Читаемость** - `usr_a3f9k2p1` более понятен чем ObjectId
2. **Удобство в логах** - легко идентифицировать пользователя в логах
3. **Независимость от MongoDB** - можно использовать с любой БД
4. **Короче** - 12 символов вместо 24 (ObjectId)
5. **URL-safe** - только буквы и цифры

## Проверка

После миграции проверьте:

```bash
# Запросить код
curl -X POST http://localhost:3001/api/auth/request-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"79123456789","name":"Test User"}'

# Проверить код (код будет в консоли сервера)
curl -X POST http://localhost:3001/api/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"79123456789","code":"1234"}'

# Ответ должен содержать userId в формате usr_XXXXXXXX
```

## Rollback (откат)

Если нужно вернуться к старому формату:

1. Удалить поле `userId` из модели User
2. Вернуть использование `_id` во всех файлах
3. Удалить индекс: `db.users.dropIndex("userId_1")`

