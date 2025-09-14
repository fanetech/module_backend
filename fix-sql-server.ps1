# SQL Server Configuration Fix Script
# Run this as Administrator in PowerShell

Write-Host "SQL Server Configuration Helper" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Check if SQL Server service is running
Write-Host "`nChecking SQL Server services..." -ForegroundColor Yellow
Get-Service -Name "MSSQL*" | Format-Table Name, Status, DisplayName

# Function to enable SQL Server Authentication
function Enable-SQLAuthentication {
    Write-Host "`nEnabling SQL Server Authentication..." -ForegroundColor Yellow
    
    $sqlQuery = @"
USE [master]
GO
EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', 
     N'Software\Microsoft\MSSQLServer\MSSQLServer', 
     N'LoginMode', REG_DWORD, 2
GO
"@
    
    try {
        Invoke-Sqlcmd -Query $sqlQuery -ServerInstance "localhost" -ErrorAction Stop
        Write-Host "SQL Authentication enabled. Restart SQL Server service for changes to take effect." -ForegroundColor Green
    } catch {
        Write-Host "Could not enable SQL Authentication automatically. Please do it manually in SSMS." -ForegroundColor Red
    }
}

# Function to reset sa password
function Reset-SAPassword {
    param([string]$NewPassword = "YourStrong@Passw0rd")
    
    Write-Host "`nResetting SA password..." -ForegroundColor Yellow
    
    $sqlQuery = @"
ALTER LOGIN [sa] WITH PASSWORD = N'$NewPassword'
GO
ALTER LOGIN [sa] ENABLE
GO
"@
    
    try {
        Invoke-Sqlcmd -Query $sqlQuery -ServerInstance "localhost" -ErrorAction Stop
        Write-Host "SA password reset successfully to: $NewPassword" -ForegroundColor Green
    } catch {
        Write-Host "Could not reset SA password. Error: $_" -ForegroundColor Red
    }
}

# Function to create database
function Create-Database {
    Write-Host "`nCreating CollaborativeSpreadsheet database..." -ForegroundColor Yellow
    
    $sqlQuery = @"
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'CollaborativeSpreadsheet')
BEGIN
    CREATE DATABASE CollaborativeSpreadsheet
    PRINT 'Database created successfully'
END
ELSE
BEGIN
    PRINT 'Database already exists'
END
"@
    
    try {
        Invoke-Sqlcmd -Query $sqlQuery -ServerInstance "localhost" -Username "sa" -Password "YourStrong@Passw0rd" -ErrorAction Stop
        Write-Host "Database check completed" -ForegroundColor Green
    } catch {
        Write-Host "Could not create database. Error: $_" -ForegroundColor Red
    }
}

# Main menu
Write-Host "`nWhat would you like to do?" -ForegroundColor Cyan
Write-Host "1. Enable SQL Server Authentication"
Write-Host "2. Reset SA password to 'YourStrong@Passw0rd'"
Write-Host "3. Create CollaborativeSpreadsheet database"
Write-Host "4. Do all of the above"
Write-Host "5. Exit"

$choice = Read-Host "Enter your choice (1-5)"

switch ($choice) {
    1 { Enable-SQLAuthentication }
    2 { Reset-SAPassword }
    3 { Create-Database }
    4 {
        Enable-SQLAuthentication
        Start-Sleep -Seconds 2
        Reset-SAPassword
        Start-Sleep -Seconds 2
        Create-Database
    }
    5 { Write-Host "Exiting..." -ForegroundColor Yellow }
    default { Write-Host "Invalid choice" -ForegroundColor Red }
}

Write-Host "`nDone! Don't forget to restart SQL Server service if you changed authentication mode." -ForegroundColor Green
