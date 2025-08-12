// src/lib/env.ts
// This file provides a centralized way to access environment variables

// Database configuration
export const DATABASE_HOST = process.env.DATABASE_HOST || 'localhost';
export const DATABASE_NAME = process.env.DATABASE_NAME || 'syntra';
export const DATABASE_USER = process.env.DATABASE_USER || 'postgres';
export const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD;

// Application configuration
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_DEVELOPMENT = NODE_ENV === 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';
export const IS_TEST = NODE_ENV === 'test';

// Function to validate required environment variables
export function validateEnv() {
  const requiredEnvVars = [
    { name: 'DATABASE_HOST', value: DATABASE_HOST },
    { name: 'DATABASE_NAME', value: DATABASE_NAME },
    { name: 'DATABASE_USER', value: DATABASE_USER },
    { name: 'DATABASE_PASSWORD', value: DATABASE_PASSWORD },
  ];

  const missingVars = requiredEnvVars
    .filter(({ value }) => !value)
    .map(({ name }) => name);

  if (missingVars.length > 0) {
    const errorMessage = `SECURITY ERROR: Missing required environment variables: ${missingVars.join(', ')}`;
    console.error(errorMessage);
    
    // Fail fast in production
    if (IS_PRODUCTION) {
      throw new Error(errorMessage);
    }
    
    return false;
  }

  return true;
}

// Log environment status on import (but only in development)
if (IS_DEVELOPMENT) {
  console.log('Environment variables loaded:');
  console.log('- DATABASE_HOST:', DATABASE_HOST ? 'Set' : 'NOT SET');
  console.log('- DATABASE_NAME:', DATABASE_NAME ? 'Set' : 'NOT SET');
  console.log('- DATABASE_USER:', DATABASE_USER ? 'Set' : 'NOT SET');
  console.log('- DATABASE_PASSWORD:', DATABASE_PASSWORD ? 'Set (value hidden)' : 'NOT SET');
  console.log('- NODE_ENV:', NODE_ENV);
}
