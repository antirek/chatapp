# Changelog - Frontend

All notable changes to the frontend will be documented in this file.

## [1.4.0] - 2025-11-05

### Added
- **User Info Modal** - View contact information of chat participant
  - "Info" button in chat header
  - Modal window with user details (name, phone, userId)
  - Beautiful gradient avatar with initials
  - Automatic loading of participant data
  - Backend endpoint: GET /api/dialogs/:id/members
  - Documentation: `docs/USER_INFO_MODAL_FEATURE.md`

## [1.3.2] - 2025-11-05

### Fixed
- **CRITICAL: Messages Not Appearing After Send** - Fixed message display issue
  - Backend now returns `data` instead of `message` field (consistency)
  - Added optimistic updates - messages appear instantly (~90% faster)
  - Messages show immediately after send, confirmed by WebSocket
  - Fixed WebSocket listener bug (was using .off instead of .on for dialog:update)
  - Documentation: `docs/MESSAGE_SENDING_FIX.md`

### Changed
- **Optimistic Updates Pattern** - Messages added immediately to UI
  - No waiting for WebSocket confirmation
  - Better UX with instant feedback
  - Deduplication prevents duplicate messages

## [1.3.1] - 2025-11-05

### Changed
- **Optimized Dialog Creation** - Use dialogsStore.createDialog instead of direct API call
  - Eliminates extra API request for fetching dialogs
  - Dialog appears in list instantly via local state update
  - Faster user experience (~50% improvement)

### Fixed
- **Dialog Titles Display** - Fixed empty dialog titles after creation
  - Backend now returns full transformed data structure
  - Consistent data format between create and list operations

## [1.3.0] - 2025-11-05

### Changed
- **Separate Login and Register Forms** - Split into two distinct forms
  - Added tabs: "Вход" (Login) and "Регистрация" (Register)
  - Login form: phone only → code (for existing users)
  - Register form: phone + name → code (for new users)
  - Better UX with clear separation of scenarios
  - Simplified flow for existing users
  - Documentation: `docs/SEPARATE_LOGIN_REGISTER.md`

### Fixed
- Fixed confusion about when name field is required
- Existing users no longer need to see/skip name field

## [1.2.0] - 2025-11-05

### Added
- **Create Dialog Feature** - New dialog creation with user selection
  - "Create Chat" button in dialogs header
  - Modal window with user list
  - Real-time search by name or phone
  - Gradient avatars with user initials
  - Automatic dialog opening after creation
  - Loading and creating indicators
  - Documentation: `docs/CREATE_DIALOG_FEATURE.md`

## [1.1.1] - 2025-11-05

### Changed
- **User Info Card Position** - Moved to top as session header
  - Now positioned above "Чаты" title instead of between title and dialog list
  - Perceived as session identifier rather than chat participant
  - Better visual hierarchy and UX
  - Logout button integrated into user card
  - Compact design (smaller avatar, text sizes, padding)

## [1.1.0] - 2025-11-05

### Added
- **User Info Card** - Display current user information
  - Avatar with user initials (gradient background)
  - Full name display
  - Formatted phone number (+7 XXX XXX-XX-XX)
  - Beautiful gradient background (blue to indigo)
  - Documentation: `docs/USER_INFO_DISPLAY.md`
- Support for independent sessions in multiple browser tabs
- Documentation: `docs/MULTI_TAB_SESSIONS.md`

### Changed
- **BREAKING**: Switched from `localStorage` to `sessionStorage` for auth tokens
  - Each browser tab now has independent session
  - Enables working with multiple users simultaneously in different tabs
  - Sessions are cleared when tab is closed (more secure)
  
### Fixed
- Fixed issue where logging in with second user in another tab would override first user's session
- Fixed session conflicts between multiple tabs
- Fixed lack of visual indication of which user is currently logged in

### Impact
- ⚠️ Users will need to re-authenticate when opening new tabs
- ⚠️ Sessions won't persist after browser restart
- ✅ Can test multiple users simultaneously
- ✅ Better security - tokens auto-cleared on tab close

### Modified Files
- `src/stores/auth.ts` - Changed storage from localStorage to sessionStorage
- `src/services/api.ts` - Updated interceptors to use sessionStorage

## [1.0.0] - 2025-11-04

### Added
- Initial Vue 3 + TypeScript frontend
- Phone number authentication flow
- SMS code verification
- Dialog list with real-time updates
- Chat window with message history
- Message input with typing indicators
- WebSocket integration for real-time events
- Responsive UI with Tailwind CSS
- Pinia stores for state management
- Vue Router for navigation

### Features
- 🔐 SMS-based login
- 💬 Real-time messaging
- 📱 Responsive design
- ✍️ Typing indicators
- 🔌 WebSocket events
- 🎨 Modern UI with Tailwind CSS
- 📊 Pagination support
- 🔄 Auto-reconnect WebSocket

### Technical Stack
- Vue 3 with Composition API
- TypeScript
- Vite (build tool)
- Pinia (state management)
- Vue Router
- Socket.io Client
- Axios
- Tailwind CSS

### Components
- `LoginView` - Authentication page
- `ChatView` - Main chat interface
- `DialogList` - Sidebar with dialogs
- `ChatWindow` - Message display area
- `MessageInput` - Input field with controls

### Stores
- `auth` - Authentication state
- `dialogs` - Dialogs management
- `messages` - Messages management

### Services
- `api` - REST API client
- `websocket` - WebSocket client

