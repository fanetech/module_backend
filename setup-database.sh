#!/bin/bash

echo "🚀 Setting up SQL Server for module_backend project"
echo "=================================================="

# Function to check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed."
        echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/"
        exit 1
    fi
    echo "✅ Docker is installed"
}

# Function to check if Docker is running
check_docker_running() {
    if ! docker info &> /dev/null; then
        echo "❌ Docker is not running."
        echo "Please start Docker Desktop and try again."
        exit 1
    fi
    echo "✅ Docker is running"
}

# Function to stop existing SQL Server container if running
stop_existing_container() {
    if docker ps -a | grep -q module_backend_sqlserver; then
        echo "🔄 Stopping existing SQL Server container..."
        docker stop module_backend_sqlserver &> /dev/null
        docker rm module_backend_sqlserver &> /dev/null
    fi
}

# Function to start SQL Server using Docker Compose
start_sqlserver_compose() {
    echo "🔄 Starting SQL Server using Docker Compose..."
    docker-compose up -d sqlserver
    
    echo "⏳ Waiting for SQL Server to be ready..."
    sleep 10
    
    # Wait for SQL Server to be fully ready
    for i in {1..30}; do
        if docker exec module_backend_sqlserver /opt/mssql-tools/bin/sqlcmd \
           -S localhost -U sa -P "YourStrong@Passw0rd" \
           -Q "SELECT 1" &> /dev/null; then
            echo "✅ SQL Server is ready!"
            break
        fi
        echo "⏳ Still waiting for SQL Server... ($i/30)"
        sleep 2
    done
}

# Function to create database
create_database() {
    echo "🔄 Creating CollaborativeSpreadsheet database..."
    
    docker exec module_backend_sqlserver /opt/mssql-tools/bin/sqlcmd \
       -S localhost -U sa -P "YourStrong@Passw0rd" \
       -Q "IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'CollaborativeSpreadsheet') CREATE DATABASE CollaborativeSpreadsheet"
    
    if [ $? -eq 0 ]; then
        echo "✅ Database created successfully!"
    else
        echo "❌ Failed to create database"
        exit 1
    fi
}

# Function to run database migrations
run_migrations() {
    echo "🔄 Running database migrations..."
    cd /Users/pro/Desktop/projects/facielDev/module_backend
    
    # Check if migration script exists
    if [ -f "package.json" ]; then
        npm run migrate 2>/dev/null || echo "⚠️  No migration script found, skipping..."
    fi
}

# Function to test connection from Node.js
test_nodejs_connection() {
    echo "🔄 Testing Node.js database connection..."
    cd /Users/pro/Desktop/projects/facielDev/module_backend
    
    node -e "
    const knex = require('knex')({
        client: 'mssql',
        connection: {
            server: 'localhost',
            port: 1433,
            user: 'sa',
            password: 'YourStrong@Passw0rd',
            database: 'CollaborativeSpreadsheet',
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        }
    });
    
    knex.raw('SELECT 1')
        .then(() => {
            console.log('✅ Node.js can connect to the database!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Node.js connection failed:', err.message);
            process.exit(1);
        });
    " 2>/dev/null || echo "⚠️  Could not test Node.js connection"
}

# Main execution
main() {
    echo ""
    check_docker
    check_docker_running
    echo ""
    
    stop_existing_container
    start_sqlserver_compose
    echo ""
    
    create_database
    echo ""
    
    # run_migrations
    # test_nodejs_connection
    
    echo "=================================================="
    echo "✅ SQL Server setup complete!"
    echo ""
    echo "📝 Connection Details:"
    echo "   Server: localhost"
    echo "   Port: 1433"
    echo "   Database: CollaborativeSpreadsheet"
    echo "   Username: sa"
    echo "   Password: YourStrong@Passw0rd"
    echo ""
    echo "📊 Database Management UI:"
    echo "   URL: http://localhost:8080"
    echo "   System: MS SQL"
    echo "   Server: sqlserver"
    echo "   Username: sa"
    echo "   Password: YourStrong@Passw0rd"
    echo "   Database: CollaborativeSpreadsheet"
    echo ""
    echo "🚀 You can now run: npm run dev"
    echo "=================================================="
}

# Run the main function
main
