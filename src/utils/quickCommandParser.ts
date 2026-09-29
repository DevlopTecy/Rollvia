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
 * P:start:end[,start:end...]
 * A:start:end[,start:end...]
 * Or mixed: P:100:105,110,115:118
 *
 * Rules:
 * - Must start with uppercase 'P:' or 'A:'
 * - Range syntax: START:END (inclusive, START <= END)
 * - Numbers must contain digits only
 * - No spaces, letters, or extra punctuation
 * - Every student roll number / ID must exist in the provided roster
 * - Duplicate numbers are automatically deduplicated
 * - If anything fails, returns isValid: false with a descriptive error message without partial execution
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

  // Check trailing colon
  if (commandStr.endsWith(':')) {
    return {
      isValid: false,
      error: 'Command must not end with a trailing colon.',
    };
  }

  // Must begin with uppercase P: or A:
  if (!commandStr.startsWith('P:') && !commandStr.startsWith('A:')) {
    return {
      isValid: false,
      error: 'Invalid syntax. Must begin with P: or A:.',
    };
  }

  const action = commandStr.charAt(0) as 'P' | 'A';
  const body = commandStr.slice(2);

  if (!body) {
    return {
      isValid: false,
      error: 'Command cannot be empty. Example: P:113,144,102',
    };
  }

  // Check for any alphabetic characters in body
  if (/[a-zA-Z]/.test(body)) {
    return {
      isValid: false,
      error: 'Roll numbers must contain digits only.',
    };
  }

  // Check for invalid characters (only digits, commas, and colons allowed)
  if (/[^0-9,:]/.test(body)) {
    return {
      isValid: false,
      error: 'Invalid characters in command. Only digits, commas, and colons are allowed.',
    };
  }

  // Check for double colons anywhere
  if (body.includes('::')) {
    return {
      isValid: false,
      error: 'Malformed command: double colon is not allowed.',
    };
  }

  // Check leading comma or colon in body
  if (body.startsWith(',') || body.startsWith(':')) {
    return {
      isValid: false,
      error: 'Malformed command syntax.',
    };
  }

  const tokens = body.split(',');
  const rawRollNumbers: string[] = [];

  for (const token of tokens) {
    if (!token) {
      return {
        isValid: false,
        error: 'Command contains empty segment between commas.',
      };
    }

    if (token.includes(':')) {
      const parts = token.split(':');
      if (parts.length !== 2) {
        return {
          isValid: false,
          error: `Malformed range: '${token}'. Only one colon is allowed per range (START:END).`,
        };
      }

      const [startStr, endStr] = parts;
      if (!startStr || !endStr) {
        return {
          isValid: false,
          error: `Malformed range: '${token}'. Both start and end roll numbers are required.`,
        };
      }

      if (!/^[0-9]+$/.test(startStr) || !/^[0-9]+$/.test(endStr)) {
        return {
          isValid: false,
          error: 'Roll numbers in range must contain digits only.',
        };
      }

      const startNum = parseInt(startStr, 10);
      const endNum = parseInt(endStr, 10);

      if (startNum > endNum) {
        return {
          isValid: false,
          error: `Invalid range ${startStr}:${endStr}. Start roll number (${startStr}) must be less than or equal to end roll number (${endStr}).`,
        };
      }

      if (endNum - startNum > 5000) {
        return {
          isValid: false,
          error: `Range span is too large (${startStr}:${endStr}). Maximum span is 5000.`,
        };
      }

      const useZeroPad = startStr.length === endStr.length && startStr.length > 1 && startStr.startsWith('0');
      const padLength = startStr.length;

      for (let i = startNum; i <= endNum; i++) {
        const roll = useZeroPad ? String(i).padStart(padLength, '0') : String(i);
        rawRollNumbers.push(roll);
      }
    } else {
      // Single roll number
      if (!/^[0-9]+$/.test(token)) {
        return {
          isValid: false,
          error: 'Roll numbers must contain digits only.',
        };
      }
      rawRollNumbers.push(token);
    }
  }

  // Deduplicate while preserving order
  const uniqueNumbers = Array.from(new Set(rawRollNumbers));

  // Check that every number exists in student roster
  const missingNumbers: string[] = [];
  for (const num of uniqueNumbers) {
    const exists = studentRoster.some((p) => {
      const roll = String(p.rollNumber || '').trim();
      const id = String(p.id || '').trim();
      return roll === num || (!roll && id === num);
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
