# Архитектура Приложения

Комплексное описание архитектуры чат-приложения с интеграцией Chat3 API.

## Оглавление

- [Общая архитектура](#общая-архитектура)
- [Компоненты системы](#компоненты-системы)
- [Потоки данных](#потоки-данных)
  - [Авторизация](#поток-авторизации)
  - [Отправка сообщений](#поток-отправки-сообщений)
  - [Получение обновлений](#поток-получения-обновлений)
  - [WebSocket коммуникация](#websocket-коммуникация)
- [Архитектура бэкенда](#архитектура-бэкенда)
- [Модели данных](#модели-данных)
- [Безопасность](#безопасность)

---

## Общая архитектура

```mermaid
graph TB
    subgraph "Frontend"
        Client[Web Client]
        WS_Client[WebSocket Client]
        HTTP_Client[HTTP Client]
    end

    subgraph "Our Backend"
        API[Express API Server]
        WS_Server[WebSocket Server]
        Auth[Auth Service]
        Chat3Client[Chat3 Client]
        RabbitMQ_Service[RabbitMQ Service]
        DB[("MongoDB
        Users")]
    end

    subgraph "Chat3 Infrastructure"
        Chat3_API[Chat3 REST API]
        Chat3_Worker[Update Worker]
        Chat3_DB[("MongoDB
        Dialogs, Messages")]
        RabbitMQ_Events[("RabbitMQ
        Events Exchange")]
        RabbitMQ_Updates[("RabbitMQ
        Updates Exchange")]
    end

    %% Frontend connections
    Client -->|HTTP/REST| HTTP_Client
    Client -->|WebSocket| WS_Client
    
    HTTP_Client -->|JWT Auth| API
    WS_Client -->|JWT Auth| WS_Server

    %% Backend internal
    API -->|Verify Token| Auth
    API -->|Chat3 Requests| Chat3Client
    WS_Server -->|Subscribe/Unsubscribe| RabbitMQ_Service
    WS_Server -->|Verify Token| Auth
    Auth -->|Store/Get Users| DB

    %% Backend to Chat3
    Chat3Client -->|REST API| Chat3_API
    RabbitMQ_Service -->|Consume Updates| RabbitMQ_Updates

    %% Chat3 Internal Flow
    Chat3_API -->|Events| RabbitMQ_Events
    Chat3_API -->|Store Data| Chat3_DB
    RabbitMQ_Events -->|Process| Chat3_Worker
    Chat3_Worker -->|Create Updates| Chat3_DB
    Chat3_Worker -->|Publish| RabbitMQ_Updates

    %% Real-time updates
    RabbitMQ_Service -->|Forward Updates| WS_Server
    WS_Server -->|Emit Events| WS_Client

    style Client fill:#e1f5ff
    style API fill:#fff3e0
    style WS_Server fill:#fff3e0
    style Chat3_API fill:#f3e5f5
    style RabbitMQ_Updates fill:#e8f5e9
    style RabbitMQ_Events fill:#e8f5e9
```

---

## Компоненты системы

### Frontend (Клиент)
- **Web Client** - пользовательский интерфейс
- **WebSocket Client** - real-time подключение для обновлений
- **HTTP Client** - REST API запросы

### Our Backend
| Компонент | Описание | Технология |
|-----------|----------|------------|
| **Express API** | REST API сервер | Express.js |
| **WebSocket Server** | Real-time сервер | Socket.io |
| **Auth Service** | Авторизация пользователей | JWT |
| **Chat3 Client** | Клиент для Chat3 API | Axios |
| **RabbitMQ Service** | Получение обновлений | amqplib |
| **MongoDB** | База пользователей | Mongoose |

### Chat3 Infrastructure
| Компонент | Описание |
|-----------|----------|
| **Chat3 API** | Управление диалогами и сообщениями |
| **Update Worker** | Обработка событий и создание updates |
| **MongoDB** | Хранение диалогов, сообщений, updates |
| **RabbitMQ Events** | Exchange для событий системы |
| **RabbitMQ Updates** | Exchange для персонализированных обновлений |

---

## Потоки данных

### Поток авторизации

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant AuthService
    participant SMSService
    participant DB
    participant JWT

    %% Request Code
    Client->>API: POST /api/auth/request-code<br/>{phone, name}
    API->>AuthService: requestCode(phone, name)
    AuthService->>DB: Find user by phone
    
    alt User not found
        AuthService->>DB: Create new user<br/>Generate userId: usr_XXXXXXXX
        DB-->>AuthService: User created
    else User exists
        AuthService->>DB: Update verification code
        DB-->>AuthService: User updated
    end

    AuthService->>SMSService: sendVerificationCode(phone, code)
    SMSService-->>AuthService: Code sent (mock)
    AuthService-->>API: {success: true, isNewUser}
    API-->>Client: 200 OK

    Note over Client: User enters code from SMS

    %% Verify Code
    Client->>API: POST /api/auth/verify-code<br/>{phone, code}
    API->>AuthService: verifyCode(phone, code)
    AuthService->>DB: Find user & validate code
    
    alt Valid code
        AuthService->>JWT: Generate token<br/>payload: {userId, phone}
        JWT-->>AuthService: JWT token (48h)
        AuthService->>DB: Clear verification code
        AuthService-->>API: {token, user: {userId, phone, name}}
        API-->>Client: 200 OK + JWT token
    else Invalid code
        AuthService-->>API: Error: Invalid code
        API-->>Client: 400 Bad Request
    end

    Note over Client: Store JWT token<br/>Use for all requests
```

### Поток отправки сообщений

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant AuthMiddleware
    participant Chat3Client
    participant Chat3_API
    participant Chat3_DB
    participant RabbitMQ_Events
    participant Worker

    Client->>API: POST /api/messages/dialog/{dialogId}<br/>Authorization: Bearer {token}<br/>{content, type, meta}
    
    API->>AuthMiddleware: Verify JWT token
    AuthMiddleware->>AuthMiddleware: Decode token → userId
    AuthMiddleware-->>API: req.user = {userId, phone, name}

    API->>Chat3Client: createMessage(dialogId, {<br/>  senderId: userId,<br/>  content, type, meta<br/>})
    
    Chat3Client->>Chat3_API: POST /api/dialogs/{dialogId}/messages<br/>X-API-Key: {apiKey}
    
    Chat3_API->>Chat3_DB: Save message
    Chat3_DB-->>Chat3_API: Message saved
    
    Chat3_API->>Chat3_API: Create Event:<br/>eventType: message.create
    Chat3_API->>Chat3_DB: Save Event
    Chat3_API->>RabbitMQ_Events: Publish Event<br/>routing: message.create

    Chat3_API-->>Chat3Client: 201 Created<br/>{message data}
    Chat3Client-->>API: {data: message}
    API-->>Client: 201 Created<br/>{success: true, message}

    Note over RabbitMQ_Events,Worker: Асинхронная обработка

    RabbitMQ_Events->>Worker: Consume Event
    Worker->>Worker: Process message.create event
    Worker->>Chat3_DB: Get dialog members
    Worker->>Worker: Create MessageUpdate<br/>for each member
    Worker->>Chat3_DB: Save Updates
    Worker->>RabbitMQ_Updates: Publish Updates<br/>routing: user.{userId}.messageupdate

    Note over Worker: Каждый участник диалога<br/>получает свой Update
```

### Поток получения обновлений

```mermaid
sequenceDiagram
    participant Client
    participant WS_Server
    participant RabbitMQ_Service
    participant RabbitMQ_Updates
    participant Worker

    Note over Worker,RabbitMQ_Updates: Update Worker публикует updates

    Worker->>RabbitMQ_Updates: Publish Update<br/>routing: user.usr_a3f9k2p1.messageupdate<br/>{eventType, data, dialogId, ...}

    Note over Client: User подключается к WebSocket

    Client->>WS_Server: Connect with JWT token
    WS_Server->>WS_Server: Authenticate user → userId: usr_a3f9k2p1
    
    WS_Server->>RabbitMQ_Service: subscribeUser(userId, callback)
    RabbitMQ_Service->>RabbitMQ_Updates: Create queue:<br/>chatpapp_user_{userId}_updates
    RabbitMQ_Service->>RabbitMQ_Updates: Bind queue to exchange<br/>routing: user.{userId}.*
    RabbitMQ_Service->>RabbitMQ_Updates: Start consuming messages

    WS_Server-->>Client: Connected

    Note over RabbitMQ_Updates: New update arrives

    RabbitMQ_Updates->>RabbitMQ_Service: Deliver Update
    RabbitMQ_Service->>RabbitMQ_Service: Parse update JSON
    RabbitMQ_Service->>WS_Server: callback(update)
    
    WS_Server->>WS_Server: Determine event type
    
    alt eventType = message.create
        WS_Server->>Client: emit('chat3:update', update)
        WS_Server->>Client: emit('message:new', update.data)
    else eventType starts with message.
        WS_Server->>Client: emit('chat3:update', update)
        WS_Server->>Client: emit('message:update', update)
    else eventType starts with dialog.
        WS_Server->>Client: emit('chat3:update', update)
        WS_Server->>Client: emit('dialog:update', update)
    end

    RabbitMQ_Service->>RabbitMQ_Updates: ACK message

    Note over Client: User disconnects

    Client->>WS_Server: Disconnect
    WS_Server->>RabbitMQ_Service: unsubscribeUser(userId)
    RabbitMQ_Service->>RabbitMQ_Updates: Delete queue:<br/>chatpapp_user_{userId}_updates
```

### WebSocket коммуникация

```mermaid
sequenceDiagram
    participant Client
    participant WS_Server
    participant RabbitMQ_Service
    participant Other_Clients

    %% Connection
    rect rgb(230, 247, 255)
        Note over Client,WS_Server: Подключение
        Client->>WS_Server: Connect {auth: {token}}
        WS_Server->>WS_Server: Authenticate user
        WS_Server->>RabbitMQ_Service: Subscribe to updates
        WS_Server->>Other_Clients: Broadcast user:online<br/>{userId, userName}
        WS_Server-->>Client: Connected
    end

    %% Join Dialog
    rect rgb(255, 243, 224)
        Note over Client,WS_Server: Присоединение к диалогу
        Client->>WS_Server: emit('dialog:join', dialogId)
        WS_Server->>WS_Server: socket.join(`dialog:${dialogId}`)
        WS_Server-->>Client: Joined room
    end

    %% Typing Indicators
    rect rgb(232, 245, 233)
        Note over Client,Other_Clients: Индикаторы печати
        Client->>WS_Server: emit('typing:start', {dialogId})
        WS_Server->>Other_Clients: emit('typing:start')<br/>{userId, userName, dialogId}
        
        Note over Client: User stops typing
        
        Client->>WS_Server: emit('typing:stop', {dialogId})
        WS_Server->>Other_Clients: emit('typing:stop')<br/>{userId, dialogId}
    end

    %% Receive Updates
    rect rgb(243, 229, 245)
        Note over RabbitMQ_Service,Client: Получение обновлений
        RabbitMQ_Service->>WS_Server: Update received
        WS_Server->>Client: emit('chat3:update', update)
        WS_Server->>Client: emit('message:new', data)
    end

    %% Disconnect
    rect rgb(255, 235, 238)
        Note over Client,Other_Clients: Отключение
        Client->>WS_Server: Disconnect
        WS_Server->>RabbitMQ_Service: Unsubscribe from updates
        WS_Server->>Other_Clients: Broadcast user:offline<br/>{userId}
    end
```

---

## Архитектура бэкенда

```mermaid
graph TB
    subgraph "Entry Point"
        Server["server.js
        Express + HTTP Server"]
    end

    subgraph "API Layer"
        AuthRoutes["/api/auth/*
        routes/auth.js"]
        DialogRoutes["/api/dialogs/*
        routes/dialogs.js"]
        MessageRoutes["/api/messages/*
        routes/messages.js"]
    end

    subgraph "Middleware"
        AuthMiddleware["auth.js
        JWT Verification"]
        ErrorHandler[Error Handler]
        CORS[CORS + Helmet]
    end

    subgraph "Services"
        AuthService["AuthService
        SMS + JWT"]
        SMSService["SMSService
        Code Generation"]
        Chat3Client["Chat3Client
        Axios HTTP Client"]
        RabbitMQService["RabbitMQService
        amqplib Consumer"]
    end

    subgraph "Models"
        UserModel["User Model
        Mongoose Schema"]
    end

    subgraph "WebSocket"
        WSServer["WebSocket Server
        Socket.io"]
    end

    subgraph "External Services"
        MongoDB[("MongoDB
        Users")]
        Chat3API[Chat3 REST API]
        RabbitMQ["RabbitMQ
        Updates Exchange"]
    end

    subgraph "Configuration"
        Config["config/index.js
        Environment Variables"]
        EnvFile[.env]
    end

    %% Entry point connections
    Server -->|Mount routes| AuthRoutes
    Server -->|Mount routes| DialogRoutes
    Server -->|Mount routes| MessageRoutes
    Server -->|Initialize| WSServer
    Server -->|Use| CORS

    %% Middleware flow
    AuthRoutes -->|Protected| AuthMiddleware
    DialogRoutes -->|Protected| AuthMiddleware
    MessageRoutes -->|Protected| AuthMiddleware

    %% Routes to Services
    AuthRoutes -->|Use| AuthService
    DialogRoutes -->|Use| Chat3Client
    MessageRoutes -->|Use| Chat3Client

    %% Services connections
    AuthService -->|Use| SMSService
    AuthService -->|Query| UserModel
    AuthMiddleware -->|Use| AuthService

    %% WebSocket connections
    WSServer -->|Authenticate| AuthService
    WSServer -->|Subscribe| RabbitMQService

    %% Models to DB
    UserModel -->|Store| MongoDB

    %% Services to External
    Chat3Client -->|HTTP| Chat3API
    RabbitMQService -->|Consume| RabbitMQ

    %% Configuration
    Config -->|Load| EnvFile
    Server -->|Use| Config
    AuthService -->|Use| Config
    Chat3Client -->|Use| Config
    RabbitMQService -->|Use| Config

    style Server fill:#ff9800
    style WSServer fill:#ff9800
    style AuthService fill:#4caf50
    style Chat3Client fill:#2196f3
    style RabbitMQService fill:#9c27b0
    style MongoDB fill:#00bcd4
    style Chat3API fill:#e91e63
    style RabbitMQ fill:#8bc34a
```

### Структура директорий

```
backend/
├── server.js                 # Точка входа, инициализация сервера
├── src/
│   ├── config/
│   │   └── index.js         # Конфигурация из .env
│   ├── db/
│   │   └── index.js         # MongoDB подключение
│   ├── models/
│   │   └── User.js          # Mongoose модель User
│   ├── services/
│   │   ├── AuthService.js   # Логика авторизации
│   │   ├── SMSService.js    # Отправка SMS (mock)
│   │   ├── Chat3Client.js   # HTTP клиент для Chat3
│   │   └── RabbitMQService.js # RabbitMQ consumer
│   ├── routes/
│   │   ├── auth.js          # Эндпоинты авторизации
│   │   ├── dialogs.js       # Эндпоинты диалогов
│   │   └── messages.js      # Эндпоинты сообщений
│   ├── middleware/
│   │   └── auth.js          # JWT middleware
│   └── websocket/
│       └── index.js         # WebSocket сервер
├── docs/
│   └── RABBITMQ_INTEGRATION.md
├── migrations/
│   └── add-userId.js        # Миграция userId
└── .env                     # Переменные окружения
```

---

## Модели данных

### User (MongoDB - Our Database)

```mermaid
classDiagram
    class User {
        +String userId           [unique, usr_XXXXXXXX]
        +String phone            [unique, 79XXXXXXXXX]
        +String name
        +Object verificationCode
        +Date createdAt
        +Date lastActiveAt
        +isVerificationCodeValid(code) Boolean
    }
    
    class VerificationCode {
        +String code             [4 digits]
        +Date expiresAt         [5 minutes]
    }
    
    User *-- VerificationCode
```

### Chat3 Data Models (Chat3 Database)

```mermaid
classDiagram
    class Dialog {
        +ObjectId _id
        +String tenantId
        +String name
        +String createdBy
        +Object meta
        +Date createdAt
        +Date updatedAt
    }
    
    class Message {
        +ObjectId _id
        +String tenantId
        +ObjectId dialogId
        +String senderId         [userId]
        +String content          [max 4096]
        +String type             [text, image, file]
        +Object reactionCounts
        +Object meta
        +Date createdAt
        +Date updatedAt
    }
    
    class DialogMember {
        +ObjectId _id
        +String tenantId
        +ObjectId dialogId
        +String userId
        +Boolean isActive
        +Number unreadCount
        +Date lastSeenAt
        +Date joinedAt
    }
    
    class Update {
        +ObjectId _id
        +String tenantId
        +String userId           [получатель]
        +ObjectId dialogId
        +ObjectId entityId       [Dialog или Message]
        +ObjectId eventId
        +String eventType
        +Object data             [полные данные]
        +Boolean published
        +Date publishedAt
        +Date createdAt
    }
    
    Dialog "1" --> "*" Message : contains
    Dialog "1" --> "*" DialogMember : has members
    Update "*" --> "1" Dialog : references
    Update "*" --> "1" Message : references
```

---

## Безопасность

```mermaid
graph TB
    subgraph "Authentication Flow"
        A1[Client Request] -->|Include JWT| A2[API Endpoint]
        A2 -->|Extract Token| A3[Auth Middleware]
        A3 -->|Verify| A4{Valid?}
        A4 -->|Yes| A5[Decode userId]
        A4 -->|No| A6[401 Unauthorized]
        A5 -->|Attach to req.user| A7[Route Handler]
    end
    
    subgraph "JWT Token"
        J1[Payload]
        J2[userId: usr_XXXXXXXX]
        J3[phone: 79XXXXXXXXX]
        J4[Expiry: 48 hours]
        
        J1 --> J2
        J1 --> J3
        J1 --> J4
    end
    
    subgraph "RabbitMQ Security"
        R1[User connects to WebSocket]
        R2[JWT Authentication]
        R3[Extract userId]
        R4[Create personal queue]
        R5[Bind to user.userId.*]
        R6[User receives only their updates]
        
        R1 --> R2
        R2 --> R3
        R3 --> R4
        R4 --> R5
        R5 --> R6
    end
    
    style A6 fill:#ff5252
    style A7 fill:#4caf50
    style R6 fill:#4caf50
```

### Уровни безопасности

| Уровень | Механизм | Описание |
|---------|----------|----------|
| **Transport** | HTTPS/WSS | Шифрование соединения (production) |
| **Authentication** | JWT | Токены с подписью и временем жизни |
| **Authorization** | Middleware | Проверка токена на каждом запросе |
| **User Isolation** | userId | Каждый пользователь видит только свои данные |
| **RabbitMQ** | Routing Keys | `user.{userId}.*` - персональные очереди |
| **Chat3 API** | API Key | Защита запросов к Chat3 |

---

## Полный жизненный цикл сообщения

```mermaid
sequenceDiagram
    autonumber
    
    participant User_A as User A<br/>(Sender)
    participant API
    participant Chat3_API
    participant Worker
    participant RabbitMQ
    participant Backend
    participant User_B as User B<br/>(Receiver)

    rect rgb(230, 247, 255)
        Note over User_A,Chat3_API: Создание сообщения
        User_A->>API: POST /api/messages/dialog/{id}<br/>{content: "Hello!"}
        API->>Chat3_API: Create message
        Chat3_API->>Chat3_API: Save message to DB
        Chat3_API->>RabbitMQ: Publish Event<br/>message.create
        Chat3_API-->>API: Message created
        API-->>User_A: 201 Created
    end

    rect rgb(255, 243, 224)
        Note over Worker,RabbitMQ: Обработка события
        RabbitMQ->>Worker: Event: message.create
        Worker->>Worker: Get dialog members
        Worker->>Worker: Create Updates for:<br/>- User A<br/>- User B
        Worker->>RabbitMQ: Publish Update<br/>user.usr_a.messageupdate
        Worker->>RabbitMQ: Publish Update<br/>user.usr_b.messageupdate
    end

    rect rgb(232, 245, 233)
        Note over RabbitMQ,User_B: Доставка обновления
        RabbitMQ->>Backend: Update for User B
        Backend->>Backend: Parse update
        Backend->>User_B: WebSocket emit<br/>message:new
        User_B->>User_B: Display message
    end

    rect rgb(243, 229, 245)
        Note over User_B,Chat3_API: Отметка как прочитано
        User_B->>API: POST /messages/{id}/status/read
        API->>Chat3_API: Update status
        Chat3_API->>RabbitMQ: Publish Event<br/>message.status.update
    end

    rect rgb(255, 235, 238)
        Note over RabbitMQ,User_A: Уведомление отправителя
        RabbitMQ->>Worker: Event: message.status.update
        Worker->>RabbitMQ: Publish Updates
        RabbitMQ->>Backend: Update for User A
        Backend->>User_A: WebSocket emit<br/>message:update
        User_A->>User_A: Show "read" status
    end
```

---

## Масштабирование

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Nginx / Load Balancer]
    end

    subgraph "Backend Instances"
        BE1[Backend Instance 1<br/>Port 3001]
        BE2[Backend Instance 2<br/>Port 3002]
        BE3[Backend Instance 3<br/>Port 3003]
    end

    subgraph "Shared Services"
        MongoDB[(MongoDB<br/>Users)]
        RabbitMQ[RabbitMQ<br/>Updates]
        Chat3[Chat3 API]
    end

    Client1[Client 1] -->|WSS| LB
    Client2[Client 2] -->|WSS| LB
    Client3[Client 3] -->|WSS| LB

    LB -->|Sticky Session| BE1
    LB -->|Sticky Session| BE2
    LB -->|Sticky Session| BE3

    BE1 -->|Read/Write| MongoDB
    BE2 -->|Read/Write| MongoDB
    BE3 -->|Read/Write| MongoDB

    BE1 -->|Subscribe| RabbitMQ
    BE2 -->|Subscribe| RabbitMQ
    BE3 -->|Subscribe| RabbitMQ

    BE1 -->|HTTP| Chat3
    BE2 -->|HTTP| Chat3
    BE3 -->|HTTP| Chat3

    style LB fill:#ff9800
    style BE1 fill:#4caf50
    style BE2 fill:#4caf50
    style BE3 fill:#4caf50
```

### Особенности горизонтального масштабирования

1. **WebSocket** - sticky sessions для сохранения соединения с одним экземпляром
2. **RabbitMQ** - каждый экземпляр создает свои очереди для подключенных пользователей
3. **MongoDB** - shared database для всех экземпляров
4. **Stateless** - каждый запрос независим благодаря JWT

---

## Мониторинг и метрики

```mermaid
graph LR
    subgraph "Метрики Backend"
        M1[Active WebSocket<br/>Connections]
        M2[RabbitMQ<br/>Subscribers]
        M3[HTTP Request<br/>Rate]
        M4[Response Time]
    end

    subgraph "Метрики RabbitMQ"
        R1[Queue Length]
        R2[Message Rate]
        R3[Unacked Messages]
        R4[Consumer Count]
    end

    subgraph "Метрики MongoDB"
        D1[Connections]
        D2[Query Time]
        D3[Collection Size]
        D4[Index Usage]
    end

    subgraph "Метрики Chat3"
        C1[API Response Time]
        C2[Request Rate]
        C3[Error Rate]
    end

    M1 --> Dashboard[Monitoring Dashboard]
    M2 --> Dashboard
    M3 --> Dashboard
    M4 --> Dashboard
    R1 --> Dashboard
    R2 --> Dashboard
    D1 --> Dashboard
    C1 --> Dashboard

    style Dashboard fill:#2196f3,color:#fff
```

---

## Обработка ошибок

```mermaid
graph TB
    Start[Request/Event] --> Check{Validate Input}
    
    Check -->|Invalid| E1[400 Bad Request]
    Check -->|Valid| Auth{Authenticate}
    
    Auth -->|Fail| E2[401 Unauthorized]
    Auth -->|Success| Process[Process Request]
    
    Process -->|DB Error| E3[500 Internal Error]
    Process -->|Chat3 Error| Retry{Retry?}
    Process -->|RabbitMQ Error| Reconnect{Reconnect?}
    Process -->|Success| Success[200 OK]
    
    Retry -->|Yes| Process
    Retry -->|No| E4[503 Service Unavailable]
    
    Reconnect -->|Yes| Queue[Queue for Retry]
    Reconnect -->|No| E5[Connection Lost]
    
    Queue --> Process
    
    E1 --> Log[Log Error]
    E2 --> Log
    E3 --> Log
    E4 --> Log
    E5 --> Log
    
    Log --> Return[Return Error Response]
    
    style Success fill:#4caf50
    style E1 fill:#ff9800
    style E2 fill:#ff5252
    style E3 fill:#ff5252
    style E4 fill:#ff5252
    style E5 fill:#ff5252
```

---

## Deployment архитектура

```mermaid
graph TB
    subgraph "Production Environment"
        subgraph "Docker Containers"
            Backend1[Backend Container 1]
            Backend2[Backend Container 2]
        end
        
        subgraph "Services"
            MongoDB[MongoDB Container]
            RabbitMQ_Cont[RabbitMQ Container]
            Nginx[Nginx Container<br/>Load Balancer]
        end
        
        subgraph "External"
            Chat3_Prod[Chat3 API<br/>External Service]
        end
    end
    
    Internet[Internet] --> Nginx
    Nginx --> Backend1
    Nginx --> Backend2
    
    Backend1 --> MongoDB
    Backend2 --> MongoDB
    
    Backend1 --> RabbitMQ_Cont
    Backend2 --> RabbitMQ_Cont
    
    Backend1 --> Chat3_Prod
    Backend2 --> Chat3_Prod
    
    style Internet fill:#e1f5ff
    style Nginx fill:#ff9800
    style Backend1 fill:#4caf50
    style Backend2 fill:#4caf50
```

### Docker Compose Example

```yaml
services:
  backend:
    image: chatapp-backend:latest
    replicas: 2
    environment:
      - MONGODB_URI=mongodb://mongo:27017/chatpapp
      - RABBITMQ_URL=amqp://rabbitmq:5672
      - CHAT3_API_URL=https://chat3.external.com/api
    depends_on:
      - mongo
      - rabbitmq

  mongo:
    image: mongo:7
    volumes:
      - mongo_data:/data/db

  rabbitmq:
    image: rabbitmq:3-management
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
```

---

## Заключение

Архитектура приложения построена на следующих принципах:

✅ **Модульность** - четкое разделение компонентов и ответственности  
✅ **Масштабируемость** - горизонтальное масштабирование через Load Balancer  
✅ **Надежность** - graceful shutdown, reconnection, error handling  
✅ **Безопасность** - JWT, user isolation, routing keys  
✅ **Real-time** - WebSocket + RabbitMQ для мгновенных обновлений  
✅ **Интеграция** - seamless работа с Chat3 API  

---

**Версия:** 1.0  
**Дата:** 2025-11-04  
**Автор:** ChatApp Team

