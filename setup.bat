@echo off
echo ========================================
echo Collaborative Spreadsheet Backend Setup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install Node.js version 18 or higher.
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js version: %NODE_VERSION%

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo npm is not installed. Please install npm.
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo [OK] npm version: %NPM_VERSION%

REM Create .env file if it doesn't exist
if not exist .env (
    echo Creating .env file from .env.example...
    copy .env.example .env >nul
    echo [OK] .env file created
    echo Please update the .env file with your configuration
) else (
    echo [OK] .env file already exists
)

REM Install dependencies
echo.
echo Installing dependencies...
call npm install

REM Build TypeScript
echo.
echo Building TypeScript...
call npm run build

echo.
echo ========================================
echo Setup completed successfully!
echo ========================================
echo.
echo Available commands:
echo   npm run dev    - Start development server with hot reload
echo   npm start      - Start production server
echo   npm test       - Run tests
echo   npm run build  - Build TypeScript
echo.
echo Testing tools:
echo   1. Import postman_collection.json into Postman for API testing
echo   2. Open websocket-test-client.html in a browser for WebSocket testing
echo.
echo Don't forget to update the .env file with your API URL and settings!
pause
