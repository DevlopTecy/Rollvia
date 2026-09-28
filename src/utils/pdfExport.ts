import type { Person, StudentAttendanceProfile } from '../types';
import { parsePercentage } from './thresholds';

/**
 * Escapes text for PDF literal strings (parentheses, backslashes).
 */
function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

const encoder = new TextEncoder();

function getByteLength(str: string): number {
  return encoder.encode(str).length;
}

/**
 * Returns RGB color components for the attendance percentage.
 * >= 75%: green, >= 60%: orange, < 60%: red
 */
function getPctColor(pct: number): [number, number, number] {
  if (pct >= 75) return [0.1, 0.6, 0.2];   // green
  if (pct >= 60) return [0.8, 0.45, 0.05];  // orange
  return [0.75, 0.2, 0.2];                   // red
}

export interface MonthlyPdfData {
  institutionName?: string;
  departmentName?: string;
  academicYear?: string;
  monthStr: string;
  roster: Person[];
  profiles: Map<string, StudentAttendanceProfile> | Record<string, StudentAttendanceProfile>;
  savedDatesCount: number;
  holidaysCount: number;
}

export function generateMonthlyAttendancePdfBuffer(data: MonthlyPdfData): Uint8Array {
  const yearFromMonth = data.monthStr ? data.monthStr.split(' ')[1] : '';
  const fallbackAcademicYear = yearFromMonth || String(new Date().getFullYear());

  const {
    institutionName = 'Apex Institute of Science & Technology',
    departmentName = 'Department of Computer Science & Engineering',
    academicYear = fallbackAcademicYear,
    monthStr,
    roster,
    profiles,
    savedDatesCount,
    holidaysCount,
  } = data;

  const pageW = 842; // A4 Landscape width in points
  const pageH = 595; // A4 Landscape height in points

  const maxRowsPage1 = 24;
  const maxRowsSubsequent = 26;
  const totalStudents = roster.length;

  let totalPages = 1;
  if (totalStudents > maxRowsPage1) {
    totalPages = 1 + Math.ceil((totalStudents - maxRowsPage1) / maxRowsSubsequent);
  }

  const colX = [36, 66, 140, 340, 420, 490, 560, 660];
  const headers = ['#', 'Roll No', 'Student Name', 'Total Classes', 'Present', 'Absent', 'Percentage'];
  const rowHeight = 17;

  // Generate content stream operations for each page
  const pageContentStreams: string[] = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const isFirstPage = pageIdx === 0;
    const startIdx = isFirstPage ? 0 : maxRowsPage1 + (pageIdx - 1) * maxRowsSubsequent;
    const maxRows = isFirstPage ? maxRowsPage1 : maxRowsSubsequent;
    const endIdx = Math.min(totalStudents, startIdx + maxRows);
    const studentsOnPage = roster.slice(startIdx, endIdx);

    const streamOps: string[] = [];

    // Helper drawing primitives for this page
    const fillRect = (x: number, y: number, w: number, h: number, r: number, g: number, b: number) => {
      streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
      streamOps.push(`${x} ${y} ${w} ${h} re f`);
    };

    const strokeLine = (x1: number, y1: number, x2: number, y2: number, r = 0.8, g = 0.8, b = 0.8) => {
      streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
      streamOps.push(`0.5 w`);
      streamOps.push(`${x1} ${y1} m ${x2} ${y2} l S`);
    };

    const drawText = (
      text: string,
      x: number,
      y: number,
      size: number,
      isBold = false,
      r = 0.1,
      g = 0.1,
      b = 0.1
    ) => {
      const font = isBold ? '/F2' : '/F1';
      const escaped = escapePdfText(text);
      streamOps.push('BT');
      streamOps.push(`${font} ${size} Tf`);
      streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
      streamOps.push(`1 0 0 1 ${x} ${y} Tm`);
      streamOps.push(`(${escaped}) Tj`);
      streamOps.push('ET');
    };

    let tableTop = pageH - 122;

    if (isFirstPage) {
      // 1. Header Banner background (Page 1)
      fillRect(36, pageH - 72, pageW - 72, 44, 0.95, 0.96, 0.98);
      strokeLine(36, pageH - 72, pageW - 36, pageH - 72, 0.85, 0.88, 0.92);

      // Header Titles
      drawText('Rollvia - Monthly Attendance Report', 48, pageH - 46, 14, true, 0.08, 0.15, 0.3);
      drawText(
        `${monthStr} | ${institutionName} - ${departmentName} (${academicYear})`,
        48,
        pageH - 62,
        8.5,
        false,
        0.35,
        0.4,
        0.48
      );

      // Top Metrics Strip
      const statsY = pageH - 96;
      fillRect(36, statsY - 4, pageW - 72, 18, 0.98, 0.98, 0.99);
      drawText(`Total Enrolled: ${roster.length}`, 48, statsY, 8, true, 0.2, 0.25, 0.35);
      drawText(`Recorded Days: ${savedDatesCount}`, 160, statsY, 8, true, 0.1, 0.55, 0.25);
      drawText(`Holidays / No Classes: ${holidaysCount}`, 280, statsY, 8, true, 0.7, 0.45, 0.1);
      drawText(`Generated on: ${new Date().toLocaleDateString()}`, pageW - 190, statsY, 7.5, false, 0.5, 0.5, 0.5);

      tableTop = pageH - 122;
    } else {
      // 1. Compact continuation header banner (Page 2+)
      fillRect(36, pageH - 54, pageW - 72, 26, 0.95, 0.96, 0.98);
      strokeLine(36, pageH - 54, pageW - 36, pageH - 54, 0.85, 0.88, 0.92);

      drawText('Rollvia - Monthly Attendance Report (Continued)', 48, pageH - 43, 11, true, 0.08, 0.15, 0.3);
      drawText(
        `${monthStr} | ${institutionName} - ${departmentName} (${academicYear})`,
        380,
        pageH - 43,
        8,
        false,
        0.35,
        0.4,
        0.48
      );

      tableTop = pageH - 80;
    }

    // 2. Table Header (Repeated on every page)
    fillRect(36, tableTop, pageW - 72, 18, 0.92, 0.94, 0.97);
    strokeLine(36, tableTop, pageW - 36, tableTop, 0.8, 0.82, 0.86);

    headers.forEach((h, idx) => {
      drawText(h, colX[idx] + 4, tableTop + 5, 7.5, true, 0.2, 0.25, 0.35);
    });

    // 3. Table Rows for this page
    studentsOnPage.forEach((person, pageRowIdx) => {
      const globalIdx = startIdx + pageRowIdx;
      const y = tableTop - (pageRowIdx + 1) * rowHeight;
      const isEven = globalIdx % 2 === 0;

      if (isEven) {
        fillRect(36, y, pageW - 72, rowHeight, 0.99, 0.99, 1.0);
      } else {
        fillRect(36, y, pageW - 72, rowHeight, 0.96, 0.97, 0.98);
      }
      strokeLine(36, y, pageW - 36, y, 0.9, 0.92, 0.94);

      const prof = profiles instanceof Map
        ? profiles.get(person.id)
        : (profiles as Record<string, StudentAttendanceProfile>)?.[person.id];
      const total = prof ? prof.totalClasses : 0;
      const present = prof ? prof.presentClasses : 0;
      const absent = prof ? prof.absentClasses : 0;
      const pct = prof ? prof.overallPercentage : '0.0%';
      const pctNum = parsePercentage(pct);
      const [pr, pg, pb] = getPctColor(pctNum);

      drawText(String(globalIdx + 1), colX[0] + 6, y + 4.5, 7.5, false, 0.4, 0.45, 0.5);
      drawText(person.rollNumber || '—', colX[1] + 4, y + 4.5, 7.5, false, 0.15, 0.4, 0.7);
      drawText(person.name || 'Unnamed', colX[2] + 4, y + 4.5, 7.5, true, 0.1, 0.1, 0.15);
      drawText(String(total), colX[3] + 16, y + 4.5, 7.5, false, 0.3, 0.3, 0.3);
      drawText(String(present), colX[4] + 16, y + 4.5, 7.5, true, 0.1, 0.6, 0.2);
      drawText(String(absent), colX[5] + 16, y + 4.5, 7.5, true, 0.75, 0.2, 0.2);
      drawText(pct, colX[6] + 14, y + 4.5, 7.5, true, pr, pg, pb);
    });

    // Table bottom border
    const tableBottomY = tableTop - studentsOnPage.length * rowHeight;
    strokeLine(36, tableBottomY, pageW - 36, tableBottomY, 0.8, 0.82, 0.86);

    // 4. Footer Note & Page Number (Repeated on every page)
    strokeLine(36, 42, pageW - 36, 42, 0.9, 0.92, 0.94);
    drawText(
      `Official attendance export generated via Rollvia \u2022 ${monthStr} \u2022 Attendance colors: Green \u226575% \u00b7 Orange 60\u201374% \u00b7 Red <60%`,
      48,
      28,
      7,
      false,
      0.5,
      0.55,
      0.6
    );

    const pageNumText = `Page ${pageIdx + 1} of ${totalPages}`;
    drawText(pageNumText, pageW - 110, 28, 7.5, true, 0.4, 0.45, 0.5);

    pageContentStreams.push(streamOps.join('\n'));
  }

  // 4. Assemble PDF Object Tree
  const pdfParts: string[] = [];
  const offsets: number[] = [];
  let currentOffset = 0;

  const addPart = (str: string) => {
    pdfParts.push(str);
    currentOffset += getByteLength(str);
  };

  addPart('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  // Object 1: Catalog
  offsets[1] = currentOffset;
  addPart('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Object 2: Pages root
  const pageKids = Array.from({ length: totalPages }, (_, i) => `${5 + i * 2} 0 R`).join(' ');
  offsets[2] = currentOffset;
  addPart(`2 0 obj\n<< /Type /Pages /Kids [${pageKids}] /Count ${totalPages} >>\nendobj\n`);

  // Object 3: Font F1 (Helvetica)
  offsets[3] = currentOffset;
  addPart('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  // Object 4: Font F2 (Helvetica-Bold)
  offsets[4] = currentOffset;
  addPart('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');

  // Page and Content Stream Objects
  for (let i = 0; i < totalPages; i++) {
    const pageObjId = 5 + i * 2;
    const contentObjId = 6 + i * 2;
    const contentStream = pageContentStreams[i];
    const streamLen = getByteLength(contentStream);

    // Page Object
    offsets[pageObjId] = currentOffset;
    addPart(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`
    );

    // Content Stream Object
    offsets[contentObjId] = currentOffset;
    addPart(
      `${contentObjId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${contentStream}\nendstream\nendobj\n`
    );
  }

  const totalObjs = 4 + totalPages * 2;

  // Xref table
  const startXref = currentOffset;
  addPart(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= totalObjs; i++) {
    const off = String(offsets[i]).padStart(10, '0');
    addPart(`${off} 00000 n \n`);
  }

  // Trailer
  addPart(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`);

  const fullPdfStr = pdfParts.join('');
  return encoder.encode(fullPdfStr);
}

/**
 * Downloads the Monthly Attendance Report PDF in the browser environment.
 */
export function downloadMonthlyAttendancePdf(data: MonthlyPdfData) {
  const buffer = generateMonthlyAttendancePdfBuffer(data);
  const blob = new Blob([buffer as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeMonth = data.monthStr.replace(/\s+/g, '_');
  link.download = `Rollvia_Monthly_Report_${safeMonth}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
