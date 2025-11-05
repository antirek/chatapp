# ChatApp Frontend

Фронтенд для чат-приложения на Vue 3 + TypeScript + Vite + Tailwind CSS.

## Технологии

- **Vue 3** - прогрессивный JavaScript фреймворк
- **TypeScript** - типизация
- **Vite** - быстрая сборка
- **Pinia** - управление состоянием
- **Vue Router** - маршрутизация
- **Tailwind CSS** - утилитарные стили
- **Socket.io Client** - WebSocket соединение
- **Axios** - HTTP клиент

## Установка

```bash
cd frontend
npm install
```

## Настройка

Создайте файл `.env`:

```bash
cp .env.example .env
```

Настройте переменные:

```env
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=http://localhost:3001
```

## Запуск

### Development режим:
```bash
npm run dev
```

Приложение будет доступно на `http://localhost:5173`

### Production сборка:
```bash
npm run build
```

### Preview production:
```bash
npm run preview
```

## Структура проекта

```
frontend/
├── src/
│   ├── components/        # Vue компоненты
│   │   ├── DialogList.vue
│   │   ├── ChatWindow.vue
│   │   └── MessageInput.vue
│   ├── views/            # Страницы
│   │   ├── LoginView.vue
│   │   └── ChatView.vue
│   ├── stores/           # Pinia stores
│   │   ├── auth.ts
│   │   ├── dialogs.ts
│   │   └── messages.ts
│   ├── services/         # API services
│   │   ├── api.ts
│   │   └── websocket.ts
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   ├── router/           # Vue Router
│   │   └── index.ts
│   ├── App.vue          # Главный компонент
│   ├── main.ts          # Точка входа
│   └── style.css        # Tailwind стили
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Возможности

### Авторизация
- ✅ Вход по номеру телефона (79XXXXXXXXX)
- ✅ SMS код (4 цифры) - mock режим в dev
- ✅ JWT токены (48 часов)
- ✅ Автоматическая регистрация при первом входе

### Диалоги
- ✅ Список диалогов
- ✅ Последнее сообщение в диалоге
- ✅ Счетчик непрочитанных
- ✅ Сортировка по последней активности

### Сообщения
- ✅ Отправка и получение сообщений
- ✅ Real-time обновления через WebSocket
- ✅ Индикатор "печатает..."
- ✅ Форматирование времени
- ✅ Визуальное различие своих/чужих сообщений

### WebSocket
- ✅ Автоматическое подключение при авторизации
- ✅ Получение обновлений из Chat3
- ✅ Индикаторы присутствия (онлайн/оффлайн)
- ✅ Индикаторы печати
- ✅ Переподключение при обрыве связи

## Компоненты

### LoginView
Страница авторизации с двумя шагами:
1. Ввод номера телефона (и имени для новых пользователей)
2. Ввод кода подтверждения

### ChatView
Главная страница приложения:
- Sidebar с списком диалогов
- Окно чата с сообщениями
- Поле ввода сообщения

### DialogList
Список всех диалогов пользователя:
- Название диалога
- Последнее сообщение
- Время последнего сообщения
- Счетчик непрочитанных

### ChatWindow
Окно чата с сообщениями:
- Заголовок диалога
- Список сообщений
- Индикатор "печатает..."
- Автоматическая прокрутка к новым сообщениям

### MessageInput
Поле ввода сообщения:
- Текстовое поле
- Кнопка отправки
- Индикатор печати (отправляется в WebSocket)

## Stores (Pinia)

### authStore
- Управление аутентификацией
- Хранение токена и пользователя
- Запрос и проверка SMS кода
- Подключение WebSocket

### dialogsStore
- Список диалогов
- Текущий выбранный диалог
- Счетчики непрочитанных
- Обновление последнего сообщения

### messagesStore
- Сообщения текущего диалога
- Отправка сообщений
- Индикаторы печати
- Реакции на сообщения

## API Service

Методы для работы с бэкендом:
- `requestCode(phone, name)` - запрос SMS кода
- `verifyCode(phone, code)` - проверка кода
- `getDialogs(params)` - получение диалогов
- `getMessages(dialogId, params)` - получение сообщений
- `sendMessage(dialogId, data)` - отправка сообщения
- `addReaction(messageId, reaction)` - добавление реакции

## WebSocket Service

Методы для работы с WebSocket:
- `connect(token)` - подключение
- `disconnect()` - отключение
- `joinDialog(dialogId)` - присоединение к диалогу
- `leaveDialog(dialogId)` - выход из диалога
- `startTyping(dialogId)` - начало печати
- `stopTyping(dialogId)` - конец печати
- `on(event, callback)` - подписка на события
- `off(event, callback)` - отписка от событий

## Стили

Используется Tailwind CSS с кастомной цветовой палитрой:

```css
/* Утилитарные классы */
.btn-primary   /* Основная кнопка */
.btn-secondary /* Второстепенная кнопка */
.input         /* Поле ввода */
.card          /* Карточка */
```

## Разработка

### Hot Module Replacement
Vite поддерживает HMR - изменения применяются без перезагрузки страницы.

### TypeScript
Все компоненты типизированы. Проверка типов:
```bash
npm run build  # Включает vue-tsc
```

### Proxy
В dev режиме запросы к `/api` проксируются на backend (localhost:3001).

## Production

### Сборка
```bash
npm run build
```

Результат в `dist/` директории.

### Деплой
Можно использовать:
- Nginx для статики
- Vercel / Netlify для быстрого деплоя
- Docker контейнер

### Пример Nginx конфига:
```nginx
server {
    listen 80;
    server_name chat.example.com;
    root /var/www/chatapp/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

## Troubleshooting

### WebSocket не подключается
- Проверьте `VITE_WS_URL` в `.env`
- Проверьте что backend запущен
- Проверьте JWT токен в localStorage

### Сообщения не отправляются
- Проверьте Network tab в DevTools
- Проверьте консоль на ошибки
- Проверьте что выбран диалог

### Не загружаются диалоги
- Проверьте авторизацию
- Проверьте соединение с backend
- Проверьте консоль на ошибки

## Дополнительная документация

- [Backend README](../backend/README.md)
- [Архитектура](../docs/ARCHITECTURE.md)
- [WebSocket API](../backend/WEBSOCKET.md)

