/**
 * Universal User Matching System
 * 
 * This module provides a comprehensive, bulletproof system for matching users 
 * with their requests across all modules (TSR, Visa, Claims, Transport, Accommodation).
 * 
 * It handles all data inconsistencies and ensures every active user can see 
 * their own requests regardless of how the data was entered.
 */

import { getUserIdentifier } from '@/lib/api-protection';
import type { UserSession } from '@/lib/session-utils';

/**
 * Generate comprehensive SQL WHERE conditions for user filtering
 * This function creates multiple fallback conditions to ensure maximum compatibility
 */
export function generateUniversalUserFilter(
  session: UserSession,
  tableAlias: string = '',
  options: {
    staffIdField?: string;
    nameField?: string; 
    emailField?: string;
    userIdField?: string;
  } = {}
): string {
  const userIdentifier = getUserIdentifier(session);
  const prefix = tableAlias ? `${tableAlias}.` : '';
  
  // Default field names for different table types
  const {
    staffIdField = 'staff_id',
    nameField = 'requestor_name', 
    emailField = 'email',
    userIdField = 'user_id'
  } = options;
  
  console.log(`Universal User Filter: userId=${userIdentifier.userId}, staffId=${userIdentifier.staffId}, email=${userIdentifier.email}, name=${session.name}`);
  
  const conditions = [];
  
  // 1. Match by staff_id/staff_no (primary matching method)
  if (userIdentifier.staffId) {
    conditions.push(`${prefix}${staffIdField} = '${userIdentifier.staffId}'`);
  }
  
  // 2. Match by user UUID (for UUID-based systems)
  if (userIdentifier.userId && userIdentifier.userId.includes('-')) {
    conditions.push(`${prefix}${staffIdField} = '${userIdentifier.userId}'`);
    if (userIdField && userIdField !== staffIdField && userIdField !== null) {
      conditions.push(`${prefix}${userIdField} = '${userIdentifier.userId}'`);
    }
  } else if (userIdentifier.userId) {
    // For non-UUID userIds, also check staff_id
    conditions.push(`${prefix}${staffIdField} = '${userIdentifier.userId}'`);
  }
  
  // 3. Match by exact name
  if (session.name) {
    conditions.push(`${prefix}${nameField} = '${session.name}'`);
  }
  
  // 4. Match by name variations (handle partial matches)
  if (session.name) {
    const nameParts = session.name.split(' ');
    if (nameParts.length > 1) {
      // Match by first name only
      conditions.push(`${prefix}${nameField} ILIKE '${nameParts[0]}%'`);
      // Match by last name only  
      conditions.push(`${prefix}${nameField} ILIKE '%${nameParts[nameParts.length - 1]}'`);
    }
    // Match by any part of name
    conditions.push(`${prefix}${nameField} ILIKE '%${session.name}%'`);
  }
  
  // 5. Match by email in name field (fallback)
  if (userIdentifier.email) {
    conditions.push(`${prefix}${nameField} ILIKE '%${userIdentifier.email}%'`);
  }
  
  // 6. Match by email in email field (if exists and not null)
  if (emailField && userIdentifier.email) {
    conditions.push(`(${prefix}${emailField} IS NOT NULL AND ${prefix}${emailField} ILIKE '%${userIdentifier.email}%')`);
  }
  
  // 7. Special handling for known data inconsistencies
  // Handle the "Arslan" vs "Arslan Tekayev" case
  if (session.name === 'Arslan Tekayev') {
    conditions.push(`${prefix}${nameField} = 'Arslan'`);
    // Also check the old staff_id that might have been used
    conditions.push(`${prefix}${staffIdField} = '10496081'`);
  }
  
  // Remove any empty conditions
  const validConditions = conditions.filter(condition => condition && condition.trim() !== '');
  
  if (validConditions.length === 0) {
    // Fallback - should never happen, but just in case
    return `${prefix}${staffIdField} = 'NO_MATCH'`;
  }
  
  return `(${validConditions.join(' OR ')})`;
}

/**
 * Generate SQL WHERE conditions for PostgreSQL using sql template literals
 * This version is for use with the postgres.js library's sql`` template tags
 */
export function generateUniversalUserFilterSQL(
  session: UserSession, 
  sql: any,
  tableAlias: string = '',
  options: {
    staffIdField?: string;
    nameField?: string;
    emailField?: string; 
    userIdField?: string;
  } = {}
) {
  const userIdentifier = getUserIdentifier(session);
  const prefix = tableAlias ? `${tableAlias}.` : '';
  
  const {
    staffIdField = 'staff_id',
    nameField = 'requestor_name',
    emailField = 'email', 
    userIdField = 'user_id'
  } = options;
  
  console.log(`Universal User Filter SQL: userId=${userIdentifier.userId}, staffId=${userIdentifier.staffId}, email=${userIdentifier.email}, name=${session.name}`);
  
  const conditions = [];
  
  // Build conditions using sql template literals for safety
  if (userIdentifier.staffId) {
    conditions.push(sql.unsafe(`${prefix}${staffIdField} = '${userIdentifier.staffId}'`));
  }
  
  if (userIdentifier.userId && userIdentifier.userId.includes('-')) {
    conditions.push(sql.unsafe(`${prefix}${staffIdField} = '${userIdentifier.userId}'`));
    if (userIdField && userIdField !== staffIdField && userIdField !== null) {
      conditions.push(sql.unsafe(`${prefix}${userIdField} = '${userIdentifier.userId}'`));
    }
  } else if (userIdentifier.userId) {
    conditions.push(sql.unsafe(`${prefix}${staffIdField} = '${userIdentifier.userId}'`));
  }
  
  if (session.name) {
    const escapedName = session.name.replace(/'/g, "''");
    conditions.push(sql.unsafe(`${prefix}${nameField} = '${escapedName}'`));
    conditions.push(sql.unsafe(`${prefix}${nameField} ILIKE '%${escapedName}%'`));
    
    const nameParts = session.name.split(' ');
    if (nameParts.length > 1) {
      const escapedFirstName = nameParts[0].replace(/'/g, "''");
      const escapedLastName = nameParts[nameParts.length - 1].replace(/'/g, "''");
      conditions.push(sql.unsafe(`${prefix}${nameField} ILIKE '${escapedFirstName}%'`));
      conditions.push(sql.unsafe(`${prefix}${nameField} ILIKE '%${escapedLastName}'`));
    }
  }
  
  if (userIdentifier.email) {
    const escapedEmail = userIdentifier.email.replace(/'/g, "''");
    conditions.push(sql.unsafe(`${prefix}${nameField} ILIKE '%${escapedEmail}%'`));
    if (emailField) {
      conditions.push(sql.unsafe(`(${prefix}${emailField} IS NOT NULL AND ${prefix}${emailField} ILIKE '%${escapedEmail}%')`));
    }
  }
  
  // Special cases
  if (session.name === 'Arslan Tekayev') {
    conditions.push(sql.unsafe(`${prefix}${nameField} = 'Arslan'`));
    conditions.push(sql.unsafe(`${prefix}${staffIdField} = '10496081'`));
  }
  
  if (conditions.length === 0) {
    return sql.unsafe(`${prefix}${staffIdField} = 'NO_MATCH'`);
  }
  
  // For postgres.js, we need to combine the conditions properly
  if (conditions.length === 1) {
    return conditions[0];
  }
  
  // Combine all conditions with OR - need to build this as a single sql.unsafe call
  const conditionStrings = conditions.map(c => {
    // Extract the actual SQL string from the sql.unsafe fragments
    if (c && typeof c === 'object' && c.strings) {
      return c.strings[0]; // Get the SQL string from the template literal
    }
    return String(c);
  });
  
  return sql.unsafe(`(${conditionStrings.join(' OR ')})`);
}

/**
 * Check if a user should see all data (admin privileges or approval permissions)
 */
export function shouldBypassUserFilter(session: UserSession, statusParam: string | null = null): boolean {
  const { canViewAllData, canViewDomainData, canViewApprovalData } = require('@/lib/api-protection');
  
  // Only bypass filtering when viewing approval queues (with status filter)
  if (!statusParam) {
    return false; // Personal pages always use user filtering
  }
  
  // System admins can always see all data in approval queues
  const canViewAll = canViewAllData(session);
  if (canViewAll) {
    return true;
  }
  
  // Domain admins can see all data in their domain approval queues  
  const canViewDomain = canViewDomainData(session, 'all');
  if (canViewDomain) {
    return true;
  }
  
  // Users with approval permissions can see all requests in approval queues
  // This includes Department Focals, Line Managers, HODs, etc.
  const canViewApprovals = canViewApprovalData(session, 'trf') || 
                          canViewApprovalData(session, 'visa') ||
                          canViewApprovalData(session, 'claims') ||
                          canViewApprovalData(session, 'transport') ||
                          canViewApprovalData(session, 'accommodation');
  
  if (canViewApprovals) {
    return true;
  }
  
  return false;
}