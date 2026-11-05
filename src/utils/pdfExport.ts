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

export type ExportTheme = 'default' | 'modern' | 'academic' | 'emerald';

export interface MonthlyPdfData {
  institutionName?: string;
  departmentName?: string;
  academicYear?: string;
  monthStr: string;
  roster: Person[];
  profiles: Map<string, StudentAttendanceProfile> | Record<string, StudentAttendanceProfile>;
  savedDatesCount: number;
  holidaysCount: number;
  theme?: ExportTheme;
}

interface ThemeConfig {
  headerBg: [number, number, number] | null;
  headerBorder: [number, number, number];
  titleColor: [number, number, number];
  subColor: [number, number, number];
  showStatsBox: boolean;
  statsBg: [number, number, number];
  tableHeaderBg: [number, number, number];
  tableHeaderBorder: [number, number, number];
  tableHeaderColor: [number, number, number];
  evenRowBg: [number, number, number];
  oddRowBg: [number, number, number];
  rowBorder: [number, number, number];
  colDividers: boolean;
  boxBorder: boolean;
  colorPct: boolean;
  showSignatureLines: boolean;
}

const THEME_CONFIGS: Record<ExportTheme, ThemeConfig> = {
  default: {
    headerBg: null,
    headerBorder: [0.75, 0.75, 0.75],
    titleColor: [0.08, 0.08, 0.08],
    subColor: [0.32, 0.32, 0.32],
    showStatsBox: false,
    statsBg: [1, 1, 1],
    tableHeaderBg: [0.94, 0.94, 0.94],
    tableHeaderBorder: [0.25, 0.25, 0.25],
    tableHeaderColor: [0.06, 0.06, 0.06],
    evenRowBg: [1.0, 1.0, 1.0],
    oddRowBg: [0.985, 0.985, 0.985],
    rowBorder: [0.82, 0.82, 0.82],
    colDividers: true,
    boxBorder: true,
    colorPct: false,
    showSignatureLines: false,
  },
  modern: {
    headerBg: [0.95, 0.96, 0.98],
    headerBorder: [0.85, 0.88, 0.92],
    titleColor: [0.08, 0.15, 0.3],
    subColor: [0.35, 0.4, 0.48],
    showStatsBox: true,
    statsBg: [0.98, 0.98, 0.99],
    tableHeaderBg: [0.92, 0.94, 0.97],
    tableHeaderBorder: [0.8, 0.82, 0.86],
    tableHeaderColor: [0.2, 0.25, 0.35],
    evenRowBg: [0.99, 0.99, 1.0],
    oddRowBg: [0.96, 0.97, 0.98],
    rowBorder: [0.9, 0.92, 0.94],
    colDividers: false,
    boxBorder: false,
    colorPct: true,
    showSignatureLines: false,
  },
  academic: {
    headerBg: null,
    headerBorder: [0.2, 0.2, 0.2],
    titleColor: [0.04, 0.04, 0.04],
    subColor: [0.15, 0.15, 0.15],
    showStatsBox: false,
    statsBg: [1, 1, 1],
    tableHeaderBg: [0.88, 0.88, 0.88],
    tableHeaderBorder: [0.18, 0.18, 0.18],
    tableHeaderColor: [0.04, 0.04, 0.04],
    evenRowBg: [1.0, 1.0, 1.0],
    oddRowBg: [0.965, 0.965, 0.965],
    rowBorder: [0.75, 0.75, 0.75],
    colDividers: true,
    boxBorder: true,
    colorPct: false,
    showSignatureLines: true,
  },
  emerald: {
    headerBg: [0.06, 0.36, 0.22],
    headerBorder: [0.04, 0.28, 0.16],
    titleColor: [1.0, 1.0, 1.0],
    subColor: [0.86, 0.95, 0.89],
    showStatsBox: true,
    statsBg: [0.94, 0.98, 0.95],
    tableHeaderBg: [0.88, 0.94, 0.9],
    tableHeaderBorder: [0.2, 0.5, 0.3],
    tableHeaderColor: [0.05, 0.3, 0.15],
    evenRowBg: [1.0, 1.0, 1.0],
    oddRowBg: [0.95, 0.975, 0.955],
    rowBorder: [0.85, 0.9, 0.86],
    colDividers: false,
    boxBorder: false,
    colorPct: true,
    showSignatureLines: false,
  },
};

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
    theme = 'default',
  } = data;

  const cfg = THEME_CONFIGS[theme] || THEME_CONFIGS.default;

  const pageW = 842; // A4 Landscape width in points
  const pageH = 595; // A4 Landscape height in points

  // Layout sizing adjusts by theme: default starts higher and fits more rows on page 1
  const isDefaultTheme = theme === 'default';
  const isAcademicTheme = theme === 'academic';
  const maxRowsPage1 = isDefaultTheme ? 27 : isAcademicTheme ? 22 : 24;
  const maxRowsSubsequent = 26;
  const totalStudents = roster.length;

  let totalPages = 1;
  if (totalStudents > maxRowsPage1) {
    totalPages = 1 + Math.ceil((totalStudents - maxRowsPage1) / maxRowsSubsequent);
  }

  const colX = [36, 66, 140, 340, 420, 490, 560, 660];
  const rightEdge = pageW - 36;
  const headers = ['#', 'Roll No', 'Student Name', 'Total Classes', 'Present', 'Absent', 'Percentage'];
  const rowHeight = 17;

  // Generate content stream operations for each page
  const pageContentStreams: string[] = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const isFirstPage = pageIdx === 0;
    const isLastPage = pageIdx === totalPages - 1;
    const startIdx = isFirstPage ? 0 : maxRowsPage1 + (pageIdx - 1) * maxRowsSubsequent;
    const maxRows = isFirstPage ? maxRowsPage1 : maxRowsSubsequent;
    const endIdx = Math.min(totalStudents, startIdx + maxRows);
    const studentsOnPage = roster.slice(startIdx, endIdx);

    const streamOps: string[] = [];

    // Helper drawing primitives for this page
    const fillRect = (x: number, y: number, w: number, h: number, r: number, g: number, b: number) => {
      streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
      streamOps.push(`${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);
    };

    const strokeLine = (x1: number, y1: number, x2: number, y2: number, r = 0.8, g = 0.8, b = 0.8, w = 0.5) => {
      streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
      streamOps.push(`${w} w`);
      streamOps.push(`${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`);
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
      streamOps.push(`1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm`);
      streamOps.push(`(${escaped}) Tj`);
      streamOps.push('ET');
    };

    let tableTop = pageH - 122;

    if (isFirstPage) {
      if (theme === 'default') {
        // ── Default Minimalist Header: Clean table title & subtext, no colored boxes ──
        tableTop = pageH - 72;
        drawText(`ATTENDANCE REGISTER — ${monthStr.toUpperCase()}`, 38, pageH - 42, 13, true, ...cfg.titleColor);
        drawText(
          `${institutionName} \u2022 ${departmentName} \u2022 Academic Year: ${academicYear} \u2022 Recorded Days: ${savedDatesCount}`,
          38,
          pageH - 56,
          8,
          false,
          ...cfg.subColor
        );
        strokeLine(36, pageH - 62, rightEdge, pageH - 62, ...cfg.headerBorder, 1);
      } else if (theme === 'academic') {
        // ── Academic Formal Centered Header ──
        tableTop = pageH - 86;
        drawText(institutionName.toUpperCase(), pageW / 2 - 140, pageH - 36, 11, true, ...cfg.titleColor);
        drawText(departmentName.toUpperCase(), pageW / 2 - 125, pageH - 49, 8.5, false, ...cfg.subColor);
        drawText(`MONTHLY ATTENDANCE STATEMENT — ${monthStr.toUpperCase()}`, pageW / 2 - 130, pageH - 63, 9.5, true, ...cfg.titleColor);
        drawText(`Academic Year: ${academicYear} \u2022 Total Students: ${roster.length}`, pageW / 2 - 70, pageH - 74, 7.5, false, ...cfg.subColor);
        strokeLine(36, pageH - 78, rightEdge, pageH - 78, ...cfg.headerBorder, 1.2);
        strokeLine(36, pageH - 80, rightEdge, pageH - 80, ...cfg.headerBorder, 0.5);
      } else {
        // ── Modern / Emerald Themed Header with Banner & Stats Strip ──
        if (cfg.headerBg) {
          fillRect(36, pageH - 72, pageW - 72, 44, ...cfg.headerBg);
        }
        strokeLine(36, pageH - 72, rightEdge, pageH - 72, ...cfg.headerBorder);

        drawText('Rollvia - Monthly Attendance Report', 48, pageH - 46, 14, true, ...cfg.titleColor);
        drawText(
          `${monthStr} | ${institutionName} - ${departmentName} (${academicYear})`,
          48,
          pageH - 62,
          8.5,
          false,
          ...cfg.subColor
        );

        if (cfg.showStatsBox) {
          const statsY = pageH - 96;
          fillRect(36, statsY - 4, pageW - 72, 18, ...cfg.statsBg);
          strokeLine(36, statsY - 4, rightEdge, statsY - 4, ...cfg.headerBorder, 0.5);
          drawText(`Total Enrolled: ${roster.length}`, 48, statsY, 8, true, 0.2, 0.25, 0.35);
          drawText(`Recorded Days: ${savedDatesCount}`, 160, statsY, 8, true, 0.1, 0.55, 0.25);
          drawText(`Holidays / No Classes: ${holidaysCount}`, 280, statsY, 8, true, 0.7, 0.45, 0.1);
          drawText(`Generated: ${new Date().toLocaleDateString()}`, pageW - 190, statsY, 7.5, false, 0.5, 0.5, 0.5);
        }

        tableTop = pageH - 122;
      }
    } else {
      // ── Compact continuation header banner (Page 2+) ──
      tableTop = isDefaultTheme ? pageH - 58 : pageH - 80;
      if (cfg.headerBg && theme !== 'default' && theme !== 'academic') {
        fillRect(36, pageH - 54, pageW - 72, 26, ...cfg.headerBg);
      }
      strokeLine(36, tableTop + 24, rightEdge, tableTop + 24, ...cfg.headerBorder);

      drawText(`Rollvia - Monthly Attendance Report (Continued \u2014 Page ${pageIdx + 1})`, 48, tableTop + 30, 10, true, ...cfg.titleColor);
      drawText(`${monthStr} | ${institutionName} (${academicYear})`, 380, tableTop + 30, 8, false, ...cfg.subColor);
    }

    // 2. Table Header (Repeated on every page)
    fillRect(36, tableTop, pageW - 72, 18, ...cfg.tableHeaderBg);
    strokeLine(36, tableTop, rightEdge, tableTop, ...cfg.tableHeaderBorder, isDefaultTheme ? 1 : 0.6);
    strokeLine(36, tableTop + 18, rightEdge, tableTop + 18, ...cfg.tableHeaderBorder, isDefaultTheme ? 1 : 0.6);

    headers.forEach((h, idx) => {
      drawText(h, colX[idx] + 4, tableTop + 5, 7.5, true, ...cfg.tableHeaderColor);
    });

    // 3. Table Rows for this page
    studentsOnPage.forEach((person, pageRowIdx) => {
      const globalIdx = startIdx + pageRowIdx;
      const y = tableTop - (pageRowIdx + 1) * rowHeight;
      const isEven = globalIdx % 2 === 0;

      if (isEven) {
        fillRect(36, y, pageW - 72, rowHeight, ...cfg.evenRowBg);
      } else {
        fillRect(36, y, pageW - 72, rowHeight, ...cfg.oddRowBg);
      }
      strokeLine(36, y, rightEdge, y, ...cfg.rowBorder, 0.4);

      const prof = profiles instanceof Map
        ? profiles.get(person.id)
        : (profiles as Record<string, StudentAttendanceProfile>)?.[person.id];
      const total = prof ? prof.totalClasses : 0;
      const present = prof ? prof.presentClasses : 0;
      const absent = prof ? prof.absentClasses : 0;
      const pct = prof ? prof.overallPercentage : '0.0%';
      const pctNum = parsePercentage(pct);
      const [pr, pg, pb] = cfg.colorPct ? getPctColor(pctNum) : [0.1, 0.1, 0.1];

      drawText(String(globalIdx + 1), colX[0] + 6, y + 4.5, 7.5, false, 0.35, 0.35, 0.4);
      drawText(person.rollNumber || '—', colX[1] + 4, y + 4.5, 7.5, false, 0.15, 0.35, 0.6);
      drawText(person.name || 'Unnamed', colX[2] + 4, y + 4.5, 7.5, true, 0.1, 0.1, 0.12);
      drawText(String(total), colX[3] + 16, y + 4.5, 7.5, false, 0.25, 0.25, 0.25);
      drawText(String(present), colX[4] + 16, y + 4.5, 7.5, true, 0.1, 0.55, 0.2);
      drawText(String(absent), colX[5] + 16, y + 4.5, 7.5, true, 0.7, 0.2, 0.2);
      drawText(pct, colX[6] + 14, y + 4.5, 7.5, true, pr, pg, pb);
    });

    const tableBottomY = tableTop - studentsOnPage.length * rowHeight;
    strokeLine(36, tableBottomY, rightEdge, tableBottomY, ...cfg.tableHeaderBorder, isDefaultTheme ? 1 : 0.6);

    // Vertical Column Grid Lines for Table (when enabled, e.g. Default Clean Table)
    if (cfg.colDividers) {
      const colDivX = [...colX, rightEdge];
      colDivX.forEach((cx) => {
        strokeLine(cx, tableTop + 18, cx, tableBottomY, ...cfg.rowBorder, 0.45);
      });
    }

    // Outer Box Border
    if (cfg.boxBorder) {
      strokeLine(36, tableTop + 18, 36, tableBottomY, ...cfg.tableHeaderBorder, 1);
      strokeLine(rightEdge, tableTop + 18, rightEdge, tableBottomY, ...cfg.tableHeaderBorder, 1);
    }

    // Academic Theme Signatures Block on Final Page
    if (cfg.showSignatureLines && isLastPage) {
      const sigY = 48;
      strokeLine(colX[1], sigY + 12, colX[1] + 120, sigY + 12, 0.3, 0.3, 0.3, 0.7);
      drawText('Faculty In-Charge', colX[1] + 15, sigY, 7.5, true, 0.2, 0.2, 0.2);

      strokeLine(colX[3] + 10, sigY + 12, colX[3] + 140, sigY + 12, 0.3, 0.3, 0.3, 0.7);
      drawText('Head of Department (HOD)', colX[3] + 15, sigY, 7.5, true, 0.2, 0.2, 0.2);

      strokeLine(colX[6] - 30, sigY + 12, colX[6] + 100, sigY + 12, 0.3, 0.3, 0.3, 0.7);
      drawText('Principal / Dean', colX[6] - 15, sigY, 7.5, true, 0.2, 0.2, 0.2);
    }

    // 4. Footer Note & Page Number
    strokeLine(36, 32, rightEdge, 32, 0.88, 0.9, 0.92, 0.5);
    drawText(
      `Official attendance export generated via Rollvia \u2022 ${monthStr} \u2022 Theme: ${theme.toUpperCase()}`,
      48,
      20,
      6.8,
      false,
      0.5,
      0.55,
      0.6
    );

    const pageNumText = `Page ${pageIdx + 1} of ${totalPages}`;
    drawText(pageNumText, pageW - 110, 20, 7.5, true, 0.4, 0.45, 0.5);

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
  const themeSuffix = data.theme ? `_${data.theme}` : '';
  link.download = `Rollvia_Monthly_Report_${safeMonth}${themeSuffix}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
