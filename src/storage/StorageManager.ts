import type { AttendanceDataset } from '../models/attendance';
import type { StorageMode } from '../types';
import type { StorageAdapter, StorageSaveResult, StorageValidationResult, StorageReadResult } from './types';
import { GoogleSheetsAdapter } from './adapters/GoogleSheetsAdapter';
import { ExcelAdapter } from './adapters/ExcelAdapter';

/**
 * Storage Manager.
 *
 * Central dispatcher acting as the storage abstraction layer between the
 * Rollvia application and specific storage implementations (Google Sheets, Excel, etc.).
 *
 * Architecture:
 * Attendance App  ->  AttendanceDataset  ->  StorageManager  ->  StorageAdapter (Google Sheets | Excel)
 */
export class StorageManager {
  private adapters = new Map<StorageMode, StorageAdapter>();

  constructor() {
    this.registerAdapter(new GoogleSheetsAdapter());
    this.registerAdapter(new ExcelAdapter());
  }

  /**
   * Registers a new storage adapter.
   */
  registerAdapter(adapter: StorageAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  /**
   * Checks whether an adapter is registered for a given storage mode.
   */
  hasAdapter(mode: StorageMode): boolean {
    return this.adapters.has(mode);
  }

  /**
   * Retrieves the storage adapter for a given mode.
   * Throws if no matching adapter is registered.
   */
  getAdapter(mode: StorageMode): StorageAdapter {
    const adapter = this.adapters.get(mode);
    if (!adapter) {
      throw new Error(`No storage adapter registered for storage mode '${mode}'.`);
    }
    return adapter;
  }

  /**
   * Validates dataset using the appropriate adapter.
   */
  validate(dataset: AttendanceDataset): StorageValidationResult {
    const adapter = this.getAdapter(dataset.storageMode);
    return adapter.validate(dataset);
  }

  /**
   * Executes attendance save through the active adapter.
   */
  async saveAttendance(dataset: AttendanceDataset, customFilePath?: string): Promise<StorageSaveResult> {
    const adapter = this.getAdapter(dataset.storageMode);
    return adapter.save(dataset, customFilePath);
  }

  /**
   * Reads existing attendance records from an Excel workbook on disk.
   */
  async readExistingWorkbook(filePath: string): Promise<StorageReadResult> {
    const adapter = this.getAdapter('excel');
    if (adapter.readExistingAttendance) {
      return adapter.readExistingAttendance(filePath);
    }
    return {
      success: false,
      records: [],
      sheetNames: [],
      totalRecords: 0,
      message: 'Reading existing attendance is not supported for this adapter.',
      error: 'Not supported',
    };
  }

  /**
   * Immediately creates and verifies an empty Attendance Excel workbook on disk.
   */
  async createNewWorkbook(filePath: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
    const adapter = this.getAdapter('excel');
    if ('createEmptyWorkbook' in adapter && typeof (adapter as ExcelAdapter).createEmptyWorkbook === 'function') {
      return (adapter as ExcelAdapter).createEmptyWorkbook(filePath);
    }
    return {
      success: false,
      error: 'Creating new workbook is not supported for this adapter.',
    };
  }

  /**
   * Returns a list of all registered storage modes.
   */
  getSupportedModes(): StorageMode[] {
    return Array.from(this.adapters.keys());
  }
}

/**
 * Singleton instance of StorageManager.
 */
export const storageManager = new StorageManager();
