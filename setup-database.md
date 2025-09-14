# Database Setup Guide

## Option 1: Use Docker (Recommended for Mac/Linux)

### Step 1: Install Docker
If you're on Mac, install Docker Desktop from https://www.docker.com/products/docker-desktop/

### Step 2: Run SQL Server in Docker
```bash
# Pull SQL Server image
docker pull mcr.microsoft.com/mssql/server:2022-latest

# Run SQL Server container
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=YourStrong@Passw0rd" \
   -p 1433:1433 --name sql_server_2022 --hostname sql_server_2022 \
   -d mcr.microsoft.com/mssql/server:2022-latest

# Verify it's running
docker ps

# Check logs
docker logs sql_server_2022
```

### Step 3: Create the database
```bash
# Connect to SQL Server and create database
docker exec -it sql_server_2022 /opt/mssql-tools/bin/sqlcmd \
   -S localhost -U sa -P "YourStrong@Passw0rd" \
   -Q "CREATE DATABASE CollaborativeSpreadsheet"
```

## Option 2: Use Azure SQL Database (Cloud Solution)

### Step 1: Create Azure SQL Database
1. Go to https://portal.azure.com
2. Create a new SQL Database
3. Note down the server name, database name, username, and password

### Step 2: Update .env file
```env
DB_SERVER=your-server.database.windows.net
DB_PORT=1433
DB_USER=your-username
DB_PASSWORD=your-password
DB_NAME=CollaborativeSpreadsheet
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=false
```

## Option 3: Use PostgreSQL Instead (Alternative)

Since SQL Server can be problematic on Mac/Linux, you might want to use PostgreSQL instead.

### Step 1: Install PostgreSQL
```bash
# Mac
brew install postgresql
brew services start postgresql

# Or using Docker
docker run --name postgres-db -e POSTGRES_PASSWORD=YourStrong@Passw0rd \
   -e POSTGRES_DB=CollaborativeSpreadsheet -p 5432:5432 -d postgres
```

### Step 2: Update the project to use PostgreSQL
We'll need to update the database configuration to use PostgreSQL instead of SQL Server.

## Option 4: Use SQLite for Development (Simplest)

For development purposes, you can use SQLite which requires no setup.

---

## Current Issue Resolution

The error "Login failed for user 'sa'" typically means:

1. **SQL Server is not running** - Most likely case on Mac
2. **Wrong password** - Check if the password in .env matches
3. **SQL Authentication not enabled** - SA login might be disabled
4. **Network/Port issues** - Port 1433 might be blocked

## Quick Fix Script

Create and run this script to set up SQL Server with Docker:
