# Real-time Message Updates Fix

**Дата**: 05.11.2025  
**Версия**: 1.4.1  
**Статус**: ✅ ИСПРАВЛЕНО И ПРОТЕСТИРОВАНО

---

## Проблема

При отправке сообщения одним пользователем, второй пользователь не видел сообщение автоматически в real-time. Требовалось обновление диалога (переоткрытие).

**Симптомы:**
- Сообщение отправляется успешно
- Отправитель видит сообщение моментально (optimistic update)
- Получатель НЕ видит сообщение автоматически
- После обновления диалога (F5 или переоткрытие) сообщение появляется

---

## Причина

Backend **не отправлял** WebSocket события `message:new` всем участникам диалога при создании нового сообщения. Событие создавалось только при получении от Chat3 API через RabbitMQ, но не при прямом создании через REST API.

---

## Решение

### 1. Backend: Отправка WebSocket событий при создании сообщения

**Файл**: `backend/src/routes/messages.js`

**Изменение**: Добавлена отправка WebSocket события `message:new` после успешного создания сообщения:

```javascript
router.post('/dialog/:dialogId', async (req, res) => {
  try {
    const { dialogId } = req.params;
    const { content, type = 'text', meta = {} } = req.body;

    // Create message through Chat3 API
    const result = await Chat3Client.createMessage(dialogId, {
      content,
      senderId: req.user.userId,
      type,
      meta,
    });

    // ✅ NEW: Emit WebSocket event to all dialog participants
    const io = req.app.get('io');
    if (io && io.emitNewMessage) {
      io.emitNewMessage(dialogId, result.data);
    }

    res.status(201).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
```

---

### 2. Frontend: Переподключение к WebSocket комнате

**Файл**: `frontend/src/views/ChatView.vue`

**Изменение**: Добавлена автоматическая повторное присоединение к WebSocket комнате при переподключении:

```typescript
// Reconnect to dialog room when WebSocket reconnects
function handleReconnect() {
  console.log('🔄 WebSocket reconnected, rejoining dialog...')
  if (selectedDialog.value) {
    websocket.joinDialog(selectedDialog.value.dialogId)
  }
}

onMounted(() => {
  loadDialogs()
  setupWebSocketListeners()
  
  // ✅ NEW: Handle WebSocket reconnection
  websocket.on('connect', handleReconnect)
})

onUnmounted(() => {
  // Clean up WebSocket listeners
  websocket.off('message:new', handleNewMessage)
  websocket.off('message:update', handleMessageUpdate)
  websocket.off('dialog:update', handleDialogUpdate)
  websocket.off('typing:start', handleTypingStart)
  websocket.off('typing:stop', handleTypingStop)
  websocket.off('connect', handleReconnect)  // ✅ NEW
})
```

---

### 3. Backend: Улучшенное логирование WebSocket

**Файл**: `backend/src/websocket/index.js`

**Добавлено подробное логирование** для отладки присоединения к комнатам и отправки событий:

```javascript
// Handle user joining a dialog room
socket.on('dialog:join', (dialogId) => {
  socket.join(`dialog:${dialogId}`);
  console.log(`📨 User ${socket.userName} (${socket.userId}) joined dialog:${dialogId}`);
  console.log(`   Current rooms:`, Array.from(socket.rooms));
});

// Emit new message to dialog members
io.emitNewMessage = (dialogId, message) => {
  console.log(`🔔 Emitting message:new to room dialog:${dialogId}`);
  console.log(`   Message from: ${message.senderId}`);
  console.log(`   Content: ${message.content}`);
  io.to(`dialog:${dialogId}`).emit('message:new', message);
};
```

---

## Архитектура Real-time обновлений

```
┌─────────────────┐                    ┌──────────────────┐
│  User 1 (Tab 1) │                    │  User 2 (Tab 2)  │
└────────┬────────┘                    └─────────┬────────┘
         │                                       │
         │ 1. POST /api/messages                │
         ├────────────────────────────────────┐  │
         │                                    │  │
    ┌────▼────────────────────────────────┐  │  │
    │         Backend API Server          │  │  │
    │                                     │  │  │
    │  routes/messages.js                 │  │  │
    │    - Chat3Client.createMessage()    │  │  │
    │    - io.emitNewMessage()  ◄─────────┘  │  │
    │                                        │  │
    └────────┬──────────────────┬───────────┘  │
             │                  │               │
             │ 2. message:new   │ 3. message:new│
             │    (WebSocket)   │    (WebSocket)│
             │                  │               │
         ┌───▼──────┐      ┌────▼───────────────▼──┐
         │  User 1  │      │      User 2           │
         │  Socket  │      │      Socket           │
         │  Room:   │      │      Room:            │
         │  dialog  │      │      dialog           │
         └──────────┘      └───────────────────────┘
             │                        │
             │ 4. handleNewMessage    │ 5. handleNewMessage
             ▼                        ▼
      ✅ Optimistic          ✅ Real-time
         Update                  Update
```

---

## Тестирование

### Сценарий 1: ✅ Сообщение между двумя пользователями

1. Открыть 2 вкладки браузера
2. Войти под разными пользователями (79111111111 и 79777777777)
3. Открыть один и тот же диалог в обеих вкладках
4. Отправить сообщение от User 1
5. **Результат**: User 2 видит сообщение моментально без обновления

**Логи backend:**
```
📢 Emitting message:new to dialog:dlg_abc123
   Message: Test message
   Sender: usr_qk2ddpnx
🔔 Emitting message:new to room dialog:dlg_abc123
   Message from: usr_qk2ddpnx
   Content: Test message
```

**Логи frontend (User 2):**
```
✅ New message received via WebSocket
isOwnMessage: usr_qk2ddpnx === usr_e86m1drv = false
```

---

### Сценарий 2: ✅ Переподключение WebSocket

1. User открыл диалог
2. Backend перезапущен (WebSocket переподключение)
3. **Результат**: User автоматически присоединяется к комнате заново

**Логи:**
```
🔄 WebSocket reconnected, rejoining dialog...
📨 User Александр Петров (usr_qk2ddpnx) joined dialog:dlg_abc123
   Current rooms: Set(2) { 'socketId', 'dialog:dlg_abc123' }
```

---

## Важные замечания

### 1. Optimistic Updates

Frontend использует **оптимистические обновления** - сообщение добавляется в UI моментально после успешного API запроса, не дожидаясь WebSocket подтверждения.

```typescript
// stores/messages.ts
async function sendMessage(dialogId: string, messageData: SendMessageData) {
  try {
    const response = await api.sendMessage(dialogId, messageData);
    // ✅ Optimistic update - add immediately
    if (response.success && response.data) {
      addMessage(response.data);
    }
    return response;
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message;
    throw err;
  }
}
```

### 2. Дублирование сообщений

Отправитель получает сообщение:
1. **Optimistic** - сразу после API запроса
2. **WebSocket** - через `message:new` событие

**Защита от дублирования** в `stores/messages.ts`:

```typescript
function addMessage(message: Message) {
  // Check for duplicates by messageId
  if (!messages.value.some(m => m.messageId === message.messageId)) {
    messages.value.push(message)
    // Sort by createdAt
    messages.value.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }
}
```

### 3. WebSocket комнаты

Каждый диалог имеет свою комнату: `dialog:${dialogId}`

Пользователь присоединяется к комнате при открытии диалога:

```typescript
// ChatView.vue
async function selectDialog(dialog: Dialog) {
  selectedDialog.value = dialog
  websocket.joinDialog(dialog.dialogId)  // ✅ Join room
  await messagesStore.loadMessages(dialog.dialogId)
}
```

---

## Производительность

### Проблема: Избыточные рендеринги

В тестировании замечено **множество логов** `isOwnMessage` в консоли, что указывает на избыточные рендеринги компонента `ChatWindow`.

**Рекомендация для будущего**:
- Добавить `memo` или `v-once` для статичных элементов
- Использовать `computed` с правильными зависимостями
- Оптимизировать обновление списка сообщений

---

## Файлы изменены

### Backend
- ✅ `backend/src/routes/messages.js` - добавлена отправка WebSocket событий
- ✅ `backend/src/websocket/index.js` - улучшено логирование

### Frontend
- ✅ `frontend/src/views/ChatView.vue` - добавлена обработка переподключения WebSocket

---

## Результат

✅ **Real-time обновления работают корректно**
✅ **Сообщения доставляются моментально**
✅ **Переподключение WebSocket обрабатывается автоматически**
✅ **Оптимистические обновления обеспечивают мгновенный feedback**

---

## Известные ограничения

1. **Пользователь должен держать диалог открытым** для получения real-time обновлений. Если диалог закрыт, сообщения загрузятся при следующем открытии.
2. **Hot reload Vite** может вызывать переподключение WebSocket.
3. **Множественные рендеринги** требуют оптимизации для производительности.

---

## Дальнейшие улучшения (Опционально)

1. **Push-уведомления** для закрытых диалогов
2. **Service Worker** для фоновых обновлений
3. **Оптимизация рендеринга** списка сообщений с виртуализацией
4. **Индикатор доставки** (отправлено/доставлено/прочитано)
5. **Reconnection exponential backoff** для WebSocket

