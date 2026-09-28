import type { AttendanceDataset, AttendanceRecord } from '../../models/attendance';
import type { StorageAdapter, StorageSaveResult, StorageValidationResult, TabularData } from '../types';

/**
 * Standard table column headers for Google Sheets attendance records as required:
 * Date | Person ID | Name | Class | Status
 */
export const GOOGLE_SHEETS_ATTENDANCE_HEADERS = ['Date', 'Person ID', 'Name', 'Class', 'Status'] as const;

/**
 * Standard worksheet name dedicated to attendance records.
 */
export const ATTENDANCE_SHEET_NAME = 'Attendance';

/**
 * Helper to safely detect Electron IPC availability.
 */
function getElectronAPI() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI;
  }
  return null;
}

/**
 * Storage Adapter for Google Sheets.
 *
 * Appends normalized AttendanceRecord items into Google Spreadsheets via Google Sheets API v4.
 * Features:
 * - Secure integration: zero credentials or secrets hardcoded in frontend source code.
 * - Standard table layout: Date | Person ID | Name | Class | Status.
 * - Non-destructive: appends records to the 'Attendance' sheet without overwriting existing entries.
 * - Verifies API write confirmation (updatedRows / updatedRange) before reporting success.
 * - Clear handling of auth failures (401), permission denials (403), and missing sheets (404).
 */
export class GoogleSheetsAdapter implements StorageAdapter {
  readonly id = 'google_sheets' as const;
  readonly displayName = 'Google Sheets';
  readonly description = 'Cloud spreadsheet synchronization via Google Sheets API v4';

  validate(dataset: AttendanceDataset): StorageValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!dataset.date) {
      errors.push('Attendance date is required for Google Sheets sync.');
    }

    if (!dataset.records || dataset.records.length === 0) {
      errors.push('No attendance records available to sync.');
    }

    if (!dataset.roster || dataset.roster.length === 0) {
      errors.push('Roster cannot be empty.');
    }

    if (!dataset.classes || dataset.classes.length === 0) {
      errors.push('At least one class must be configured.');
    }

    for (let i = 0; i < (dataset.records || []).length; i++) {
      const rec = dataset.records[i];
      if (!rec.personName || !rec.rollNumber || !rec.className) {
        errors.push(`Record #${i + 1} has incomplete data (missing name, roll number, or class).`);
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  toTabularData(dataset: AttendanceDataset): TabularData {
    const headers = [...GOOGLE_SHEETS_ATTENDANCE_HEADERS];
    const rows = dataset.records.map((r) => this.formatRecord(r));
    return { headers, rows };
  }

  formatRecord(record: AttendanceRecord): (string | number)[] {
    return [
      record.date,
      record.personId,
      record.personName,
      record.className,
      record.status,
    ];
  }

  async save(dataset: AttendanceDataset): Promise<StorageSaveResult> {
    const validation = this.validate(dataset);
    if (!validation.isValid) {
      return {
        success: false,
        storageMode: this.id,
        destination: 'Google Sheets',
        recordsCount: 0,
        timestamp: new Date().toISOString(),
        message: `Validation failed: ${validation.errors.join('; ')}`,
        error: validation.errors[0],
      };
    }

    const electronAPI = getElectronAPI();
    if (!electronAPI || !electronAPI.googleSheetsAppendRecords) {
      return {
        success: false,
        storageMode: this.id,
        destination: 'Google Sheets',
        recordsCount: 0,
        timestamp: new Date().toISOString(),
        message: 'Google Sheets synchronization is available in the desktop application.',
        error: 'Google Sheets integration unavailable outside Electron desktop environment.',
      };
    }

    try {
      // Execute append via Electron secure backend
      const result = await electronAPI.googleSheetsAppendRecords(dataset);

      if (!result.success || !result.updatedRows || result.updatedRows === 0) {
        return {
          success: false,
          storageMode: this.id,
          destination: result.spreadsheetUrl || 'Google Sheets',
          recordsCount: 0,
          timestamp: new Date().toISOString(),
          message: result.error || 'Write Verification Failed: Google Sheets did not confirm any rows written.',
          error: result.error || 'No rows confirmed written by Google Sheets API.',
        };
      }

      return {
        success: true,
        storageMode: this.id,
        destination: result.spreadsheetUrl,
        recordsCount: dataset.records.length,
        timestamp: new Date().toISOString(),
        message: `Confirmed: Successfully appended ${dataset.records.length} records to '${result.spreadsheetTitle || 'Attendance'}' sheet in Google Sheets (${result.updatedRange || `${result.updatedRows} rows written`}).`,
        tabularSummary: {
          totalRows: result.updatedRows,
          columns: [...GOOGLE_SHEETS_ATTENDANCE_HEADERS],
        },
        details: {
          spreadsheetId: result.spreadsheetId,
          spreadsheetUrl: result.spreadsheetUrl,
          updatedRows: result.updatedRows,
          updatedRange: result.updatedRange,
          verified: true,
        },
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        storageMode: this.id,
        destination: 'Google Sheets',
        recordsCount: 0,
        timestamp: new Date().toISOString(),
        message: `Google Sheets Error: ${errorMsg}`,
        error: errorMsg,
      };
    }
  }
}
