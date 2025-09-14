# Collaborative Spreadsheet Backend Module

## 📋 Table of Contents
- [Overview](#-overview)
- [Key Architecture Changes](#-key-architecture-changes)
- [Project Structure](#-project-structure)
- [Technical Stack](#-technical-stack)
- [Database Schema](#-database-schema)
- [Installation & Setup](#-installation--setup)
- [Core Concepts](#-core-concepts)
- [API Documentation](#-api-documentation)
- [WebSocket Events](#-websocket-events)
- [Data Format](#-data-format)
- [Development Guide](#-development-guide)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)

## 🎯 Overview

This is a **standalone Node.js/TypeScript backend module** for real-time collaborative spreadsheets with formula support through HyperFormula. The module now includes its own database layer using SQL Server for data persistence and manages spreadsheet data directly without external API dependencies.

### What This Module Does:
- ✅ **Data persistence** using SQL Server database
- ✅ **Real-time synchronization** between multiple users editing the same spreadsheet
- ✅ **Formula calculation** support (HyperFormula compatible)
- ✅ **WebSocket management** for live collaboration features
- ✅ **Conflict resolution** using Operational Transformation (OT)
- ✅ **User presence tracking** (cursors, selections, active users)
- ✅ **Version history** and change tracking
- ✅ **Cell-level data storage** with formula preservation

### What This Module Does NOT Do:
- ❌ **NO user authentication** - Frontend handles this separately
- ❌ **NO user management** - Only tracks active sessions
- ❌ **NO file imports/exports** - Focuses on real-time data only
- ❌ **NO complex permissions** - Simple read/write access only

## 🏗 Key Architecture Changes

### Migration from API Proxy to Direct Database

**Before (v1.0):**
```
Frontend → Backend (Proxy) → External API → External DB
```

**Now (v2.0):**
```
Frontend → Backend → SQL Server DB
         ↓
    WebSocket → Other Clients
```

### New Features with Database Integration:
1. **Direct data access** - No API latency
2. **Atomic operations** - Database transactions for consistency
3. **Query optimization** - Efficient data retrieval
4. **Audit trail** - Built-in change history
5. **Offline support** - Local caching capabilities

## 📁 Project Structure

```
module_backend/
├── src/
│   ├── app.ts                          # Express app configuration
│   ├── server.ts                       # Server entry point
│   │
│   ├── config/
│   │   ├── database.config.ts         # SQL Server configuration
│   │   ├── socket.config.ts           # Socket.IO configuration
│   │   └── app.config.ts              # Application settings
│   │
│   ├── database/
│   │   ├── connection.ts              # Database connection manager
│   │   ├── migrations/                # Database migrations
│   │   │   ├── 001_create_tables.ts   # Initial schema
│   │   │   └── 002_seed_data.ts       # Test data seeding
│   │   ├── models/                    # Database models
│   │   │   ├── spreadsheet.model.ts   # Spreadsheet entity
│   │   │   ├── cell.model.ts          # Cell data entity
│   │   │   ├── change.model.ts        # Change history entity
│   │   │   └── session.model.ts       # Active session entity
│   │   └── repositories/              # Data access layer
│   │       ├── spreadsheet.repository.ts
│   │       ├── cell.repository.ts
│   │       └── change.repository.ts
│   │
│   ├── controllers/                    # REST endpoint handlers
│   │   ├── spreadsheet.controller.ts  # Spreadsheet CRUD operations
│   │   ├── collaboration.controller.ts # Collaboration management
│   │   └── data.controller.ts         # Cell data operations
│   │
│   ├── services/                       # Business logic layer
│   │   ├── spreadsheet.service.ts     # Spreadsheet operations
│   │   ├── cell.service.ts            # Cell data management
│   │   ├── formula.service.ts         # Formula processing
│   │   ├── collaboration.service.ts   # Multi-user coordination
│   │   ├── conflict-resolution.service.ts # OT implementation
│   │   └── cache.service.ts           # In-memory caching
│   │
│   ├── websocket/                      # Real-time communication
│   │   ├── socket.server.ts           # Main WebSocket server
│   │   ├── rooms.manager.ts           # Room-based user grouping
│   │   └── handlers/                  # Event handlers
│   │       ├── cell.handler.ts        # Cell change events
│   │       ├── cursor.handler.ts      # Cursor tracking
│   │       └── presence.handler.ts    # User presence
│   │
│   ├── middleware/                     # Express middleware
│   │   ├── validation.middleware.ts   # Input validation
│   │   ├── error.middleware.ts        # Error handling
│   │   └── cors.middleware.ts         # CORS configuration
│   │
│   ├── types/                          # TypeScript definitions
│   │   ├── spreadsheet.types.ts       # Spreadsheet data models
│   │   ├── cell.types.ts              # Cell data types
│   │   ├── formula.types.ts           # Formula types
│   │   └── collaboration.types.ts     # Collaboration models
│   │
│   └── utils/                          # Utility functions
│       ├── ot-transform.ts            # OT algorithms
│       ├── formula-parser.ts          # Formula utilities
│       └── logger.ts                   # Logging utility
│
├── tests/                              # Test suites
├── docker-compose.yml                  # Docker configuration
├── Dockerfile                          # Container definition
├── .env.example                        # Environment variables template
└── websocket-test-client.html         # WebSocket testing tool
```

## 🛠 Technical Stack

### Core Technologies
- **Runtime**: Node.js (v18+)
- **Language**: TypeScript (v5.3+)
- **Framework**: Express.js (v4.18+)
- **Database**: SQL Server / Azure SQL
- **ORM**: TypeORM or Prisma
- **WebSocket**: Socket.IO (v4.6+)

### Key Dependencies
- **mssql**: SQL Server client
- **typeorm**: Object-Relational Mapping
- **socket.io**: Real-time communication
- **cors**: Cross-origin resource sharing
- **helmet**: Security headers
- **compression**: Response compression
- **express-rate-limit**: API rate limiting
- **uuid**: Unique identifier generation
- **dotenv**: Environment configuration

## 📊 Database Schema

### Tables Structure

#### 1. **spreadsheets**
```sql
CREATE TABLE spreadsheets (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    row_count INT DEFAULT 100,
    column_count INT DEFAULT 26,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    metadata NVARCHAR(MAX) -- JSON column for additional settings
);
```

#### 2. **cells**
```sql
CREATE TABLE cells (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    spreadsheet_id UNIQUEIDENTIFIER NOT NULL,
    row_index INT NOT NULL,
    column_index INT NOT NULL,
    cell_address NVARCHAR(10) NOT NULL, -- e.g., 'A1', 'B2'
    raw_value NVARCHAR(MAX), -- Original input value
    calculated_value NVARCHAR(MAX), -- Calculated result for formulas
    formula NVARCHAR(MAX), -- Formula if applicable (e.g., '=SUM(A1:A10)')
    data_type NVARCHAR(20), -- 'number', 'string', 'date', 'formula', 'boolean'
    format NVARCHAR(MAX), -- JSON for cell formatting
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    version INT DEFAULT 1,
    FOREIGN KEY (spreadsheet_id) REFERENCES spreadsheets(id) ON DELETE CASCADE,
    UNIQUE(spreadsheet_id, row_index, column_index),
    INDEX idx_cell_address (spreadsheet_id, cell_address)
);
```

#### 3. **change_history**
```sql
CREATE TABLE change_history (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    spreadsheet_id UNIQUEIDENTIFIER NOT NULL,
    cell_id UNIQUEIDENTIFIER NOT NULL,
    user_session_id NVARCHAR(255),
    operation_type NVARCHAR(20), -- 'create', 'update', 'delete'
    old_value NVARCHAR(MAX),
    new_value NVARCHAR(MAX),
    timestamp DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (spreadsheet_id) REFERENCES spreadsheets(id),
    FOREIGN KEY (cell_id) REFERENCES cells(id),
    INDEX idx_history_timestamp (spreadsheet_id, timestamp DESC)
);
```

#### 4. **active_sessions**
```sql
CREATE TABLE active_sessions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    socket_id NVARCHAR(255) UNIQUE NOT NULL,
    spreadsheet_id UNIQUEIDENTIFIER NOT NULL,
    user_name NVARCHAR(255),
    user_color NVARCHAR(7), -- Hex color for cursor
    cursor_position NVARCHAR(10), -- Current cell address
    selection_range NVARCHAR(50), -- e.g., 'A1:C5'
    connected_at DATETIME2 DEFAULT GETUTCDATE(),
    last_activity DATETIME2 DEFAULT GETUTCDATE(),
    is_active BIT DEFAULT 1,
    FOREIGN KEY (spreadsheet_id) REFERENCES spreadsheets(id),
    INDEX idx_active_sessions (spreadsheet_id, is_active)
);
```

### Migration Scripts

#### Initial Migration with Test Data
```typescript
// migrations/002_seed_data.ts
export async function up(queryRunner: QueryRunner) {
    // Create test spreadsheet
    const spreadsheetId = uuid();
    await queryRunner.query(`
        INSERT INTO spreadsheets (id, name, description) 
        VALUES (@0, @1, @2)
    `, [spreadsheetId, 'Sales Report 2024', 'Monthly sales data with calculations']);

    // Insert test data matching Handsontable format
    const testData = [
        ['2024-01-01', 1000, 600, '=B2-C2', '=D2/B2*100', '=D2', '=AVERAGE(B2:B2)', '=IF(D2>300,"Good","Poor")'],
        ['2024-01-02', 1500, 900, '=B3-C3', '=D3/B3*100', '=D3+F2', '=AVERAGE(B2:B3)', '=IF(D3>300,"Good","Poor")'],
        ['2024-01-03', 800, 500, '=B4-C4', '=D4/B4*100', '=D4+F3', '=AVERAGE(B2:B4)', '=IF(D4>300,"Good","Poor")'],
        ['2024-01-04', 2000, 1100, '=B5-C5', '=D5/B5*100', '=D5+F4', '=AVERAGE(B2:B5)', '=IF(D5>300,"Good","Poor")'],
        ['2024-01-05', 1200, 700, '=B6-C6', '=D6/B6*100', '=D6+F5', '=AVERAGE(B2:B6)', '=IF(D6>300,"Good","Poor")'],
        ['TOTAL', '=SUM(B2:B6)', '=SUM(C2:C6)', '=SUM(D2:D6)', '=AVERAGE(E2:E6)', '=MAX(F2:F6)', '=AVERAGE(G2:G6)', '=COUNTIF(H2:H6,"Good")']
    ];

    // Insert cells
    for (let rowIndex = 0; rowIndex < testData.length; rowIndex++) {
        for (let colIndex = 0; colIndex < testData[rowIndex].length; colIndex++) {
            const value = testData[rowIndex][colIndex];
            const cellAddress = getCellAddress(rowIndex + 1, colIndex); // A1, B1, etc.
            const isFormula = typeof value === 'string' && value.startsWith('=');
            
            await queryRunner.query(`
                INSERT INTO cells (
                    spreadsheet_id, row_index, column_index, cell_address,
                    raw_value, formula, data_type
                ) VALUES (@0, @1, @2, @3, @4, @5, @6)
            `, [
                spreadsheetId,
                rowIndex,
                colIndex,
                cellAddress,
                value,
                isFormula ? value : null,
                isFormula ? 'formula' : getDataType(value)
            ]);
        }
    }
}
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+ and npm 8+
- SQL Server 2019+ or Azure SQL Database
- Network connectivity for WebSocket

### Quick Start

1. **Clone and Install**
```bash
git clone [repository-url]
cd module_backend
npm install
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Required Environment Variables**
```env
# Server Configuration
PORT=3000                              # REST API port
WS_PORT=3001                          # WebSocket port

# Database Configuration
DB_HOST=localhost
DB_PORT=1433
DB_NAME=spreadsheet_db
DB_USER=sa
DB_PASSWORD=YourStrong@Password
DB_ENCRYPT=false                      # Set to true for Azure SQL

# CORS Settings
WS_CORS_ORIGIN=http://localhost:4200  # Frontend URL

# Environment
NODE_ENV=development                   # development | production

# Logging
LOG_LEVEL=debug                        # debug | info | warn | error

# Cache Configuration
CACHE_TTL=3600                        # Cache time-to-live in seconds
CACHE_MAX_SIZE=100                    # Maximum cached spreadsheets
```

4. **Run Database Migrations**
```bash
npm run migrate:up
```

5. **Seed Test Data**
```bash
npm run seed
```

6. **Run Development Server**
```bash
npm run dev
```

7. **Build for Production**
```bash
npm run build
npm start
```

## 🔑 Core Concepts

### 1. Data Flow Architecture
```
User Action → Frontend → Backend API
                ↓             ↓
            WebSocket    SQL Server
                ↓             ↓
         Other Clients   Persistence
```

### 2. Cell Data Management

#### Cell Address System
```typescript
// Cell addressing follows Excel notation
interface CellAddress {
  row: number;      // 0-based index
  column: number;   // 0-based index
  address: string;  // A1-style notation
}

// Examples:
// A1 = { row: 0, column: 0, address: 'A1' }
// B2 = { row: 1, column: 1, address: 'B2' }
```

#### Formula Storage
```typescript
interface CellData {
  rawValue: string | number;     // What user entered
  formula?: string;               // Formula if starts with '='
  calculatedValue?: any;          // Result of formula calculation
  dataType: 'string' | 'number' | 'date' | 'formula' | 'boolean';
}
```

### 3. Real-time Synchronization

#### Change Propagation Flow:
```javascript
1. User edits cell in Handsontable
2. Frontend sends change via WebSocket
3. Backend validates and saves to DB
4. Backend broadcasts to other users
5. Other frontends update their Handsontable instance
```

### 4. Conflict Resolution

The system uses Operational Transformation to handle concurrent edits:

```typescript
// Example: Two users edit same cell simultaneously
User A: Cell A1 = "Hello" (timestamp: 1000)
User B: Cell A1 = "World" (timestamp: 1001)

// Resolution strategy:
1. Last-write-wins for same cell
2. Preserve both in history
3. Allow undo/redo functionality
```

## 📚 API Documentation

### Spreadsheet Operations

#### GET `/api/spreadsheets`
List all available spreadsheets.
```http
GET /api/spreadsheets

Response: {
  spreadsheets: [
    {
      id: "uuid",
      name: "Sales Report 2024",
      description: "Monthly sales data",
      rowCount: 100,
      columnCount: 26,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### GET `/api/spreadsheets/:id`
Get spreadsheet with all cell data.
```http
GET /api/spreadsheets/abc-123

Response: {
  spreadsheet: {
    id: "abc-123",
    name: "Sales Report 2024",
    metadata: {...}
  },
  data: [
    ['2024-01-01', 1000, 600, '=B2-C2', '=D2/B2*100'],
    ['2024-01-02', 1500, 900, '=B3-C3', '=D3/B3*100'],
    // ... more rows
  ],
  formulas: {
    'D2': '=B2-C2',
    'E2': '=D2/B2*100',
    // ... more formulas
  }
}
```

#### POST `/api/spreadsheets`
Create a new spreadsheet.
```http
POST /api/spreadsheets
Content-Type: application/json

Body: {
  name: "New Spreadsheet",
  description: "Description",
  rowCount: 100,
  columnCount: 26
}

Response: {
  id: "new-uuid",
  name: "New Spreadsheet",
  ...
}
```

#### PUT `/api/spreadsheets/:id`
Update spreadsheet metadata.
```http
PUT /api/spreadsheets/abc-123
Content-Type: application/json

Body: {
  name: "Updated Name",
  description: "Updated Description"
}
```

### Cell Operations

#### GET `/api/spreadsheets/:id/cells`
Get all cells for a spreadsheet.
```http
GET /api/spreadsheets/abc-123/cells

Response: {
  cells: [
    {
      address: "A1",
      rowIndex: 0,
      columnIndex: 0,
      rawValue: "2024-01-01",
      dataType: "date"
    },
    {
      address: "D2",
      rowIndex: 1,
      columnIndex: 3,
      formula: "=B2-C2",
      calculatedValue: 400,
      dataType: "formula"
    }
  ]
}
```

#### PUT `/api/spreadsheets/:id/cells/:address`
Update a single cell.
```http
PUT /api/spreadsheets/abc-123/cells/A1
Content-Type: application/json

Body: {
  value: "2024-01-15",
  dataType: "date"
}
```

#### POST `/api/spreadsheets/:id/cells/batch`
Batch update multiple cells.
```http
POST /api/spreadsheets/abc-123/cells/batch
Content-Type: application/json

Body: {
  changes: [
    { address: "A1", value: "2024-01-15" },
    { address: "B1", value: 2000 },
    { address: "C1", value: "=A1+B1" }
  ]
}
```

### Collaboration Operations

#### GET `/api/spreadsheets/:id/sessions`
Get active sessions for a spreadsheet.
```http
GET /api/spreadsheets/abc-123/sessions

Response: {
  sessions: [
    {
      socketId: "socket-123",
      userName: "User 1",
      userColor: "#FF5733",
      cursorPosition: "B3",
      connectedAt: "2024-01-01T10:00:00Z"
    }
  ]
}
```

#### GET `/api/spreadsheets/:id/history`
Get change history.
```http
GET /api/spreadsheets/abc-123/history?limit=50

Response: {
  changes: [
    {
      id: "change-1",
      cellId: "cell-uuid",
      cellAddress: "A1",
      oldValue: "100",
      newValue: "200",
      userSessionId: "session-123",
      timestamp: "2024-01-01T10:00:00Z"
    }
  ]
}
```

## 🔌 WebSocket Events

### Client → Server Events

#### Connection
```javascript
// Join spreadsheet room
socket.emit('join-spreadsheet', {
  spreadsheetId: 'abc-123',
  userName: 'User Name' // Optional
});
```

#### Cell Operations
```javascript
// Single cell update
socket.emit('cell-update', {
  spreadsheetId: 'abc-123',
  address: 'A1',
  value: 'New Value',
  dataType: 'string'
});

// Batch update
socket.emit('cells-batch-update', {
  spreadsheetId: 'abc-123',
  changes: [
    { address: 'A1', value: '2024-01-01' },
    { address: 'B1', value: 1000 }
  ]
});

// Formula update
socket.emit('formula-update', {
  spreadsheetId: 'abc-123',
  address: 'D2',
  formula: '=SUM(B2:C2)'
});
```

#### Cursor & Selection
```javascript
// Cursor position
socket.emit('cursor-move', {
  spreadsheetId: 'abc-123',
  address: 'B3'
});

// Selection range
socket.emit('selection-change', {
  spreadsheetId: 'abc-123',
  start: 'A1',
  end: 'C5'
});
```

### Server → Client Events

#### Data Updates
```javascript
// Cell updated by another user
socket.on('cell-updated', (data) => {
  // data: {
  //   address: 'A1',
  //   value: 'New Value',
  //   userId: 'socket-123',
  //   timestamp: 1234567890
  // }
});

// Batch updates
socket.on('cells-batch-updated', (data) => {
  // data: {
  //   changes: [...],
  //   userId: 'socket-123'
  // }
});
```

#### User Presence
```javascript
// User joined
socket.on('user-joined', (data) => {
  // data: {
  //   socketId: 'socket-123',
  //   userName: 'User Name',
  //   userColor: '#FF5733'
  // }
});

// User left
socket.on('user-left', (data) => {
  // data: { socketId: 'socket-123' }
});

// Cursor update
socket.on('cursor-updated', (data) => {
  // data: {
  //   userId: 'socket-123',
  //   address: 'B3',
  //   userColor: '#FF5733'
  // }
});
```

## 📐 Data Format

### Handsontable/HyperFormula Compatible Format

The backend returns data in a format directly consumable by Handsontable:

```javascript
// Backend response format
const spreadsheetData = {
  data: [
    // Row 0 (displayed as row 1 in UI)
    ['2024-01-01', 1000, 600, '=B1-C1', '=D1/B1*100'],
    // Row 1 (displayed as row 2 in UI)
    ['2024-01-02', 1500, 900, '=B2-C2', '=D2/B2*100'],
    // ... more rows
  ],
  // Optional: Column headers
  columns: [
    { data: 0, title: 'Date' },
    { data: 1, title: 'Revenue' },
    { data: 2, title: 'Costs' },
    { data: 3, title: 'Profit' },
    { data: 4, title: 'Margin %' }
  ],
  // Optional: Cell metadata
  cell: [
    { row: 0, col: 0, className: 'htCenter' },
    { row: 0, col: 1, type: 'numeric', format: '0,0.00' }
  ]
};
```

### Frontend Integration Example

```typescript
// Frontend (Angular + Handsontable)
import Handsontable from 'handsontable';
import { HyperFormula } from 'hyperformula';

// Initialize HyperFormula
const hyperformulaInstance = HyperFormula.buildEmpty({
  licenseKey: 'internal-use-only'
});

// Fetch data from backend
const response = await fetch('/api/spreadsheets/abc-123');
const { data, columns } = await response.json();

// Create Handsontable instance
const hot = new Handsontable(container, {
  data: data,
  columns: columns,
  formulas: {
    engine: hyperformulaInstance
  },
  afterChange: (changes, source) => {
    if (source === 'loadData') return;
    
    // Send changes to backend via WebSocket
    socket.emit('cells-batch-update', {
      spreadsheetId: 'abc-123',
      changes: changes.map(([row, col, oldVal, newVal]) => ({
        address: getCellAddress(row, col),
        value: newVal
      }))
    });
  }
});

// Listen for real-time updates
socket.on('cell-updated', ({ address, value }) => {
  const [row, col] = parseAddress(address);
  hot.setDataAtCell(row, col, value, 'remote');
});
```

## 💻 Development Guide

### Database Connection Setup

```typescript
// config/database.config.ts
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'mssql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false, // Use migrations in production
  logging: process.env.NODE_ENV === 'development',
  entities: ['src/database/models/*.ts'],
  migrations: ['src/database/migrations/*.ts'],
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true
  }
});
```

### Repository Pattern Example

```typescript
// repositories/cell.repository.ts
export class CellRepository {
  async getCellsBySpreadsheet(spreadsheetId: string): Promise<Cell[]> {
    return await this.dataSource
      .createQueryBuilder('cell')
      .where('cell.spreadsheet_id = :spreadsheetId', { spreadsheetId })
      .orderBy('cell.row_index', 'ASC')
      .addOrderBy('cell.column_index', 'ASC')
      .getMany();
  }

  async updateCell(
    spreadsheetId: string,
    address: string,
    value: any
  ): Promise<Cell> {
    const [row, col] = this.parseAddress(address);
    
    let cell = await this.findOne({
      where: { spreadsheetId, rowIndex: row, columnIndex: col }
    });

    if (!cell) {
      cell = this.create({
        spreadsheetId,
        rowIndex: row,
        columnIndex: col,
        cellAddress: address
      });
    }

    cell.rawValue = value;
    cell.formula = value?.toString().startsWith('=') ? value : null;
    cell.dataType = this.detectDataType(value);
    cell.version++;

    return await this.save(cell);
  }

  async batchUpdate(
    spreadsheetId: string,
    changes: CellChange[]
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      for (const change of changes) {
        await this.updateCell(spreadsheetId, change.address, change.value);
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
```

### Service Layer Example

```typescript
// services/spreadsheet.service.ts
export class SpreadsheetService {
  constructor(
    private spreadsheetRepo: SpreadsheetRepository,
    private cellRepo: CellRepository,
    private cacheService: CacheService
  ) {}

  async getSpreadsheetData(id: string): Promise<any[][]> {
    // Check cache first
    const cached = await this.cacheService.get(`spreadsheet:${id}`);
    if (cached) return cached;

    // Fetch from database
    const cells = await this.cellRepo.getCellsBySpreadsheet(id);
    
    // Convert to 2D array for Handsontable
    const maxRow = Math.max(...cells.map(c => c.rowIndex), 0);
    const maxCol = Math.max(...cells.map(c => c.columnIndex), 0);
    
    const data = Array(maxRow + 1).fill(null)
      .map(() => Array(maxCol + 1).fill(''));
    
    cells.forEach(cell => {
      data[cell.rowIndex][cell.columnIndex] = 
        cell.formula || cell.calculatedValue || cell.rawValue;
    });

    // Cache the result
    await this.cacheService.set(`spreadsheet:${id}`, data, 300); // 5 min TTL
    
    return data;
  }

  async updateCells(
    spreadsheetId: string,
    changes: CellChange[]
  ): Promise<void> {
    // Update database
    await this.cellRepo.batchUpdate(spreadsheetId, changes);
    
    // Invalidate cache
    await this.cacheService.delete(`spreadsheet:${spreadsheetId}`);
    
    // Track changes for history
    await this.trackChanges(spreadsheetId, changes);
  }
}
```

## 🧪 Testing

### Test Database Setup
```bash
# Create test database
npm run db:test:create

# Run migrations on test DB
npm run db:test:migrate
```

### Run Tests
```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

### Example Test

```typescript
// tests/services/spreadsheet.service.test.ts
describe('SpreadsheetService', () => {
  let service: SpreadsheetService;
  let testSpreadsheetId: string;

  beforeEach(async () => {
    // Setup test database connection
    await setupTestDatabase();
    service = new SpreadsheetService(...);
    
    // Create test spreadsheet
    testSpreadsheetId = await createTestSpreadsheet();
  });

  it('should return data in Handsontable format', async () => {
    // Insert test data
    await insertTestCells(testSpreadsheetId, [
      { address: 'A1', value: '2024-01-01' },
      { address: 'B1', value: 1000 },
      { address: 'C1', value: '=B1*2' }
    ]);

    // Get spreadsheet data
    const data = await service.getSpreadsheetData(testSpreadsheetId);

    // Verify format
    expect(data).toBeInstanceOf(Array);
    expect(data[0]).toBeInstanceOf(Array);
    expect(data[0][0]).toBe('2024-01-01');
    expect(data[0][1]).toBe(1000);
    expect(data[0][2]).toBe('=B1*2');
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });
});
```

## 🚢 Deployment

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000 3001

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DB_HOST=database
      - DB_PORT=1433
      - DB_NAME=spreadsheet_db
      - DB_USER=sa
      - DB_PASSWORD=${DB_PASSWORD}
    depends_on:
      - database

  database:
    image: mcr.microsoft.com/mssql/server:2019-latest
    environment:
      - ACCEPT_EULA=Y
      - SA_PASSWORD=${DB_PASSWORD}
      - MSSQL_PID=Express
    ports:
      - "1433:1433"
    volumes:
      - mssql_data:/var/opt/mssql

volumes:
  mssql_data:
```

### Production Considerations

1. **Database**
   - Use connection pooling
   - Implement read replicas for scaling
   - Regular backups
   - Index optimization for cell queries

2. **Caching**
   - Consider Redis for distributed caching
   - Cache frequently accessed spreadsheets
   - Implement cache invalidation strategy

3. **Performance**
   - Paginate large spreadsheets
   - Lazy load cell data
   - Compress WebSocket messages
   - Batch database operations

4. **Monitoring**
   - Track database query performance
   - Monitor WebSocket connections
   - Log slow operations
   - Set up alerts for errors

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```
Error: Failed to connect to localhost:1433
```
**Solution**: 
- Verify SQL Server is running
- Check firewall rules
- Confirm credentials in .env

#### 2. WebSocket Connection Timeout
```
Error: WebSocket connection timeout
```
**Solution**: 
- Check CORS settings
- Verify WS_PORT is open
- Check client-side Socket.IO version compatibility

#### 3. Formula Calculation Errors
```
Error: Formula evaluation failed
```
**Solution**: 
- Verify formula syntax
- Check cell references exist
- Ensure HyperFormula compatibility

#### 4. Performance Issues with Large Spreadsheets
```
Warning: Slow query detected
```
**Solution**: 
- Add database indexes
- Implement pagination
- Use caching layer
- Optimize queries

### Debug Commands

```bash
# Check database connection
npm run db:ping

# View active sessions
npm run debug:sessions

# Clear cache
npm run cache:clear

# Database query profiling
npm run db:profile
```

## 📝 Important Notes for AI Assistants

When working on this codebase, remember:

1. **Database-First Architecture** - All data persists in SQL Server
2. **No Authentication Logic** - Frontend handles all auth
3. **Formula Preservation** - Always store original formulas, not just calculated values
4. **Real-time Sync** - WebSocket is primary for live updates
5. **Handsontable Format** - Data structure must match Handsontable expectations
6. **Cell Addressing** - Use Excel-style notation (A1, B2, etc.)
7. **Transaction Safety** - Use database transactions for batch operations
8. **Change History** - Track all changes for audit trail
9. **Memory Efficiency** - Don't load entire spreadsheets for large datasets
10. **Testing** - Always test with formula-heavy spreadsheets

## 📄 License

ISC

## 🤝 Contributing

This is an internal module. For questions or issues, contact the development team.

---

**Last Updated**: September 2025
**Version**: 2.0.0
**Status**: Production Ready with Database Integration