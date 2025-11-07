# Индекс документации

Полный список документации проекта ChatApp.

## 📐 Архитектура и дизайн

### [Архитектура приложения](docs/ARCHITECTURE.md)
**Комплексная документация с Mermaid диаграммами**

Включает:
- Общая архитектура системы
- Поток авторизации (sequence diagram)
- Поток отправки сообщений (sequence diagram)
- Поток получения обновлений через RabbitMQ (sequence diagram)
- WebSocket коммуникация (sequence diagram)
- Архитектура бэкенда (component diagram)
- Модели данных (class diagram)
- Полный жизненный цикл сообщения
- Безопасность
- Масштабирование
- Deployment архитектура

### [Chat3 Updates System](docs/chat3/UPDATES.md)
Документация системы обновлений Chat3:
- Архитектура Updates
- Типы updates (DialogUpdate, MessageUpdate)
- Процесс создания и публикации
- Routing keys и подписки
- Примеры использования

---

## 🚀 Быстрый старт

### [Быстрый старт](QUICK_START.md)
**Пошаговое руководство по запуску приложения**

Включает:
- Установка всех зависимостей
- Настройка backend и frontend
- Первый вход в приложение
- Проверка всех компонентов
- Решение типичных проблем

---

## 💻 Frontend

### [Frontend README](frontend/README.md)
Документация фронтенда:
- Установка и запуск
- Структура проекта
- Компоненты и stores
- API и WebSocket services
- Production деплой

---

## 🔧 Backend

### [Backend README](backend/README.md)
Основная документация бэкенда:
- Установка и запуск
- API endpoints
- Конфигурация
- Структура проекта

### [WebSocket API](backend/WEBSOCKET.md)
Документация WebSocket сервера:
- События от клиента к серверу
- События от сервера к клиенту
- Chat3 updates через WebSocket
- Примеры использования
- React hooks примеры

### [RabbitMQ Integration](backend/docs/RABBITMQ_INTEGRATION.md)
Интеграция с системой обновлений Chat3:
- Архитектура интеграции
- RabbitMQService
- Типы updates
- Структура update
- Примеры подписки
- Мониторинг и отладка
- Troubleshooting

### [Migration Guide](backend/MIGRATION.md)
Руководство по миграции на кастомные userId:
- Изменения в API
- Скрипт миграции
- Использование в коде
- Преимущества нового формата

### [Changelog](backend/CHANGELOG.md)
История изменений проекта

---

## 📋 API Тесты

### [HTTP Tests](backend/api-test.http)
REST Client тесты для VS Code:
- Авторизация
- Диалоги
- Сообщения
- Реакции

### [Shell Test Script](backend/test-api.sh)
Bash скрипт для тестирования API:
- Автоматический flow от авторизации до отправки сообщения
- Интерактивный ввод SMS кода
- Цветной вывод результатов

### [WebSocket Test Client](backend/test-websocket.html)
HTML страница для тестирования WebSocket:
- Подключение с JWT
- Подписка на диалоги
- Индикаторы печати
- Просмотр событий в реальном времени

---

## 🗄️ База данных

### [Migrations](backend/migrations/README.md)
Документация миграций:
- Список доступных миграций
- Инструкции по запуску
- Откат миграций

### [Add userId Migration](backend/migrations/add-userId.js)
Скрипт миграции для добавления кастомных userId

---

## 🚀 Быстрый старт

### Для разработчиков

1. **Начните с архитектуры**
   - [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - понять общую картину

2. **Настройте backend**
   - [backend/README.md](backend/README.md) - установка и запуск

3. **Изучите API**
   - [backend/README.md](backend/README.md) - REST API endpoints
   - [backend/WEBSOCKET.md](backend/WEBSOCKET.md) - WebSocket события

4. **Протестируйте**
   - [backend/api-test.http](backend/api-test.http) - HTTP тесты
   - [backend/test-websocket.html](backend/test-websocket.html) - WebSocket тесты

### Для новых разработчиков

**Рекомендуемый порядок изучения:**

```
1. README.md                           # Обзор проекта
   ↓
2. QUICK_START.md                      # Запуск приложения
   ↓
3. docs/ARCHITECTURE.md                # Понять архитектуру
   ↓
4. backend/README.md                   # Backend API
   ↓
5. frontend/README.md                  # Frontend компоненты
   ↓
6. docs/chat3/UPDATES.md              # Система обновлений Chat3
   ↓
7. backend/docs/RABBITMQ_INTEGRATION.md # Интеграция RabbitMQ
   ↓
8. backend/WEBSOCKET.md                # WebSocket API
   ↓
9. backend/MIGRATION.md                # Особенности userId
```

---

## 📊 Диаграммы и схемы

Все диаграммы используют Mermaid и доступны в:

### [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- ✅ Общая архитектура системы
- ✅ Поток авторизации
- ✅ Поток отправки сообщений  
- ✅ Поток получения обновлений
- ✅ WebSocket коммуникация
- ✅ Архитектура бэкенда
- ✅ Модели данных
- ✅ Полный жизненный цикл сообщения
- ✅ Обработка ошибок
- ✅ Масштабирование
- ✅ Deployment

---

## 🔍 Поиск по документации

### По функциональности

**Авторизация:**
- [backend/README.md](backend/README.md) - API endpoints
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - поток авторизации
- [backend/src/services/AuthService.js](backend/src/services/AuthService.js) - код

**Сообщения:**
- [backend/README.md](backend/README.md) - API endpoints
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - жизненный цикл сообщения
- [backend/src/routes/messages.js](backend/src/routes/messages.js) - код

**WebSocket:**
- [backend/WEBSOCKET.md](backend/WEBSOCKET.md) - API и события
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - WebSocket коммуникация
- [backend/src/websocket/index.js](backend/src/websocket/index.js) - код

**RabbitMQ:**
- [backend/docs/RABBITMQ_INTEGRATION.md](backend/docs/RABBITMQ_INTEGRATION.md) - полная документация
- [docs/chat3/UPDATES.md](docs/chat3/UPDATES.md) - система Chat3
- [backend/src/services/RabbitMQService.js](backend/src/services/RabbitMQService.js) - код

### По технологиям

#### Backend

| Технология | Документация | Код |
|-----------|--------------|-----|
| Express | [backend/README.md](backend/README.md) | [backend/server.js](backend/server.js) |
| Socket.io | [backend/WEBSOCKET.md](backend/WEBSOCKET.md) | [backend/src/websocket/](backend/src/websocket/) |
| MongoDB | [backend/MIGRATION.md](backend/MIGRATION.md) | [backend/src/models/](backend/src/models/) |
| RabbitMQ | [backend/docs/RABBITMQ_INTEGRATION.md](backend/docs/RABBITMQ_INTEGRATION.md) | [backend/src/services/RabbitMQService.js](backend/src/services/RabbitMQService.js) |
| JWT | [backend/README.md](backend/README.md) | [backend/src/services/AuthService.js](backend/src/services/AuthService.js) |
| Axios | [backend/README.md](backend/README.md) | [backend/src/services/Chat3Client.js](backend/src/services/Chat3Client.js) |

#### Frontend

| Технология | Документация | Код |
|-----------|--------------|-----|
| Vue 3 | [frontend/README.md](frontend/README.md) | [frontend/src/App.vue](frontend/src/App.vue) |
| Pinia | [frontend/README.md](frontend/README.md) | [frontend/src/stores/](frontend/src/stores/) |
| Vue Router | [frontend/README.md](frontend/README.md) | [frontend/src/router/](frontend/src/router/) |
| Tailwind | [frontend/README.md](frontend/README.md) | [frontend/src/style.css](frontend/src/style.css) |
| Socket.io Client | [backend/WEBSOCKET.md](backend/WEBSOCKET.md) | [frontend/src/services/websocket.ts](frontend/src/services/websocket.ts) |
| TypeScript | [frontend/README.md](frontend/README.md) | [frontend/src/types/](frontend/src/types/) |

---

## 🛠️ Инструменты разработки

### Тестирование
- [api-test.http](backend/api-test.http) - REST Client (VS Code)
- [test-api.sh](backend/test-api.sh) - Bash скрипт
- [test-websocket.html](backend/test-websocket.html) - WebSocket UI

### Миграции
- [migrations/](backend/migrations/) - Database migrations
- [migrations/README.md](backend/migrations/README.md) - Документация

---

## 📝 Contribution Guide

При добавлении новой функциональности:

1. ✅ Обновить [CHANGELOG.md](backend/CHANGELOG.md)
2. ✅ Добавить документацию в соответствующий раздел
3. ✅ Обновить [ARCHITECTURE.md](docs/ARCHITECTURE.md) если изменилась архитектура
4. ✅ Добавить тесты в [api-test.http](backend/api-test.http)
5. ✅ Обновить этот индекс если добавлен новый документ

---

## 📞 Контакты и поддержка

- **Issues:** GitHub Issues
- **Email:** support@chatapp.com
- **Docs:** Этот файл

---

**Версия:** 1.0  
**Последнее обновление:** 2025-11-04

