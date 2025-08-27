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

// NextAuth configuration
export const NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
export const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

// Email configuration
export const EMAIL_HOST = process.env.EMAIL_HOST;
export const EMAIL_PORT = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587;
export const EMAIL_USE_TLS = process.env.EMAIL_USE_TLS === 'true';
export const EMAIL_USE_SSL = process.env.EMAIL_USE_SSL === 'true';
export const EMAIL_HOST_USER = process.env.EMAIL_HOST_USER;
export const EMAIL_HOST_PASSWORD = process.env.EMAIL_HOST_PASSWORD;
export const DEFAULT_FROM_EMAIL = process.env.DEFAULT_FROM_EMAIL;
export const SERVER_EMAIL = process.env.SERVER_EMAIL;
export const EMAIL_ADMIN = process.env.EMAIL_ADMIN;

// Performance monitoring configuration
export const ENABLE_PERFORMANCE_MONITORING = process.env.ENABLE_PERFORMANCE_MONITORING === 'true';
export const PERFORMANCE_ALERT_EMAIL = process.env.PERFORMANCE_ALERT_EMAIL;

// Security configuration
export const FORCE_HTTPS = process.env.FORCE_HTTPS === 'true' && IS_PRODUCTION;
export const SECURE_COOKIES = process.env.SECURE_COOKIES === 'true' && IS_PRODUCTION;
export const HSTS_MAX_AGE = process.env.HSTS_MAX_AGE ? parseInt(process.env.HSTS_MAX_AGE) : 31536000;

// Function to validate required environment variables
export function validateEnv() {
  // Only validate on server side
  if (typeof window !== 'undefined') {
    console.warn('Environment validation skipped on client side');
    return true;
  }

  const requiredEnvVars = [
    { name: 'DATABASE_HOST', value: DATABASE_HOST },
    { name: 'DATABASE_NAME', value: DATABASE_NAME },
    { name: 'DATABASE_USER', value: DATABASE_USER },
    { name: 'DATABASE_PASSWORD', value: DATABASE_PASSWORD },
  ];
  
  // Additional production-only validations
  if (IS_PRODUCTION) {
    requiredEnvVars.push(
      { name: 'NEXTAUTH_SECRET', value: NEXTAUTH_SECRET },
      { name: 'NEXTAUTH_URL', value: NEXTAUTH_URL }
    );
  }

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
  console.log('- NEXTAUTH_URL:', NEXTAUTH_URL ? 'Set' : 'NOT SET');
  console.log('- NEXTAUTH_SECRET:', NEXTAUTH_SECRET ? 'Set (value hidden)' : 'NOT SET');
  console.log('- EMAIL_HOST:', EMAIL_HOST ? 'Set' : 'NOT SET');
  console.log('- EMAIL_HOST_USER:', EMAIL_HOST_USER ? 'Set' : 'NOT SET');
  console.log('- EMAIL_HOST_PASSWORD:', EMAIL_HOST_PASSWORD ? 'Set (value hidden)' : 'NOT SET');
  console.log('- NODE_ENV:', NODE_ENV);
  console.log('- PERFORMANCE_MONITORING:', ENABLE_PERFORMANCE_MONITORING ? 'Enabled' : 'Disabled');
}
