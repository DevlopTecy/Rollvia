import * as XLSX from 'xlsx';
import type { Person } from '../types';

export type StudentRowStatus =
  | 'valid'
  | 'duplicate_in_input'
  | 'duplicate_existing'
  | 'missing_required';

export interface ParsedStudentRow {
  /** 1-based index of row for display */
  displayIndex: number;
  name: string;
  rollNumber: string;
  phone: string;
  email: string;
  status: StudentRowStatus;
  errors: string[];
  /** If matches an existing student in Rollvia */
  isExistingMatch: boolean;
  existingStudentName?: string;
}

export interface ParseStudentsResult {
  rows: ParsedStudentRow[];
  totalRows: number;
  validCount: number;
  duplicateInInputCount: number;
  duplicateExistingCount: number;
  missingRequiredCount: number;
  hasHeaders: boolean;
  detectedHeaders?: {
    nameCol?: string;
    rollCol?: string;
    phoneCol?: string;
    emailCol?: string;
  };
}

/**
 * Normalizes cell content to a clean string.
 */
function cleanCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
 * Checks if a string looks like a header token for a specific field.
 */
function isNameHeader(token: string): boolean {
  const norm = token.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    norm === 'name' ||
    norm === 'studentname' ||
    norm === 'fullname' ||
    norm === 'candidatename' ||
    norm === 'student'
  );
}

function isRollHeader(token: string): boolean {
  const norm = token.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    norm === 'roll' ||
    norm === 'rollno' ||
    norm === 'rollnum' ||
    norm === 'rollnumber' ||
    norm === 'id' ||
    norm === 'studentid' ||
    norm === 'urn' ||
    norm === 'regno' ||
    norm === 'registrationno' ||
    norm === 'admno' ||
    norm === 'admissionno'
  );
}

function isPhoneHeader(token: string): boolean {
  const norm = token.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    norm === 'phone' ||
    norm === 'phoneno' ||
    norm === 'phonenumber' ||
    norm === 'mobile' ||
    norm === 'mobileno' ||
    norm === 'mobilenumber' ||
    norm === 'contact' ||
    norm === 'contactno' ||
    norm === 'cell' ||
    norm === 'telephone'
  );
}

function isEmailHeader(token: string): boolean {
  const norm = token.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    norm === 'email' ||
    norm === 'emailid' ||
    norm === 'emailaddress' ||
    norm === 'mail' ||
    norm === 'mailid'
  );
}

/**
 * Resolves column index mappings from raw 2D array of rows.
 */
function detectColumnMapping(rows: (string | number)[][]): {
  headerRowIndex: number;
  nameIdx: number;
  rollIdx: number;
  phoneIdx: number;
  emailIdx: number;
  hasHeaders: boolean;
} {
  // Check the first 4 rows to see if any row contains header tokens
  for (let r = 0; r < Math.min(rows.length, 4); r++) {
    const row = rows[r];
    if (!row) continue;

    let foundName = -1;
    let foundRoll = -1;
    let foundPhone = -1;
    let foundEmail = -1;

    for (let c = 0; c < row.length; c++) {
      const cellText = cleanCell(row[c]);
      if (!cellText) continue;

      if (foundName === -1 && isNameHeader(cellText)) {
        foundName = c;
      } else if (foundRoll === -1 && isRollHeader(cellText)) {
        foundRoll = c;
      } else if (foundPhone === -1 && isPhoneHeader(cellText)) {
        foundPhone = c;
      } else if (foundEmail === -1 && isEmailHeader(cellText)) {
        foundEmail = c;
      }
    }

    // If at least Name or Roll No was explicitly found as a header:
    if (foundName !== -1 || foundRoll !== -1) {
      return {
        headerRowIndex: r,
        nameIdx: foundName !== -1 ? foundName : 0,
        rollIdx: foundRoll !== -1 ? foundRoll : 1,
        phoneIdx: foundPhone !== -1 ? foundPhone : 2,
        emailIdx: foundEmail !== -1 ? foundEmail : 3,
        hasHeaders: true,
      };
    }
  }

  // Fallback default column order: [Name, Roll No, Phone, Email]
  return {
    headerRowIndex: -1,
    nameIdx: 0,
    rollIdx: 1,
    phoneIdx: 2,
    emailIdx: 3,
    hasHeaders: false,
  };
}

/**
 * Validates and transforms 2D rows into ParsedStudentRow objects.
 */
function process2DRows(
  rawRows: (string | number)[][],
  existingRoster: Person[]
): ParseStudentsResult {
  if (!rawRows || rawRows.length === 0) {
    return {
      rows: [],
      totalRows: 0,
      validCount: 0,
      duplicateInInputCount: 0,
      duplicateExistingCount: 0,
      missingRequiredCount: 0,
      hasHeaders: false,
    };
  }

  const { headerRowIndex, nameIdx, rollIdx, phoneIdx, emailIdx, hasHeaders } =
    detectColumnMapping(rawRows);

  const existingRollMap = new Map<string, Person>();
  for (const p of existingRoster) {
    if (p.rollNumber) {
      existingRollMap.set(p.rollNumber.trim().toLowerCase(), p);
    }
  }

  const seenInBatchRolls = new Set<string>();
  const parsedRows: ParsedStudentRow[] = [];

  let validCount = 0;
  let duplicateInInputCount = 0;
  let duplicateExistingCount = 0;
  let missingRequiredCount = 0;

  const startIndex = hasHeaders ? headerRowIndex + 1 : 0;

  for (let r = startIndex; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row) continue;

    // Check if entire row is empty
    const isAllBlank = row.every((c) => cleanCell(c).length === 0);
    if (isAllBlank) continue;

    const name = cleanCell(row[nameIdx]);
    const rollNumber = cleanCell(row[rollIdx]);
    const phone = cleanCell(row[phoneIdx]);
    const email = cleanCell(row[emailIdx]);

    const errors: string[] = [];
    if (!name) errors.push('Missing Name');
    if (!rollNumber) errors.push('Missing Roll No / ID');

    let status: StudentRowStatus = 'valid';
    const cleanRollLower = rollNumber.toLowerCase();
    const existingMatch = rollNumber ? existingRollMap.get(cleanRollLower) : undefined;

    if (errors.length > 0) {
      status = 'missing_required';
      missingRequiredCount++;
    } else if (seenInBatchRolls.has(cleanRollLower)) {
      status = 'duplicate_in_input';
      errors.push(`Roll No "${rollNumber}" appears multiple times in import list`);
      duplicateInInputCount++;
    } else if (existingMatch) {
      status = 'duplicate_existing';
      errors.push(`Roll No "${rollNumber}" already exists in roster (${existingMatch.name})`);
      duplicateExistingCount++;
    } else {
      status = 'valid';
      validCount++;
    }

    if (rollNumber) {
      seenInBatchRolls.add(cleanRollLower);
    }

    parsedRows.push({
      displayIndex: parsedRows.length + 1,
      name,
      rollNumber,
      phone,
      email,
      status,
      errors,
      isExistingMatch: Boolean(existingMatch),
      existingStudentName: existingMatch?.name,
    });
  }

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validCount,
    duplicateInInputCount,
    duplicateExistingCount,
    missingRequiredCount,
    hasHeaders,
  };
}

/**
 * Parses raw pasted text (e.g. copied from Excel, TSV, or CSV).
 * Format: Name<TAB>Roll No<TAB>Phone<TAB>Email (or comma/semicolon/pipe)
 */
export function parsePastedStudentList(
  pastedText: string,
  existingRoster: Person[]
): ParseStudentsResult {
  const lines = pastedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      rows: [],
      totalRows: 0,
      validCount: 0,
      duplicateInInputCount: 0,
      duplicateExistingCount: 0,
      missingRequiredCount: 0,
      hasHeaders: false,
    };
  }

  // Detect delimiter: tab (\t), comma (,), semicolon (;), or pipe (|)
  let tabCount = 0;
  let commaCount = 0;
  let semiCount = 0;
  let pipeCount = 0;

  for (const line of lines.slice(0, 5)) {
    tabCount += (line.match(/\t/g) || []).length;
    commaCount += (line.match(/,/g) || []).length;
    semiCount += (line.match(/;/g) || []).length;
    pipeCount += (line.match(/\|/g) || []).length;
  }

  let delimiter: string | RegExp = '\t';
  if (tabCount > 0) {
    delimiter = '\t';
  } else if (commaCount >= lines.length) {
    delimiter = ',';
  } else if (semiCount >= lines.length) {
    delimiter = ';';
  } else if (pipeCount >= lines.length) {
    delimiter = '|';
  } else {
    // Single space or multiple spaces if tab isn't present
    delimiter = /\t+/;
  }

  const rawRows: string[][] = lines.map((line) => {
    if (delimiter instanceof RegExp) {
      return line.split(delimiter).map((c) => c.trim());
    }
    return line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
  });

  return process2DRows(rawRows, existingRoster);
}

/**
 * Parses an uploaded Excel (.xlsx, .xls) or CSV file.
 */
export function parseUploadedStudentFile(
  fileBuffer: ArrayBuffer | Uint8Array,
  existingRoster: Person[]
): ParseStudentsResult {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return {
        rows: [],
        totalRows: 0,
        validCount: 0,
        duplicateInInputCount: 0,
        duplicateExistingCount: 0,
        missingRequiredCount: 0,
        hasHeaders: false,
      };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    return process2DRows(rawRows, existingRoster);
  } catch (err) {
    console.error('[StudentImportParser] Error reading workbook:', err);
    throw new Error('Failed to parse the uploaded file. Please ensure it is a valid .xlsx, .xls, or .csv file.');
  }
}
