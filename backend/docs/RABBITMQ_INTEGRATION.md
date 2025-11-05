# RabbitMQ Integration

Интеграция с системой обновлений Chat3 через RabbitMQ.

## Архитектура

```
┌──────────────┐
│   Chat3 API  │  События: создание сообщений, диалогов, реакций и т.д.
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Update Worker│  Обработка событий и создание персонализированных Updates
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   RabbitMQ   │  Exchange: chat3_updates
│   Updates    │  Routing: user.{userId}.{updateType}
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Our API    │  RabbitMQService подписывается на updates
│   Backend    │  Пересылает через WebSocket клиентам
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Frontend   │  WebSocket клиент получает обновления в реальном времени
│   Client     │
└──────────────┘
```

## Компоненты

### 1. RabbitMQService

**Местонахождение:** `src/services/RabbitMQService.js`

**Функции:**
- Подключение к RabbitMQ
- Создание персональных очередей для пользователей
- Подписка на updates с routing key `user.{userId}.*`
- Автоматическое переподключение при обрыве связи
- Управление подписками пользователей

**Основные методы:**

```javascript
// Подключение к RabbitMQ
await RabbitMQService.connect();

// Подписка пользователя на updates
await RabbitMQService.subscribeUser(userId, (update) => {
  // Обработка полученного update
  console.log('Received update:', update);
});

// Отписка пользователя
await RabbitMQService.unsubscribeUser(userId);

// Закрытие соединения
await RabbitMQService.close();
```

### 2. WebSocket Integration

**Местонахождение:** `src/websocket/index.js`

При подключении пользователя к WebSocket:
1. Аутентификация через JWT
2. Автоматическая подписка на RabbitMQ updates
3. Пересылка updates через WebSocket события

При отключении:
1. Автоматическая отписка от RabbitMQ
2. Удаление персональной очереди

## Типы Updates

### MessageUpdate

Обновления о сообщениях:
- `message.create` - новое сообщение
- `message.update` - изменение сообщения
- `message.delete` - удаление сообщения
- `message.reaction.add` - добавление реакции
- `message.reaction.update` - изменение реакции
- `message.reaction.remove` - удаление реакции
- `message.status.create` - создание статуса (доставлено/прочитано)
- `message.status.update` - изменение статуса

### DialogUpdate

Обновления о диалогах:
- `dialog.create` - создание диалога
- `dialog.update` - изменение диалога
- `dialog.delete` - удаление диалога
- `dialog.member.add` - добавление участника
- `dialog.member.remove` - удаление участника

## Структура Update

```javascript
{
  _id: "507f1f77bcf86cd799439011",
  tenantId: "tnt_default",
  userId: "usr_a3f9k2p1",           // Получатель
  dialogId: "507f1f77bcf86cd799439012",
  entityId: "507f1f77bcf86cd799439013",
  eventId: "507f1f77bcf86cd799439014",
  eventType: "message.create",
  data: {
    // Полные данные сущности (Dialog или Message)
    _id: "507f1f77bcf86cd799439013",
    content: "Hello!",
    senderId: "usr_x7m2n4k9",
    type: "text",
    createdAt: "2025-11-04T12:18:32.000Z",
    meta: {
      channelType: "whatsapp"
    }
  },
  published: true,
  publishedAt: "2025-11-04T12:18:32.500Z",
  createdAt: "2025-11-04T12:18:32.450Z"
}
```

## WebSocket Events

### События от сервера к клиенту

#### chat3:update
Общее событие для всех updates из Chat3.

```javascript
socket.on('chat3:update', (update) => {
  console.log('Update from Chat3:', update);
  // update содержит полную структуру Update
});
```

#### message:new
Специализированное событие для новых сообщений.

```javascript
socket.on('message:new', (messageData) => {
  // messageData = update.data для message.create
  console.log('New message:', messageData);
  displayMessage(messageData);
});
```

#### message:update
Событие для изменений сообщений (редактирование, реакции, статусы).

```javascript
socket.on('message:update', (update) => {
  if (update.eventType === 'message.reaction.add') {
    addReactionToMessage(update.data);
  }
});
```

#### dialog:update
Событие для изменений диалогов.

```javascript
socket.on('dialog:update', (update) => {
  if (update.eventType === 'dialog.member.add') {
    refreshDialogMembers(update.dialogId);
  }
});
```

## Примеры использования

### Frontend - Подключение и получение updates

```javascript
import { io } from 'socket.io-client';

// Подключение с JWT токеном
const socket = io('http://localhost:3001', {
  auth: {
    token: jwtToken
  }
});

// Обработка подключения
socket.on('connect', () => {
  console.log('✅ Connected to server');
});

// Получение всех updates из Chat3
socket.on('chat3:update', (update) => {
  console.log('Update received:', update);
  
  switch (update.eventType) {
    case 'message.create':
      // Новое сообщение
      addMessageToChat(update.data);
      break;
      
    case 'message.reaction.add':
      // Новая реакция
      updateMessageReactions(update.entityId, update.data.reactionCounts);
      break;
      
    case 'dialog.member.add':
      // Новый участник
      refreshDialogList();
      break;
      
    default:
      console.log('Unhandled update type:', update.eventType);
  }
});

// Или использовать специализированные события
socket.on('message:new', (message) => {
  addMessageToChat(message);
});

socket.on('message:update', (update) => {
  if (update.eventType === 'message.reaction.add') {
    updateMessageReactions(update.entityId, update.data.reactionCounts);
  }
});

socket.on('dialog:update', (update) => {
  refreshDialogList();
});
```

### React Hook Example

```javascript
import { useEffect } from 'react';
import { io } from 'socket.io-client';

function useChatUpdates(token, onUpdate) {
  useEffect(() => {
    const socket = io('http://localhost:3001', {
      auth: { token }
    });

    socket.on('chat3:update', (update) => {
      onUpdate(update);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);
}

// Использование в компоненте
function ChatComponent({ token }) {
  const [messages, setMessages] = useState([]);

  useChatUpdates(token, (update) => {
    if (update.eventType === 'message.create') {
      setMessages(prev => [...prev, update.data]);
    }
  });

  return (
    <div>
      {messages.map(msg => (
        <div key={msg._id}>{msg.content}</div>
      ))}
    </div>
  );
}
```

## Конфигурация

### Environment Variables

```bash
# RabbitMQ Connection
RABBITMQ_URL=amqp://rmuser:rmpassword@localhost:5672/

# RabbitMQ Exchange (создается Chat3)
RABBITMQ_UPDATES_EXCHANGE=chat3_updates
```

### Формат Routing Keys

```
user.{userId}.{updateType}
```

Примеры:
- `user.usr_a3f9k2p1.messageupdate` - message updates для пользователя
- `user.usr_a3f9k2p1.dialogupdate` - dialog updates для пользователя
- `user.usr_a3f9k2p1.*` - все updates для пользователя

## Мониторинг

### Проверка RabbitMQ соединения

```bash
# Проверить exchange
curl -u rmuser:rmpassword http://localhost:15672/api/exchanges/%2F/chat3_updates

# Список очередей
curl -u rmuser:rmpassword http://localhost:15672/api/queues
```

### Логи сервера

```bash
# Поиск RabbitMQ логов
tail -f logs/server.log | grep RabbitMQ

# Подписки пользователей
tail -f logs/server.log | grep "subscribed to updates"

# Полученные updates
tail -f logs/server.log | grep "Update received"
```

### Статистика в приложении

```javascript
// Количество подписанных пользователей
const subscribersCount = RabbitMQService.getSubscribersCount();

// Проверка подписки пользователя
const isSubscribed = RabbitMQService.isUserSubscribed(userId);

// Статус соединения
const isConnected = RabbitMQService.isConnected;
```

## Обработка ошибок

### Переподключение

RabbitMQService автоматически пытается переподключиться при обрыве соединения:

```javascript
// В RabbitMQService.js
this.connection.on('close', () => {
  console.log('⚠️  RabbitMQ connection closed');
  setTimeout(() => this.reconnect(), 5000); // Переподключение через 5 секунд
});
```

При переподключении:
1. Восстанавливается соединение с RabbitMQ
2. Автоматически переподписываются все активные пользователи
3. Очереди пересоздаются

### Graceful Shutdown

При остановке сервера:

```javascript
// В server.js при SIGTERM/SIGINT
await RabbitMQService.close();
```

## Отладка

### Включение подробных логов

Установите `NODE_ENV=development` для вывода дополнительной информации:

```bash
NODE_ENV=development npm run dev
```

Логи включают:
- Детали подключения к RabbitMQ
- Информацию о подписках пользователей
- Детали каждого полученного update
- Информацию о routing keys

### Тестирование без RabbitMQ

Если RabbitMQ недоступен, сервер продолжит работу, но updates не будут доставляться:

```
⚠️  Failed to connect to RabbitMQ. Updates will not be available.
   Error: connect ECONNREFUSED 127.0.0.1:5672
```

WebSocket и REST API продолжат работать нормально.

## Производительность

### Оптимизация

1. **Auto-delete queues** - очереди удаляются автоматически при отключении пользователя
2. **Non-durable queues** - быстрее, так как не записываются на диск
3. **Message acknowledgment** - гарантия доставки, повторная обработка при ошибках
4. **Reconnection strategy** - автоматическое восстановление соединения

### Масштабирование

Для горизонтального масштабирования:

1. Каждый экземпляр сервера создает свои очереди для пользователей
2. RabbitMQ автоматически распределяет updates по routing keys
3. Пользователь получает updates только на том сервере, где подключен

## Безопасность

1. **JWT Authentication** - обязательна для WebSocket подключения
2. **User Isolation** - каждый пользователь получает только свои updates
3. **Routing Keys** - гарантируют доставку только нужному пользователю
4. **Auto-delete queues** - автоматическая очистка при отключении

## Troubleshooting

### Updates не приходят

**Причины:**
1. RabbitMQ не запущен
2. Chat3 Update Worker не работает
3. Неправильный routing key
4. Пользователь не подписан

**Решение:**
```bash
# Проверить RabbitMQ
curl http://localhost:15672/api/overview

# Проверить exchange
curl -u rmuser:rmpassword http://localhost:15672/api/exchanges/%2F/chat3_updates

# Проверить логи
tail -f logs/server.log | grep "subscribed to updates"
```

### Соединение постоянно разрывается

**Причины:**
1. Сетевые проблемы
2. RabbitMQ перегружен
3. Неправильные credentials

**Решение:**
- Проверить RABBITMQ_URL в .env
- Увеличить таймауты
- Проверить ресурсы RabbitMQ сервера

## Связанные документы

- [Chat3 Updates Documentation](../../docs/chat3/UPDATES.md)
- [WebSocket Documentation](../WEBSOCKET.md)
- [Chat3 Integration](README.md)

