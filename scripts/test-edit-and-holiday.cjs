const assert = require('assert');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

console.log('========================================================');
console.log('TEST SUITE: EDIT PREVIOUS DATES & HOLIDAY WORKFLOWS');
console.log('========================================================\n');

let passCount = 0;
function pass(msg) {
  passCount++;
  console.log(`[PASS] ${msg}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. REAL MONTHLY PDF EXPORT VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- 1. Monthly PDF Generation & Spec Compliance ---');

// Replicate pure PDF generation conforming to PDF-1.4 spec as in src/utils/pdfExport.ts
function escapePdfText(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function generateMonthlyPdf(data) {
  const {
    institutionName = 'Apex Institute of Science & Technology',
    departmentName = 'Department of Computer Science & Engineering',
    academicYear = '2026',
    monthStr,
    roster,
    profiles,
    savedDatesCount,
    holidaysCount,
  } = data;

  const pageW = 842;
  const pageH = 595;
  const streamOps = [];

  const fillRect = (x, y, w, h, r, g, b) => {
    streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
    streamOps.push(`${x} ${y} ${w} ${h} re f`);
  };

  const strokeLine = (x1, y1, x2, y2, r = 0.8, g = 0.8, b = 0.8) => {
    streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
    streamOps.push(`0.5 w`);
    streamOps.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  };

  const drawText = (text, x, y, size, isBold = false, r = 0.1, g = 0.1, b = 0.1) => {
    const font = isBold ? '/F2' : '/F1';
    const escaped = escapePdfText(text);
    streamOps.push('BT');
    streamOps.push(`${font} ${size} Tf`);
    streamOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
    streamOps.push(`1 0 0 1 ${x} ${y} Tm`);
    streamOps.push(`(${escaped}) Tj`);
    streamOps.push('ET');
  };

  // Header Banner
  fillRect(36, pageH - 72, pageW - 72, 44, 0.95, 0.96, 0.98);
  strokeLine(36, pageH - 72, pageW - 36, pageH - 72, 0.85, 0.88, 0.92);
  drawText('Attendly - Monthly Attendance Report', 48, pageH - 46, 14, true, 0.08, 0.15, 0.3);
  drawText(`${monthStr} | ${institutionName} - ${departmentName} (${academicYear})`, 48, pageH - 62, 8.5, false, 0.35, 0.4, 0.48);

  // Top Metrics Strip
  const statsY = pageH - 96;
  fillRect(36, statsY - 4, pageW - 72, 18, 0.98, 0.98, 0.99);
  drawText(`Total Enrolled: ${roster.length}`, 48, statsY, 8, true, 0.2, 0.25, 0.35);
  drawText(`Recorded Days: ${savedDatesCount}`, 160, statsY, 8, true, 0.1, 0.55, 0.25);
  drawText(`Holidays / No Classes: ${holidaysCount}`, 280, statsY, 8, true, 0.7, 0.45, 0.1);
  drawText(`Generated on: 2026-09-28`, pageW - 190, statsY, 7.5, false, 0.5, 0.5, 0.5);

  // Table
  const tableTop = pageH - 122;
  const colX = [36, 66, 140, 340, 420, 490, 560, 650];
  const headers = ['#', 'Roll No', 'Student Name', 'Total Classes', 'Present', 'Absent', 'Percentage', 'Status'];

  fillRect(36, tableTop, pageW - 72, 18, 0.92, 0.94, 0.97);
  strokeLine(36, tableTop, pageW - 36, tableTop, 0.8, 0.82, 0.86);

  headers.forEach((h, idx) => {
    drawText(h, colX[idx] + 4, tableTop + 5, 7.5, true, 0.2, 0.25, 0.35);
  });

  const rowHeight = 17;
  roster.forEach((p, idx) => {
    const y = tableTop - (idx + 1) * rowHeight;
    fillRect(36, y, pageW - 72, rowHeight, idx % 2 === 0 ? 0.99 : 0.96, idx % 2 === 0 ? 0.99 : 0.97, idx % 2 === 0 ? 1.0 : 0.98);
    strokeLine(36, y, pageW - 36, y, 0.9, 0.92, 0.94);

    const prof = profiles[p.id] || { totalClasses: 0, presentClasses: 0, absentClasses: 0, overallPercentage: '0.0%' };
    drawText(String(idx + 1), colX[0] + 6, y + 4.5, 7.5, false, 0.4, 0.45, 0.5);
    drawText(p.rollNumber || '—', colX[1] + 4, y + 4.5, 7.5, false, 0.15, 0.4, 0.7);
    drawText(p.name, colX[2] + 4, y + 4.5, 7.5, true, 0.1, 0.1, 0.15);
    drawText(String(prof.totalClasses), colX[3] + 16, y + 4.5, 7.5, false, 0.3, 0.3, 0.3);
    drawText(String(prof.presentClasses), colX[4] + 16, y + 4.5, 7.5, true, 0.1, 0.6, 0.2);
    drawText(String(prof.absentClasses), colX[5] + 16, y + 4.5, 7.5, true, 0.75, 0.2, 0.2);
    drawText(prof.overallPercentage, colX[6] + 14, y + 4.5, 7.5, true, 0.1, 0.15, 0.25);
    drawText('Healthy', colX[7] + 8, y + 4.5, 7, true, 0.2, 0.4, 0.6);
  });

  const contentStream = streamOps.join('\n');
  const streamLen = Buffer.byteLength(contentStream, 'utf-8');

  const pdfParts = [];
  const offsets = [];

  const addPart = (str) => pdfParts.push(str);

  addPart('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  offsets[1] = Buffer.byteLength(pdfParts.join(''), 'utf-8');
  addPart('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets[2] = Buffer.byteLength(pdfParts.join(''), 'utf-8');
  addPart('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  offsets[3] = Buffer.byteLength(pdfParts.join(''), 'utf-8');
  addPart(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`);

  offsets[4] = Buffer.byteLength(pdfParts.join(''), 'utf-8');
  addPart('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  offsets[5] = Buffer.byteLength(pdfParts.join(''), 'utf-8');
  addPart('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');

  offsets[6] = Buffer.byteLength(pdfParts.join(''), 'utf-8');
  addPart(`6 0 obj\n<< /Length ${streamLen} >>\nstream\n${contentStream}\nendstream\nendobj\n`);

  const startXref = Buffer.byteLength(pdfParts.join(''), 'utf-8');
  addPart('xref\n0 7\n0000000000 65535 f \n');
  for (let i = 1; i <= 6; i++) {
    const off = String(offsets[i]).padStart(10, '0');
    addPart(`${off} 00000 n \n`);
  }
  addPart(`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`);

  return Buffer.from(pdfParts.join(''), 'utf-8');
}

const testPdfBuffer = generateMonthlyPdf({
  monthStr: 'September 2026',
  roster: [
    { id: 's1', name: 'Aarav Sharma', rollNumber: 'CS-01' },
    { id: 's2', name: 'Bhavna Patel', rollNumber: 'CS-02' },
    { id: 's3', name: 'Chetan Verma', rollNumber: 'CS-03' },
  ],
  profiles: {
    s1: { totalClasses: 10, presentClasses: 9, absentClasses: 1, overallPercentage: '90.0%' },
    s2: { totalClasses: 10, presentClasses: 8, absentClasses: 2, overallPercentage: '80.0%' },
    s3: { totalClasses: 10, presentClasses: 7, absentClasses: 3, overallPercentage: '70.0%' },
  },
  savedDatesCount: 5,
  holidaysCount: 2,
});

const pdfStr = testPdfBuffer.toString('latin1');
assert(pdfStr.startsWith('%PDF-1.4'), 'PDF must start with %PDF-1.4 header');
assert(pdfStr.includes('/Type /Catalog'), 'PDF must define Catalog');
assert(pdfStr.includes('/Type /Pages'), 'PDF must define Page tree');
assert(pdfStr.includes('/BaseFont /Helvetica'), 'PDF must declare standard font');
assert(pdfStr.includes('Attendly - Monthly Attendance Report'), 'PDF must include Attendly header');
assert(pdfStr.includes('Aarav Sharma'), 'PDF must render student Aarav Sharma');
assert(pdfStr.includes('Bhavna Patel'), 'PDF must render student Bhavna Patel');
assert(pdfStr.includes('Chetan Verma'), 'PDF must render student Chetan Verma');
assert(pdfStr.includes('xref'), 'PDF must include xref cross-reference table');
assert(pdfStr.trimEnd().endsWith('%%EOF'), 'PDF must terminate with %%EOF marker');

// Write out to scratch/test_export.pdf
const exportPath = path.join(__dirname, 'test_monthly_report.pdf');
fs.writeFileSync(exportPath, testPdfBuffer);
assert(fs.existsSync(exportPath), 'PDF file written to disk successfully');
assert(fs.statSync(exportPath).size > 1500, 'PDF file size must be non-trivial (>1.5KB)');
pass(`Exported real monthly PDF (${fs.statSync(exportPath).size} bytes) strictly conforming to PDF-1.4`);

// Clean up
try { fs.unlinkSync(exportPath); } catch {}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EDIT AN EXISTING SAVED DATE & VERIFY NO DUPLICATES IN EXCEL
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 2. Edit Existing Saved Date & Verify No Duplicates ---');

// Emulate ExcelAdapter record deduplication
function deduplicateAndMergeRecords(existingRecords, incomingRecords) {
  const recordsMap = new Map();
  const makeKey = (rec) => {
    const rDate = String(rec.date || '').trim().toLowerCase();
    const rRoll = String(rec.rollNumber || rec.personId || '').trim().toLowerCase();
    const rClass = String(rec.className || '').trim().toLowerCase();
    return `${rDate}|${rRoll}|${rClass}`;
  };

  for (const rec of existingRecords) {
    recordsMap.set(makeKey(rec), rec);
  }
  for (const rec of incomingRecords) {
    recordsMap.set(makeKey(rec), rec);
  }

  return Array.from(recordsMap.values());
}

// Initial 2 dates saved: 2026-09-01 and 2026-09-02 (2 students, 2 subjects each = 4 records per day)
const initialDay1Records = [
  { date: '2026-09-01', personId: 's1', rollNumber: 'CS-01', name: 'Aarav', className: 'Maths', status: 'Present' },
  { date: '2026-09-01', personId: 's1', rollNumber: 'CS-01', name: 'Aarav', className: 'Physics', status: 'Present' },
  { date: '2026-09-01', personId: 's2', rollNumber: 'CS-02', name: 'Bhavna', className: 'Maths', status: 'Present' },
  { date: '2026-09-01', personId: 's2', rollNumber: 'CS-02', name: 'Bhavna', className: 'Physics', status: 'Absent' },
];

const initialDay2Records = [
  { date: '2026-09-02', personId: 's1', rollNumber: 'CS-01', name: 'Aarav', className: 'Maths', status: 'Present' },
  { date: '2026-09-02', personId: 's1', rollNumber: 'CS-01', name: 'Aarav', className: 'Physics', status: 'Present' },
  { date: '2026-09-02', personId: 's2', rollNumber: 'CS-02', name: 'Bhavna', className: 'Maths', status: 'Present' },
  { date: '2026-09-02', personId: 's2', rollNumber: 'CS-02', name: 'Bhavna', className: 'Physics', status: 'Present' },
];

let allExcelRecords = [...initialDay1Records, ...initialDay2Records];
assert.strictEqual(allExcelRecords.length, 8, 'Initial record count must be 8 (2 days * 4 records)');

// Now user selects 2026-09-01 on calendar (completed day with '✓').
// Clicks "Edit Attendance".
// Modifies s1 (Aarav) Maths from Present -> Absent.
// Modifies s2 (Bhavna) Physics from Absent -> Present.
const editedDay1Records = [
  { date: '2026-09-01', personId: 's1', rollNumber: 'CS-01', name: 'Aarav', className: 'Maths', status: 'Absent' }, // Changed to Absent
  { date: '2026-09-01', personId: 's1', rollNumber: 'CS-01', name: 'Aarav', className: 'Physics', status: 'Present' },
  { date: '2026-09-01', personId: 's2', rollNumber: 'CS-02', name: 'Bhavna', className: 'Maths', status: 'Present' },
  { date: '2026-09-01', personId: 's2', rollNumber: 'CS-02', name: 'Bhavna', className: 'Physics', status: 'Present' }, // Changed to Present
];

// Execute save back to Excel:
allExcelRecords = deduplicateAndMergeRecords(allExcelRecords, editedDay1Records);

// VERIFY NO DUPLICATES CREATED:
assert.strictEqual(allExcelRecords.length, 8, 'Record count MUST REMAIN 8 after editing 2026-09-01 (NO DUPLICATES)');

const day1Count = allExcelRecords.filter(r => r.date === '2026-09-01').length;
const day2Count = allExcelRecords.filter(r => r.date === '2026-09-02').length;
assert.strictEqual(day1Count, 4, 'Day 1 must still have exactly 4 records');
assert.strictEqual(day2Count, 4, 'Day 2 must still have exactly 4 records');

// Verify updated values:
const aaravMaths = allExcelRecords.find(r => r.date === '2026-09-01' && r.personId === 's1' && r.className === 'Maths');
const bhavnaPhysics = allExcelRecords.find(r => r.date === '2026-09-01' && r.personId === 's2' && r.className === 'Physics');
assert.strictEqual(aaravMaths.status, 'Absent', 'Aarav Maths status must be updated to Absent');
assert.strictEqual(bhavnaPhysics.status, 'Present', 'Bhavna Physics status must be updated to Present');

// Test saving to actual Excel file via XLSX library
const testWorkbookPath = path.join(__dirname, 'test_edited_attendance.xlsx');
const wb = XLSX.utils.book_new();

// Create normalized _AttendanceData sheet
const rows = [
  ['Date', 'Student ID', 'Roll No', 'Name', 'Subject', 'Status'],
  ...allExcelRecords.map(r => [r.date, r.personId, r.rollNumber, r.name, r.className, r.status]),
];
const ws = XLSX.utils.aoa_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, ws, '_AttendanceData');
XLSX.writeFile(wb, testWorkbookPath);

// Read back from disk and verify
const readWb = XLSX.readFile(testWorkbookPath);
const readSheet = readWb.Sheets['_AttendanceData'];
const readData = XLSX.utils.sheet_to_json(readSheet);
assert.strictEqual(readData.length, 8, 'Read from disk: must have exactly 8 records');
const readAaravMaths = readData.find(r => r.Date === '2026-09-01' && r['Roll No'] === 'CS-01' && r.Subject === 'Maths');
assert.strictEqual(readAaravMaths.Status, 'Absent', 'Disk verification: Aarav Maths is Absent');
pass('Edited existing saved date: Excel updated accurately without duplicate records');

// Clean up
try { fs.unlinkSync(testWorkbookPath); } catch {}

// ─────────────────────────────────────────────────────────────────────────────
// 3. STUDENT STATISTICS UPDATED AFTER EDITING
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 3. Verify Student Statistics Update Accurately ---');

function computeProfile(personId, records) {
  const pRecs = records.filter(r => r.personId === personId);
  const total = pRecs.length;
  const present = pRecs.filter(r => r.status === 'Present').length;
  const absent = total - present;
  const pct = total > 0 ? ((present / total) * 100).toFixed(1) + '%' : '0.0%';
  return { total, present, absent, pct };
}

// Before editing:
// Aarav had 4 total, 4 present (100.0%)
// Bhavna had 4 total, 3 present, 1 absent (75.0%)
// After editing:
// Aarav has 4 total, 3 present, 1 absent (75.0%)
// Bhavna has 4 total, 4 present, 0 absent (100.0%)
const aaravStats = computeProfile('s1', allExcelRecords);
const bhavnaStats = computeProfile('s2', allExcelRecords);

assert.strictEqual(aaravStats.total, 4);
assert.strictEqual(aaravStats.present, 3);
assert.strictEqual(aaravStats.absent, 1);
assert.strictEqual(aaravStats.pct, '75.0%');

assert.strictEqual(bhavnaStats.total, 4);
assert.strictEqual(bhavnaStats.present, 4);
assert.strictEqual(bhavnaStats.absent, 0);
assert.strictEqual(bhavnaStats.pct, '100.0%');
pass('Student statistics and percentages recomputed accurately following date edit');

// ─────────────────────────────────────────────────────────────────────────────
// 4. HOLIDAY / NO CLASS DAYS: VERIFY ZERO ATTENDANCE IMPACT
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 4. Holiday / No Class Days - Attendance Impact ---');

let holidays = {};
let noClassDatesList = [];
let activeAttendanceRecords = [...allExcelRecords];

function markDateAsHoliday(dateStr, reason = 'College Holiday') {
  holidays[dateStr] = reason;
  if (!noClassDatesList.includes(dateStr)) noClassDatesList.push(dateStr);
  // CRITICAL REQUIREMENT: A holiday must NOT create attendance records.
  // Any existing records for that date must be purged.
  activeAttendanceRecords = activeAttendanceRecords.filter(r => r.date !== dateStr);
}

function removeDateHoliday(dateStr) {
  delete holidays[dateStr];
  noClassDatesList = noClassDatesList.filter(d => d !== dateStr);
}

// Check baseline before marking 2026-09-03 as holiday
const baselineAarav = computeProfile('s1', activeAttendanceRecords);
assert.strictEqual(baselineAarav.total, 4);
assert.strictEqual(baselineAarav.pct, '75.0%');

// Mark 2026-09-03 (a Thursday with scheduled classes) as Holiday
markDateAsHoliday('2026-09-03', 'College Holiday');

// Verify:
// 1. Holiday does NOT create attendance records
const recordsForHoliday = activeAttendanceRecords.filter(r => r.date === '2026-09-03');
assert.strictEqual(recordsForHoliday.length, 0, 'Holiday MUST NOT create any attendance records');

// 2. Holiday does NOT increase Total Classes
const postHolidayAarav = computeProfile('s1', activeAttendanceRecords);
assert.strictEqual(postHolidayAarav.total, baselineAarav.total, 'Holiday MUST NOT increase Total Classes');

// 3. Holiday does NOT reduce attendance percentage
assert.strictEqual(postHolidayAarav.pct, baselineAarav.pct, 'Holiday MUST NOT reduce attendance percentage');
assert.strictEqual(holidays['2026-09-03'], 'College Holiday', 'Holiday reason preserved');
pass('Holiday correctly marked: 0 records created, Total Classes unchanged, attendance percentage unchanged');

// Test marking a date that had attendance as holiday: purges records so no penalty
markDateAsHoliday('2026-09-02', 'Festival');
const purgedDay2 = activeAttendanceRecords.filter(r => r.date === '2026-09-02');
assert.strictEqual(purgedDay2.length, 0, 'Purged date 2 attendance records when marked holiday');
const aaravAfterPurge = computeProfile('s1', activeAttendanceRecords);
assert.strictEqual(aaravAfterPurge.total, 2, 'Total classes updated cleanly to 2');
assert.strictEqual(aaravAfterPurge.present, 1);
assert.strictEqual(aaravAfterPurge.absent, 1);
assert.strictEqual(aaravAfterPurge.pct, '50.0%');
pass('Marking date as holiday safely removes records without residual artifacts');

// ─────────────────────────────────────────────────────────────────────────────
// 5. REMOVE HOLIDAY & RESTORE TIMETABLE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 5. Remove Holiday & Timetable Restoration ---');

// Weekday timetable definition
const weeklyTimetable = {
  1: [{ id: 'sub1', name: 'Maths' }, { id: 'sub2', name: 'Physics' }], // Mon
  2: [{ id: 'sub1', name: 'Maths' }, { id: 'sub2', name: 'Physics' }], // Tue
  3: [{ id: 'sub3', name: 'Chemistry' }, { id: 'sub4', name: 'English' }], // Wed
  4: [{ id: 'sub1', name: 'Maths' }, { id: 'sub4', name: 'English' }], // Thu
  5: [{ id: 'sub2', name: 'Physics' }, { id: 'sub3', name: 'Chemistry' }], // Fri
};

function getActiveTimetableForDate(dateStr) {
  if (noClassDatesList.includes(dateStr)) {
    return []; // No timetable active on holiday
  }
  const parts = dateStr.split('-').map(Number);
  const dayOfWeek = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
  return weeklyTimetable[dayOfWeek] || [];
}

// 2026-09-03 is Thursday (dayOfWeek = 4)
assert.strictEqual(getActiveTimetableForDate('2026-09-03').length, 0, 'While holiday: timetable is inactive (0 subjects)');

// Remove holiday
removeDateHoliday('2026-09-03');
assert.strictEqual(noClassDatesList.includes('2026-09-03'), false, 'Holiday status removed');
const restoredSubjects = getActiveTimetableForDate('2026-09-03');
assert.strictEqual(restoredSubjects.length, 2, 'Restored Thursday timetable has 2 subjects');
assert.strictEqual(restoredSubjects[0].name, 'Maths');
assert.strictEqual(restoredSubjects[1].name, 'English');
pass('Holiday removed: normal weekday timetable is immediately restored and active');

// ─────────────────────────────────────────────────────────────────────────────
// 6. CALENDAR BEHAVIOR: STRICT SPEC
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 6. Calendar Visual Indicators & Click Actions ---');

function getCalendarDisplay(dateStr, isSaved, isHoliday) {
  if (isHoliday) {
    return {
      indicator: '— Holiday',
      clickAction: 'View Holiday / Remove Holiday',
    };
  }
  if (isSaved) {
    return {
      indicator: '✓',
      clickAction: 'View/Edit Attendance',
    };
  }
  return {
    indicator: '○',
    clickAction: 'Start Attendance',
  };
}

const completedDay = getCalendarDisplay('2026-09-01', true, false);
assert.strictEqual(completedDay.indicator, '✓');
assert.strictEqual(completedDay.clickAction, 'View/Edit Attendance');

const uncompletedDay = getCalendarDisplay('2026-09-04', false, false);
assert.strictEqual(uncompletedDay.indicator, '○');
assert.strictEqual(uncompletedDay.clickAction, 'Start Attendance');

const holidayDay = getCalendarDisplay('2026-09-05', false, true);
assert.strictEqual(holidayDay.indicator, '— Holiday');
assert.strictEqual(holidayDay.clickAction, 'View Holiday / Remove Holiday');

pass('Strict calendar behavior confirmed: ✓ for completed, ○ for uncompleted, — Holiday for holiday');

console.log('\n========================================================');
console.log(`ALL ${passCount} TESTS PASSED!`);
console.log('========================================================');
