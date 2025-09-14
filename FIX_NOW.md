# IMMEDIATE FIX INSTRUCTIONS

## Step 1: Open SQL Server Management Studio (SSMS)
1. Open SSMS
2. In the connection dialog:
   - Server name: `localhost` or `.\SQLEXPRESS` (if using Express edition)
   - Authentication: **Windows Authentication**
   - Click "Connect"

## Step 2: Run the Setup Script
1. In SSMS, click "New Query" button
2. Open the file `create-app-user.sql` from this project folder
   - Or copy and paste its contents into the query window
3. Click "Execute" (F5) or the green play button
4. Look at the Messages tab for results

## Step 3: Check the Messages
You should see messages like:
- ✅ SQL Server Authentication is already enabled (or it will enable it)
- ✅ Created new login: app_user with password: YourStrong@Passw0rd
- ✅ Database CollaborativeSpreadsheet created

**IMPORTANT**: If you see "Mixed Mode enabled. YOU MUST RESTART SQL SERVER SERVICE!", then:
1. Close SSMS
2. Open Services (Win+R, type `services.msc`, press Enter)
3. Find "SQL Server (MSSQLSERVER)" or "SQL Server (SQLEXPRESS)"
4. Right-click → Restart
5. Wait for it to restart completely

## Step 4: Test the Connection
Run the test script again:
```bash
node test-sql-connection.js
```

You should now see:
```
✅ Connected successfully!
```

## Step 5: Update Your .env File
Replace the database section in your `.env` file with:
```env
DB_SERVER=localhost
DB_PORT=1433
DB_USER=app_user
DB_PASSWORD=YourStrong@Passw0rd
DB_NAME=CollaborativeSpreadsheet
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
```

## Step 6: Run Your Application
```bash
npm run dev
```

---

## If Step 2 Fails in SSMS

If you get an error when running the script, try this manual approach:

### Manual Fix in SSMS:
1. Right-click your server in Object Explorer → Properties
2. Go to Security page
3. Select "SQL Server and Windows Authentication mode"
4. Click OK
5. Restart SQL Server service

### Create User Manually:
1. In Object Explorer, expand Security → Logins
2. Right-click Logins → New Login
3. Login name: `app_user`
4. Select "SQL Server authentication"
5. Password: `YourStrong@Passw0rd`
6. Uncheck "Enforce password policy"
7. Default database: master
8. Go to "Server Roles" page
9. Check "sysadmin"
10. Click OK

### Create Database Manually:
1. Right-click Databases → New Database
2. Database name: `CollaborativeSpreadsheet`
3. Click OK

---

## Alternative: Use Your Existing SA Password

If you know your current SA password, just update the .env file:
```env
DB_USER=sa
DB_PASSWORD=<your-actual-sa-password>
```

To find out what password you might have used:
- Check any other projects where you connect to SQL Server
- Common passwords: `sa`, `password`, `Password123`, `admin`, `123456`
- Password you set during SQL Server installation

---

## Still Not Working?

Run this diagnostic command in Command Prompt (as Administrator):
```cmd
sqlcmd -S localhost -U app_user -P YourStrong@Passw0rd -Q "SELECT 'Connection successful' as Result"
```

If this works but Node.js doesn't, the issue is with the Node.js driver.

If this doesn't work, the issue is with SQL Server configuration.
