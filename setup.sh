#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Collaborative Spreadsheet Backend Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js version 18 or higher.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js version: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install npm.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} npm version: $(npm -v)"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓${NC} .env file created"
    echo -e "${YELLOW}Please update the .env file with your configuration${NC}"
else
    echo -e "${GREEN}✓${NC} .env file already exists"
fi

# Install dependencies
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

# Build TypeScript
echo ""
echo -e "${YELLOW}Building TypeScript...${NC}"
npm run build

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Available commands:"
echo "  npm run dev    - Start development server with hot reload"
echo "  npm start      - Start production server"
echo "  npm test       - Run tests"
echo "  npm run build  - Build TypeScript"
echo ""
echo "Testing tools:"
echo "  1. Import postman_collection.json into Postman for API testing"
echo "  2. Open websocket-test-client.html in a browser for WebSocket testing"
echo ""
echo -e "${YELLOW}Don't forget to update the .env file with your API URL and settings!${NC}"
