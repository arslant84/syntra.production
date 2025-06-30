# Database Environment Setup Guide

Based on the PostgreSQL database setup we previously created, you need to configure your environment variables properly for the SynTra application to connect to the database.

## Required Environment Variables

Create or update your `.env` file in the root directory of your project with the following variables:

```
# Database Configuration
DATABASE_HOST=localhost
DATABASE_NAME=syntra
DATABASE_USER=postgres
DATABASE_PASSWORD=221202
```

Replace `your_password_here` with the actual password you set for your PostgreSQL database.

## How to Apply These Changes

1. Open your `.env` file in the project root
2. Add or update the variables as shown above
3. Save the file
4. Restart your Next.js development server

## Verifying the Connection

After setting up your environment variables, you can run the test script to verify the connection:

```
node scripts/test-db-connection.js
```

If everything is configured correctly, you should see a successful connection message and information about your database.
