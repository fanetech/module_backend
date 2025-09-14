# SQL Server Connection Troubleshooting Guide

## Quick Fix Steps

### Step 1: Verify SQL Server is Running
Open **Services** (services.msc) and check:
- SQL Server (MSSQLSERVER) - should be "Running"
- SQL Server Browser - should be "Running"

### Step 2: Enable SQL Server Authentication (Mixed Mode)

#### Option A: Using SSMS (SQL Server Management Studio)
1. Open SSMS and connect using Windows Authentication
2. Right-click on your server instance → Properties
3. Go to Security page
4. Under "Server authentication", select **SQL Server and Windows Authentication mode**
5. Click OK
6. Restart SQL Server service

#### Option B: Using the SQL Script
1. Open SSMS and connect using Windows Authentication
2. Open the file `fix-sql-config.sql` from this project
3. Execute the script (F5)
4. Restart SQL Server service

### Step 3: Enable TCP/IP Protocol
1. Open **SQL Server Configuration Manager**
2. Expand "SQL Server Network Configuration"
3. Click on "Protocols for MSSQLSERVER"
4. Right-click on **TCP/IP** → Enable
5. Double-click TCP/IP → IP Addresses tab
6. Scroll to IPAll section
7. Set TCP Port to **1433**
8. Click OK and restart SQL Server

### Step 4: Configure Firewall
Open Windows Firewall and allow port 1433:
```cmd
netsh advfirewall firewall add rule name="SQL Server" dir=in action=allow protocol=TCP localport=1433
```

### Step 5: Test the Connection
Run the test script:
```bash
node test-sql-connection.js
```

## Common Issues and Solutions

### Issue 1: "Login failed for user 'sa'"
**Causes:**
- Wrong password
- SA account disabled
- SQL Authentication not enabled

**Solution:**
1. Run `fix-sql-config.sql` in SSMS with Windows Authentication
2. This will:
   - Enable SA account
   - Set password to: YourStrong@Passw0rd
   - Enable SQL Authentication

### Issue 2: "Cannot connect to localhost"
**Causes:**
- SQL Server not running
- TCP/IP not enabled
- Wrong port

**Solution:**
1. Check SQL Server service is running
2. Enable TCP/IP in SQL Server Configuration Manager
3. Verify port 1433 is configured

### Issue 3: "Database 'CollaborativeSpreadsheet' does not exist"
**Solution:**
Run in SSMS:
```sql
CREATE DATABASE CollaborativeSpreadsheet
```

## Manual SA Password Reset

If you need to manually reset the SA password:

1. Open SSMS with Windows Authentication
2. Run this query:
```sql
ALTER LOGIN [sa] WITH PASSWORD = N'YourStrong@Passw0rd'
ALTER LOGIN [sa] ENABLE
```

## Verify Your Configuration

After fixing, your configuration should be:
- **Server**: localhost (or 127.0.0.1)
- **Port**: 1433
- **Username**: sa
- **Password**: YourStrong@Passw0rd
- **Database**: CollaborativeSpreadsheet
- **Authentication**: SQL Server Authentication

## Test Connection from Node.js

Create a simple test file:
```javascript
const sql = require('mssql');

const config = {
  server: 'localhost',
  port: 1433,
  user: 'sa',
  password: 'YourStrong@Passw0rd',
  database: 'CollaborativeSpreadsheet',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

sql.connect(config).then(pool => {
  console.log('Connected!');
  return pool.close();
}).catch(err => {
  console.error('Error:', err);
});
```

## Alternative: Use Windows Authentication

If SA login continues to fail, you can use Windows Authentication:

1. Update `.env`:
```env
DB_USE_WINDOWS_AUTH=true
# Comment out DB_USER and DB_PASSWORD
```

2. Update `database.ts` to use Windows Authentication when this flag is set.

## Still Having Issues?

1. Check SQL Server logs:
   - Location: `C:\Program Files\Microsoft SQL Server\MSSQL15.MSSQLSERVER\MSSQL\Log\ERRORLOG`

2. Enable SQL Server Browser service

3. Try connecting with SSMS first to verify credentials

4. Make sure no other application is using port 1433

5. Try using IP address instead of localhost:
   - Change DB_SERVER to: 127.0.0.1

6. Check SQL Server version compatibility with mssql npm package
