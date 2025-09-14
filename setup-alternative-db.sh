#!/bin/bash

# Alternative solution for PostgreSQL setup (easier for development)
echo "🚀 Setting up PostgreSQL as alternative to SQL Server"
echo "======================================================"

# Install PostgreSQL client
apt-get update && apt-get install -y postgresql-client

# Create a simple SQLite database for immediate development
npm install sqlite3 better-sqlite3

echo "✅ SQLite installed for development"
echo ""
echo "To use PostgreSQL with Docker:"
echo "docker run --name postgres-db -e POSTGRES_PASSWORD=YourStrong@Passw0rd -e POSTGRES_DB=CollaborativeSpreadsheet -p 5432:5432 -d postgres"
