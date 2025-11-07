# 🚀 Быстрый старт

Пошаговое руководство по запуску чат-приложения.

## Предварительные требования

### Обязательно:
- ✅ **Node.js** 18+ ([скачать](https://nodejs.org/))
- ✅ **MongoDB** ([скачать](https://www.mongodb.com/try/download/community))
- ✅ **RabbitMQ** ([скачать](https://www.rabbitmq.com/download.html))
- ✅ **Chat3 API** запущен на `http://localhost:3002`

### Проверка установки:
```bash
node --version    # должно быть >= 18
npm --version
mongod --version
rabbitmq-server   # должен быть запущен
```

---

## Шаг 1: Запуск зависимых сервисов

### MongoDB
```bash
# Linux/Mac
sudo systemctl start mongod

# Mac (Homebrew)
brew services start mongodb-community

# Windows
net start MongoDB

# Docker
docker run -d -p 27017:27017 --name mongodb mongo:7
```

Проверка: `mongosh` должен подключиться

### RabbitMQ
```bash
# Linux
sudo systemctl start rabbitmq-server

# Mac (Homebrew)
brew services start rabbitmq

# Windows
rabbitmq-server

# Docker
docker run -d -p 5672:5672 -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=rmuser \
  -e RABBITMQ_DEFAULT_PASS=rmpassword \
  --name rabbitmq rabbitmq:3-management
```

Проверка: `http://localhost:15672` (логин: rmuser/rmpassword)

### Chat3 API
Убедитесь что Chat3 запущен на `http://localhost:3002`

---

## Шаг 2: Настройка Backend

```bash
# 1. Перейти в директорию backend
cd backend

# 2. Установить зависимости
npm install

# 3. Создать .env файл
cp .env.example .env

# 4. Отредактировать .env
nano .env  # или любой редактор
```

### Минимальная настройка .env:
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/chatpapp
CHAT3_API_URL=http://localhost:3002/api
CHAT3_API_KEY=chat3_edabb7b0fb722074c0d2efcc262f386fa23708adef9115392d79b4e5774e3d28
RABBITMQ_URL=amqp://rmuser:rmpassword@localhost:5672/
RABBITMQ_UPDATES_EXCHANGE=chat3_updates
SMS_MOCK_MODE=true
```

```bash
# 5. Запустить backend
npm run dev
```

### Проверка backend:
```bash
curl http://localhost:3001/health
# Должен вернуть: {"status":"ok",...}
```

---

## Шаг 3: Настройка Frontend

**Откройте новый терминал:**

```bash
# 1. Перейти в директорию frontend
cd frontend

# 2. Установить зависимости
npm install

# 3. Создать .env файл
cp .env.example .env

# 4. (Опционально) Отредактировать .env
nano .env
```

### .env для frontend:
```env
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=http://localhost:3001
```

```bash
# 5. Запустить frontend
npm run dev
```

### Проверка frontend:
Откройте браузер: `http://localhost:5173`

---

## Шаг 4: Первый вход

### 1. Откройте приложение
```
http://localhost:5173
```

### 2. Введите номер телефона
```
79123456789
```

Для нового пользователя введите имя:
```
Тестовый Пользователь
```

### 3. Получите код из консоли backend
В терминале где запущен backend найдите:
```
📱 [SMS MOCK] Sending code to 79123456789
🔐 Verification code: 1234
⏰ Valid for 5 minutes
```

### 4. Введите код
```
1234
```

### 5. Вы в приложении! 🎉

---

## Шаг 5: Тестирование

### Создать второго пользователя

**Откройте приложение в режиме инкогнито или другом браузере:**

1. Авторизуйтесь с другим номером: `79987654321`
2. Создайте диалог с первым пользователем

### Проверить WebSocket

В DevTools Console должно быть:
```
✅ WebSocket connected
```

### Проверить обновления

Отправьте сообщение от одного пользователя - оно должно появиться у другого моментально.

---

## Проверка всех компонентов

### Backend здоров?
```bash
curl http://localhost:3001/health
```

### MongoDB работает?
```bash
mongosh
> show dbs
> use chatpapp
> db.users.find()
```

### RabbitMQ работает?
```bash
# Веб-интерфейс
open http://localhost:15672

# Или curl
curl -u rmuser:rmpassword http://localhost:15672/api/overview
```

### Chat3 API доступен?
```bash
curl http://localhost:3002/api-docs/
```

### WebSocket работает?
Откройте: `backend/test-websocket.html` в браузере

---

## Возможные проблемы

### Backend не запускается

**Ошибка: `MongoDB connection error`**
```bash
# Проверить запущен ли MongoDB
sudo systemctl status mongod

# Запустить MongoDB
sudo systemctl start mongod
```

**Ошибка: `RabbitMQ connection error`**
```bash
# Проверить RabbitMQ
sudo systemctl status rabbitmq-server

# Запустить RabbitMQ
sudo systemctl start rabbitmq-server
```

**Ошибка: `Chat3 API not available`**
- Убедитесь что Chat3 запущен на localhost:3002
- Проверьте `CHAT3_API_URL` в .env

### Frontend не запускается

**Ошибка при `npm install`**
```bash
# Очистить cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Ошибка: `Cannot connect to backend`**
- Убедитесь что backend запущен
- Проверьте `VITE_API_URL` в .env
- Проверьте CORS настройки в backend

### WebSocket не подключается

**В консоли браузера:**
```javascript
// Проверить наличие токена
localStorage.getItem('token')

// Переподключиться
location.reload()
```

---

## Полезные команды

### Backend
```bash
# Development с hot-reload
npm run dev

# Production
npm start

# Проверить health
curl http://localhost:3001/health

# Тестировать API
bash test-api.sh
```

### Frontend
```bash
# Development
npm run dev

# Build
npm run build

# Preview production
npm run preview

# Type check
npm run build  # включает vue-tsc
```

### MongoDB
```bash
# Подключиться
mongosh

# Показать пользователей
use chatpapp
db.users.find().pretty()

# Очистить базу
db.users.deleteMany({})
```

### RabbitMQ
```bash
# Web UI
open http://localhost:15672

# Список очередей
curl -u rmuser:rmpassword http://localhost:15672/api/queues

# Список exchanges
curl -u rmuser:rmpassword http://localhost:15672/api/exchanges
```

---

## Остановка всего

```bash
# Ctrl+C в терминалах backend и frontend

# Остановить MongoDB
sudo systemctl stop mongod

# Остановить RabbitMQ
sudo systemctl stop rabbitmq-server

# Docker контейнеры
docker stop mongodb rabbitmq
```

---

## Production деплой

### 1. Backend

```bash
cd backend

# Установить зависимости
npm install --production

# Настроить .env для production
NODE_ENV=production
MONGODB_URI=mongodb://production-host:27017/chatpapp
RABBITMQ_URL=amqp://user:pass@production-host:5672/

# Запустить с PM2
npm install -g pm2
pm2 start server.js --name chatapp-backend

# Или с systemd
sudo systemctl enable chatapp-backend
sudo systemctl start chatapp-backend
```

### 2. Frontend

```bash
cd frontend

# Сборка
npm run build

# Результат в dist/
# Деплой на Nginx/Apache/CDN
```

---

## Следующие шаги

После успешного запуска:

1. ✅ Прочитайте [Архитектуру](docs/ARCHITECTURE.md)
2. ✅ Изучите [API документацию](backend/README.md)
3. ✅ Попробуйте [WebSocket тесты](backend/test-websocket.html)
4. ✅ Создайте несколько пользователей и протестируйте чат

---

**Готово!** Теперь у вас работающее чат-приложение! 🎉

Если возникли проблемы, проверьте [Troubleshooting](docs/TROUBLESHOOTING.md) или создайте Issue.

