import type { MonthlyAttendanceMatrix } from './monthlyAttendanceSummary';

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
 * >= 75%: emerald green, >= 60%: amber, < 60%: red
 */
function getPctColor(pct: number): [number, number, number] {
  if (pct >= 75) return [0.08, 0.58, 0.32]; // Emerald green
  if (pct >= 60) return [0.85, 0.48, 0.05]; // Amber / Orange
  return [0.82, 0.18, 0.18]; // Rose / Red
}

export interface MonthlySummaryPdfOptions {
  institutionName?: string;
  departmentName?: string;
  academicYear?: string;
}

interface HorizontalChunk {
  monthIndices: number[]; // Indices into matrix.monthGroups
  includeOverallSummary: boolean;
}

/**
 * Generates an official, publication-quality Landscape PDF buffer for the
 * Monthly Attendance Summary Matrix with full horizontal and vertical pagination.
 */
export function generateMonthlySummaryPdfBuffer(
  matrix: MonthlyAttendanceMatrix,
  options: MonthlySummaryPdfOptions = {}
): Uint8Array {
  const {
    institutionName = 'Rollvia Academic Institute',
    departmentName = 'Department of Computer Science & Engineering',
    academicYear = matrix.academicYear || String(matrix.selectedYear),
  } = options;

  const pageW = 842; // A4 Landscape width (pt)
  const pageH = 595; // A4 Landscape height (pt)

  const leftMargin = 32;
  const rightMargin = 32;
  const printableW = pageW - leftMargin - rightMargin; // 778 pt

  const fixedColWidths = {
    index: 22,
    rollNo: 72,
    name: 126,
  };
  const fixedTotalW = fixedColWidths.index + fixedColWidths.rollNo + fixedColWidths.name; // 220 pt
  const maxDataW = printableW - fixedTotalW; // 558 pt

  // 1. Partition months into horizontal chunks that fit comfortably on landscape pages
  const horizontalChunks: HorizontalChunk[] = [];
  let currentChunkMonths: number[] = [];
  let currentChunkCols = 0;

  for (let gIdx = 0; gIdx < matrix.monthGroups.length; gIdx++) {
    const group = matrix.monthGroups[gIdx];
    const monthCols = group.subjects.length + 1; // subjects + Month Total

    // Assume average column width is ~36 pt
    const projectedWidth = (currentChunkCols + monthCols) * 36;

    if (currentChunkMonths.length > 0 && projectedWidth > maxDataW) {
      // Push current chunk and start a new one
      horizontalChunks.push({
        monthIndices: currentChunkMonths,
        includeOverallSummary: false,
      });
      currentChunkMonths = [gIdx];
      currentChunkCols = monthCols;
    } else {
      currentChunkMonths.push(gIdx);
      currentChunkCols += monthCols;
    }
  }

  // Final chunk includes overall summary if columns fit, otherwise separate chunk
  if (currentChunkMonths.length > 0) {
    const summaryCols = 4; // Present, Absent, Total, Attendance %
    const totalCols = currentChunkCols + summaryCols;
    if (totalCols * 34 <= maxDataW || horizontalChunks.length === 0) {
      horizontalChunks.push({
        monthIndices: currentChunkMonths,
        includeOverallSummary: true,
      });
    } else {
      horizontalChunks.push({
        monthIndices: currentChunkMonths,
        includeOverallSummary: false,
      });
      horizontalChunks.push({
        monthIndices: [],
        includeOverallSummary: true,
      });
    }
  } else {
    horizontalChunks.push({
      monthIndices: [],
      includeOverallSummary: true,
    });
  }

  // 2. Vertical pagination parameters
  const rowHeight = 16;
  const maxRowsPage1 = 23;
  const maxRowsSubsequent = 25;
  const totalStudents = matrix.students.length;

  let verticalPageCount = 1;
  if (totalStudents > maxRowsPage1) {
    verticalPageCount = 1 + Math.ceil((totalStudents - maxRowsPage1) / maxRowsSubsequent);
  }

  const totalPages = horizontalChunks.length * verticalPageCount;
  const pageContentStreams: string[] = [];

  let globalPageIdx = 0;

  // 3. Render pages
  for (let hIdx = 0; hIdx < horizontalChunks.length; hIdx++) {
    const chunk = horizontalChunks[hIdx];
    const chunkGroups = chunk.monthIndices.map((i) => matrix.monthGroups[i]);

    // Calculate column widths for this horizontal chunk
    let totalDataCols = 0;
    for (const g of chunkGroups) {
      totalDataCols += g.subjects.length + 1;
    }
    if (chunk.includeOverallSummary) {
      totalDataCols += 3; // Conducted, Attended, %
    }

    const calculatedColW =
      totalDataCols > 0
        ? Math.max(30, Math.min(46, Math.floor(maxDataW / totalDataCols)))
        : 40;

    for (let vIdx = 0; vIdx < verticalPageCount; vIdx++) {
      globalPageIdx++;
      const isFirstVertPage = vIdx === 0;
      const startIdx = isFirstVertPage ? 0 : maxRowsPage1 + (vIdx - 1) * maxRowsSubsequent;
      const maxRows = isFirstVertPage ? maxRowsPage1 : maxRowsSubsequent;
      const endIdx = Math.min(totalStudents, startIdx + maxRows);
      const studentsOnPage = matrix.students.slice(startIdx, endIdx);

      const streamOps: string[] = [];

      // Drawing helpers
      const fillRect = (x: number, y: number, w: number, h: number, r: number, g: number, b: number) => {
        streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
        streamOps.push(`${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);
      };

      const strokeLine = (x1: number, y1: number, x2: number, y2: number, r = 0.82, g = 0.84, b = 0.88) => {
        streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
        streamOps.push(`0.5 w`);
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
        b = 0.15
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

      // Header Banner
      const bannerTop = pageH - 28;
      if (isFirstVertPage) {
        fillRect(leftMargin, bannerTop - 36, printableW, 36, 0.96, 0.97, 0.99);
        strokeLine(leftMargin, bannerTop - 36, leftMargin + printableW, bannerTop - 36, 0.85, 0.88, 0.92);

        drawText('Rollvia - Monthly Attendance Summary', leftMargin + 10, bannerTop - 18, 12, true, 0.08, 0.18, 0.38);
        drawText(
          `${institutionName} \u2022 ${departmentName} \u2022 Academic Year: ${academicYear} \u2022 ${matrix.monthRangeLabel}`,
          leftMargin + 10,
          bannerTop - 30,
          8,
          false,
          0.38,
          0.42,
          0.48
        );
      } else {
        fillRect(leftMargin, bannerTop - 26, printableW, 26, 0.96, 0.97, 0.99);
        strokeLine(leftMargin, bannerTop - 26, leftMargin + printableW, bannerTop - 26, 0.85, 0.88, 0.92);

        drawText('Rollvia - Monthly Attendance Summary (Continued)', leftMargin + 10, bannerTop - 17, 10, true, 0.08, 0.18, 0.38);
        drawText(
          `${institutionName} \u2022 Academic Year: ${academicYear} \u2022 ${matrix.monthRangeLabel}`,
          leftMargin + 290,
          bannerTop - 17,
          8,
          false,
          0.38,
          0.42,
          0.48
        );
      }

      // Page X of Y top-right
      drawText(`Page ${globalPageIdx} of ${totalPages}`, leftMargin + printableW - 75, bannerTop - 18, 8, true, 0.35, 0.4, 0.48);

      // Table Header Positions
      const tableTopY = isFirstVertPage ? bannerTop - 56 : bannerTop - 42;
      const headerRow0H = 17;
      const headerRow1H = 17;
      const headerTotalH = headerRow0H + headerRow1H;
      const rowStartY = tableTopY - headerTotalH;

      // Grouped Month Header (Row 0)
      fillRect(leftMargin, tableTopY - headerRow0H, printableW, headerRow0H, 0.92, 0.94, 0.97);
      strokeLine(leftMargin, tableTopY - headerRow0H, leftMargin + printableW, tableTopY - headerRow0H, 0.8, 0.83, 0.88);

      // Blank over fixed columns in Row 0
      drawText('Student Credentials', leftMargin + 10, tableTopY - headerRow0H + 4.5, 7.5, true, 0.25, 0.3, 0.4);

      let colX = leftMargin + fixedTotalW;

      // Draw Grouped Months in Row 0
      for (const g of chunkGroups) {
        const mCols = g.subjects.length + 1;
        const mWidth = mCols * calculatedColW;

        // Month background highlight
        fillRect(colX + 1, tableTopY - headerRow0H + 1, mWidth - 2, headerRow0H - 2, 0.89, 0.92, 0.96);
        strokeLine(colX, tableTopY, colX, tableTopY - headerTotalH, 0.78, 0.82, 0.88);

        const mTitle = `${g.monthName.toUpperCase()} (${g.totalClasses} Classes)`;
        drawText(mTitle, colX + 4, tableTopY - headerRow0H + 4.5, 7, true, 0.12, 0.22, 0.42);

        colX += mWidth;
      }

      if (chunk.includeOverallSummary) {
        const summaryW = 4 * calculatedColW;
        fillRect(colX + 1, tableTopY - headerRow0H + 1, summaryW - 2, headerRow0H - 2, 0.91, 0.94, 0.92);
        strokeLine(colX, tableTopY, colX, tableTopY - headerTotalH, 0.78, 0.82, 0.88);
        drawText('OVERALL SUMMARY', colX + 4, tableTopY - headerRow0H + 4.5, 7, true, 0.1, 0.4, 0.2);
      }

      // Subheaders (Row 1)
      fillRect(leftMargin, rowStartY, printableW, headerRow1H, 0.95, 0.96, 0.98);
      strokeLine(leftMargin, rowStartY, leftMargin + printableW, rowStartY, 0.8, 0.83, 0.88);

      drawText('#', leftMargin + 6, rowStartY + 4.5, 7, true, 0.3, 0.35, 0.42);
      drawText('Roll No', leftMargin + fixedColWidths.index + 4, rowStartY + 4.5, 7, true, 0.3, 0.35, 0.42);
      drawText('Student Name', leftMargin + fixedColWidths.index + fixedColWidths.rollNo + 4, rowStartY + 4.5, 7, true, 0.3, 0.35, 0.42);

      colX = leftMargin + fixedTotalW;

      for (const g of chunkGroups) {
        for (const s of g.subjects) {
          strokeLine(colX, rowStartY + headerRow1H, colX, rowStartY, 0.85, 0.88, 0.92);
          const shortName = s.subjectName.length > 7 ? `${s.subjectName.slice(0, 6)}.` : s.subjectName;
          drawText(`${shortName}(${s.totalClasses})`, colX + 2, rowStartY + 4.5, 6.5, true, 0.2, 0.25, 0.32);
          colX += calculatedColW;
        }

        // Month Total Header
        strokeLine(colX, rowStartY + headerRow1H, colX, rowStartY, 0.8, 0.83, 0.88);
        fillRect(colX, rowStartY, calculatedColW, headerRow1H, 0.9, 0.93, 0.97);
        drawText('Total', colX + 4, rowStartY + 4.5, 7, true, 0.1, 0.25, 0.5);
        colX += calculatedColW;
      }

      if (chunk.includeOverallSummary) {
        strokeLine(colX, rowStartY + headerRow1H, colX, rowStartY, 0.8, 0.83, 0.88);
        drawText('Present', colX + 2, rowStartY + 4.5, 6.2, true, 0.1, 0.5, 0.25);
        colX += calculatedColW;

        strokeLine(colX, rowStartY + headerRow1H, colX, rowStartY, 0.8, 0.83, 0.88);
        drawText('Absent', colX + 2, rowStartY + 4.5, 6.2, true, 0.7, 0.2, 0.2);
        colX += calculatedColW;

        strokeLine(colX, rowStartY + headerRow1H, colX, rowStartY, 0.8, 0.83, 0.88);
        drawText('Total', colX + 3, rowStartY + 4.5, 6.2, true, 0.3, 0.35, 0.4);
        colX += calculatedColW;

        strokeLine(colX, rowStartY + headerRow1H, colX, rowStartY, 0.8, 0.83, 0.88);
        drawText('Attd %', colX + 2, rowStartY + 4.5, 6.2, true, 0.15, 0.3, 0.6);
        colX += calculatedColW;
      }

      // 4. Student Rows
      studentsOnPage.forEach((sRow, pageRowIdx) => {
        const globalRowIdx = startIdx + pageRowIdx;
        const y = rowStartY - (pageRowIdx + 1) * rowHeight;
        const isEven = globalRowIdx % 2 === 0;

        if (isEven) {
          fillRect(leftMargin, y, printableW, rowHeight, 0.99, 0.99, 1.0);
        } else {
          fillRect(leftMargin, y, printableW, rowHeight, 0.96, 0.97, 0.985);
        }
        strokeLine(leftMargin, y, leftMargin + printableW, y, 0.88, 0.9, 0.93);

        // Fixed columns
        drawText(String(globalRowIdx + 1), leftMargin + 6, y + 4.5, 6.8, false, 0.45, 0.5, 0.55);
        drawText(sRow.student.rollNumber || '—', leftMargin + fixedColWidths.index + 4, y + 4.5, 6.8, false, 0.15, 0.4, 0.7);

        const safeName = sRow.student.name || 'Unnamed';
        const truncatedName = safeName.length > 21 ? `${safeName.slice(0, 19)}..` : safeName;
        drawText(truncatedName, leftMargin + fixedColWidths.index + fixedColWidths.rollNo + 4, y + 4.5, 6.8, true, 0.1, 0.12, 0.18);

        colX = leftMargin + fixedTotalW;

        // Render Months in this chunk
        for (const mIdx of chunk.monthIndices) {
          const group = matrix.monthGroups[mIdx];
          const mData = sRow.monthlyData[mIdx];

          for (const sub of group.subjects) {
            strokeLine(colX, y + rowHeight, colX, y, 0.9, 0.92, 0.95);
            const attended = mData?.subjectAttended[sub.subjectName] ?? 0;
            const isZeroConducted = sub.totalClasses === 0;

            const valStr = String(attended);
            const r = isZeroConducted ? 0.6 : 0.2;
            const g = isZeroConducted ? 0.6 : 0.22;
            const b = isZeroConducted ? 0.6 : 0.25;

            drawText(valStr, colX + 8, y + 4.5, 6.8, attended > 0, r, g, b);
            colX += calculatedColW;
          }

          // Month Total
          strokeLine(colX, y + rowHeight, colX, y, 0.82, 0.85, 0.9);
          fillRect(colX + 0.5, y + 0.5, calculatedColW - 1, rowHeight - 1, 0.93, 0.95, 0.98);
          const mTotal = mData?.monthTotalAttended ?? 0;
          drawText(String(mTotal), colX + 8, y + 4.5, 7, true, 0.1, 0.25, 0.55);
          colX += calculatedColW;
        }

        // Overall Summary columns if present: Present, Absent, Total, Attendance %
        if (chunk.includeOverallSummary) {
          strokeLine(colX, y + rowHeight, colX, y, 0.85, 0.88, 0.92);
          drawText(String(sRow.overallPresent), colX + 5, y + 4.5, 6.8, true, 0.1, 0.55, 0.25);
          colX += calculatedColW;

          strokeLine(colX, y + rowHeight, colX, y, 0.85, 0.88, 0.92);
          drawText(String(sRow.overallAbsent), colX + 5, y + 4.5, 6.8, sRow.overallAbsent > 0, 0.65, 0.2, 0.2);
          colX += calculatedColW;

          strokeLine(colX, y + rowHeight, colX, y, 0.85, 0.88, 0.92);
          drawText(String(sRow.overallTotal), colX + 5, y + 4.5, 6.8, false, 0.3, 0.35, 0.45);
          colX += calculatedColW;

          strokeLine(colX, y + rowHeight, colX, y, 0.85, 0.88, 0.92);
          const pct = sRow.overallPercentage;
          const [pr, pg, pb] = getPctColor(pct);
          drawText(`${pct.toFixed(1)}%`, colX + 4, y + 4.5, 6.8, true, pr, pg, pb);
          colX += calculatedColW;
        }
      });

      // Bottom border of table
      const tableBottomY = rowStartY - studentsOnPage.length * rowHeight;
      strokeLine(leftMargin, tableBottomY, leftMargin + printableW, tableBottomY, 0.8, 0.83, 0.88);

      // Footer
      const footerY = 26;
      strokeLine(leftMargin, footerY + 12, leftMargin + printableW, footerY + 12, 0.88, 0.9, 0.94);
      drawText(
        `Official Monthly Attendance Summary generated via Rollvia \u2022 Green \u226575% \u2022 Orange 60\u201374% \u2022 Red <60% \u2022 ${matrix.monthRangeLabel}`,
        leftMargin + 6,
        footerY,
        6.8,
        false,
        0.45,
        0.5,
        0.58
      );

      const footerPageText = `Page ${globalPageIdx} of ${totalPages}`;
      drawText(footerPageText, leftMargin + printableW - 80, footerY, 7, true, 0.35, 0.4, 0.48);

      pageContentStreams.push(streamOps.join('\n'));
    }
  }

  // 5. Assemble complete PDF structure
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
 * Initiates the download of the Monthly Attendance Summary PDF.
 */
export function downloadMonthlySummaryPdf(
  matrix: MonthlyAttendanceMatrix,
  options: MonthlySummaryPdfOptions = {}
) {
  const buffer = generateMonthlySummaryPdfBuffer(matrix, options);
  const blob = new Blob([buffer as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeYear = matrix.selectedYear || new Date().getFullYear();
  const safeRange = matrix.monthRangeLabel.replace(/[\s–—]+/g, '_');
  link.download = `Rollvia_Monthly_Attendance_Summary_${safeYear}_${safeRange}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
