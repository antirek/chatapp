# Chat Application Backend

Бэкенд сервер для чат-приложения с интеграцией Chat3 API.

## Возможности

- 🔐 **Авторизация по SMS** - вход по номеру телефона с 4-значным кодом
- 🔑 **JWT токены** - сессии на 48 часов
- 🆔 **Кастомные userId** - формат `usr_XXXXXXXX`
- 💬 **Интеграция с Chat3** - управление диалогами и сообщениями
- 🔌 **WebSocket** - real-time обновления
- 📬 **RabbitMQ** - получение обновлений из Chat3
- 📱 **REST API** - удобные эндпоинты для фронтенда
- 💾 **MongoDB** - хранение пользователей

## Установка

```bash
cd backend
npm install
```

## Настройка

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Заполните переменные окружения:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/chatpapp
CHAT3_API_URL=http://localhost:3002/api
CHAT3_API_KEY=your-api-key
RABBITMQ_URL=amqp://rmuser:rmpassword@localhost:5672/
RABBITMQ_UPDATES_EXCHANGE=chat3_updates
```

## Запуск

### Development режим (с hot-reload):
```bash
npm run dev
```

### Production режим:
```bash
npm start
```

## API Endpoints

### Авторизация

#### POST /api/auth/request-code
Запрос кода авторизации

**Request:**
```json
{
  "phone": "79123456789",
  "name": "Иван Иванов"  // Обязательно для новых пользователей
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent",
  "isNewUser": false
}
```

#### POST /api/auth/verify-code
Проверка кода и получение токена

**Request:**
```json
{
  "phone": "79123456789",
  "code": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt-token...",
  "user": {
    "userId": "usr_a3f9k2p1",
    "phone": "79123456789",
    "name": "Иван Иванов"
  }
}
```

> **Note:** `userId` имеет формат `usr_XXXXXXXX` где X - строчная буква или цифра (8 символов)

#### GET /api/auth/me
Получить информацию о текущем пользователе

**Headers:**
```
Authorization: Bearer <jwt-token>
```

### Диалоги

Все эндпоинты требуют авторизацию (Bearer token).

#### GET /api/dialogs
Получить список диалогов пользователя

**Query params:**
- `page` - номер страницы (default: 1)
- `limit` - количество на странице (default: 10)
- `includeLastMessage` - включить последнее сообщение (default: false)

#### POST /api/dialogs
Создать новый диалог

**Request:**
```json
{
  "name": "Название диалога",
  "memberIds": ["userId1", "userId2"]
}
```

#### GET /api/dialogs/:dialogId
Получить диалог по ID

#### DELETE /api/dialogs/:dialogId
Удалить диалог

#### POST /api/dialogs/:dialogId/members
Добавить участника в диалог

**Request:**
```json
{
  "userId": "usr_a3f9k2p1"
}
```

#### DELETE /api/dialogs/:dialogId/members/:userId
Удалить участника из диалога

### Сообщения

#### GET /api/dialog/:dialogId/messages
Получить сообщения диалога

**Query params:**
- `page` - номер страницы (default: 1)
- `limit` - количество на странице (default: 50)

#### POST /api/dialog/:dialogId/messages
Отправить сообщение в диалог

**Request:**
```json
{
  "content": "Текст сообщения",
  "type": "text",
  "meta": {}
}
```

#### POST /api/messages/:messageId/status/:status
Обновить статус сообщения (read/delivered)

#### GET /api/messages/:messageId/reactions
Получить реакции на сообщение

#### POST /api/messages/:messageId/reactions
Добавить реакцию

**Request:**
```json
{
  "reaction": "👍"
}
```

## WebSocket Events

### Подключение

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: {
    token: 'jwt-token'
  }
});
```

### События от клиента

- `dialog:join` - войти в комнату диалога
- `dialog:leave` - покинуть комнату диалога
- `typing:start` - начал печатать
- `typing:stop` - закончил печатать

### События от сервера

#### Chat3 Updates (через RabbitMQ)
- `chat3:update` - все обновления из Chat3
- `message:new` - новое сообщение (из Chat3)
- `message:update` - изменения сообщения (реакции, статусы)
- `dialog:update` - изменения диалога

#### Локальные события
- `user:online` - пользователь онлайн
- `user:offline` - пользователь оффлайн
- `typing:start` - пользователь печатает
- `typing:stop` - пользователь закончил печатать

Полная документация: [WEBSOCKET.md](WEBSOCKET.md), [RabbitMQ Integration](docs/RABBITMQ_INTEGRATION.md)

## Структура проекта

```
backend/
├── src/
│   ├── config/          # Конфигурация
│   ├── db/              # Подключение к БД
│   ├── models/          # Mongoose модели
│   ├── services/        # Бизнес-логика
│   │   ├── AuthService.js
│   │   ├── SMSService.js
│   │   └── Chat3Client.js
│   ├── routes/          # API роуты
│   │   ├── auth.js
│   │   ├── dialogs.js
│   │   └── messages.js
│   ├── middleware/      # Express middleware
│   │   └── auth.js
│   └── websocket/       # WebSocket сервер
├── server.js            # Точка входа
├── package.json
└── .env
```

## Разработка

### SMS в dev режиме

В development режиме SMS коды выводятся в консоль:

```
📱 [SMS MOCK] Sending code to 79123456789
🔐 Verification code: 1234
⏰ Valid for 5 minutes
```

### JWT Secret

При первом запуске без указанного JWT_SECRET генерируется случайный:

```
⚠️  Generated JWT Secret: abc123...
💡 Add it to .env file: JWT_SECRET=abc123...
```

## Production

1. Установите реальный SMS сервис в `SMSService.js`
2. Настройте CORS в `websocket/index.js`
3. Используйте реальный MongoDB URI
4. Установите `NODE_ENV=production`
5. Используйте process manager (PM2, systemd)

## Зависимости

- **express** - веб-фреймворк
- **mongoose** - MongoDB ODM
- **socket.io** - WebSocket сервер
- **amqplib** - RabbitMQ клиент
- **axios** - HTTP клиент для Chat3 API
- **jsonwebtoken** - JWT токены
- **cors** - CORS middleware
- **helmet** - безопасность HTTP заголовков

## Дополнительная документация

- 📐 [ARCHITECTURE.md](../docs/ARCHITECTURE.md) - **Комплексная архитектура приложения с диаграммами**
- 🔌 [WEBSOCKET.md](WEBSOCKET.md) - WebSocket API и события
- 📬 [RABBITMQ_INTEGRATION.md](docs/RABBITMQ_INTEGRATION.md) - Интеграция с Chat3 через RabbitMQ
- 🔄 [MIGRATION.md](MIGRATION.md) - Миграция на кастомные userId
- 📋 [CHANGELOG.md](CHANGELOG.md) - История изменений

