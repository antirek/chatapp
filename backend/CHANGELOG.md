# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.4.1] - 2025-11-05

### Fixed
- **CRITICAL: Real-time Message Updates** - Fixed WebSocket event emission
  - Backend now emits `message:new` events to all dialog participants after message creation
  - Added detailed logging for WebSocket rooms and events
  - Messages appear instantly for all users in the dialog
  - Documentation: `docs/REALTIME_FIX.md`

### Added
- **Users API** - Endpoints for getting user list
  - GET /api/users - Get all users with search support
  - GET /api/users/:userId - Get specific user
  - Excludes current user from list
  - Search by name or phone
  - Script for creating test users: `scripts/create-test-users.js`

### Fixed
- **CRITICAL: Message Send Response** - Changed field name from `message` to `data`
  - POST /api/messages/dialog/:id now returns `data` instead of `message`
  - Consistent with other API responses
  - Frontend can now display sent messages immediately
- **Dialog Creation Response** - Now returns full transformed data structure
  - POST /api/dialogs returns same structure as GET /api/dialogs
  - Includes dialogName, unreadCount, and all required fields
  - Frontend can display dialog titles immediately after creation

### Added (Previous)
- **RabbitMQ Integration** - Real-time updates from Chat3
  - RabbitMQService for consuming Chat3 updates
  - Automatic subscription/unsubscription on WebSocket connect/disconnect
  - Event forwarding: `chat3:update`, `message:new`, `message:update`, `dialog:update`
  - Graceful reconnection on connection loss
  - Comprehensive documentation in `docs/RABBITMQ_INTEGRATION.md`
- Custom `userId` field with format `usr_XXXXXXXX`
- Auto-generation of unique userId on user creation
- Migration guide for existing users
- Graceful shutdown handling for all services

### Changed
- **BREAKING**: API responses now use `userId` instead of `id` or `_id`
- JWT tokens now contain custom `userId` instead of MongoDB ObjectId
- All internal code updated to use `userId`
- WebSocket initialization is now async to support RabbitMQ connection
- Enhanced WebSocket events with Chat3 updates

### Dependencies
- Added `amqplib@^0.10.3` for RabbitMQ client

### Migration Required
If you have existing users in the database, run the migration script:
```bash
node migrations/add-userId.js
```

See [MIGRATION.md](MIGRATION.md) for details.

## [1.0.0] - 2025-11-04

### Added
- Initial project setup
- SMS-based authentication with JWT tokens (48h sessions)
- Chat3 API integration
- WebSocket server for real-time updates
- REST API endpoints for dialogs and messages
- MongoDB User model
- Comprehensive documentation

### Features
- 🔐 Phone number authentication (79XXXXXXXXX format)
- 📱 SMS mock mode for development
- 💬 Dialog management (create, read, delete)
- 💬 Message operations (send, receive, status, reactions)
- 🔌 Real-time WebSocket events
- 👥 User presence (online/offline)
- ✍️ Typing indicators
- 📊 Pagination support
- 🔒 JWT authentication middleware
- 🛡️ Security headers with Helmet
- 🌐 CORS support

### Technical Stack
- Node.js with ES modules
- Express.js
- Socket.io
- MongoDB + Mongoose
- JWT for authentication
- Axios for HTTP client
- Development hot-reload with --watch

### Documentation
- README with API documentation
- WebSocket events documentation
- Testing tools (HTTP client, shell script, HTML test page)
- .env.example for configuration

