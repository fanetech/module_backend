-- SQL Server Configuration Fix Script
-- Run this in SSMS (SQL Server Management Studio) as Administrator

-- 1. Enable SQL Server Authentication (Mixed Mode)
USE [master]
GO
EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', 
     N'Software\Microsoft\MSSQLServer\MSSQLServer', 
     N'LoginMode', REG_DWORD, 2
GO
PRINT 'SQL Server Authentication enabled. Please restart SQL Server service.'
GO

-- 2. Enable and reset SA account
ALTER LOGIN [sa] ENABLE
GO

ALTER LOGIN [sa] WITH PASSWORD = N'YourStrong@Passw0rd'
GO

ALTER LOGIN [sa] WITH CHECK_POLICY = OFF
GO

PRINT 'SA account enabled and password set to: YourStrong@Passw0rd'
GO

-- 3. Create the database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'CollaborativeSpreadsheet')
BEGIN
    CREATE DATABASE CollaborativeSpreadsheet
    PRINT 'Database CollaborativeSpreadsheet created successfully'
END
ELSE
BEGIN
    PRINT 'Database CollaborativeSpreadsheet already exists'
END
GO

-- 4. Grant permissions to SA (should already have them, but just in case)
USE [CollaborativeSpreadsheet]
GO

-- 5. Test the connection
SELECT 
    @@SERVERNAME as ServerName,
    @@VERSION as Version,
    DB_NAME() as CurrentDatabase,
    SUSER_NAME() as CurrentUser
GO

PRINT 'Configuration complete! You should now be able to connect with:'
PRINT 'Server: localhost'
PRINT 'Username: sa'
PRINT 'Password: YourStrong@Passw0rd'
PRINT 'Database: CollaborativeSpreadsheet'
