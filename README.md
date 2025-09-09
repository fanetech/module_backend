# Collaborative Spreadsheet Backend Module

## 🚀 Installation

```bash
npm install
```

## 🔧 Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
WS_PORT=3001

# External API Configuration
EXTERNAL_API_URL=https://api-epm.example.com

# CORS
WS_CORS_ORIGIN=http://localhost:4200

# Environment
NODE_ENV=development

# Logging
LOG_LEVEL=debug
```

## 📦 Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier

## 🏗️ Architecture

This backend module serves as a real-time synchronization server for collaborative spreadsheets. It acts as a proxy to the existing EPM API and handles:

- WebSocket connections for real-time collaboration
- Operational Transformation for conflict resolution
- Memory-based caching for active sessions
- Transparent authentication proxying to existing API

### Key Features

- ✅ Real-time multi-user collaboration
- ✅ Conflict resolution with OT
- ✅ Cursor and selection tracking
- ✅ User presence management
- ❌ No local authentication (delegated to existing API)
- ❌ No database (memory store only)
- ❌ No token validation (transparent proxy)

## 📚 API Documentation

### REST Endpoints

- `GET /api/spreadsheets/:id` - Get spreadsheet data (proxied)
- `PUT /api/spreadsheets/:id/save` - Save changes (proxied)
- `GET /api/spreadsheets/:id/users` - Get connected users (local)

### WebSocket Events

#### Client → Server
- `init` - Initialize connection with token and spreadsheet ID
- `cell-change` - Cell value changed
- `cursor-move` - Cursor position changed
- `selection-change` - Cell selection changed

#### Server → Client
- `user-joined` - New user connected
- `user-left` - User disconnected
- `cell-updated` - Cell value updated by another user
- `cursor-updated` - Cursor position of another user
- `selection-updated` - Selection change of another user

## 🧪 Testing

Run the test suite:

```bash
npm test
```

## 📄 License

ISC
# module_backend
