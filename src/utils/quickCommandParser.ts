import type { Person } from '../types';

export interface ValidateCommandResult {
  isValid: boolean;
  action?: 'P' | 'A';
  rollNumbers?: string[];
  error?: string;
}

/**
 * Validates and parses a Simple Quick attendance command string according to strict grammar:
 * P:number[,number...]
 * A:number[,number...]
 *
 * Rules:
 * - Must start with uppercase 'P:' or 'A:'
 * - Numbers must contain digits only
 * - No spaces, letters, or extra punctuation
 * - Every student roll number must exist in the provided roster
 * - Duplicate numbers are automatically deduplicated
 * - If anything fails, returns isValid: false with a descriptive error message
 */
export function validateQuickCommand(commandStr: string, studentRoster: Person[]): ValidateCommandResult {
  if (!commandStr || !commandStr.trim()) {
    return {
      isValid: false,
      error: 'Command cannot be empty. Example: P:113,144,102',
    };
  }

  // Strict check: No spaces anywhere
  if (/\s/.test(commandStr)) {
    return {
      isValid: false,
      error: 'Command must not contain spaces.',
    };
  }

  // Check lowercase command
  if (commandStr.startsWith('p:') || commandStr.startsWith('a:')) {
    return {
      isValid: false,
      error: 'Command letter must be uppercase P or A.',
    };
  }

  // Check trailing comma
  if (commandStr.endsWith(',')) {
    return {
      isValid: false,
      error: 'Command must not end with a trailing comma.',
    };
  }

  // Check empty number between commas
  if (commandStr.includes(',,')) {
    return {
      isValid: false,
      error: 'Command contains empty number between commas.',
    };
  }

  // Strict grammar regex check: leading uppercase P or A, colon, comma-separated digits only
  const match = commandStr.match(/^([PA]):([0-9]+(?:,[0-9]+)*)$/);
  if (!match) {
    if (/[a-zA-Z]/.test(commandStr.slice(2))) {
      return {
        isValid: false,
        error: 'Roll numbers must contain digits only.',
      };
    }
    return {
      isValid: false,
      error: 'Invalid syntax. Must be P:number,number or A:number,number.',
    };
  }

  const action = match[1] as 'P' | 'A';
  const rawList = match[2].split(',');
  const uniqueNumbers = Array.from(new Set(rawList));

  // Check that every number exists in current student roster
  const missingNumbers: string[] = [];
  for (const num of uniqueNumbers) {
    const exists = studentRoster.some((p) => {
      const roll = String(p.rollNumber || '').trim();
      return roll === num;
    });
    if (!exists) {
      missingNumbers.push(num);
    }
  }

  if (missingNumbers.length > 0) {
    return {
      isValid: false,
      error: `Roll No / ID ${missingNumbers.join(', ')} does not exist.`,
    };
  }

  return {
    isValid: true,
    action,
    rollNumbers: uniqueNumbers,
  };
}
