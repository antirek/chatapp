# WebSocket Documentation

WebSocket сервер для real-time обновлений в чат-приложении.

## Подключение

### JavaScript/TypeScript (socket.io-client)

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: {
    token: 'your-jwt-token-here'
  }
});

// Обработка успешного подключения
socket.on('connect', () => {
  console.log('Connected to WebSocket server');
});

// Обработка ошибок авторизации
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
});
```

## События от клиента к серверу

### Присоединиться к диалогу

```javascript
socket.emit('dialog:join', dialogId);
```

Клиент должен присоединиться к комнате диалога, чтобы получать обновления о новых сообщениях в этом диалоге.

### Покинуть диалог

```javascript
socket.emit('dialog:leave', dialogId);
```

### Индикатор печати (начал)

```javascript
socket.emit('typing:start', { dialogId: 'dialog-id' });
```

### Индикатор печати (закончил)

```javascript
socket.emit('typing:stop', { dialogId: 'dialog-id' });
```

## События от сервера к клиенту

### Chat3 Updates

#### chat3:update
Общее событие для всех обновлений из Chat3 (RabbitMQ).

```javascript
socket.on('chat3:update', (update) => {
  console.log('Update from Chat3:', update);
  // update содержит: eventType, data, dialogId, entityId и т.д.
  
  // Обработка разных типов
  switch (update.eventType) {
    case 'message.create':
      displayNewMessage(update.data);
      break;
    case 'message.reaction.add':
      updateMessageReactions(update.data);
      break;
    case 'dialog.member.add':
      refreshDialogList();
      break;
  }
});
```

**Типы обновлений:**
- Message updates: `message.create`, `message.update`, `message.delete`, `message.reaction.*`, `message.status.*`
- Dialog updates: `dialog.create`, `dialog.update`, `dialog.delete`, `dialog.member.*`

См. [RabbitMQ Integration](docs/RABBITMQ_INTEGRATION.md) для подробностей.

### Пользователь появился онлайн

```javascript
socket.on('user:online', (data) => {
  console.log(`User ${data.userName} is now online`);
  // data: { userId, userName }
});
```

### Пользователь ушёл оффлайн

```javascript
socket.on('user:offline', (data) => {
  console.log(`User ${data.userId} is now offline`);
  // data: { userId }
});
```

### Новое сообщение

```javascript
socket.on('message:new', (message) => {
  console.log('New message:', message);
  // message: { _id, content, senderId, dialogId, type, meta, createdAt, ... }
});
```

### Изменение статуса сообщения

```javascript
socket.on('message:status', (data) => {
  console.log('Message status updated:', data);
  // data: { messageId, userId, status: 'read' | 'delivered' }
});
```

### Новая реакция на сообщение

```javascript
socket.on('message:reaction', (data) => {
  console.log('New reaction:', data);
  // data: { messageId, reaction: { userId, reaction, createdAt } }
});
```

### Обновление диалога

```javascript
socket.on('dialog:update', (update) => {
  console.log('Dialog updated:', update);
  // update: { dialogId, name, members, ... }
});
```

### Пользователь печатает

```javascript
socket.on('typing:start', (data) => {
  console.log(`${data.userName} is typing...`);
  // data: { userId, userName, dialogId }
});
```

### Пользователь закончил печатать

```javascript
socket.on('typing:stop', (data) => {
  console.log(`${data.userId} stopped typing`);
  // data: { userId, dialogId }
});
```

## Полный пример использования

```javascript
import { io } from 'socket.io-client';

class ChatWebSocket {
  constructor(token) {
    this.socket = io('http://localhost:3001', {
      auth: { token }
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Подключение
    this.socket.on('connect', () => {
      console.log('✅ Connected to chat server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
    });

    // Новые сообщения
    this.socket.on('message:new', (message) => {
      this.onNewMessage(message);
    });

    // Статусы сообщений
    this.socket.on('message:status', (data) => {
      this.onMessageStatus(data);
    });

    // Реакции
    this.socket.on('message:reaction', (data) => {
      this.onMessageReaction(data);
    });

    // Индикатор печати
    this.socket.on('typing:start', (data) => {
      this.onTypingStart(data);
    });

    this.socket.on('typing:stop', (data) => {
      this.onTypingStop(data);
    });

    // Статус пользователей
    this.socket.on('user:online', (data) => {
      this.onUserOnline(data);
    });

    this.socket.on('user:offline', (data) => {
      this.onUserOffline(data);
    });
  }

  // Присоединиться к диалогу
  joinDialog(dialogId) {
    this.socket.emit('dialog:join', dialogId);
  }

  // Покинуть диалог
  leaveDialog(dialogId) {
    this.socket.emit('dialog:leave', dialogId);
  }

  // Начать печатать
  startTyping(dialogId) {
    this.socket.emit('typing:start', { dialogId });
  }

  // Закончить печатать
  stopTyping(dialogId) {
    this.socket.emit('typing:stop', { dialogId });
  }

  // Обработчики событий (переопределите в своём коде)
  onNewMessage(message) {
    console.log('New message:', message);
  }

  onMessageStatus(data) {
    console.log('Message status:', data);
  }

  onMessageReaction(data) {
    console.log('New reaction:', data);
  }

  onTypingStart(data) {
    console.log(`${data.userName} is typing...`);
  }

  onTypingStop(data) {
    console.log('User stopped typing');
  }

  onUserOnline(data) {
    console.log(`${data.userName} is online`);
  }

  onUserOffline(data) {
    console.log('User went offline');
  }

  // Отключиться
  disconnect() {
    this.socket.disconnect();
  }
}

// Использование
const jwt = 'your-jwt-token';
const chatWS = new ChatWebSocket(jwt);

// Присоединиться к диалогу
chatWS.joinDialog('dialog-id-123');

// Отправить индикатор печати
chatWS.startTyping('dialog-id-123');
setTimeout(() => chatWS.stopTyping('dialog-id-123'), 3000);
```

## Интеграция с React

```jsx
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function useChat(token, dialogId) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());

  useEffect(() => {
    // Подключиться
    const newSocket = io('http://localhost:3001', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Connected');
      newSocket.emit('dialog:join', dialogId);
    });

    // Новые сообщения
    newSocket.on('message:new', (message) => {
      if (message.dialogId === dialogId) {
        setMessages(prev => [...prev, message]);
      }
    });

    // Индикатор печати
    newSocket.on('typing:start', (data) => {
      if (data.dialogId === dialogId) {
        setTypingUsers(prev => new Set([...prev, data.userId]));
      }
    });

    newSocket.on('typing:stop', (data) => {
      if (data.dialogId === dialogId) {
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(data.userId);
          return next;
        });
      }
    });

    setSocket(newSocket);

    // Очистка
    return () => {
      newSocket.emit('dialog:leave', dialogId);
      newSocket.disconnect();
    };
  }, [token, dialogId]);

  const startTyping = () => {
    socket?.emit('typing:start', { dialogId });
  };

  const stopTyping = () => {
    socket?.emit('typing:stop', { dialogId });
  };

  return {
    messages,
    typingUsers,
    startTyping,
    stopTyping,
  };
}

// Компонент
function ChatComponent({ token, dialogId }) {
  const { messages, typingUsers, startTyping, stopTyping } = useChat(token, dialogId);

  return (
    <div>
      <div>
        {messages.map(msg => (
          <div key={msg._id}>{msg.content}</div>
        ))}
      </div>
      
      {typingUsers.size > 0 && (
        <div>Someone is typing...</div>
      )}
      
      <input
        onFocus={startTyping}
        onBlur={stopTyping}
        placeholder="Type a message..."
      />
    </div>
  );
}
```

## Безопасность

1. **Авторизация обязательна** - все подключения требуют валидный JWT токен
2. **Комнаты диалогов** - пользователи получают только события из диалогов, к которым присоединились
3. **Валидация userId** - userId берётся из JWT токена, клиент не может его подделать

## Production

В production измените настройки CORS в `src/websocket/index.js`:

```javascript
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'https://your-frontend.com',
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

