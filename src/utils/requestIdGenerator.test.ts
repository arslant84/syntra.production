import { 
  generateRequestId, 
  parseRequestId, 
  validateContext, 
  generateUniqueId,
  formatDateForRequestId,
  RequestType
} from './requestIdGenerator';

describe('Request ID Generator', () => {
  // Mock the Date object for consistent testing
  const mockDate = new Date('2025-07-02T14:23:00Z');
  
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('formatDateForRequestId formats date correctly', () => {
    const formatted = formatDateForRequestId(mockDate);
    expect(formatted).toBe('20250702-1423');
  });

  test('validateContext sanitizes and limits context', () => {
    expect(validateContext('NYC')).toBe('NYC');
    expect(validateContext('new york')).toBe('NEWYORK');
    expect(validateContext('SAN FRANCISCO')).toBe('SANFR');
    expect(validateContext('DEL-HI')).toBe('DELHI');
    expect(validateContext('')).toBe('');
  });

  test('generateUniqueId creates IDs of correct length', () => {
    const id1 = generateUniqueId();
    const id2 = generateUniqueId(6);
    
    expect(id1.length).toBe(4);
    expect(id2.length).toBe(6);
    expect(id1).not.toBe(id2.substring(0, 4)); // Should be random
  });

  test('generateRequestId creates properly formatted IDs', () => {
    // Mock Math.random to return predictable values
    const originalRandom = Math.random;
    Math.random = jest.fn()
      .mockReturnValueOnce(0.1) // A
      .mockReturnValueOnce(0.2) // B
      .mockReturnValueOnce(0.3) // C
      .mockReturnValueOnce(0.4); // D

    const tsrId = generateRequestId('TSR', 'NYC');
    expect(tsrId).toBe('TSR-20250702-1423-NYC-ABCD');

    const visaId = generateRequestId('VIS', 'USA');
    expect(visaId).toBe('VIS-20250702-1423-USA-ABCD');

    const accomId = generateRequestId('ACCOM', 'DEL');
    expect(accomId).toBe('ACCOM-20250702-1423-DEL-ABCD');

    const claimId = generateRequestId('CLM', 'MED');
    expect(claimId).toBe('CLM-20250702-1423-MED-ABCD');

    // Restore original Math.random
    Math.random = originalRandom;
  });

  test('parseRequestId correctly parses valid IDs', () => {
    const parsed = parseRequestId('TSR-20250702-1423-NYC-ABCD');
    
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.type).toBe('TSR');
      expect(parsed.timestamp).toBe('20250702-1423');
      expect(parsed.context).toBe('NYC');
      expect(parsed.uniqueId).toBe('ABCD');
      expect(parsed.date).toEqual(new Date(2025, 6, 2, 14, 23)); // Month is 0-indexed
    }
  });

  test('parseRequestId returns null for invalid IDs', () => {
    expect(parseRequestId('INVALID-ID')).toBeNull();
    expect(parseRequestId('TSR-BADDATE-TIME-NYC-ABCD')).toBeNull();
    expect(parseRequestId('UNKNOWN-20250702-1423-NYC-ABCD')).toBeNull();
  });
});
