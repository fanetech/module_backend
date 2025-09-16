# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Development Server:**
```bash
npm run dev          # Start development server with nodemon + ts-node
npm run build        # Compile TypeScript to dist/
npm start            # Run production server from dist/
```

**Testing:**
```bash
npm test             # Run Jest test suite
npm run lint         # Run ESLint on src/**/*.ts
npm run format       # Format code with Prettier
```

**Database Operations:**
```bash
npm run migrate      # Run latest Knex migrations
npm run migrate:rollback  # Rollback last migration
npm run migrate:make <name>  # Create new migration
npm run seed         # Run database seeds
npm run db           # Run CLI for database operations
npm run db:init      # Initialize database schema
npm run db:reset     # Reset database (drop/recreate)
npm run db:health    # Check database connection
npm run db:stats     # View database statistics
```

## Architecture Overview

This is a **Node.js/TypeScript backend module** for real-time collaborative spreadsheets with direct SQL Server database integration. The system provides:

- **Real-time collaboration** via Socket.IO WebSockets
- **Formula processing** using HyperFormula compatibility
- **Database persistence** with SQL Server/Azure SQL
- **Conflict resolution** using Operational Transformation
- **User presence tracking** and cursor synchronization

### Key Architecture Principles

1. **Database-First Design**: All data persistence handled directly in SQL Server, no external API dependencies
2. **Real-time Sync**: WebSocket-primary communication for live collaboration
3. **Formula Preservation**: Store original formulas and calculated values separately
4. **Cell Addressing**: Excel-style notation (A1, B2, etc.) throughout the system
5. **Transaction Safety**: Use database transactions for batch operations

## Project Structure

```
src/
├── app.ts                    # Express app configuration
├── server.ts                 # Server entry point
├── config/                   # Configuration files
├── controllers/              # REST API endpoints
├── database/                 # Database layer (migrations, models, repositories)
├── middleware/               # Express middleware
├── models/                   # TypeScript data models
├── services/                 # Business logic layer
├── types/                    # TypeScript type definitions
├── utils/                    # Utility functions
└── websocket/                # Socket.IO real-time communication
```

### Core Database Tables

- **spreadsheets**: Spreadsheet metadata and configuration
- **cells**: Individual cell data with formulas and calculated values
- **change_history**: Audit trail of all cell modifications
- **active_sessions**: Real-time user presence and cursor tracking

## Important Implementation Notes

**Database Integration:**
- Uses Knex.js for query building and migrations
- SQL Server with connection pooling for production
- Cell data stored with row/column indexes and Excel-style addresses
- Formula storage separate from calculated values

**WebSocket Architecture:**
- Socket.IO for real-time collaboration
- Room-based user grouping per spreadsheet
- Event-driven cell updates with conflict resolution
- User presence and cursor tracking

**Data Format Compatibility:**
- Returns data in Handsontable-compatible 2D array format
- Preserves original formulas for HyperFormula processing
- Supports Excel-style cell addressing throughout

**Environment Configuration:**
- Database connection via environment variables
- WebSocket CORS configuration for frontend integration
- Separate configurations for development/staging/production

## Testing Strategy

- Jest test framework with ts-jest preset
- Test files in `/tests` directory
- Coverage reports generated in `/coverage`
- Database testing requires test environment setup

## Common Development Tasks

**Adding New Cell Operations:**
1. Update cell model/repository for data access
2. Add service layer business logic
3. Create/update REST API endpoint
4. Add WebSocket event handler
5. Update type definitions

**Database Schema Changes:**
1. Create migration: `npm run migrate:make migration_name`
2. Implement up/down functions in migration file
3. Test locally: `npm run migrate`
4. Update seed data if needed

**WebSocket Event Handling:**
1. Add event handler in appropriate websocket/handlers/ file
2. Update room management in rooms.manager.ts
3. Test real-time synchronization between clients