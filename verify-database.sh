#!/bin/bash

# ============================================================================
# SynTra Database Verification Script
# ============================================================================
# This script verifies that the database is properly set up and ready for the app
# Usage: ./verify-database.sh
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Database configuration (should match your .env file)
DB_NAME="syntra"
DB_USER="syntra_user"
DB_PASSWORD="your_secure_password_here"  # Update this

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  SynTra Database Verification${NC}"
echo -e "${BLUE}============================================${NC}"

# Test basic connection
echo -e "${BLUE}Testing database connection...${NC}"
if PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}✗ Database connection failed${NC}"
    exit 1
fi

# Check essential tables exist
echo -e "${BLUE}Checking essential tables...${NC}"

REQUIRED_TABLES=(
    "users"
    "roles"
    "permissions"
    "travel_requests"
    "trf_approval_steps"
    "accommodation_staff_houses"
    "accommodation_rooms"
    "accommodation_bookings"
    "expense_claims"
    "transport_requests"
    "visa_applications"
    "notification_templates"
)

for table in "${REQUIRED_TABLES[@]}"; do
    if PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 1 FROM $table LIMIT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Table '$table' exists and accessible${NC}"
    else
        echo -e "${RED}✗ Table '$table' missing or inaccessible${NC}"
        exit 1
    fi
done

# Check functions exist
echo -e "${BLUE}Checking database functions...${NC}"
FUNCTION_CHECK=$(PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM pg_proc WHERE proname IN ('trigger_set_timestamp', 'hash_user_password');
")

if [ "$FUNCTION_CHECK" -eq 2 ]; then
    echo -e "${GREEN}✓ Required functions exist${NC}"
else
    echo -e "${RED}✗ Some required functions are missing${NC}"
fi

# Check extensions
echo -e "${BLUE}Checking required extensions...${NC}"
EXTENSION_CHECK=$(PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM pg_extension WHERE extname IN ('pgcrypto', 'uuid-ossp');
")

if [ "$EXTENSION_CHECK" -eq 2 ]; then
    echo -e "${GREEN}✓ Required extensions installed${NC}"
else
    echo -e "${YELLOW}⚠ Some extensions may be missing (this might be OK)${NC}"
fi

# Show database statistics
echo -e "${BLUE}Database statistics:${NC}"
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "
SELECT
    'Tables' as type,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
UNION ALL
SELECT
    'Indexes' as type,
    COUNT(*) as count
FROM pg_indexes
WHERE schemaname = 'public'
UNION ALL
SELECT
    'Functions' as type,
    COUNT(*) as count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';
"

# Test application-specific queries
echo -e "${BLUE}Testing application queries...${NC}"

# Test user authentication query
if PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "
SELECT u.id, u.name, u.email, u.role, r.name as role_name
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
LIMIT 1;
" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ User authentication query works${NC}"
else
    echo -e "${RED}✗ User authentication query failed${NC}"
fi

# Test travel request query
if PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "
SELECT tr.id, tr.status, tr.travel_type, tr.requestor_name
FROM travel_requests tr
LEFT JOIN trf_approval_steps tas ON tr.id = tas.trf_id
LIMIT 1;
" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Travel request query works${NC}"
else
    echo -e "${RED}✗ Travel request query failed${NC}"
fi

# Test accommodation query
if PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "
SELECT ash.name, ar.name, ar.capacity
FROM accommodation_staff_houses ash
LEFT JOIN accommodation_rooms ar ON ash.id = ar.staff_house_id
LIMIT 1;
" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Accommodation query works${NC}"
else
    echo -e "${RED}✗ Accommodation query failed${NC}"
fi

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Database verification completed!${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "${YELLOW}Your database is ready for the SynTra application.${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Update your .env file with the database credentials"
echo -e "2. Start your Node.js application"
echo -e "3. Create your first admin user through the application"
echo ""
echo -e "${GREEN}Database is ready! 🚀${NC}"