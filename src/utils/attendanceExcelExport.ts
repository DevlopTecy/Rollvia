import * as XLSX from 'xlsx';
import type { AttendanceDataset, AttendanceRecord } from '../models/attendance';
import { storageManager } from '../storage';
import type { ExcelAdapter } from '../storage/adapters/ExcelAdapter';

export interface DownloadAttendanceExcelParams {
  dataset: AttendanceDataset;
  existingRecords?: AttendanceRecord[];
  filePath?: string;
}

/**
 * Downloads or exports the standard Rollvia Attendance Excel workbook
 * containing the structured monthly sheet, search dashboard, and hidden normalized data.
 */
export async function downloadAttendanceExcel(params: DownloadAttendanceExcelParams): Promise<{
  success: boolean;
  filePath?: string;
  error?: string;
}> {
  try {
    const adapter = storageManager.getAdapter('excel') as ExcelAdapter;
    if (!adapter) {
      return { success: false, error: 'Excel storage adapter is not available.' };
    }

    const { dataset, existingRecords = [], filePath } = params;
    const workbook = adapter.generateWorkbook(dataset, existingRecords);

    const safeDate = (dataset.date || new Date().toISOString().split('T')[0]).replace(/[^0-9a-zA-Z_-]/g, '_');
    const defaultName = filePath ? filePath.split(/[/\\]/).pop() || `Rollvia_Attendance_${safeDate}.xlsx` : `Rollvia_Attendance_${safeDate}.xlsx`;

    // 1. Electron environment with native save dialog
    if (
      window.electronAPI &&
      typeof window.electronAPI.saveExcelDialog === 'function' &&
      typeof window.electronAPI.writeExcelBuffer === 'function'
    ) {
      const saveRes = await window.electronAPI.saveExcelDialog(defaultName);
      if (saveRes.canceled || !saveRes.filePath) {
        return { success: false, error: 'Save was cancelled.' };
      }

      const outBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true }) as ArrayBuffer;
      const uint8 = new Uint8Array(outBuffer);
      const writeRes = await window.electronAPI.writeExcelBuffer(saveRes.filePath, uint8);

      if (writeRes.success) {
        // Also save to storage manager so session state remains in sync
        try {
          await storageManager.saveAttendance(dataset, saveRes.filePath);
        } catch {
          // Non-blocking
        }
        return { success: true, filePath: saveRes.filePath };
      }
      return { success: false, error: writeRes.error || 'Failed to write Excel file to disk.' };
    }

    // 2. Browser download fallback
    const outBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true }) as ArrayBuffer;
    const blob = new Blob([outBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = defaultName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Save in storage manager in-memory
    try {
      await storageManager.saveAttendance(dataset, filePath);
    } catch {
      // Non-blocking
    }

    return { success: true, filePath: defaultName };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to export Attendance Excel workbook.';
    return { success: false, error: msg };
  }
}
