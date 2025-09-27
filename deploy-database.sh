#!/bin/bash

# ============================================================================
# SynTra Database Deployment Script
# ============================================================================
# This script sets up the PostgreSQL database for SynTra on production server
# Usage: ./deploy-database.sh
# ============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database configuration
DB_NAME="syntra"
DB_USER="syntra_user"
DB_PASSWORD="your_secure_password_here"  # Change this!

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  SynTra Database Deployment Script${NC}"
echo -e "${BLUE}============================================${NC}"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: PostgreSQL is not installed or not in PATH${NC}"
    echo "Please install PostgreSQL first using:"
    echo "sudo apt install postgresql postgresql-contrib"
    exit 1
fi

# Check if PostgreSQL service is running
if ! sudo systemctl is-active --quiet postgresql; then
    echo -e "${YELLOW}PostgreSQL service is not running. Starting it...${NC}"
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
fi

echo -e "${GREEN}✓ PostgreSQL is installed and running${NC}"

# Create database and user
echo -e "${BLUE}Creating database and user...${NC}"

sudo -u postgres psql << EOF
-- Create database
CREATE DATABASE $DB_NAME;

-- Create user
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;

-- Connect to the database and grant schema privileges
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;

\q
EOF

echo -e "${GREEN}✓ Database and user created successfully${NC}"

# Run the schema setup script
echo -e "${BLUE}Setting up database schema...${NC}"

if [ ! -f "database-setup-production.sql" ]; then
    echo -e "${RED}Error: database-setup-production.sql not found${NC}"
    echo "Please ensure the schema file is in the current directory"
    exit 1
fi

# Execute the schema setup
sudo -u postgres psql -d $DB_NAME -f database-setup-production.sql

echo -e "${GREEN}✓ Database schema setup completed${NC}"

# Test database connection
echo -e "${BLUE}Testing database connection...${NC}"

if psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database connection test successful${NC}"
else
    echo -e "${RED}✗ Database connection test failed${NC}"
    echo "Please check your credentials and try again"
    exit 1
fi

# Show database statistics
echo -e "${BLUE}Database setup summary:${NC}"
sudo -u postgres psql -d $DB_NAME -c "
SELECT
    schemaname,
    COUNT(*) as table_count
FROM pg_tables
WHERE schemaname = 'public'
GROUP BY schemaname;
"

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Database deployment completed!${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "${YELLOW}Database details:${NC}"
echo -e "  Database: ${DB_NAME}"
echo -e "  User: ${DB_USER}"
echo -e "  Host: localhost"
echo -e "  Port: 5432"
echo ""
echo -e "${YELLOW}Update your .env file with these settings:${NC}"
echo -e "  DATABASE_HOST=localhost"
echo -e "  DATABASE_NAME=${DB_NAME}"
echo -e "  DATABASE_USER=${DB_USER}"
echo -e "  DATABASE_PASSWORD=${DB_PASSWORD}"
echo ""
echo -e "${GREEN}You can now start your SynTra application!${NC}"