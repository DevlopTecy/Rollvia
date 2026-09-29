import * as XLSX from 'xlsx';
import type { MonthlyAttendanceMatrix } from './monthlyAttendanceSummary';

/**
 * Builds an Excel Workbook representing the Monthly Attendance Summary Matrix
 * structured identically to the college attendance summary spreadsheet format.
 */
export function generateMonthlySummaryWorkbook(matrix: MonthlyAttendanceMatrix): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 1. Build 2D array of rows
  const row0: (string | number | null)[] = ['', '']; // Grouped Month Headers
  const row1: (string | number | null)[] = ['Registration Number', 'Name of the student']; // Subheaders
  const merges: XLSX.Range[] = [];

  let currentCol = 2; // Column index after Registration Number & Name

  // Build header rows for each month
  for (const group of matrix.monthGroups) {
    const colCount = group.subjects.length + 1; // subjects + Month Total
    const startCol = currentCol;
    const endCol = currentCol + colCount - 1;

    // Row 0: Merged month label
    row0[startCol] = `${group.monthName} (Total No. Of Classes: ${group.totalClasses})`;
    for (let c = startCol + 1; c <= endCol; c++) {
      row0[c] = null;
    }

    merges.push({
      s: { r: 0, c: startCol },
      e: { r: 0, c: endCol },
    });

    // Row 1: Subjects + Total
    for (const sub of group.subjects) {
      row1[currentCol] = `${sub.subjectName}(${sub.totalClasses})`;
      currentCol++;
    }

    row1[currentCol] = 'Total';
    currentCol++;
  }

  // Row 0 & Row 1: Overall Summary columns (Present, Absent, Total, Attendance %)
  const summaryStartCol = currentCol;
  row0[summaryStartCol] = 'Overall Summary';
  row0[summaryStartCol + 1] = null;
  row0[summaryStartCol + 2] = null;
  row0[summaryStartCol + 3] = null;
  merges.push({
    s: { r: 0, c: summaryStartCol },
    e: { r: 0, c: summaryStartCol + 3 },
  });

  row1[summaryStartCol] = 'Present';
  row1[summaryStartCol + 1] = 'Absent';
  row1[summaryStartCol + 2] = 'Total';
  row1[summaryStartCol + 3] = 'Attendance %';

  const dataRows: (string | number | null)[][] = [row0, row1];

  // 2. Build Student Data Rows
  for (const sRow of matrix.students) {
    const row: (string | number | null)[] = [
      sRow.student.rollNumber || '—',
      sRow.student.name || 'Unnamed',
    ];

    for (let gIdx = 0; gIdx < matrix.monthGroups.length; gIdx++) {
      const group = matrix.monthGroups[gIdx];
      const mData = sRow.monthlyData[gIdx];

      for (const sub of group.subjects) {
        const attended = mData?.subjectAttended[sub.subjectName] ?? 0;
        row.push(attended);
      }

      const mTotal = mData?.monthTotalAttended ?? 0;
      row.push(mTotal);
    }

    // Overall summary values: Present, Absent, Total, Attendance %
    row.push(sRow.overallPresent);
    row.push(sRow.overallAbsent);
    row.push(sRow.overallTotal);
    row.push(`${sRow.overallPercentage.toFixed(1)}%`);

    dataRows.push(row);
  }

  // 3. Create worksheet from array of arrays
  const ws = XLSX.utils.aoa_to_sheet(dataRows);

  // Set merges
  ws['!merges'] = merges;

  // Set column widths
  const colWidths: { wch: number }[] = [
    { wch: 22 }, // Registration Number
    { wch: 32 }, // Name of the student
  ];

  for (const group of matrix.monthGroups) {
    for (let i = 0; i < group.subjects.length; i++) {
      colWidths.push({ wch: 14 }); // Subject
    }
    colWidths.push({ wch: 12 }); // Month Total
  }

  // Summary columns
  colWidths.push({ wch: 14 }); // Present
  colWidths.push({ wch: 14 }); // Absent
  colWidths.push({ wch: 14 }); // Total
  colWidths.push({ wch: 16 }); // Attendance %

  ws['!cols'] = colWidths;

  // Set freeze panes: freeze top 2 rows and left 2 columns
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ws as any)['!views'] = [
    {
      state: 'frozen',
      xSplit: 2,
      ySplit: 2,
      topLeftCell: 'C3',
      activeCell: 'C3',
    },
  ];

  const sheetName =
    matrix.monthGroups.length === 1
      ? `${matrix.monthGroups[0].monthName} Summary`
      : 'Monthly Attendance Summary';

  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  return wb;
}

/**
 * Downloads the Monthly Attendance Summary as an Excel spreadsheet file (.xlsx).
 * Handles both Electron desktop environment (save dialog) and standard browser download.
 */
export async function downloadMonthlySummaryExcel(matrix: MonthlyAttendanceMatrix): Promise<{
  success: boolean;
  filePath?: string;
  error?: string;
}> {
  try {
    const wb = generateMonthlySummaryWorkbook(matrix);
    const safeYear = matrix.selectedYear || new Date().getFullYear();
    const safeRange = matrix.monthRangeLabel.replace(/[\s–—]+/g, '_');
    const fileName = `Rollvia_Monthly_Summary_${safeYear}_${safeRange}.xlsx`;

    // 1. Electron save dialog if supported
    if (window.electronAPI && typeof window.electronAPI.saveExcelDialog === 'function' && typeof window.electronAPI.writeExcelBuffer === 'function') {
      const saveRes = await window.electronAPI.saveExcelDialog(fileName);
      if (saveRes.canceled || !saveRes.filePath) {
        return { success: false, error: 'Save was cancelled.' };
      }

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
      const uint8 = new Uint8Array(excelBuffer);
      const writeRes = await window.electronAPI.writeExcelBuffer(saveRes.filePath, uint8);
      if (writeRes.success) {
        return { success: true, filePath: saveRes.filePath };
      }
      return { success: false, error: writeRes.error || 'Failed to write Excel file.' };
    }

    // 2. Standard browser download fallback
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, filePath: fileName };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to export Excel report.';
    return { success: false, error: msg };
  }
}
