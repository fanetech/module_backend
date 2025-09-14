-- =====================================================
-- SQL Server Authentication Fix & User Creation Script
-- Run this in SSMS using Windows Authentication
-- =====================================================

USE [master]
GO

-- 1. Check current authentication mode
DECLARE @AuthMode INT
EXEC xp_instance_regread 
    N'HKEY_LOCAL_MACHINE', 
    N'Software\Microsoft\MSSQLServer\MSSQLServer',
    N'LoginMode', 
    @AuthMode OUTPUT

IF @AuthMode = 1
BEGIN
    PRINT '⚠️ WARNING: SQL Server is in Windows Authentication mode only!'
    PRINT 'Enabling Mixed Mode Authentication...'
    
    -- Enable Mixed Mode
    EXEC xp_instance_regwrite 
        N'HKEY_LOCAL_MACHINE', 
        N'Software\Microsoft\MSSQLServer\MSSQLServer',
        N'LoginMode', 
        REG_DWORD, 
        2
    
    PRINT '✅ Mixed Mode enabled. YOU MUST RESTART SQL SERVER SERVICE!'
END
ELSE
BEGIN
    PRINT '✅ SQL Server Authentication is already enabled'
END
GO

-- 2. Check SA account status
SELECT 
    name,
    is_disabled,
    LOGINPROPERTY(name, 'IsLocked') as is_locked,
    LOGINPROPERTY(name, 'IsExpired') as is_expired,
    create_date,
    modify_date
FROM sys.sql_logins 
WHERE name = 'sa'

-- 3. Enable SA account if disabled
IF EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = 'sa' AND is_disabled = 1)
BEGIN
    ALTER LOGIN [sa] ENABLE
    PRINT '✅ SA account has been enabled'
END
GO

-- 4. Create a new SQL login that we know will work
IF NOT EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = 'app_user')
BEGIN
    CREATE LOGIN [app_user] WITH PASSWORD = N'YourStrong@Passw0rd',
        DEFAULT_DATABASE = [master],
        CHECK_EXPIRATION = OFF,
        CHECK_POLICY = OFF
    
    -- Grant sysadmin role to the new user
    ALTER SERVER ROLE [sysadmin] ADD MEMBER [app_user]
    
    PRINT '✅ Created new login: app_user with password: YourStrong@Passw0rd'
END
ELSE
BEGIN
    -- Reset password for existing app_user
    ALTER LOGIN [app_user] WITH PASSWORD = N'YourStrong@Passw0rd'
    ALTER LOGIN [app_user] ENABLE
    PRINT '✅ Reset password for app_user to: YourStrong@Passw0rd'
END
GO

-- 5. Try to reset SA password (this might fail if you don't have permissions)
BEGIN TRY
    ALTER LOGIN [sa] WITH PASSWORD = N'YourStrong@Passw0rd'
    ALTER LOGIN [sa] WITH CHECK_POLICY = OFF
    ALTER LOGIN [sa] WITH CHECK_EXPIRATION = OFF
    PRINT '✅ SA password has been reset to: YourStrong@Passw0rd'
END TRY
BEGIN CATCH
    PRINT '⚠️ Could not reset SA password. Use app_user instead.'
END CATCH
GO

-- 6. Create the database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'CollaborativeSpreadsheet')
BEGIN
    CREATE DATABASE CollaborativeSpreadsheet
    PRINT '✅ Database CollaborativeSpreadsheet created'
END
ELSE
BEGIN
    PRINT '✅ Database CollaborativeSpreadsheet already exists'
END
GO

-- 7. Grant permissions to both users on the database
USE [CollaborativeSpreadsheet]
GO

-- Create user for app_user login if not exists
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'app_user')
BEGIN
    CREATE USER [app_user] FOR LOGIN [app_user]
    ALTER ROLE [db_owner] ADD MEMBER [app_user]
END
GO

-- 8. Test the logins
PRINT ''
PRINT '====================================='
PRINT '✅ Setup Complete!'
PRINT '====================================='
PRINT ''
PRINT 'You can now use either of these logins:'
PRINT ''
PRINT 'Option 1 (New User):'
PRINT '  Username: app_user'
PRINT '  Password: YourStrong@Passw0rd'
PRINT ''
PRINT 'Option 2 (SA - if password reset worked):'
PRINT '  Username: sa'
PRINT '  Password: YourStrong@Passw0rd'
PRINT ''
PRINT '⚠️ IMPORTANT: If you see the mixed mode message above,'
PRINT '   you MUST restart SQL Server service before continuing!'
PRINT ''
PRINT '====================================='
GO

-- 9. Show current logins for verification
SELECT 
    'Current SQL Logins:' as Info,
    name as LoginName,
    CASE is_disabled 
        WHEN 0 THEN '✅ Enabled' 
        ELSE '❌ Disabled' 
    END as Status,
    create_date as Created,
    modify_date as Modified
FROM sys.sql_logins
WHERE name IN ('sa', 'app_user')
ORDER BY name
