# 📋 План реализации работы с топиками в групповых диалогах

## 📚 Контекст

Топики (Topics) - это новая функциональность Chat3, позволяющая группировать сообщения внутри диалога по темам. Каждое сообщение может быть привязано к топику через поле `topicId`.

**Документация:** `docs/chat3/INTEGRATION.md` (раздел "Топики (Topics)")

---

## 🎯 Цели реализации

1. **Отображение списка топиков** в групповых диалогах
2. **Создание новых топиков** с мета-тегами (название, цвет, описание)
3. **Фильтрация сообщений по топику** - показывать только сообщения выбранного топика
4. **Выбор топика при отправке сообщения** - возможность указать топик для нового сообщения
5. **Визуальное отображение топика** в сообщениях (badge/header)
6. **Обработка real-time обновлений** топиков через WebSocket
7. **Отображение счетчика непрочитанных** сообщений по топикам

---

## 📦 Этапы реализации

### Этап 1: Backend - API методы для работы с топиками

#### 1.1. Добавить методы в Chat3Client
**Файл:** `backend/src/services/Chat3Client.js`

```javascript
// Получить список топиков диалога
async getDialogTopics(dialogId, params = {}) {
  const response = await this.client.get(`/dialogs/${dialogId}/topics`, { params });
  return response.data;
}

// Получить список топиков в контексте пользователя (с unreadCount)
async getUserDialogTopics(userId, dialogId, params = {}) {
  const response = await this.client.get(`/users/${userId}/dialogs/${dialogId}/topics`, { params });
  return response.data;
}

// Создать новый топик
async createDialogTopic(dialogId, data) {
  const response = await this.client.post(`/dialogs/${dialogId}/topics`, data);
  return response.data;
}
```

#### 1.2. Создать контроллер для топиков
**Файл:** `backend/src/controllers/topicsController.js` (новый)

```javascript
// GET /api/dialogs/:dialogId/topics - список топиков
// GET /api/dialogs/:dialogId/topics/user - список топиков с unreadCount для текущего пользователя
// POST /api/dialogs/:dialogId/topics - создать топик
```

**Эндпоинты:**
- `GET /api/dialogs/:dialogId/topics` - получить список топиков
- `GET /api/dialogs/:dialogId/topics/user` - получить список топиков с `unreadCount` для текущего пользователя
- `POST /api/dialogs/:dialogId/topics` - создать новый топик

#### 1.3. Обновить контроллер сообщений
**Файл:** `backend/src/controllers/messagesController.js`

- Добавить поддержку `topicId` в `sendDialogMessage` - передавать `topicId` в Chat3 API при создании сообщения

#### 1.4. Добавить роуты
**Файл:** `backend/src/routes/index.js` или соответствующий файл роутов

```javascript
router.get('/dialogs/:dialogId/topics', topicsController.getDialogTopics);
router.get('/dialogs/:dialogId/topics/user', topicsController.getUserDialogTopics);
router.post('/dialogs/:dialogId/topics', topicsController.createDialogTopic);
```

---

### Этап 2: Frontend - Типы и API методы

#### 2.1. Типы данных ✅ (уже добавлено)
**Файл:** `frontend/src/types/index.ts`

- ✅ `Topic` interface
- ✅ `Message.topicId` и `Message.topic`
- ✅ `SendMessageData.topicId`

#### 2.2. API методы ✅ (уже добавлено)
**Файл:** `frontend/src/services/api.ts`

- ✅ `getTopics(dialogId, params)`
- ✅ `getUserTopics(dialogId, params)`
- ✅ `createTopic(dialogId, topicData)`
- ✅ `sendMessage` уже поддерживает `topicId` в `SendMessageData`

---

### Этап 3: Frontend - Store для управления топиками

#### 3.1. Создать Pinia store для топиков
**Файл:** `frontend/src/stores/topics.ts` (новый)

**Функциональность:**
- Хранение списка топиков для текущего диалога
- Загрузка топиков (`fetchTopics`, `fetchUserTopics`)
- Создание топика (`createTopic`)
- Выбранный топик (`selectedTopicId`)
- Фильтрация сообщений по топику
- Обновление топиков через WebSocket

**Состояние:**
```typescript
const topics = ref<Topic[]>([])
const selectedTopicId = ref<string | null>(null) // null = все сообщения
const isLoading = ref(false)
const currentDialogId = ref<string | null>(null)
```

---

### Этап 4: Frontend - UI компоненты

#### 4.1. Компонент TopicsList
**Файл:** `frontend/src/components/TopicsList.vue` (новый)

**Функциональность:**
- Отображение списка топиков диалога
- Выбор топика для фильтрации сообщений
- Отображение счетчика непрочитанных (`unreadCount`) для каждого топика
- Кнопка "Все сообщения" для сброса фильтра
- Кнопка создания нового топика
- Визуальное выделение выбранного топика

**UI элементы:**
- Список топиков с названием и цветом (из `meta.name` и `meta.color`)
- Badge с количеством непрочитанных
- Кнопка "+" для создания нового топика

#### 4.2. Компонент CreateTopicModal
**Файл:** `frontend/src/components/CreateTopicModal.vue` (новый)

**Функциональность:**
- Модальное окно для создания нового топика
- Поля: название (обязательно), описание (опционально), цвет (опционально)
- Валидация формы
- Вызов API для создания топика

#### 4.3. Компонент TopicSelector
**Файл:** `frontend/src/components/TopicSelector.vue` (новый)

**Функциональность:**
- Выпадающий список для выбора топика при отправке сообщения
- Интеграция в форму отправки сообщения в `ChatWindow.vue`
- Опция "Без топика" (null) для сообщений в основном потоке

#### 4.4. Обновить ChatWindow.vue
**Файл:** `frontend/src/components/ChatWindow.vue`

**Изменения:**
1. **Добавить TopicsList** в header или sidebar (для групповых диалогов)
2. **Добавить TopicSelector** в форму отправки сообщения
3. **Отображать badge топика** в сообщениях (если `message.topicId` существует)
4. **Фильтровать сообщения** по выбранному топику
5. **Обрабатывать WebSocket события** `dialog.topic.create` и `dialog.topic.update`

**Визуальные изменения:**
- Badge с названием топика над сообщением (если сообщение в топике)
- Разделитель между сообщениями разных топиков
- Индикатор "Все сообщения" vs "Топик: [название]"

---

### Этап 5: Frontend - Интеграция с WebSocket

#### 5.1. Обработка событий топиков
**Файл:** `frontend/src/services/websocket.ts` или соответствующий

**События:**
- `dialog.topic.create` - новый топик создан
- `dialog.topic.update` - топик обновлен

**Действия:**
- Обновить список топиков в store
- Если открыт диалог с новым топиком - добавить топик в список
- Обновить счетчики непрочитанных

#### 5.2. Обработка сообщений с топиками
**Файл:** `frontend/src/stores/messages.ts`

**Изменения:**
- При получении нового сообщения через WebSocket проверять `message.topicId`
- Если сообщение в топике - обновить счетчик непрочитанных для этого топика
- Если выбран фильтр по топику - автоматически добавлять сообщение в список (если соответствует фильтру)

---

### Этап 6: Визуальные улучшения

#### 6.1. Стилизация топиков
- Цветовая схема для топиков (из `meta.color`)
- Иконки для топиков
- Анимации при переключении топиков

#### 6.2. UX улучшения
- Подсказки при наведении на топик
- Контекстное меню для топиков (переименовать, удалить - если API поддерживает)
- Автоскролл к новым сообщениям в выбранном топике

---

## 🔄 Последовательность реализации

### Фаза 1: Backend (1-2 часа)
1. ✅ Добавить методы в Chat3Client
2. ✅ Создать topicsController.js
3. ✅ Добавить роуты
4. ✅ Обновить sendDialogMessage для поддержки topicId
5. ✅ Протестировать API endpoints

### Фаза 2: Frontend - Базовая функциональность (2-3 часа)
1. ✅ Типы данных (уже готово)
2. ✅ API методы (уже готово)
3. ✅ Создать topics store
4. ✅ Создать TopicsList компонент
5. ✅ Интегрировать TopicsList в ChatWindow
6. ✅ Добавить фильтрацию сообщений по топику

### Фаза 3: Frontend - Создание топиков (1-2 часа)
1. ✅ Создать CreateTopicModal
2. ✅ Добавить кнопку создания топика в TopicsList
3. ✅ Интегрировать создание топика в store

### Фаза 4: Frontend - Отправка сообщений в топики (1 час)
1. ✅ Создать TopicSelector компонент
2. ✅ Интегрировать в форму отправки сообщения
3. ✅ Обновить sendMessage для передачи topicId

### Фаза 5: Frontend - Визуальное отображение (1-2 часа)
1. ✅ Добавить badge топика в сообщения
2. ✅ Добавить разделители между топиками
3. ✅ Стилизация топиков

### Фаза 6: Frontend - WebSocket интеграция (1-2 часа)
1. ✅ Обработать dialog.topic.create
2. ✅ Обработать dialog.topic.update
3. ✅ Обновлять счетчики непрочитанных

### Фаза 7: Тестирование и полировка (1-2 часа)
1. ✅ Тестирование всех сценариев
2. ✅ Исправление багов
3. ✅ UX улучшения

---

## 📝 Детали реализации

### Структура данных топика

```typescript
interface Topic {
  topicId: string
  dialogId: string
  createdAt: string | number
  updatedAt?: string | number
  meta?: {
    name?: string        // Название топика
    color?: string       // Цвет топика (hex)
    description?: string  // Описание топика
    [key: string]: any
  }
  unreadCount?: number   // Только в user context endpoints
}
```

### Структура сообщения с топиком

```typescript
interface Message {
  // ... существующие поля
  topicId?: string | null
  topic?: Topic | null  // Объект с информацией о топике
}
```

### API Endpoints

**Backend:**
- `GET /api/dialogs/:dialogId/topics` → `GET /api/dialogs/:dialogId/topics` (Chat3)
- `GET /api/dialogs/:dialogId/topics/user` → `GET /api/users/:userId/dialogs/:dialogId/topics` (Chat3)
- `POST /api/dialogs/:dialogId/topics` → `POST /api/dialogs/:dialogId/topics` (Chat3)

**При создании сообщения:**
- `POST /api/dialog/:dialogId/messages` с `{ topicId: "..." }` → `POST /api/dialogs/:dialogId/messages` (Chat3)

---

## 🎨 UI/UX концепция

### TopicsList компонент
```
┌─────────────────────────────┐
│ 📌 Топики                   │
├─────────────────────────────┤
│ [Все сообщения] (5)         │ ← Кнопка для сброса фильтра
│ ─────────────────────────── │
│ 🟢 Важная тема (3)          │ ← Топик с unreadCount
│ 🔵 Обсуждение (0)           │
│ 🟡 Вопросы (2)              │
│ ─────────────────────────── │
│ [+ Создать топик]           │
└─────────────────────────────┘
```

### Сообщение с топиком
```
┌─────────────────────────────┐
│ 🟢 Важная тема              │ ← Badge топика
├─────────────────────────────┤
│ Иван Иванов                 │
│ Привет! Это сообщение в     │
│ топике "Важная тема"        │
│ 10:30                       │
└─────────────────────────────┘
```

### Форма отправки с выбором топика
```
┌─────────────────────────────┐
│ [Выбрать топик ▼]           │ ← TopicSelector
│ └─ Все сообщения            │
│ └─ 🟢 Важная тема           │
│ └─ 🔵 Обсуждение            │
│ └─ 🟡 Вопросы               │
│ └─ [+ Создать новый топик]  │
├─────────────────────────────┤
│ [Введите сообщение...]      │
│ [Отправить]                 │
└─────────────────────────────┘
```

---

## ⚠️ Важные моменты

1. **Только для групповых диалогов**: Топики должны отображаться только в групповых чатах (`chatType === 'group'`)

2. **Фильтрация сообщений**: При выборе топика показывать только сообщения с `message.topicId === selectedTopicId`. При `selectedTopicId === null` показывать все сообщения.

3. **Счетчики непрочитанных**: Использовать `getUserTopics` для получения `unreadCount` для каждого топика.

4. **WebSocket события**: Обрабатывать `dialog.topic.create` и `dialog.topic.update` для real-time обновлений.

5. **Fallback для сообщений без топика**: Сообщения без `topicId` отображаются в основном потоке (без badge).

6. **Валидация**: При создании топика обязательно указывать `meta.name`.

---

## 🧪 Тестовые сценарии

1. ✅ Создать групповой диалог
2. ✅ Создать топик в диалоге
3. ✅ Отправить сообщение в топик
4. ✅ Отправить сообщение без топика
5. ✅ Фильтровать сообщения по топику
6. ✅ Переключиться на "Все сообщения"
7. ✅ Проверить счетчики непрочитанных
8. ✅ Создать топик через WebSocket (другой пользователь)
9. ✅ Получить сообщение в топике через WebSocket

---

## 📚 Связанные файлы

### Backend
- `backend/src/services/Chat3Client.js` - методы для работы с Chat3 API
- `backend/src/controllers/topicsController.js` - контроллер топиков (новый)
- `backend/src/controllers/messagesController.js` - обновить для поддержки topicId
- `backend/src/routes/index.js` - добавить роуты для топиков

### Frontend
- `frontend/src/types/index.ts` - типы Topic, Message.topicId
- `frontend/src/services/api.ts` - API методы для топиков
- `frontend/src/stores/topics.ts` - store для управления топиками (новый)
- `frontend/src/components/TopicsList.vue` - список топиков (новый)
- `frontend/src/components/CreateTopicModal.vue` - модальное окно создания (новый)
- `frontend/src/components/TopicSelector.vue` - селектор топика (новый)
- `frontend/src/components/ChatWindow.vue` - интеграция всех компонентов
- `frontend/src/services/websocket.ts` - обработка событий топиков

---

**Дата создания плана:** 2025-01-XX  
**Статус:** Готов к реализации
