import * as XLSX from 'xlsx';
import type { AttendanceDataset, AttendanceRecord, AttendanceStatusValue } from '../../models/attendance';
import type { Person, WeeklyTimetable } from '../../types';
import type { StorageAdapter, StorageSaveResult, StorageValidationResult, TabularData, StorageReadResult } from '../types';
import { getSubjectsForDate } from '../../utils/calendar';

/**
 * Standard table column headers for Excel attendance records (legacy & raw data schema):
 * Date | Roll No | Name | Class | Status
 */
export const EXCEL_ATTENDANCE_HEADERS = ['Date', 'Roll No', 'Name', 'Class', 'Status'] as const;

/**
 * Legacy sheet name for backward compatibility.
 */
export const ATTENDANCE_SHEET_NAME = 'Attendance';

/**
 * Standard search sheet name.
 */
export const SEARCH_SHEET_NAME = 'Search';

/**
 * Hidden worksheet storing normalized records losslessly.
 */
export const RAW_DATA_SHEET_NAME = '_AttendanceData';

/**
 * Hidden worksheet storing full student roster losslessly.
 */
export const ROSTER_SHEET_NAME = '_Roster';

/**
 * Hidden worksheet storing timetable and date schedule overrides metadata losslessly.
 */
export const METADATA_SHEET_NAME = '_Metadata';

export interface MonthlyMatrixParseResult {
  records: AttendanceRecord[];
  roster: Person[];
  dateScheduleOverrides: Record<string, string[]>;
  weeklyTimetable: Record<string, { id: string; name: string }[]>;
  year?: number;
  monthIndex?: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

/**
 * Returns the Weekday name ('Monday' ... 'Sunday') for a YYYY-MM-DD date string.
 */
export function getWeekdayForDate(dateStr: string): string {
  if (!dateStr) return 'Monday';
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return 'Monday';
  }
  const jsDay = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
  return WEEKDAY_NAMES[jsDay];
}

/**
 * Parses Month name and Year from metadata or ISO date string.
 */
export function parseMonthAndYear(dateStr?: string, metadata?: AttendanceDataset['metadata']): {
  monthName: string;
  year: number;
  monthIndex: number;
} {
  if (metadata && metadata.selectedMonth) {
    const parts = metadata.selectedMonth.trim().split(/\s+/);
    if (parts.length >= 2) {
      const mName = parts[0];
      const yNum = parseInt(parts[1], 10);
      const mIdx = MONTH_NAMES.findIndex(m => m.toLowerCase() === mName.toLowerCase());
      if (mIdx >= 0 && !isNaN(yNum)) {
        return { monthName: MONTH_NAMES[mIdx], year: yNum, monthIndex: mIdx };
      }
    }
  }

  if (dateStr && dateStr.includes('-')) {
    const parts = dateStr.split('-').map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const yNum = parts[0];
      const mIdx = parts[1] - 1;
      return { monthName: MONTH_NAMES[mIdx] || 'September', year: yNum, monthIndex: mIdx };
    }
  }

  const now = new Date();
  return { monthName: MONTH_NAMES[now.getMonth()], year: now.getFullYear(), monthIndex: now.getMonth() };
}

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
 * Excel Storage Adapter.
 *
 * Persists AttendanceRecord items into professional Excel workbooks (.xlsx) using SheetJS (xlsx).
 * Features:
 * - Creates a monthly structured Attendance sheet: "Attendance [Month]" (e.g. Attendance September).
 * - Lists students vertically in configured Rollvia order with S.No, Name, and Roll No.
 * - Dates arranged horizontally with merged date header and weekday header.
 * - Under weekday/date, displays subjects scheduled on that date according to the weekly timetable.
 * - Matrix cells show compact 'P' (light green formatting) and 'A' (light red formatting).
 * - Blank cells remain blank for non-scheduled or future dates.
 * - Totals on the right: Total Presents, Total Absents, Total Classes, Percentage (formatted to 2 decimal places).
 * - "Search" sheet with interactive student Roll No search, student detail card, and subject-wise breakdown.
 * - Internal hidden "_AttendanceData" sheet storing lossless normalized records.
 * - Backward-compatible readback from legacy "Attendance" flat sheets and structured monthly sheets.
 * - In-place editing and deduplication: editing existing attendance updates P/A cells without duplicate records.
 * - Frozen student/name columns and header rows for scrolling.
 * - Verification on disk after every write.
 */
export class ExcelAdapter implements StorageAdapter {
  readonly id = 'excel' as const;
  readonly displayName = 'Excel Workbook';
  readonly description = 'Structured monthly attendance workbook (.xlsx) with horizontal dates & search sheet';
  readonly fileExtension = '.xlsx';

  validate(dataset: AttendanceDataset): StorageValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!dataset.date) {
      errors.push('Attendance date is required for Excel export.');
    }

    if (!dataset.records || dataset.records.length === 0) {
      errors.push('No attendance records available to save.');
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
    const headers = [...EXCEL_ATTENDANCE_HEADERS];
    const rows = dataset.records.map((r) => this.formatRecord(r, dataset.roster));
    return { headers, rows };
  }

  formatRecord(record: AttendanceRecord, roster?: Person[]): (string | number)[] {
    const student = roster?.find((p) => p.id === record.personId);
    let roll = record.rollNumber && record.rollNumber !== 'N/A' && !record.rollNumber.startsWith('p_')
      ? record.rollNumber
      : (student?.rollNumber && !student.rollNumber.startsWith('p_') ? student.rollNumber : '');

    if (!roll && record.rollNumber && record.rollNumber !== 'N/A') {
      roll = record.rollNumber;
    }

    return [
      record.date,
      roll,
      record.personName,
      record.className,
      record.status,
    ];
  }

  /**
   * Immediately creates an empty Attendance workbook on disk with the structured
   * monthly Attendance sheet and Search sheet, and verifies it.
   */
  async createEmptyWorkbook(filePath: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const now = new Date();
      const monthName = MONTH_NAMES[now.getMonth()];
      const year = now.getFullYear();
      const monthlySheetName = `Attendance ${monthName}`;

      const emptyDataset: AttendanceDataset = {
        storageMode: 'excel',
        date: `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
        formattedDate: `1 ${monthName} ${year}`,
        records: [],
        summary: {
          totalRecords: 0,
          totalPresent: 0,
          totalAbsent: 0,
          attendancePercentage: 0,
          uniquePeopleCount: 0,
          uniqueClassesCount: 0,
        },
        roster: [],
        classes: [],
        metadata: {
          recordedAt: new Date().toISOString(),
          selectedMonth: `${monthName} ${year}`,
          selectedYear: year,
          selectedMonthIndex: now.getMonth(),
        },
      };

      const workbook = this.buildWorkbookData(emptyDataset, []);
      const outBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true }) as Uint8Array;
      await this.writeBufferToDisk(filePath, outBuffer);

      // Verify
      const exists = await this.checkFileExists(filePath);
      if (!exists) {
        return { success: false, error: `Verification failed: File was not created at '${filePath}'.` };
      }

      const readBuffer = await this.readBufferFromDisk(filePath);
      if (!readBuffer || readBuffer.length === 0) {
        return { success: false, error: `Verification failed: File at '${filePath}' was created with 0 bytes.` };
      }

      const verifyWb = XLSX.read(readBuffer, { type: 'array' });
      if (!verifyWb.SheetNames || !verifyWb.SheetNames.includes(monthlySheetName)) {
        return { success: false, error: `Verification failed: Sheet '${monthlySheetName}' was not found in created workbook.` };
      }

      return { success: true, filePath };
    } catch (err: unknown) {
      const errorMsg = this.formatDiskError(err, filePath);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Reads existing attendance records from an existing .xlsx workbook on disk.
   * Priority:
   * 1. '_AttendanceData' hidden sheet (lossless normalized records)
   * 2. 'Attendance' legacy flat sheet
   * 3. 'Attendance [Month]' structured monthly matrix sheet
   */
  async readExistingAttendance(filePath: string): Promise<StorageReadResult> {
    try {
      const fileBuffer = await this.readBufferFromDisk(filePath);
      if (!fileBuffer || fileBuffer.length === 0) {
        return {
          success: false,
          records: [],
          sheetNames: [],
          totalRecords: 0,
          message: `Unable to read file at ${filePath} (file is empty or unreadable).`,
          error: 'File is empty or could not be read',
        };
      }

      const workbook = XLSX.read(fileBuffer, { type: 'array' });
      const sheetNames = workbook.SheetNames || [];

      // 1. Check '_Metadata' hidden sheet
      let metaTimetable: Record<string, { id: string; name: string }[]> | undefined;
      let metaDateOverrides: Record<string, string[]> | undefined;
      if (sheetNames.includes(METADATA_SHEET_NAME)) {
        const wsMeta = workbook.Sheets[METADATA_SHEET_NAME];
        if (wsMeta) {
          const metaRows = XLSX.utils.sheet_to_json<(string | number)[]>(wsMeta, { header: 1 });
          if (metaRows.length > 1 && metaRows[1] && metaRows[1][0]) {
            try {
              const parsed = JSON.parse(String(metaRows[1][0]));
              if (parsed && typeof parsed === 'object') {
                if (parsed.weeklyTimetable) metaTimetable = parsed.weeklyTimetable;
                if (parsed.dateScheduleOverrides) metaDateOverrides = parsed.dateScheduleOverrides;
              }
            } catch {
              // Ignore malformed metadata
            }
          }
        }
      }

      // 2. Check '_Roster' hidden sheet for full student roster
      let existingRoster: Person[] | undefined;
      if (sheetNames.includes(ROSTER_SHEET_NAME)) {
        const wsRoster = workbook.Sheets[ROSTER_SHEET_NAME];
        if (wsRoster) {
          const rosterRows = XLSX.utils.sheet_to_json<(string | number)[]>(wsRoster, { header: 1 });
          if (rosterRows.length > 1) {
            existingRoster = [];
            for (let r = 1; r < rosterRows.length; r++) {
              const row = rosterRows[r];
              if (row && (row[0] || row[1])) {
                let roll = String(row[0] || '').trim();
                if (roll.endsWith('.0')) roll = roll.slice(0, -2);
                existingRoster.push({
                  id: String(row[4] || roll || `p_${r}`).trim(),
                  rollNumber: roll,
                  name: String(row[1] || '').trim(),
                  phone: row[2] ? String(row[2]).trim() : '',
                  email: row[3] ? String(row[3]).trim() : '',
                });
              }
            }
          }
        }
      }

      // 3. Check '_AttendanceData' hidden sheet
      let rawDataRecords: AttendanceRecord[] = [];
      if (sheetNames.includes(RAW_DATA_SHEET_NAME)) {
        const ws = workbook.Sheets[RAW_DATA_SHEET_NAME];
        if (ws) {
          const rawRows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
          if (rawRows.length > 1) {
            rawDataRecords = this.parseRawDataSheet(rawRows);
          }
        }
      }

      // 4. Check legacy 'Attendance' flat sheet
      let legacyRecords: AttendanceRecord[] = [];
      if (sheetNames.includes(ATTENDANCE_SHEET_NAME)) {
        const ws = workbook.Sheets[ATTENDANCE_SHEET_NAME];
        if (ws) {
          const rawRows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
          if (rawRows.length > 1) {
            legacyRecords = this.parseLegacyAttendanceSheet(rawRows);
          }
        }
      }

      // 5. Scan all structured monthly sheets ('Attendance July', etc.)
      const monthlyRecords: AttendanceRecord[] = [];
      const monthlyRosterMap = new Map<string, Person>();
      const monthlyDateOverrides: Record<string, string[]> = {};
      const monthlyTimetable: Record<string, { id: string; name: string }[]> = {};
      let detectedYear: number | undefined;
      let detectedMonthIndex: number | undefined;

      for (const sName of sheetNames) {
        const isMonthly =
          ((sName.startsWith('Attendance ') && sName !== ATTENDANCE_SHEET_NAME && sName !== RAW_DATA_SHEET_NAME) ||
            MONTH_NAMES.some((m) => sName.toLowerCase().includes(m.toLowerCase()))) &&
          sName !== SEARCH_SHEET_NAME &&
          sName !== ROSTER_SHEET_NAME &&
          sName !== METADATA_SHEET_NAME;

        if (isMonthly) {
          const ws = workbook.Sheets[sName];
          if (ws) {
            const parsed = this.parseMonthlyMatrixSheet(ws, sName);
            if (
              parsed.records.length > 0 ||
              parsed.roster.length > 0 ||
              Object.keys(parsed.dateScheduleOverrides).length > 0
            ) {
              monthlyRecords.push(...parsed.records);
              for (const p of parsed.roster) {
                const key = (p.rollNumber ? p.rollNumber.toLowerCase() : '') || p.id.toLowerCase();
                if (!monthlyRosterMap.has(key)) {
                  monthlyRosterMap.set(key, p);
                }
              }
              for (const [dateStr, subs] of Object.entries(parsed.dateScheduleOverrides)) {
                if (!monthlyDateOverrides[dateStr]) {
                  monthlyDateOverrides[dateStr] = [];
                }
                for (const s of subs) {
                  if (!monthlyDateOverrides[dateStr].includes(s)) {
                    monthlyDateOverrides[dateStr].push(s);
                  }
                }
              }
              for (const [wDay, subs] of Object.entries(parsed.weeklyTimetable)) {
                if (!monthlyTimetable[wDay]) {
                  monthlyTimetable[wDay] = [];
                }
                for (const sub of subs) {
                  if (!monthlyTimetable[wDay].some((existing) => existing.name.toLowerCase() === sub.name.toLowerCase())) {
                    monthlyTimetable[wDay].push(sub);
                  }
                }
              }
              if (detectedYear === undefined && parsed.year) {
                detectedYear = parsed.year;
              }
              if (detectedMonthIndex === undefined && parsed.monthIndex !== undefined) {
                detectedMonthIndex = parsed.monthIndex;
              }
            }
          }
        }
      }

      // 6. Merge records
      const recordsMap = new Map<string, AttendanceRecord>();
      const makeKey = (rec: AttendanceRecord) => {
        const rDate = String(rec.date || '').trim().toLowerCase();
        const rPerson = String(rec.rollNumber || rec.personId || '').trim().toLowerCase();
        const rClass = String(rec.className || '').trim().toLowerCase();
        return `${rDate}|${rPerson}|${rClass}`;
      };

      for (const r of monthlyRecords) recordsMap.set(makeKey(r), r);
      for (const r of legacyRecords) recordsMap.set(makeKey(r), r);
      for (const r of rawDataRecords) recordsMap.set(makeKey(r), r);

      const combinedRecords = Array.from(recordsMap.values());

      // 7. Resolve final roster
      let finalRoster = existingRoster && existingRoster.length > 0 ? existingRoster : Array.from(monthlyRosterMap.values());
      if (finalRoster.length === 0 && combinedRecords.length > 0) {
        const rosterSet = new Map<string, Person>();
        for (const r of combinedRecords) {
          const key = (r.rollNumber ? r.rollNumber.toLowerCase() : '') || r.personId.toLowerCase();
          if (!rosterSet.has(key)) {
            rosterSet.set(key, {
              id: r.personId || r.rollNumber || `p_${rosterSet.size + 1}`,
              name: r.personName || 'Unnamed',
              rollNumber: r.rollNumber || '',
            });
          }
        }
        finalRoster = Array.from(rosterSet.values());
      }

      // 8. Combine dateScheduleOverrides and timetable
      const combinedDateOverrides: Record<string, string[]> = {
        ...monthlyDateOverrides,
        ...(metaDateOverrides || {}),
      };

      for (const rec of combinedRecords) {
        if (!combinedDateOverrides[rec.date]) {
          combinedDateOverrides[rec.date] = [];
        }
        if (!combinedDateOverrides[rec.date].includes(rec.className)) {
          combinedDateOverrides[rec.date].push(rec.className);
        }
      }

      const combinedTimetable: Record<string, { id: string; name: string }[]> = {
        ...monthlyTimetable,
        ...(metaTimetable || {}),
      };

      if (detectedYear === undefined && combinedRecords.length > 0) {
        const dates = combinedRecords.map((r) => r.date).filter(Boolean).sort();
        if (dates.length > 0) {
          const latest = dates[dates.length - 1];
          const [y, m] = latest.split('-').map(Number);
          if (y) detectedYear = y;
          if (m) detectedMonthIndex = m - 1;
        }
      }

      const uniqueDates = Array.from(new Set(combinedRecords.map((r) => r.date)));

      return {
        success: true,
        records: combinedRecords,
        sheetNames,
        totalRecords: combinedRecords.length,
        roster: finalRoster,
        dateScheduleOverrides: combinedDateOverrides,
        weeklyTimetable: combinedTimetable,
        detectedYear,
        detectedMonthIndex,
        message: `Found ${combinedRecords.length} records and ${finalRoster.length} students across ${uniqueDates.length} session date(s).`,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        records: [],
        sheetNames: [],
        totalRecords: 0,
        message: `Failed to read existing workbook: ${errorMsg}`,
        error: errorMsg,
      };
    }
  }

  /**
   * Prepares, preserves existing records and sheets, writes structured workbook to disk,
   * and verifies readback.
   */
  async save(dataset: AttendanceDataset, customFilePath?: string): Promise<StorageSaveResult> {
    const validation = this.validate(dataset);
    if (!validation.isValid) {
      return {
        success: false,
        storageMode: this.id,
        destination: customFilePath || 'Rollvia_Attendance.xlsx',
        recordsCount: 0,
        timestamp: new Date().toISOString(),
        message: `Validation failed: ${validation.errors.join('; ')}`,
        error: validation.errors[0],
      };
    }

    const targetFilePath = await this.resolveTargetFilePath(customFilePath, dataset);

    try {
      let existingRecords: AttendanceRecord[] = [];
      let backupPath: string | null = null;
      const fileExists = await this.checkFileExists(targetFilePath);

      if (fileExists) {
        // Safe Rolling Backup: backup existing file before modifying
        backupPath = await this.createRollingBackup(targetFilePath);

        const readResult = await this.readExistingAttendance(targetFilePath);
        if (readResult.success && readResult.records) {
          existingRecords = readResult.records;
        }
      }

      // Read existing other sheets to preserve them
      let existingWorkbook: XLSX.WorkBook | undefined;
      if (fileExists) {
        const existingBuf = await this.readBufferFromDisk(targetFilePath);
        existingWorkbook = XLSX.read(existingBuf, { type: 'array' });
      }

      const workbook = this.buildWorkbookData(dataset, existingRecords, existingWorkbook);
      const outBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true }) as Uint8Array;

      await this.writeBufferToDisk(targetFilePath, outBuffer);

      // Strict disk verification
      const verification = await this.verifyFileOnDisk(targetFilePath, dataset);
      if (!verification.verified) {
        return {
          success: false,
          storageMode: this.id,
          destination: targetFilePath,
          recordsCount: 0,
          timestamp: new Date().toISOString(),
          message: `Save failed verification: ${verification.error || 'File on disk could not be verified'}`,
          error: verification.error,
        };
      }

      const { monthName } = parseMonthAndYear(dataset.date, dataset.metadata);
      const monthlySheetName = `Attendance ${monthName}`;

      return {
        success: true,
        storageMode: this.id,
        destination: targetFilePath,
        recordsCount: dataset.records.length,
        timestamp: new Date().toISOString(),
        message: `Successfully saved and verified ${dataset.records.length} records in sheet '${monthlySheetName}' and '${SEARCH_SHEET_NAME}'.${backupPath ? ' (Auto-backup created)' : ''} Total entries: ${verification.totalRecordsCount}.`,
        tabularSummary: {
          totalRows: verification.totalRowsCount ?? 0,
          columns: ['S.No.', 'Name', 'Roll No.', 'Dates...', 'Totals'],
        },
        details: {
          filePath: targetFilePath,
          backupPath: backupPath || undefined,
          fileSize: verification.fileSize ?? 0,
          sheetNames: verification.sheetNames,
          monthlySheet: monthlySheetName,
          totalRecordsCount: verification.totalRecordsCount ?? 0,
          newRecordsSaved: dataset.records.length,
          verified: true,
        },
      };
    } catch (err: unknown) {
      const errorMsg = this.formatDiskError(err, targetFilePath);
      return {
        success: false,
        storageMode: this.id,
        destination: targetFilePath,
        recordsCount: 0,
        timestamp: new Date().toISOString(),
        message: errorMsg,
        error: errorMsg,
      };
    }
  }

  /**
   * Builds the complete workbook containing:
   * 1. Attendance [Month] (structured matrix)
   * 2. Search (student lookup and summary)
   * 3. Other preserved sheets
   * 4. _AttendanceData (hidden normalized records)
   */
  public generateWorkbook(
    dataset: AttendanceDataset,
    existingRecords: AttendanceRecord[] = [],
    existingWorkbook?: XLSX.WorkBook
  ): XLSX.WorkBook {
    return this.buildWorkbookData(dataset, existingRecords, existingWorkbook);
  }

  private buildWorkbookData(
    dataset: AttendanceDataset,
    existingRecords: AttendanceRecord[],
    existingWorkbook?: XLSX.WorkBook
  ): XLSX.WorkBook {
    const { monthName, year, monthIndex } = parseMonthAndYear(dataset.date, dataset.metadata);
    const monthlySheetName = `Attendance ${monthName}`;

    // 1. Merge existing records with current session records (Deduplication)
    // Unique composite key: Date + Student ID/Roll + Class
    const recordsMap = new Map<string, AttendanceRecord>();

    const makeKey = (rec: AttendanceRecord) => {
      const rDate = String(rec.date || '').trim().toLowerCase();
      const rRoll = String(rec.rollNumber || rec.personId || '').trim().toLowerCase();
      const rClass = String(rec.className || '').trim().toLowerCase();
      return `${rDate}|${rRoll}|${rClass}`;
    };

    for (const rec of existingRecords) {
      recordsMap.set(makeKey(rec), rec);
    }

    for (const rec of dataset.records || []) {
      recordsMap.set(makeKey(rec), rec);
    }

    const allRecords = Array.from(recordsMap.values());

    // 2. Resolve student roster (preserving configured Rollvia order)
    const rosterMap = new Map<string, Person>();
    const orderedStudents: { id: string; name: string; rollNumber: string }[] = [];

    for (const p of dataset.roster || []) {
      const roll = p.rollNumber ? String(p.rollNumber).trim() : '';
      const cleanRoll = roll.startsWith('p_') ? '' : roll;
      const student = {
        id: p.id,
        name: p.name,
        rollNumber: cleanRoll || roll,
      };
      rosterMap.set(p.id.toLowerCase(), p);
      if (cleanRoll) rosterMap.set(cleanRoll.toLowerCase(), p);
      orderedStudents.push(student);
    }

    for (const rec of allRecords) {
      const pId = String(rec.personId || '').toLowerCase();
      const roll = String(rec.rollNumber || '').toLowerCase();
      if (!rosterMap.has(pId) && (!roll || !rosterMap.has(roll))) {
        const cleanRoll = rec.rollNumber && !String(rec.rollNumber).startsWith('p_') ? String(rec.rollNumber) : '';
        const fallbackStudent = {
          id: rec.personId || `p_${orderedStudents.length + 1}`,
          name: rec.personName || 'Unnamed Student',
          rollNumber: cleanRoll,
        };
        if (pId) rosterMap.set(pId, fallbackStudent as Person);
        if (cleanRoll) rosterMap.set(cleanRoll.toLowerCase(), fallbackStudent as Person);
        orderedStudents.push(fallbackStudent);
      }
    }

    // 3. Resolve dates and timetable subjects for this month
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const timetable = (dataset.metadata?.weeklyTimetable || {}) as WeeklyTimetable;
    const dateOverrides = (dataset.metadata?.dateScheduleOverrides || {}) as Record<string, string[]>;

    // Group records by date -> studentKey -> class -> status
    const recordsByDateStudentClass = new Map<string, Map<string, Map<string, AttendanceStatusValue>>>();
    for (const rec of allRecords) {
      const d = rec.date;
      if (!recordsByDateStudentClass.has(d)) {
        recordsByDateStudentClass.set(d, new Map());
      }
      const dateMap = recordsByDateStudentClass.get(d)!;
      const sKey = (rec.rollNumber && !String(rec.rollNumber).startsWith('p_') ? rec.rollNumber : rec.personId).toLowerCase();
      if (!dateMap.has(sKey)) {
        dateMap.set(sKey, new Map());
      }
      dateMap.get(sKey)!.set(String(rec.className).trim().toLowerCase(), rec.status);
    }

    const scheduledDates: {
      dateStr: string;
      dayNum: number;
      dateLabel: string;
      weekdayLabel: string;
      weekdayShort: string;
      subjects: string[];
    }[] = [];

    const monthShort = MONTH_SHORT[monthIndex] || 'Sep';
    const onlyRecordedDates = Boolean(dataset.metadata?.onlyRecordedDates);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const weekday = getWeekdayForDate(dateStr) as keyof WeeklyTimetable;
      const scheduledSubs = getSubjectsForDate(dateStr, timetable, dateOverrides);
      const dayTimetableSubjects = scheduledSubs.map((s) => s.name.trim());

      // Check if any records exist for this date with additional subjects
      const dateRecordsMap = recordsByDateStudentClass.get(dateStr);
      const recordSubjects = new Set<string>();
      if (dateRecordsMap) {
        for (const classMap of dateRecordsMap.values()) {
          for (const clsName of classMap.keys()) {
            recordSubjects.add(clsName);
          }
        }
      }

      const mergedSubjects = [...dayTimetableSubjects];
      for (const rSub of recordSubjects) {
        if (!mergedSubjects.some((s) => s.toLowerCase() === rSub.toLowerCase())) {
          const properRec = allRecords.find((r) => r.date === dateStr && r.className.toLowerCase() === rSub.toLowerCase());
          mergedSubjects.push(properRec ? properRec.className : rSub);
        }
      }

      const hasRecords = Boolean(dateRecordsMap && dateRecordsMap.size > 0);
      const isScheduled = mergedSubjects.length > 0;

      if (onlyRecordedDates) {
        if (hasRecords) {
          scheduledDates.push({
            dateStr,
            dayNum: d,
            dateLabel: `${d}-${monthShort}`,
            weekdayLabel: weekday,
            weekdayShort: weekday.slice(0, 3),
            subjects: mergedSubjects,
          });
        }
      } else {
        if (isScheduled || hasRecords) {
          scheduledDates.push({
            dateStr,
            dayNum: d,
            dateLabel: `${d}-${monthShort}`,
            weekdayLabel: weekday,
            weekdayShort: weekday.slice(0, 3),
            subjects: mergedSubjects,
          });
        }
      }
    }

    // Fallback if no dates were scheduled or recorded
    if (scheduledDates.length === 0) {
      const dStr = dataset.date;
      const parts = dStr.split('-').map(Number);
      const d = parts[2] || 1;
      const weekday = getWeekdayForDate(dStr);
      const subjects = dataset.classes ? dataset.classes.map((c) => c.name) : ['General'];
      scheduledDates.push({
        dateStr: dStr,
        dayNum: d,
        dateLabel: `${d}-${monthShort}`,
        weekdayLabel: weekday,
        weekdayShort: weekday.slice(0, 3),
        subjects,
      });
    }

    let totalSubjectCols = 0;
    for (const sd of scheduledDates) {
      totalSubjectCols += sd.subjects.length;
    }

    const colIndexTotalPresents = 3 + totalSubjectCols;
    const colIndexTotalAbsents = colIndexTotalPresents + 1;
    const colIndexTotalClasses = colIndexTotalAbsents + 1;
    const colIndexPercentage = colIndexTotalClasses + 1;
    const totalColumns = colIndexPercentage + 1;

    // ---------------------------------------------------------
    // BUILD SHEET 1: Attendance [Month] (Structured Matrix)
    // ---------------------------------------------------------
    const monthlyRows: (string | number)[][] = [];
    const merges: XLSX.Range[] = [];

    // Row 0 (Excel 1): Title Banner
    const titleRow = new Array(totalColumns).fill('');
    titleRow[0] = `${monthName} ${year}`;
    monthlyRows.push(titleRow);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalColumns - 1 } });

    // Row 1 (Excel 2): Date Header Row
    const dateHeaderRow = new Array(totalColumns).fill('');
    dateHeaderRow[0] = 'S.No.';
    dateHeaderRow[1] = 'Name';
    dateHeaderRow[2] = 'Roll No.';

    // Row 2 (Excel 3): Weekday Header Row
    const weekdayHeaderRow = new Array(totalColumns).fill('');

    // Row 3 (Excel 4): Subject Header Row
    const subjectHeaderRow = new Array(totalColumns).fill('');

    let currentCol = 3;
    for (const sd of scheduledDates) {
      const startCol = currentCol;
      const endCol = startCol + sd.subjects.length - 1;

      dateHeaderRow[startCol] = sd.dateLabel;
      weekdayHeaderRow[startCol] = sd.weekdayLabel;

      if (endCol > startCol) {
        merges.push({ s: { r: 1, c: startCol }, e: { r: 1, c: endCol } });
        merges.push({ s: { r: 2, c: startCol }, e: { r: 2, c: endCol } });
      }

      for (let sIdx = 0; sIdx < sd.subjects.length; sIdx++) {
        subjectHeaderRow[startCol + sIdx] = sd.subjects[sIdx];
      }

      currentCol += sd.subjects.length;
    }

    // S.No, Name, Roll No vertical merges across Rows 1 to 3 (Excel Rows 2-4)
    merges.push({ s: { r: 1, c: 0 }, e: { r: 3, c: 0 } });
    merges.push({ s: { r: 1, c: 1 }, e: { r: 3, c: 1 } });
    merges.push({ s: { r: 1, c: 2 }, e: { r: 3, c: 2 } });

    // Totals column headers
    dateHeaderRow[colIndexTotalPresents] = 'Total Presents';
    dateHeaderRow[colIndexTotalAbsents] = 'Total Absents';
    dateHeaderRow[colIndexTotalClasses] = 'Total Classes';
    dateHeaderRow[colIndexPercentage] = 'Percentage';

    merges.push({ s: { r: 1, c: colIndexTotalPresents }, e: { r: 3, c: colIndexTotalPresents } });
    merges.push({ s: { r: 1, c: colIndexTotalAbsents }, e: { r: 3, c: colIndexTotalAbsents } });
    merges.push({ s: { r: 1, c: colIndexTotalClasses }, e: { r: 3, c: colIndexTotalClasses } });
    merges.push({ s: { r: 1, c: colIndexPercentage }, e: { r: 3, c: colIndexPercentage } });

    monthlyRows.push(dateHeaderRow);
    monthlyRows.push(weekdayHeaderRow);
    monthlyRows.push(subjectHeaderRow);

    // Student Rows (Excel Rows 5 onward)
    const studentStatsMap = new Map<string, {
      student: { id: string; name: string; rollNumber: string };
      presents: number;
      absents: number;
      total: number;
      percentage: string;
    }>();

    orderedStudents.forEach((student, idx) => {
      const sNo = idx + 1;
      const row = new Array(totalColumns).fill('');
      row[0] = sNo;
      row[1] = student.name;
      row[2] = student.rollNumber || '';

      let colPointer = 3;
      let presentsCount = 0;
      let absentsCount = 0;

      const studentRollKey = student.rollNumber ? student.rollNumber.toLowerCase() : '';
      const studentIdKey = student.id.toLowerCase();

      for (const sd of scheduledDates) {
        const dateMap = recordsByDateStudentClass.get(sd.dateStr);

        for (const sub of sd.subjects) {
          let status: AttendanceStatusValue | '' = '';
          if (dateMap) {
            const studentMap = (studentRollKey && dateMap.get(studentRollKey)) || dateMap.get(studentIdKey);
            if (studentMap) {
              const stat = studentMap.get(sub.toLowerCase());
              if (stat) status = stat;
            }
          }

          if (status === 'Present') {
            row[colPointer] = 'P';
            presentsCount++;
          } else if (status === 'Absent') {
            row[colPointer] = 'A';
            absentsCount++;
          } else {
            row[colPointer] = ''; // Blank/unscheduled
          }

          colPointer++;
        }
      }

      const totalClasses = presentsCount + absentsCount;
      const percentage = totalClasses > 0
        ? ((presentsCount / totalClasses) * 100).toFixed(2) + '%'
        : '0.00%';

      row[colIndexTotalPresents] = presentsCount;
      row[colIndexTotalAbsents] = absentsCount;
      row[colIndexTotalClasses] = totalClasses;
      row[colIndexPercentage] = percentage;

      studentStatsMap.set(student.id, {
        student,
        presents: presentsCount,
        absents: absentsCount,
        total: totalClasses,
        percentage,
      });

      monthlyRows.push(row);
    });

    const wsMonthly = XLSX.utils.aoa_to_sheet(monthlyRows);
    wsMonthly['!merges'] = merges;

    // Apply column widths
    const cols = new Array(totalColumns).fill({ wch: 8 });
    cols[0] = { wch: 6 };  // S.No
    cols[1] = { wch: 22 }; // Name
    cols[2] = { wch: 11 }; // Roll No
    cols[colIndexTotalPresents] = { wch: 14 };
    cols[colIndexTotalAbsents] = { wch: 14 };
    cols[colIndexTotalClasses] = { wch: 14 };
    cols[colIndexPercentage] = { wch: 14 };
    wsMonthly['!cols'] = cols;

    // Frozen panes (Freeze columns A, B, C and header rows 1-4)
    wsMonthly['!freeze'] = { xSplit: 3, ySplit: 4 };
    wsMonthly['!views'] = [{
      state: 'frozen',
      xSplit: 3,
      ySplit: 4,
      topLeftCell: 'D5',
      activePane: 'bottomRight',
    }];

    // Apply formulas & cell styles to monthly sheet
    this.applyMonthlySheetStyles(wsMonthly, orderedStudents.length, 3, totalSubjectCols);

    // ---------------------------------------------------------
    // BUILD SHEET 2: Search Sheet
    // ---------------------------------------------------------
    const defaultStudent = orderedStudents[0] || { id: '1', name: 'N/A', rollNumber: '1' };
    const defaultStats = studentStatsMap.get(defaultStudent.id) || { presents: 0, absents: 0, total: 0, percentage: '0.00%' };

    // Calculate subject-wise breakdown for default student
    const subjectMap = new Map<string, { present: number; absent: number; total: number }>();
    for (const sd of scheduledDates) {
      for (const sub of sd.subjects) {
        if (!subjectMap.has(sub)) {
          subjectMap.set(sub, { present: 0, absent: 0, total: 0 });
        }
      }
    }

    const defaultStudentRollKey = defaultStudent.rollNumber ? defaultStudent.rollNumber.toLowerCase() : '';
    const defaultStudentIdKey = defaultStudent.id.toLowerCase();

    for (const sd of scheduledDates) {
      const dateMap = recordsByDateStudentClass.get(sd.dateStr);
      if (!dateMap) continue;
      const studentMap = (defaultStudentRollKey && dateMap.get(defaultStudentRollKey)) || dateMap.get(defaultStudentIdKey);
      if (!studentMap) continue;

      for (const sub of sd.subjects) {
        const stat = studentMap.get(sub.toLowerCase());
        const counts = subjectMap.get(sub) || { present: 0, absent: 0, total: 0 };
        if (stat === 'Present') {
          counts.present++;
          counts.total++;
        } else if (stat === 'Absent') {
          counts.absent++;
          counts.total++;
        }
        subjectMap.set(sub, counts);
      }
    }

    const searchRows: (string | number)[][] = [
      ['Student Attendance Summary & Search', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['Search Student by Roll No:', defaultStudent.rollNumber || '1', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['Student Monthly Summary', '', '', '', '', '', ''],
      ['Name:', defaultStudent.name, '', 'Roll No:', defaultStudent.rollNumber || '1', '', ''],
      ['Total Presents:', defaultStats.presents, '', 'Total Absents:', defaultStats.absents, '', ''],
      ['Total Classes:', defaultStats.total, '', 'Percentage:', defaultStats.percentage, '', ''],
      ['', '', '', '', '', '', ''],
      ['Subject-Wise Attendance Breakdown', '', '', '', '', '', ''],
      ['Subject', 'Presents', 'Absents', 'Total', 'Percentage'],
    ];

    for (const [sub, counts] of subjectMap.entries()) {
      const pct = counts.total > 0 ? ((counts.present / counts.total) * 100).toFixed(2) + '%' : '0.00%';
      searchRows.push([sub, counts.present, counts.absent, counts.total, pct]);
    }

    searchRows.push(['', '', '', '', '', '', '']);
    searchRows.push(['All Students Monthly Summary', '', '', '', '', '', '']);
    searchRows.push(['S.No.', 'Name', 'Roll No', 'Presents', 'Absents', 'Total', 'Percentage']);

    orderedStudents.forEach((st, idx) => {
      const stats = studentStatsMap.get(st.id) || { presents: 0, absents: 0, total: 0, percentage: '0.00%' };
      searchRows.push([
        idx + 1,
        st.name,
        st.rollNumber || '',
        stats.presents,
        stats.absents,
        stats.total,
        stats.percentage,
      ]);
    });

    const wsSearch = XLSX.utils.aoa_to_sheet(searchRows);
    wsSearch['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 6 } },
      { s: { r: 9, c: 0 }, e: { r: 9, c: 4 } },
    ];
    wsSearch['!cols'] = [
      { wch: 18 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];

    // ---------------------------------------------------------
    // BUILD SHEET 3: _AttendanceData (Hidden Normalized Storage)
    // ---------------------------------------------------------
    const rawHeaders = ['Date', 'Roll No', 'Name', 'Class', 'Status', 'Person ID', 'Marked At'];
    const rawDataRows: (string | number)[][] = [rawHeaders];

    allRecords.sort((a, b) => {
      const dCmp = String(a.date || '').localeCompare(String(b.date || ''));
      if (dCmp !== 0) return dCmp;
      const rCmp = String(a.rollNumber || '').localeCompare(String(b.rollNumber || ''), undefined, { numeric: true, sensitivity: 'base' });
      if (rCmp !== 0) return rCmp;
      return String(a.className || '').localeCompare(String(b.className || ''));
    });

    for (const r of allRecords) {
      const student = rosterMap.get(String(r.personId).toLowerCase()) || rosterMap.get(String(r.rollNumber).toLowerCase());
      const roll = r.rollNumber && !String(r.rollNumber).startsWith('p_')
        ? r.rollNumber
        : (student?.rollNumber && !String(student.rollNumber).startsWith('p_') ? student.rollNumber : '');
      rawDataRows.push([
        r.date,
        roll,
        r.personName,
        r.className,
        r.status,
        r.personId,
        r.markedAt || new Date().toISOString(),
      ]);
    }

    const wsRawData = XLSX.utils.aoa_to_sheet(rawDataRows);
    wsRawData['!cols'] = [
      { wch: 14 },
      { wch: 12 },
      { wch: 24 },
      { wch: 18 },
      { wch: 12 },
      { wch: 24 },
      { wch: 24 },
    ];

    // ---------------------------------------------------------
    // BUILD SHEET 4: _Roster (Hidden Roster Storage)
    // ---------------------------------------------------------
    const rosterHeaders = ['Roll No', 'Name', 'Phone', 'Email', 'Student ID'];
    const rosterDataRows: (string | number)[][] = [rosterHeaders];
    for (const s of orderedStudents) {
      const fullPerson = rosterMap.get(s.id.toLowerCase()) || (s.rollNumber ? rosterMap.get(s.rollNumber.toLowerCase()) : undefined);
      rosterDataRows.push([
        s.rollNumber,
        s.name,
        fullPerson?.phone || '',
        fullPerson?.email || '',
        s.id,
      ]);
    }
    const wsRoster = XLSX.utils.aoa_to_sheet(rosterDataRows);
    wsRoster['!cols'] = [
      { wch: 14 },
      { wch: 24 },
      { wch: 18 },
      { wch: 28 },
      { wch: 24 },
    ];

    // ---------------------------------------------------------
    // ASSEMBLE FINAL WORKBOOK
    // ---------------------------------------------------------
    const newWb = XLSX.utils.book_new();

    // 1. Monthly Attendance sheet
    XLSX.utils.book_append_sheet(newWb, wsMonthly, monthlySheetName);

    // 2. Search sheet
    XLSX.utils.book_append_sheet(newWb, wsSearch, SEARCH_SHEET_NAME);

    // 3. Other preserved sheets from existing workbook
    if (existingWorkbook && existingWorkbook.SheetNames) {
      for (const name of existingWorkbook.SheetNames) {
        if (
          name !== monthlySheetName &&
          name !== SEARCH_SHEET_NAME &&
          name !== RAW_DATA_SHEET_NAME &&
          name !== ROSTER_SHEET_NAME &&
          name !== METADATA_SHEET_NAME &&
          name !== ATTENDANCE_SHEET_NAME
        ) {
          const s = existingWorkbook.Sheets[name];
          if (s) {
            XLSX.utils.book_append_sheet(newWb, s, name);
          }
        }
      }
    }

    // 4. Raw Data sheet (Hidden)
    XLSX.utils.book_append_sheet(newWb, wsRawData, RAW_DATA_SHEET_NAME);

    // 5. Roster sheet (Hidden)
    XLSX.utils.book_append_sheet(newWb, wsRoster, ROSTER_SHEET_NAME);

    // 6. Metadata sheet (Hidden)
    const metaPayload = {
      version: 1,
      weeklyTimetable: dataset.metadata?.weeklyTimetable,
      dateScheduleOverrides: dataset.metadata?.dateScheduleOverrides,
    };
    const wsMetadata = XLSX.utils.aoa_to_sheet([['Metadata JSON'], [JSON.stringify(metaPayload)]]);
    XLSX.utils.book_append_sheet(newWb, wsMetadata, METADATA_SHEET_NAME);

    // Set Hidden sheets
    if (!newWb.Workbook) newWb.Workbook = { Sheets: [] };
    if (!newWb.Workbook.Sheets) newWb.Workbook.Sheets = [];

    const rawSheetIndex = newWb.SheetNames.indexOf(RAW_DATA_SHEET_NAME);
    if (rawSheetIndex >= 0) {
      newWb.Workbook.Sheets[rawSheetIndex] = { Hidden: 1 };
    }

    const rosterSheetIndex = newWb.SheetNames.indexOf(ROSTER_SHEET_NAME);
    if (rosterSheetIndex >= 0) {
      newWb.Workbook.Sheets[rosterSheetIndex] = { Hidden: 1 };
    }

    const metaSheetIndex = newWb.SheetNames.indexOf(METADATA_SHEET_NAME);
    if (metaSheetIndex >= 0) {
      newWb.Workbook.Sheets[metaSheetIndex] = { Hidden: 1 };
    }

    return newWb;
  }

  /**
   * Applies styling and formulas to the monthly Attendance worksheet.
   */
  private applyMonthlySheetStyles(
    ws: XLSX.WorkSheet,
    studentCount: number,
    subjectStartCol: number,
    totalSubjectCols: number
  ) {
    const colPres = subjectStartCol + totalSubjectCols;
    const colAbs = colPres + 1;
    const colTot = colAbs + 1;
    const colPct = colTot + 1;

    const presColLetter = XLSX.utils.encode_col(colPres);
    const absColLetter = XLSX.utils.encode_col(colAbs);
    const totColLetter = XLSX.utils.encode_col(colTot);
    const startSubjectLetter = XLSX.utils.encode_col(subjectStartCol);
    const endSubjectLetter = XLSX.utils.encode_col(subjectStartCol + totalSubjectCols - 1);

    for (let sIdx = 0; sIdx < studentCount; sIdx++) {
      const rowNum = 5 + sIdx; // 1-indexed Excel row

      // P and A cell formatting
      for (let c = subjectStartCol; c < subjectStartCol + totalSubjectCols; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: rowNum - 1, c });
        const cell = ws[cellRef];
        if (cell && cell.v === 'P') {
          cell.s = {
            font: { bold: true, color: { rgb: '276A3C' } },
            fill: { fgColor: { rgb: 'E2EFDA' } },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        } else if (cell && cell.v === 'A') {
          cell.s = {
            font: { bold: true, color: { rgb: 'C00000' } },
            fill: { fgColor: { rgb: 'FCE4D6' } },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        } else if (cell) {
          cell.s = {
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }
      }

      // Totals formulas
      if (totalSubjectCols > 0) {
        const presCellRef = XLSX.utils.encode_cell({ r: rowNum - 1, c: colPres });
        if (ws[presCellRef]) {
          ws[presCellRef].f = `COUNTIF(${startSubjectLetter}${rowNum}:${endSubjectLetter}${rowNum},"P")`;
        }

        const absCellRef = XLSX.utils.encode_cell({ r: rowNum - 1, c: colAbs });
        if (ws[absCellRef]) {
          ws[absCellRef].f = `COUNTIF(${startSubjectLetter}${rowNum}:${endSubjectLetter}${rowNum},"A")`;
        }

        const totCellRef = XLSX.utils.encode_cell({ r: rowNum - 1, c: colTot });
        if (ws[totCellRef]) {
          ws[totCellRef].f = `${presColLetter}${rowNum}+${absColLetter}${rowNum}`;
        }

        const pctCellRef = XLSX.utils.encode_cell({ r: rowNum - 1, c: colPct });
        if (ws[pctCellRef]) {
          ws[pctCellRef].f = `IF(${totColLetter}${rowNum}>0,${presColLetter}${rowNum}/${totColLetter}${rowNum},0)`;
          ws[pctCellRef].z = '0.00%';
        }
      }
    }
  }

  /**
   * Parses '_AttendanceData' sheet rows into AttendanceRecord[].
   */
  private parseRawDataSheet(rows: (string | number)[][]): AttendanceRecord[] {
    const records: AttendanceRecord[] = [];
    const headerRow = rows[0].map((h) => String(h || '').trim().toLowerCase());
    const dIdx = headerRow.findIndex((h) => h.includes('date'));
    const rIdx = headerRow.findIndex((h) => h.includes('roll'));
    const nIdx = headerRow.findIndex((h) => h.includes('name'));
    const cIdx = headerRow.findIndex((h) => h.includes('class') || h.includes('subject'));
    const sIdx = headerRow.findIndex((h) => h.includes('status'));
    const pIdx = headerRow.findIndex((h) => h.includes('person') || h.includes('id'));
    const mIdx = headerRow.findIndex((h) => h.includes('marked') || h.includes('time'));

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      const date = dIdx >= 0 ? String(r[dIdx] || '').trim() : '';
      const rollNumber = rIdx >= 0 ? String(r[rIdx] || '').trim() : '';
      const personName = nIdx >= 0 ? String(r[nIdx] || '').trim() : 'Unnamed';
      const className = cIdx >= 0 ? String(r[cIdx] || '').trim() : 'General';
      const statusRaw = sIdx >= 0 ? String(r[sIdx] || '').trim() : 'Absent';
      const status: AttendanceStatusValue = statusRaw.toLowerCase() === 'present' ? 'Present' : 'Absent';
      const personId = pIdx >= 0 && r[pIdx] ? String(r[pIdx]).trim() : (rollNumber || `p_${i}`);
      const markedAt = mIdx >= 0 && r[mIdx] ? String(r[mIdx]).trim() : undefined;

      if (date && (rollNumber || personName)) {
        records.push({
          id: `rec_${date}_${personId}_${className}`,
          date,
          personId,
          personName,
          rollNumber,
          className,
          status,
          markedAt,
        });
      }
    }
    return records;
  }

  /**
   * Parses legacy 'Attendance' flat sheet rows into AttendanceRecord[].
   */
  private parseLegacyAttendanceSheet(rows: (string | number)[][]): AttendanceRecord[] {
    return this.parseRawDataSheet(rows);
  }

  /**
   * Parses structured monthly matrix sheet ('Attendance July', 'Attendance September', etc.)
   * into AttendanceRecord[], Person[] roster, dateScheduleOverrides, and weeklyTimetable.
   */
  private parseMonthlyMatrixSheet(ws: XLSX.WorkSheet, sheetName: string): MonthlyMatrixParseResult {
    const emptyResult: MonthlyMatrixParseResult = {
      records: [],
      roster: [],
      dateScheduleOverrides: {},
      weeklyTimetable: {},
    };

    const rawRows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
    if (!rawRows || rawRows.length < 3) return emptyResult;

    // 1. Resolve month and year from sheetName and/or top banner rows
    let resolvedMonthIdx = -1;
    let resolvedYear = new Date().getFullYear();

    const sheetMonthMatch = sheetName.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/i
    );
    if (sheetMonthMatch) {
      const mStr = sheetMonthMatch[1].toLowerCase().slice(0, 3);
      const mIdx = MONTH_NAMES.findIndex((m) => m.toLowerCase().startsWith(mStr));
      if (mIdx >= 0) resolvedMonthIdx = mIdx;
    }
    const sheetYearMatch = sheetName.match(/\b(20\d\d)\b/);
    if (sheetYearMatch) {
      resolvedYear = parseInt(sheetYearMatch[1], 10);
    }

    // Inspect top rows (rows 0, 1, 2) for title like 'July 2026'
    for (let r = 0; r < Math.min(3, rawRows.length); r++) {
      const row = rawRows[r];
      if (!row) continue;
      for (const cell of row) {
        if (!cell) continue;
        const cellStr = String(cell).trim();
        if (resolvedMonthIdx === -1) {
          const mMatch = cellStr.match(
            /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/i
          );
          if (mMatch) {
            const mStr = mMatch[1].toLowerCase().slice(0, 3);
            const mIdx = MONTH_NAMES.findIndex((m) => m.toLowerCase().startsWith(mStr));
            if (mIdx >= 0) resolvedMonthIdx = mIdx;
          }
        }
        const yMatch = cellStr.match(/\b(20\d\d)\b/);
        if (yMatch) {
          resolvedYear = parseInt(yMatch[1], 10);
        }
      }
    }

    if (resolvedMonthIdx === -1) {
      resolvedMonthIdx = 6; // Default to July if unresolvable
    }

    // 2. Dynamically find first student row
    let firstStudentRow = -1;
    for (let r = 0; r < Math.min(15, rawRows.length); r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;
      const col0 = String(row[0] || '').trim();
      const col1 = String(row[1] || '').trim();
      const col2 = String(row[2] || '').trim();

      const isSNo1 = col0 === '1' || col0 === '01' || col0 === '1.';
      const isHeaderCol1 = /^(name|student|s\.?no|roll|candidate|total|percentage)$/i.test(col1);

      if (isSNo1 && col1 && !isHeaderCol1) {
        firstStudentRow = r;
        break;
      }

      if (col1 && !isHeaderCol1 && /^\d{5,}$/.test(col2)) {
        firstStudentRow = r;
        break;
      }
    }

    if (firstStudentRow === -1) {
      firstStudentRow = Math.min(4, Math.max(1, rawRows.length - 1));
    }

    // 3. Identify S.No, Name, Roll No columns from header rows (0 to firstStudentRow - 1)
    let sNoCol = 0;
    let nameCol = 1;
    let rollCol = 2;

    for (let r = 0; r < firstStudentRow; r++) {
      const row = rawRows[r];
      if (!row) continue;
      for (let c = 0; c < Math.min(6, row.length); c++) {
        const text = String(row[c] || '').trim().toLowerCase();
        if (/^(s\.?no|sl\.?no|serial|#)$/i.test(text)) sNoCol = c;
        if (/^(name|student\s*name|candidate\s*name)$/i.test(text)) nameCol = c;
        if (/^(roll|roll\s*no\.?|reg\s*no\.?|id|student\s*id)$/i.test(text)) rollCol = c;
      }
    }

    const subjectStartCol = Math.max(sNoCol, nameCol, rollCol) + 1;
    const maxCol = Math.max(...rawRows.slice(0, Math.min(firstStudentRow + 5, rawRows.length)).map((r) => (r ? r.length : 0)));

    // 4. Identify dateRowIndex and subjectRowIndex
    const isDatePattern = (str: string) => {
      const s = str.trim();
      if (!s) return false;
      const lower = s.toLowerCase();
      if (lower.includes('total') || lower.includes('percent') || lower.includes('class') || lower.includes('name') || lower.includes('roll')) return false;
      return (
        /\b\d{1,2}[\s\-/](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)/i.test(s) ||
        /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[\s\-/]\d{1,2}/i.test(s) ||
        /\b\d{1,2}[/-]\d{1,2}\b/.test(s) ||
        /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*[\s\-,]+\d{1,2}\b/i.test(s) ||
        /^\d{1,2}$/.test(s)
      );
    };

    let dateRowIndex = -1;
    let maxDateMatches = 0;

    for (let r = 0; r < firstStudentRow; r++) {
      const row = rawRows[r];
      if (!row) continue;
      let dateMatches = 0;
      for (let c = subjectStartCol; c < row.length; c++) {
        if (isDatePattern(String(row[c] || ''))) {
          dateMatches++;
        }
      }
      if (dateMatches > maxDateMatches) {
        maxDateMatches = dateMatches;
        dateRowIndex = r;
      }
    }

    let subjectRowIndex = Math.max(0, firstStudentRow - 1);
    if (subjectRowIndex === dateRowIndex && dateRowIndex > 0) {
      subjectRowIndex = dateRowIndex;
    }

    // 5. Map columns to resolved date and subject
    const columnMeta: { col: number; dateStr: string; subject: string; weekday: string }[] = [];
    let activeDateStr = '';
    let activeWeekday = '';

    const resolveWeekday = (w: string): string => {
      const lower = w.toLowerCase();
      if (lower.startsWith('mon')) return 'Monday';
      if (lower.startsWith('tue')) return 'Tuesday';
      if (lower.startsWith('wed')) return 'Wednesday';
      if (lower.startsWith('thu')) return 'Thursday';
      if (lower.startsWith('fri')) return 'Friday';
      if (lower.startsWith('sat')) return 'Saturday';
      if (lower.startsWith('sun')) return 'Sunday';
      return w;
    };

    const getWeekdayForDay = (y: number, m: number, d: number): string => {
      const dt = new Date(y, m, d);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[dt.getDay()];
    };

    for (let c = subjectStartCol; c < maxCol; c++) {
      // Check for date in dateRowIndex (or any header row above subjectRowIndex)
      for (let r = 0; r < firstStudentRow; r++) {
        if (r === subjectRowIndex && firstStudentRow > 1) continue;
        const cellVal = String(rawRows[r]?.[c] || '').trim();
        if (cellVal && isDatePattern(cellVal)) {
          const dayMatch = cellVal.match(/\b(\d{1,2})\b/);
          if (dayMatch) {
            const d = parseInt(dayMatch[1], 10);
            if (d >= 1 && d <= 31) {
              activeDateStr = `${resolvedYear}-${String(resolvedMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const wMatch = cellVal.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
              if (wMatch) {
                activeWeekday = resolveWeekday(wMatch[1]);
              } else {
                activeWeekday = getWeekdayForDay(resolvedYear, resolvedMonthIdx, d);
              }
            }
          }
        }
      }

      // Check subject in subjectRowIndex
      const rawSubject = String(rawRows[subjectRowIndex]?.[c] || '').trim();
      if (!rawSubject) continue;

      const subLower = rawSubject.toLowerCase();
      if (
        subLower.includes('total') ||
        subLower.includes('percent') ||
        subLower.includes('absent') ||
        subLower.includes('present') ||
        subLower.includes('classes') ||
        subLower === '%'
      ) {
        continue;
      }

      if (activeDateStr && rawSubject) {
        columnMeta.push({
          col: c,
          dateStr: activeDateStr,
          subject: rawSubject,
          weekday: activeWeekday || 'Wednesday',
        });
      }
    }

    // 6. Parse students and attendance records
    const records: AttendanceRecord[] = [];
    const roster: Person[] = [];

    for (let r = firstStudentRow; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const name = String(row[nameCol] || '').trim();
      let roll = String(row[rollCol] || '').trim();
      if (roll.endsWith('.0')) roll = roll.slice(0, -2);

      if (!name && !roll) continue;

      const checkFooter = (name + ' ' + roll).toLowerCase();
      if (checkFooter.includes('total') || checkFooter.includes('average') || checkFooter.includes('summary')) {
        continue;
      }

      const studentId = roll && !roll.startsWith('p_') ? roll : `std_${r - firstStudentRow + 1}`;
      roster.push({
        id: studentId,
        name: name || `Student ${r - firstStudentRow + 1}`,
        rollNumber: roll,
      });

      for (const cm of columnMeta) {
        const val = String(row[cm.col] || '').trim().toUpperCase();
        if (val === 'P' || val === 'A') {
          records.push({
            id: `rec_${cm.dateStr}_${studentId}_${cm.subject}`,
            date: cm.dateStr,
            personId: studentId,
            personName: name,
            rollNumber: roll,
            className: cm.subject,
            status: val === 'P' ? 'Present' : 'Absent',
          });
        }
      }
    }

    // 7. Build dateScheduleOverrides and weeklyTimetable
    const dateScheduleOverrides: Record<string, string[]> = {};
    const weeklyTimetable: Record<string, { id: string; name: string }[]> = {};

    for (const cm of columnMeta) {
      if (!dateScheduleOverrides[cm.dateStr]) {
        dateScheduleOverrides[cm.dateStr] = [];
      }
      if (!dateScheduleOverrides[cm.dateStr].includes(cm.subject)) {
        dateScheduleOverrides[cm.dateStr].push(cm.subject);
      }

      const wDay = cm.weekday;
      if (wDay) {
        if (!weeklyTimetable[wDay]) {
          weeklyTimetable[wDay] = [];
        }
        if (!weeklyTimetable[wDay].some((s) => s.name.toLowerCase() === cm.subject.toLowerCase())) {
          const safeId = `sub_${cm.subject.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
          weeklyTimetable[wDay].push({ id: safeId, name: cm.subject });
        }
      }
    }

    return {
      records,
      roster,
      dateScheduleOverrides,
      weeklyTimetable,
      year: resolvedYear,
      monthIndex: resolvedMonthIdx,
    };
  }

  // In-memory buffer store for testing or browser sandbox fallback
  private inMemoryFiles = new Map<string, Uint8Array>();

  private async resolveTargetFilePath(customFilePath: string | undefined, dataset: AttendanceDataset): Promise<string> {
    if (customFilePath && customFilePath.trim()) {
      return customFilePath.trim();
    }

    if (dataset.metadata && 'filePath' in dataset.metadata && typeof dataset.metadata.filePath === 'string') {
      return dataset.metadata.filePath;
    }

    const electronAPI = getElectronAPI();
    if (electronAPI?.getDefaultExcelPath) {
      const sanitizedDate = dataset.date.replace(/[^0-9a-zA-Z_-]/g, '_');
      const defaultName = `Rollvia_Attendance_${sanitizedDate}.xlsx`;
      return await electronAPI.getDefaultExcelPath(defaultName);
    }

    return `Rollvia_Attendance_${dataset.date}.xlsx`;
  }

  private async getNodeFS(): Promise<{
    existsSync: (path: string) => boolean;
    readFileSync: (path: string) => Uint8Array;
    writeFileSync: (path: string, data: Uint8Array) => void;
    mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
    statSync: (path: string) => { size: number };
  } | null> {
    const proc = (globalThis as Record<string, unknown>).process as { versions?: { node?: string } } | undefined;
    if (proc && proc.versions && proc.versions.node) {
      try {
        const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
        const rawMod = await dynamicImport('node:fs');
        return (rawMod.default || rawMod) as {
          existsSync: (path: string) => boolean;
          readFileSync: (path: string) => Uint8Array;
          writeFileSync: (path: string, data: Uint8Array) => void;
          mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
          statSync: (path: string) => { size: number };
        };
      } catch {
        return null;
      }
    }
    return null;
  }

  private async readBufferFromDisk(filePath: string): Promise<Uint8Array> {
    const electronAPI = getElectronAPI();
    if (electronAPI?.readExcelBuffer) {
      const res = await electronAPI.readExcelBuffer(filePath);
      if (!res.success || !res.data) {
        throw new Error(res.error || `Failed to read file from ${filePath}`);
      }
      return res.data;
    }

    const fsMod = await this.getNodeFS();
    if (fsMod && fsMod.existsSync(filePath)) {
      const buf = fsMod.readFileSync(filePath);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }

    if (this.inMemoryFiles.has(filePath)) {
      return this.inMemoryFiles.get(filePath)!;
    }

    throw new Error(`File not found: '${filePath}'. Please select an existing file or create a new workbook.`);
  }

  private async writeBufferToDisk(filePath: string, buffer: Uint8Array | ArrayBuffer): Promise<void> {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const electronAPI = getElectronAPI();
    if (electronAPI?.writeExcelBuffer) {
      const res = await electronAPI.writeExcelBuffer(filePath, uint8);
      if (!res.success) {
        throw new Error(res.error || `Failed to write file to ${filePath}`);
      }
      return;
    }

    const fsMod = await this.getNodeFS();
    if (fsMod) {
      try {
        const dir = filePath.replace(/[/\\][^/\\]+$/, '');
        if (dir && !fsMod.existsSync(dir)) {
          fsMod.mkdirSync(dir, { recursive: true });
        }
        fsMod.writeFileSync(filePath, uint8);
        this.inMemoryFiles.set(filePath, uint8);
        return;
      } catch (err) {
        console.error('writeBufferToDisk error:', err);
      }
    }

    this.inMemoryFiles.set(filePath, uint8);
  }

  private async checkFileExists(filePath: string): Promise<boolean> {
    const electronAPI = getElectronAPI();
    if (electronAPI?.verifyExcelFile) {
      const res = await electronAPI.verifyExcelFile(filePath);
      return res.exists;
    }

    const fsMod = await this.getNodeFS();
    if (fsMod) {
      try {
        return fsMod.existsSync(filePath);
      } catch {
        // Fallback to in-memory
      }
    }

    return this.inMemoryFiles.has(filePath);
  }

  private async verifyFileOnDisk(
    filePath: string,
    dataset: AttendanceDataset
  ): Promise<{
    verified: boolean;
    fileSize?: number;
    totalRowsCount?: number;
    totalRecordsCount?: number;
    sheetNames?: string[];
    error?: string;
  }> {
    let fileSize = 0;
    const electronAPI = getElectronAPI();

    if (electronAPI?.verifyExcelFile) {
      const statRes = await electronAPI.verifyExcelFile(filePath);
      if (!statRes.exists || !statRes.size) {
        return { verified: false, error: `File verification failed: '${filePath}' does not exist on disk or has 0 bytes.` };
      }
      fileSize = statRes.size;
    } else {
      const fsMod = await this.getNodeFS();
      if (fsMod && fsMod.existsSync(filePath)) {
        fileSize = fsMod.statSync(filePath).size;
      } else if (this.inMemoryFiles.has(filePath)) {
        fileSize = this.inMemoryFiles.get(filePath)!.length;
      } else {
        return { verified: false, error: `File verification failed: '${filePath}' was not created.` };
      }
    }

    const verifyBuffer = await this.readBufferFromDisk(filePath);
    if (!verifyBuffer || verifyBuffer.length === 0) {
      return { verified: false, error: 'File readback verification failed: empty buffer returned from disk.' };
    }

    const verifyWb = XLSX.read(verifyBuffer, { type: 'array' });
    const { monthName } = parseMonthAndYear(dataset.date, dataset.metadata);
    const monthlySheetName = `Attendance ${monthName}`;

    if (!verifyWb.SheetNames.includes(monthlySheetName)) {
      return {
        verified: false,
        error: `Verification failed: Worksheet '${monthlySheetName}' was not found in written file. Found sheets: [${verifyWb.SheetNames.join(', ')}]`,
      };
    }

    if (!verifyWb.SheetNames.includes(SEARCH_SHEET_NAME)) {
      return {
        verified: false,
        error: `Verification failed: Search worksheet '${SEARCH_SHEET_NAME}' was not found in written file.`,
      };
    }

    const wsMonthly = verifyWb.Sheets[monthlySheetName];
    const writtenRows = XLSX.utils.sheet_to_json<(string | number)[]>(wsMonthly, { header: 1 });

    if (writtenRows.length < 5) {
      return { verified: false, error: 'Verification failed: Written worksheet contains insufficient matrix rows.' };
    }

    let rawCount = 0;
    if (verifyWb.Sheets[RAW_DATA_SHEET_NAME]) {
      const rawRows = XLSX.utils.sheet_to_json<(string | number)[]>(verifyWb.Sheets[RAW_DATA_SHEET_NAME], { header: 1 });
      rawCount = Math.max(0, rawRows.length - 1);
    }

    return {
      verified: true,
      fileSize,
      totalRowsCount: writtenRows.length - 4, // data rows
      totalRecordsCount: rawCount,
      sheetNames: verifyWb.SheetNames,
    };
  }

  private formatDiskError(err: unknown, filePath: string): string {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('EBUSY') || msg.includes('locked') || msg.includes('permission denied') || msg.includes('EPERM')) {
      return `File Access Error: '${filePath}' is currently locked or open in Microsoft Excel or another application. Please close the file in Excel and try again.`;
    }
    if (msg.includes('ENOENT')) {
      return `Path Error: Directory for '${filePath}' does not exist or cannot be accessed.`;
    }
    return `Excel Save Error: ${msg}`;
  }

  /**
   * Resolves the standard backups directory for a given workbook path.
   */
  getBackupsDirectory(targetFilePath?: string): string {
    if (!targetFilePath) return '.rollvia_backups';
    const normalized = targetFilePath.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    const parentDir = lastSlash > 0 ? normalized.substring(0, lastSlash) : '.';
    return `${parentDir}/.rollvia_backups`;
  }

  /**
   * Creates a timestamped rolling backup copy of the existing workbook before overwriting.
   * Keeps the latest 15 backups to prevent data loss while bounding disk usage.
   */
  async createRollingBackup(targetFilePath: string): Promise<string | null> {
    try {
      const existingBuf = await this.readBufferFromDisk(targetFilePath);
      if (!existingBuf || existingBuf.length === 0) return null;

      const normalized = targetFilePath.replace(/\\/g, '/');
      const lastSlash = normalized.lastIndexOf('/');
      const parentDir = lastSlash > 0 ? normalized.substring(0, lastSlash) : '.';
      const fileName = lastSlash > 0 ? normalized.substring(lastSlash + 1) : normalized;
      const baseName = fileName.replace(/\.xlsx$/i, '');
      const backupDir = `${parentDir}/.rollvia_backups`;

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      const backupFilePath = `${backupDir}/${baseName}_backup_${timestamp}.xlsx`;

      await this.writeBufferToDisk(backupFilePath, existingBuf);

      // Keep latest 15 backups
      await this.pruneOldBackups(backupDir, baseName, 15);

      return backupFilePath;
    } catch (err) {
      console.warn('createRollingBackup warning (non-fatal):', err);
      return null;
    }
  }

  private async pruneOldBackups(backupDir: string, baseName: string, maxBackups = 15): Promise<void> {
    try {
      const fsMod = await this.getNodeFS();
      if (!fsMod) {
        // Prune in-memory files if running in browser / memory sandbox
        const prefix = `${backupDir}/${baseName}_backup_`;
        const memoryBackups = Array.from(this.inMemoryFiles.keys())
          .filter((k) => k.startsWith(prefix) && k.endsWith('.xlsx'))
          .sort();
        if (memoryBackups.length > maxBackups) {
          const toRemove = memoryBackups.slice(0, memoryBackups.length - maxBackups);
          for (const k of toRemove) this.inMemoryFiles.delete(k);
        }
        return;
      }

      const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
      const pathMod = await dynamicImport('node:path');
      const fsPromises = await dynamicImport('node:fs/promises');

      if (!fsMod.existsSync(backupDir)) return;

      const files: string[] = await fsPromises.readdir(backupDir);
      const prefix = `${baseName}_backup_`;
      const backupFiles = files
        .filter((f) => f.startsWith(prefix) && f.endsWith('.xlsx'))
        .sort()
        .map((f) => pathMod.join(backupDir, f));

      if (backupFiles.length > maxBackups) {
        const toDelete = backupFiles.slice(0, backupFiles.length - maxBackups);
        for (const filePath of toDelete) {
          try {
            await fsPromises.unlink(filePath);
          } catch {
            // Non-fatal
          }
        }
      }
    } catch {
      // In-memory or sandbox fallback
    }
  }
}
