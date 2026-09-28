import type { AttendanceDataset, AttendanceRecord } from '../models/attendance';
import type { StorageMode, Person } from '../types';

/**
 * Tabular 2D structure shared across spreadsheet storage destinations.
 */
export interface TabularData {
  headers: string[];
  rows: (string | number)[][];
}

/**
 * Validation result before committing data to storage.
 */
export interface StorageValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Result returned by a storage adapter after persisting or previewing data.
 */
export interface StorageSaveResult {
  success: boolean;
  destination: string;
  storageMode: StorageMode;
  recordsCount: number;
  timestamp: string;
  message: string;
  tabularSummary?: {
    totalRows: number;
    columns: string[];
  };
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Result of reading existing attendance from a storage workbook.
 */
export interface StorageReadResult {
  success: boolean;
  records: AttendanceRecord[];
  sheetNames: string[];
  totalRecords: number;
  message: string;
  error?: string;
  roster?: Person[];
}

/**
 * Storage Adapter Interface.
 *
 * Defines the contract that any attendance storage target must fulfill.
 * This decouples the core Rollvia application logic from specific persistence
 * engines (Google Sheets, Excel, CSV, databases, etc.).
 */
export interface StorageAdapter {
  /** Target identifier matching StorageMode ('google_sheets' | 'excel') */
  readonly id: StorageMode;
  /** Human-readable display label */
  readonly displayName: string;
  /** Short summary of what this adapter targets */
  readonly description: string;
  /** Primary file extension if file-based (e.g. '.xlsx') */
  readonly fileExtension?: string;

  /**
   * Validates dataset requirements before export.
   */
  validate(dataset: AttendanceDataset): StorageValidationResult;

  /**
   * Converts the unified AttendanceDataset into adapter-specific tabular data.
   */
  toTabularData(dataset: AttendanceDataset): TabularData;

  /**
   * Prepares, preserves existing records/unrelated sheets, and persists the attendance dataset.
   */
  save(dataset: AttendanceDataset, customFilePath?: string): Promise<StorageSaveResult>;

  /**
   * Formats individual records for quick streaming or row-level updates.
   */
  formatRecord(record: AttendanceRecord): (string | number)[];

  /**
   * Reads existing attendance records from an existing storage destination if supported.
   */
  readExistingAttendance?(filePath: string): Promise<StorageReadResult>;
}
