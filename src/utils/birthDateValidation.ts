import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";
import moment from 'moment';
// Birth date validation and processing utilities
// Ensures consistent, strict parsing across multiple input formats

// Accepted input formats (strict)
const ACCEPTED_FORMATS = [
  'YYYY-MM-DD',
  'MMMM D, YYYY',
  'MMM D, YYYY',
  'M/D/YYYY',
  'MM/DD/YYYY',
];

function parseBirthDateStrict(input: string): moment.Moment | null {
  if (!input || typeof input !== 'string') return null;
  // Try strict parsing across accepted formats
  const m = moment(input.trim(), ACCEPTED_FORMATS, true);
  if (m.isValid()) return m;
  // Fallback: try trimming extra commas or spaces
  const cleaned = input.replace(/\s+/g, ' ').replace(/,\s*/, ', ');
  const m2 = moment(cleaned, ACCEPTED_FORMATS, true);
  return m2.isValid() ? m2 : null;
}

function toDisplayFormat(m: moment.Moment): string {
  // Normalize to "Month D, YYYY" (e.g., July 28, 1994)
  return m.format('MMMM D, YYYY');
}

export function toISODate(input: string): string | null {
  const m = parseBirthDateStrict(input);
  return m ? m.format('YYYY-MM-DD') : null;
}

/**
 * Validates and normalizes a birth date string
 * Ensures the date is in the correct format and year is reasonable
 */
export function validateBirthDate(birthDate: string): { isValid: boolean; normalizedDate?: string; error?: string } {
  if (!birthDate || typeof birthDate !== 'string') {
    return { isValid: false, error: 'Birth date is required' };
  }

  try {
    const m = parseBirthDateStrict(birthDate);
    if (!m) {
      return { isValid: false, error: 'Invalid date format' };
    }

    const year = m.year();
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) {
      return { isValid: false, error: `Invalid birth year: ${year}. Must be between 1900 and ${currentYear}` };
    }

    const normalizedDate = toDisplayFormat(m);
    return { isValid: true, normalizedDate };
  } catch (error) {
    return { isValid: false, error: `Date parsing error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Calculates age from birth date string
 * Uses the same logic as the app to ensure consistency
 */
export function calculateAgeFromBirthDate(birthDate: string): { age?: number; error?: string } {
  const m = parseBirthDateStrict(birthDate);
  if (!m) {
    return { error: 'Invalid birth date format' };
  }

  try {
    const today = new Date();
    let age = today.getFullYear() - m.year();
    const monthDiff = today.getMonth() - m.month();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < m.date())) {
      age--;
    }
    return { age };
  } catch (error) {
    return { error: `Age calculation error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Validates that a calculated age matches the birth year
 * Helps detect the 2-year offset bug
 */
export function validateAgeConsistency(birthDate: string, calculatedAge: number): { isConsistent: boolean; expectedAge?: number; error?: string } {
  const ageResult = calculateAgeFromBirthDate(birthDate);
  if (ageResult.error) {
    return { isConsistent: false, error: ageResult.error };
  }

  const expectedAge = ageResult.age!;
  const isConsistent = Math.abs(expectedAge - calculatedAge) <= 1; // Allow 1 year difference for birthday timing

  return { 
    isConsistent, 
    expectedAge,
    error: isConsistent ? undefined : `Age mismatch: expected ${expectedAge}, got ${calculatedAge}`
  };
}

/**
 * Debug function to trace birth date processing
 * Logs each step of the birth date handling pipeline
 */
export function debugBirthDateProcessing(inputDate: string): void {
  logDebug('=== Birth Date Processing Debug ===', "Debug");
  logDebug(`Input: "${inputDate}"`, "Debug");
  
  // Step 1: Validation
  const validation = validateBirthDate(inputDate);
  logDebug(`Validation: ${validation.isValid ? 'PASS' : 'FAIL'}`, "Debug");
  if (!validation.isValid) {
    logDebug(`Error: ${validation.error}`, "Debug");
    return;
  }
  logDebug(`Normalized: "${validation.normalizedDate}"`, "Debug");
  
  // Step 2: Parse strictly with moment
  const m = parseBirthDateStrict(inputDate)!;
  logDebug(`Parsed (strict): ${m.format('YYYY-MM-DD')}`, "Debug");
  logDebug(`Extracted year: ${m.year()}`, "Debug");
  
  // Step 3: Age calculation
  const ageResult = calculateAgeFromBirthDate(inputDate);
  logDebug(`Calculated age: ${ageResult.age || 'ERROR: ' + ageResult.error}`, "Debug");
  
  // Step 4: Consistency check
  if (ageResult.age) {
    const consistency = validateAgeConsistency(inputDate, ageResult.age);
    logDebug(`Consistency: ${consistency.isConsistent ? 'PASS' : 'FAIL'}`, "Debug");
    if (!consistency.isConsistent) {
      logDebug(`Consistency error: ${consistency.error}`, "Debug");
    }
  }
  
  logDebug('=== End Debug ===', "Debug");
}

/**
 * Test function to verify birth date handling works correctly
 * Returns true if all tests pass, false otherwise
 */
export function testBirthDateHandling(): boolean {
  const testCases = [
    { input: 'January 1, 1994', expectedYear: 1994 },
    { input: 'December 31, 1994', expectedYear: 1994 },
    { input: 'July 15, 1996', expectedYear: 1996 },
    { input: 'February 29, 2000', expectedYear: 2000 }, // leap year
    { input: '7/28/1994', expectedYear: 1994 }, // numeric US format
    { input: '1994-07-28', expectedYear: 1994 }, // ISO format
  ];

  logDebug('=== Birth Date Handling Test ===', "Debug");
  let allPassed = true;

  testCases.forEach((testCase, index) => {
    logDebug(`\nTest ${index + 1}: "${testCase.input}"`, "Debug");
    
    const validation = validateBirthDate(testCase.input);
    const m = parseBirthDateStrict(testCase.input);
    const actualYear = m ? m.year() : NaN;
    
    const passed = validation.isValid && actualYear === testCase.expectedYear;
    logDebug(`Expected year: ${testCase.expectedYear}, "Debug", Got: ${actualYear}, Passed: ${passed}`);
    
    if (!passed) {
      allPassed = false;
      logDebug(`❌ Test failed!`, "Debug");
    } else {
      logDebug(`✅ Test passed`, "Debug");
    }
  });

  logDebug(`\n=== Test Summary ===`, "Debug");
  logDebug(`Overall result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`, "Debug");
  
  return allPassed;
}
