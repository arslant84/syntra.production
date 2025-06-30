// src/lib/db.ts
import postgres, { type Sql } from 'postgres';
import { DATABASE_HOST, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD, validateEnv } from './env';

let sql: Sql<{}>;

console.log("DB_LIB: Initializing PostgreSQL client...");

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
  
  sql = postgres({
    host: DATABASE_HOST,
    database: DATABASE_NAME,
    username: DATABASE_USER,
    password: DATABASE_PASSWORD,
    ssl: isLocalhost ? false : { rejectUnauthorized: false }, // Disable SSL for localhost
    connect_timeout: 10, // 10 seconds
    // connection: {
    //   search_path: 'my_schema', // Example if using a specific schema
    // },
  });
  console.log("DB_LIB_SUCCESS: PostgreSQL client initialized successfully for database:", DATABASE_NAME);
} catch (error: any) {
  console.error("DB_LIB_ERROR: Failed to initialize PostgreSQL client:", error.message, error.stack);
  const errorMessage = `FATAL ERROR: Failed to initialize PostgreSQL client: ${error.message}. Check connection details and server accessibility.`;
  throw new Error(errorMessage);
}

export { sql };
