/**
 * Request ID Generator Utility
 * 
 * Implements unified request ID naming convention:
 * [TYPE]-[YYYYMMDD-HHMM]-[CONTEXT]-[UNIQUE_ID]
 * 
 * Examples:
 * - TSR: TSR-20250702-1423-NYC-PCYX
 * - VIS: VIS-20250702-1423-USA-5X9R
 * - ACCOM: ACCOM-20250702-1423-DEL-2Y8P
 * - CLM: CLM-20250702-1423-MED-7Z4Q
 */

// Valid request types
export type RequestType = 'TSR' | 'VIS' | 'ACCOM' | 'CLM';

// Characters to use for unique ID generation (avoiding ambiguous characters like 0/O, 1/I)
const UNIQUE_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generates a random string of specified length using non-ambiguous characters
 * @param length Length of the unique ID to generate
 * @returns Random string of specified length
 */
export function generateUniqueId(length: number = 4): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += UNIQUE_ID_CHARS.charAt(Math.floor(Math.random() * UNIQUE_ID_CHARS.length));
  }
  return result;
}

/**
 * Formats a date as YYYYMMDD-HHMM
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDateForRequestId(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}${month}${day}-${hours}${minutes}`;
}

/**
 * Validates a context string to ensure it meets the requirements
 * @param context Context string to validate
 * @returns Validated context string (uppercase, no special characters)
 */
export function validateContext(context: string): string {
  // Remove special characters and spaces, convert to uppercase
  const sanitized = context.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  // Limit to 5 characters max
  return sanitized.substring(0, 5);
}

/**
 * Generates a unified request ID according to the specified format
 * @param type Request type (TSR, VIS, ACCOM, CLM)
 * @param context Context information (e.g., NYC for New York, USA for United States)
 * @param date Optional date to use (defaults to current date/time)
 * @returns Formatted request ID
 */
export function generateRequestId(
  type: RequestType,
  context: string,
  date: Date = new Date()
): string {
  const timestamp = formatDateForRequestId(date);
  const validContext = validateContext(context);
  const uniqueId = generateUniqueId();
  
  return `${type}-${timestamp}-${validContext}-${uniqueId}`;
}

/**
 * Parses a request ID into its component parts
 * @param requestId Request ID to parse
 * @returns Object containing the parsed components, or null if invalid
 */
export function parseRequestId(requestId: string): {
  type: RequestType;
  timestamp: string;
  context: string;
  uniqueId: string;
  date: Date;
} | null {
  // Expected format: TYPE-YYYYMMDD-HHMM-CONTEXT-UNIQUEID
  const parts = requestId.split('-');
  
  if (parts.length !== 5) {
    return null;
  }
  
  const [type, dateStr, timeStr, context, uniqueId] = parts;
  
  // Validate type
  if (!['TSR', 'VIS', 'ACCOM', 'CLM'].includes(type)) {
    return null;
  }
  
  // Parse date
  try {
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-indexed
    const day = parseInt(dateStr.substring(6, 8));
    const hours = parseInt(timeStr.substring(0, 2));
    const minutes = parseInt(timeStr.substring(2, 4));
    
    const date = new Date(year, month, day, hours, minutes);
    
    return {
      type: type as RequestType,
      timestamp: `${dateStr}-${timeStr}`,
      context,
      uniqueId,
      date
    };
  } catch (error) {
    return null;
  }
}
