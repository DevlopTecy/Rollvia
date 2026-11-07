import * as XLSX from 'xlsx';
import type { MonthlyAttendanceMatrix } from './monthlyAttendanceSummary';

export interface CollegeSignatureSheetOptions {
  institutionName?: string;
  departmentName?: string;
  academicYear?: string;
  subjectName?: string;
  semesterOrTerm?: string;
  minimumAttendanceThreshold?: number; // Defaults to 75%
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

const encoder = new TextEncoder();

function getByteLength(str: string): number {
  return encoder.encode(str).length;
}

/**
 * Returns RGB color components for the attendance percentage.
 * >= 75%: emerald green, >= 60%: amber, < 60%: rose red
 */
function getPctColor(pct: number): [number, number, number] {
  if (pct >= 75) return [0.08, 0.58, 0.32]; // Emerald
  if (pct >= 60) return [0.85, 0.48, 0.05]; // Amber
  return [0.82, 0.18, 0.18]; // Rose / Red
}

/**
 * Generates an official, publication-quality Portrait A4 PDF buffer for the
 * College/University Attendance Signature Sheet.
 */
export function generateCollegeSignatureSheetPdfBuffer(
  matrix: MonthlyAttendanceMatrix,
  options: CollegeSignatureSheetOptions = {}
): Uint8Array {
  const {
    institutionName = 'Rollvia Academic Institute',
    departmentName = 'Department of Computer Science & Engineering',
    academicYear = matrix.academicYear || String(matrix.selectedYear || new Date().getFullYear()),
    minimumAttendanceThreshold = 75,
  } = options;

  const pageW = 595; // A4 Portrait width (pt)
  const pageH = 842; // A4 Portrait height (pt)

  const leftMargin = 28;
  const printableW = pageW - leftMargin * 2; // 539 pt

  // Column Layout (Total: 539 pt)
  const cols = {
    sNo: 26,
    rollNo: 76,
    name: 165,
    conducted: 44,
    attended: 44,
    pct: 46,
    status: 56,
    sig: 82,
  };

  const students = matrix.students;
  const rowsPerPage = 25;
  const totalPages = Math.max(1, Math.ceil(students.length / rowsPerPage));

  const pageContentStreams: string[] = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const streamOps: string[] = [];
    const isLastPage = pageIdx === totalPages - 1;

    // Helper functions
    const drawRect = (x: number, y: number, w: number, h: number, r: number, g: number, b: number) => {
      const pdfY = pageH - y - h;
      streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
      streamOps.push(`${x.toFixed(2)} ${pdfY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
      streamOps.push('f');
    };

    const drawLine = (x1: number, y1: number, x2: number, y2: number, r: number, g: number, b: number, lineWidth = 0.5) => {
      const pdfY1 = pageH - y1;
      const pdfY2 = pageH - y2;
      streamOps.push(`${lineWidth.toFixed(2)} w`);
      streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
      streamOps.push(`${x1.toFixed(2)} ${pdfY1.toFixed(2)} m`);
      streamOps.push(`${x2.toFixed(2)} ${pdfY2.toFixed(2)} l`);
      streamOps.push('S');
    };

    const drawText = (
      text: string,
      x: number,
      y: number,
      size: number,
      bold = false,
      r = 0,
      g = 0,
      b = 0
    ) => {
      const pdfY = pageH - y;
      const font = bold ? '/F2' : '/F1';
      streamOps.push('BT');
      streamOps.push(`${font} ${size.toFixed(1)} Tf`);
      streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
      streamOps.push(`${x.toFixed(2)} ${pdfY.toFixed(2)} Td`);
      streamOps.push(`(${escapePdfText(text)}) Tj`);
      streamOps.push('ET');
    };

    let curY = 24;

    // ─── 1. Header Banner ────────────────────────────────────────────────
    drawRect(leftMargin, curY, printableW, 58, 0.08, 0.16, 0.32); // Deep Navy

    drawText(institutionName.toUpperCase(), leftMargin + printableW / 2 - (institutionName.length * 3.4), curY + 16, 12, true, 1, 1, 1);
    drawText(departmentName, leftMargin + printableW / 2 - (departmentName.length * 2.5), curY + 31, 9, false, 0.78, 0.85, 0.95);
    drawText(
      `OFFICIAL ATTENDANCE AND SIGNATURE STATEMENT \u2022 ACADEMIC YEAR ${academicYear}`,
      leftMargin + printableW / 2 - 138,
      curY + 46,
      8,
      true,
      0.95,
      0.82,
      0.4
    );

    curY += 64;

    // ─── 2. Metadata Strip ───────────────────────────────────────────────
    drawRect(leftMargin, curY, printableW, 20, 0.95, 0.96, 0.98);
    drawLine(leftMargin, curY + 20, leftMargin + printableW, curY + 20, 0.8, 0.84, 0.89);

    const periodText = `Period: ${matrix.monthRangeLabel}`;
    const minText = `Min Attendance Requirement: ${minimumAttendanceThreshold}%`;
    const totalConducted = matrix.overallStats?.totalConductedClasses ?? 0;
    const totalConductedText = `Total Classes: ${totalConducted}`;

    drawText(periodText, leftMargin + 8, curY + 13, 7.8, true, 0.2, 0.25, 0.35);
    drawText(totalConductedText, leftMargin + 210, curY + 13, 7.8, true, 0.2, 0.25, 0.35);
    drawText(minText, leftMargin + printableW - 165, curY + 13, 7.8, true, 0.1, 0.45, 0.25);

    curY += 24;

    // ─── 3. Table Column Headers ─────────────────────────────────────────
    const thHeight = 22;
    drawRect(leftMargin, curY, printableW, thHeight, 0.15, 0.23, 0.35); // Slate Navy

    let colX = leftMargin;
    drawText('#', colX + 8, curY + 14, 7.5, true, 1, 1, 1);
    colX += cols.sNo;

    drawText('Roll No.', colX + 6, curY + 14, 7.5, true, 1, 1, 1);
    colX += cols.rollNo;

    drawText('Student Name', colX + 6, curY + 14, 7.5, true, 1, 1, 1);
    colX += cols.name;

    drawText('Conducted', colX + 4, curY + 14, 7.2, true, 1, 1, 1);
    colX += cols.conducted;

    drawText('Attended', colX + 6, curY + 14, 7.2, true, 1, 1, 1);
    colX += cols.attended;

    drawText('Attd %', colX + 8, curY + 14, 7.2, true, 1, 1, 1);
    colX += cols.pct;

    drawText('Status', colX + 12, curY + 14, 7.2, true, 1, 1, 1);
    colX += cols.status;

    drawText('Student Signature', colX + 8, curY + 14, 7.5, true, 1, 1, 1);

    curY += thHeight;

    // ─── 4. Table Rows ───────────────────────────────────────────────────
    const startRow = pageIdx * rowsPerPage;
    const endRow = Math.min(students.length, startRow + rowsPerPage);
    const rowHeight = 19;

    for (let rIdx = startRow; rIdx < endRow; rIdx++) {
      const s = students[rIdx];
      const isAlt = (rIdx - startRow) % 2 === 1;

      // Background striping
      if (isAlt) {
        drawRect(leftMargin, curY, printableW, rowHeight, 0.97, 0.98, 0.99);
      }
      drawLine(leftMargin, curY + rowHeight, leftMargin + printableW, curY + rowHeight, 0.88, 0.9, 0.93, 0.4);

      let x = leftMargin;

      // S.No
      drawText(String(rIdx + 1), x + 8, curY + 13, 7.5, false, 0.4, 0.45, 0.5);
      x += cols.sNo;

      // Roll No
      drawText(s.student.rollNumber || 'N/A', x + 6, curY + 13, 7.5, true, 0.15, 0.2, 0.3);
      x += cols.rollNo;

      // Name (truncated if too long)
      const maxNameLen = 28;
      const displayName = s.student.name.length > maxNameLen ? `${s.student.name.substring(0, maxNameLen - 2)}..` : s.student.name;
      drawText(displayName, x + 6, curY + 13, 7.8, true, 0.1, 0.15, 0.2);
      x += cols.name;

      // Conducted
      const conducted = matrix.overallStats?.totalConductedClasses ?? 0;
      drawText(String(conducted), x + 16, curY + 13, 7.5, false, 0.3, 0.35, 0.4);
      x += cols.conducted;

      // Attended
      drawText(String(s.overallPresent), x + 16, curY + 13, 7.5, true, 0.15, 0.2, 0.25);
      x += cols.attended;

      // Percentage with Color
      const [pr, pg, pb] = getPctColor(s.overallPercentage);
      drawText(`${s.overallPercentage.toFixed(1)}%`, x + 8, curY + 13, 7.8, true, pr, pg, pb);
      x += cols.pct;

      // Status
      const isEligible = s.overallPercentage >= minimumAttendanceThreshold;
      if (isEligible) {
        drawText('Eligible', x + 10, curY + 13, 7, true, 0.08, 0.55, 0.28);
      } else {
        drawText('Shortage', x + 8, curY + 13, 7, true, 0.82, 0.18, 0.18);
      }
      x += cols.status;

      // Student Signature Line (Underline for physical signature)
      drawLine(x + 6, curY + 14, x + cols.sig - 6, curY + 14, 0.75, 0.78, 0.84, 0.6);

      curY += rowHeight;
    }

    // ─── 5. Sign-Off Verification Blocks (On Final Page) ──────────────────
    if (isLastPage) {
      const footerBoxY = Math.max(curY + 22, pageH - 120);

      const colW = printableW / 3;

      // Block 1: Subject Faculty
      drawLine(leftMargin + 10, footerBoxY + 30, leftMargin + colW - 10, footerBoxY + 30, 0.4, 0.45, 0.5, 0.8);
      drawText('Faculty / Subject In-Charge', leftMargin + 16, footerBoxY + 43, 7.5, true, 0.15, 0.2, 0.3);
      drawText('Date: ____________________', leftMargin + 16, footerBoxY + 56, 7, false, 0.4, 0.45, 0.5);

      // Block 2: Class Coordinator / Mentor
      drawLine(leftMargin + colW + 10, footerBoxY + 30, leftMargin + colW * 2 - 10, footerBoxY + 30, 0.4, 0.45, 0.5, 0.8);
      drawText('Class Mentor / Coordinator', leftMargin + colW + 18, footerBoxY + 43, 7.5, true, 0.15, 0.2, 0.3);
      drawText('Date: ____________________', leftMargin + colW + 18, footerBoxY + 56, 7, false, 0.4, 0.45, 0.5);

      // Block 3: Head of Department
      drawLine(leftMargin + colW * 2 + 10, footerBoxY + 30, leftMargin + printableW - 10, footerBoxY + 30, 0.4, 0.45, 0.5, 0.8);
      drawText('Head of Department (HOD)', leftMargin + colW * 2 + 18, footerBoxY + 43, 7.5, true, 0.15, 0.2, 0.3);
      drawText('Seal & Date: ______________', leftMargin + colW * 2 + 18, footerBoxY + 56, 7, false, 0.4, 0.45, 0.5);
    }

    // ─── 6. Running Page Footer ──────────────────────────────────────────
    const footerY = pageH - 18;
    drawLine(leftMargin, footerY - 8, leftMargin + printableW, footerY - 8, 0.88, 0.9, 0.93, 0.5);
    drawText('Official Attendance Record \u2022 Generated securely via Rollvia', leftMargin, footerY, 6.8, false, 0.45, 0.5, 0.58);
    drawText(`Page ${pageIdx + 1} of ${totalPages}`, leftMargin + printableW - 55, footerY, 6.8, true, 0.3, 0.35, 0.45);

    pageContentStreams.push(streamOps.join('\n'));
  }

  // Assemble PDF Structure
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

    offsets[pageObjId] = currentOffset;
    addPart(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`
    );

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

  return encoder.encode(pdfParts.join(''));
}

/**
 * Initiates the download of the College Attendance Signature Sheet PDF.
 */
export function downloadCollegeSignatureSheetPdf(
  matrix: MonthlyAttendanceMatrix,
  options: CollegeSignatureSheetOptions = {}
) {
  const buffer = generateCollegeSignatureSheetPdfBuffer(matrix, options);
  const blob = new Blob([buffer as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeYear = matrix.selectedYear || new Date().getFullYear();
  const safeRange = matrix.monthRangeLabel.replace(/[\s–—]+/g, '_');
  link.download = `Rollvia_University_Signature_Sheet_${safeYear}_${safeRange}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Builds an Excel Workbook formatted specifically as an Official University Signature Sheet.
 */
export function generateCollegeSignatureSheetWorkbook(
  matrix: MonthlyAttendanceMatrix,
  options: CollegeSignatureSheetOptions = {}
): XLSX.WorkBook {
  const {
    institutionName = 'Rollvia Academic Institute',
    departmentName = 'Department of Computer Science & Engineering',
    academicYear = matrix.academicYear || String(matrix.selectedYear || new Date().getFullYear()),
    minimumAttendanceThreshold = 75,
  } = options;

  const wb = XLSX.utils.book_new();

  const rows: (string | number | null)[][] = [];

  const totalConducted = matrix.overallStats?.totalConductedClasses ?? 0;
  const avgAttendance = matrix.overallStats?.averageAttendancePct ?? 0;

  // Row 0: Institution
  rows.push([institutionName.toUpperCase(), null, null, null, null, null, null, null]);
  // Row 1: Department
  rows.push([departmentName, null, null, null, null, null, null, null]);
  // Row 2: Title
  rows.push([`OFFICIAL ATTENDANCE AND SIGNATURE STATEMENT - ACADEMIC YEAR ${academicYear}`, null, null, null, null, null, null, null]);
  // Row 3: Metadata
  rows.push([`Period: ${matrix.monthRangeLabel}  |  Total Classes Conducted: ${totalConducted}  |  Min Requirement: ${minimumAttendanceThreshold}%`, null, null, null, null, null, null, null]);
  // Row 4: Blank separator
  rows.push([]);

  // Row 5: Column Headers
  rows.push([
    'S.No.',
    'Roll Number',
    'Student Name',
    'Conducted Classes',
    'Attended Classes',
    'Attendance %',
    'Eligibility Status',
    'Student Signature',
    'Faculty Remarks',
  ]);

  let eligibleCount = 0;
  let shortageCount = 0;

  matrix.students.forEach((s, idx) => {
    const isEligible = s.overallPercentage >= minimumAttendanceThreshold;
    if (isEligible) eligibleCount++;
    else shortageCount++;

    rows.push([
      idx + 1,
      s.student.rollNumber || 'N/A',
      s.student.name,
      totalConducted,
      s.overallPresent,
      `${s.overallPercentage.toFixed(1)}%`,
      isEligible ? 'Eligible' : 'Attendance Shortage',
      '', // Blank for student signature
      '', // Blank for faculty remarks
    ]);
  });

  // Summary Row
  rows.push([]);
  rows.push([
    'Class Summary:',
    `Total Students: ${matrix.students.length}`,
    `Eligible (>=${minimumAttendanceThreshold}%): ${eligibleCount}`,
    `Shortage (<${minimumAttendanceThreshold}%): ${shortageCount}`,
    '',
    `Class Average: ${avgAttendance.toFixed(1)}%`,
    '',
    '',
    '',
  ]);

  // Signatures Block
  rows.push([]);
  rows.push([]);
  rows.push([
    '',
    '______________________________',
    '',
    '______________________________',
    '',
    '______________________________',
    '',
    '',
    '',
  ]);
  rows.push([
    '',
    'Faculty In-Charge Signature',
    '',
    'Class Mentor / Coordinator',
    '',
    'Head of Department (HOD) Seal',
    '',
    '',
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Merges for header titles
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } },
  ];

  // Column Widths
  ws['!cols'] = [
    { wch: 8 },  // S.No
    { wch: 16 }, // Roll No
    { wch: 28 }, // Name
    { wch: 18 }, // Conducted
    { wch: 18 }, // Attended
    { wch: 15 }, // %
    { wch: 20 }, // Status
    { wch: 24 }, // Student Signature
    { wch: 24 }, // Remarks
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Signature Statement');
  return wb;
}

/**
 * Initiates the download of the College Attendance Signature Sheet in Excel (.xlsx).
 */
export async function downloadCollegeSignatureSheetExcel(
  matrix: MonthlyAttendanceMatrix,
  options: CollegeSignatureSheetOptions = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const wb = generateCollegeSignatureSheetWorkbook(matrix, options);
    const safeYear = matrix.selectedYear || new Date().getFullYear();
    const safeRange = matrix.monthRangeLabel.replace(/[\s–—]+/g, '_');
    const fileName = `Rollvia_University_Signature_Sheet_${safeYear}_${safeRange}.xlsx`;

    XLSX.writeFile(wb, fileName);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to export College Signature Sheet Excel.';
    return { success: false, error: msg };
  }
}
