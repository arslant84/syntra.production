// src/lib/db.ts
const postgres = require('postgres');
import { DATABASE_HOST, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD, validateEnv } from './env';

let dbConnection: any = null;

console.log("DB_LIB: Initializing PostgreSQL client...");

// Initialize database connection
function createDatabaseConnection() {
  if (dbConnection) {
    return dbConnection; // Already initialized
  }

  // Validate environment variables
  if (!validateEnv()) {
    const errorMessage = "FATAL ERROR: PostgreSQL environment variables are not fully set. Please check your .env file.";
    console.error("DB_LIB_ERROR:", errorMessage);
    throw new Error(errorMessage);
  }

  try {
    // Determine if we should use SSL based on the host
    // For localhost or 127.0.0.1, we'll disable SSL
    const isLocalhost = DATABASE_HOST === 'localhost' || DATABASE_HOST === '127.0.0.1';

    dbConnection = postgres({
      host: DATABASE_HOST,
      database: DATABASE_NAME,
      username: DATABASE_USER,
      password: DATABASE_PASSWORD,
      ssl: isLocalhost ? false : { rejectUnauthorized: false }, // Disable SSL for localhost

      // OPTIMIZED CONNECTION POOL FOR 1000+ USERS
      connect_timeout: 10, // 10 seconds connection timeout
      max: 50, // Increased max connections for high load (from 10 to 50)
      idle_timeout: 300, // Keep connections alive longer (5 minutes)
      max_lifetime: 60 * 60, // Connection lifetime: 1 hour (from 30 minutes)

      // PERFORMANCE OPTIMIZATIONS
      prepare: true, // Enable prepared statements for better performance
      types: {
        bigint: postgres.BigInt
      },

      // ADDITIONAL PERFORMANCE SETTINGS
      connection: {
        application_name: 'syntra_vms', // Help identify connections in pg_stat_activity
        statement_timeout: '30000', // 30 second query timeout
        lock_timeout: '10000', // 10 second lock timeout
        idle_in_transaction_session_timeout: '30000', // 30 second idle transaction timeout
      },

      // LOGGING FOR PERFORMANCE MONITORING (disable in production if needed)
      debug: process.env.NODE_ENV === 'development' ? ['query'] : false,

      // CONNECTION RETRY SETTINGS
      retry_delay: 1000, // 1 second delay between retries
      max_retries: 3, // Maximum retry attempts
    });
    console.log("DB_LIB_SUCCESS: PostgreSQL client initialized successfully for database:", DATABASE_NAME);
    return dbConnection;
  } catch (error: any) {
    console.error("DB_LIB_ERROR: Failed to initialize PostgreSQL client:", error.message, error.stack);
    const errorMessage = `FATAL ERROR: Failed to initialize PostgreSQL client: ${error.message}. Check connection details and server accessibility.`;
    throw new Error(errorMessage);
  }
}

// Export a function that ensures the database is initialized
export function getSql(): any {
  if (!dbConnection) {
    dbConnection = createDatabaseConnection();
  }
  return dbConnection;
}

// Export the database client
export const sql = getSql();