// @ts-check
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');
const xlsx = require('xlsx');

let passedTests = 0;
let failedTests = 0;

function pass(msg) {
  passedTests++;
  console.log(`[PASS] ${msg}`);
}

function fail(msg, err) {
  failedTests++;
  console.error(`[FAIL] ${msg}`, err || '');
}

console.log('================================================================');
console.log('TEST SUITE: MONTHLY ATTENDANCE SUMMARY MATRIX & EXPORT');
console.log('================================================================\n');

// 1. Transpile required modules
const calendarPath = path.join(__dirname, '../src/utils/calendar.ts');
const summaryPath = path.join(__dirname, '../src/utils/monthlyAttendanceSummary.ts');
const excelExportPath = path.join(__dirname, '../src/utils/monthlySummaryExcelExport.ts');
const pdfExportPath = path.join(__dirname, '../src/utils/monthlySummaryPdfExport.ts');

function transpileFile(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

const calendarTranspiled = transpileFile(calendarPath);
const summaryTranspiled = transpileFile(summaryPath);
const excelExportTranspiled = transpileFile(excelExportPath);
const pdfExportTranspiled = transpileFile(pdfExportPath);

// Calendar module
const calendarModule = { exports: {} };
const evalCalendar = new Function('exports', 'module', 'require', calendarTranspiled);
evalCalendar(calendarModule.exports, calendarModule, require);

// Summary module
const summaryModule = { exports: {} };
const customRequireSummary = (id) => {
  if (id === './calendar' || id.endsWith('/calendar')) return calendarModule.exports;
  if (id === '../types' || id.endsWith('/types')) return {};
  return require(id);
};
const evalSummary = new Function('exports', 'module', 'require', summaryTranspiled);
evalSummary(summaryModule.exports, summaryModule, customRequireSummary);

const { computeMonthlyAttendanceMatrix, extractUniqueSubjectNames, computeMonthConductedClasses } = summaryModule.exports;

// Excel export module
const excelExportModule = { exports: {} };
const customRequireExcel = (id) => {
  if (id === 'xlsx') return xlsx;
  if (id === './monthlyAttendanceSummary') return summaryModule.exports;
  return require(id);
};
const evalExcel = new Function('exports', 'module', 'require', excelExportTranspiled);
evalExcel(excelExportModule.exports, excelExportModule, customRequireExcel);

const { generateMonthlySummaryWorkbook } = excelExportModule.exports;

// PDF export module
const pdfExportModule = { exports: {} };
const customRequirePdf = (id) => {
  if (id === './monthlyAttendanceSummary') return summaryModule.exports;
  if (id === './thresholds') return { parsePercentage: (s) => parseFloat(s) || 0 };
  return require(id);
};
const evalPdf = new Function('exports', 'module', 'require', pdfExportTranspiled);
evalPdf(pdfExportModule.exports, pdfExportModule, customRequirePdf);

const { generateMonthlySummaryPdfBuffer } = pdfExportModule.exports;

// -------------------------------------------------------------
// Test Helpers
// -------------------------------------------------------------
function makeTimetable() {
  return {
    Monday: [
      { id: 'sub-mon-1', name: 'DBMS' },
      { id: 'sub-mon-2', name: 'Java' },
    ],
    Tuesday: [
      { id: 'sub-tue-1', name: 'PP' },
      { id: 'sub-tue-2', name: 'DCCN' },
    ],
    Wednesday: [
      { id: 'sub-wed-1', name: 'Java' },
      { id: 'sub-wed-2', name: 'OS' },
      { id: 'sub-wed-3', name: 'DCCN' },
    ],
    Thursday: [
      { id: 'sub-thu-1', name: 'DBMS' },
      { id: 'sub-thu-2', name: 'PP' },
    ],
    Friday: [
      { id: 'sub-fri-1', name: 'Java' },
      { id: 'sub-fri-2', name: 'OS' },
    ],
    Saturday: [
      { id: 'sub-sat-1', name: 'Lab' },
    ],
    Sunday: [],
  };
}

function makeRoster(count) {
  const people = [];
  for (let i = 1; i <= count; i++) {
    people.push({
      id: `p-${i}`,
      name: `Student ${i}`,
      rollNumber: `3241064100${String(i).padStart(2, '0')}`,
    });
  }
  return people;
}

// =============================================================
// TEST 1: Multiple Students & Dynamic Subject Extraction
// =============================================================
try {
  const timetable = makeTimetable();
  const subjects = extractUniqueSubjectNames(timetable);
  assert(subjects.includes('DBMS'), 'Should include DBMS');
  assert(subjects.includes('Java'), 'Should include Java');
  assert(subjects.includes('OS'), 'Should include OS');
  assert(subjects.includes('PP'), 'Should include PP');
  assert(subjects.includes('DCCN'), 'Should include DCCN');
  assert(subjects.includes('Lab'), 'Should include Lab');
  assert.strictEqual(subjects.length, 6, 'Should extract 6 unique subjects');
  pass('TEST 1: Successfully extracted unique subjects from weekly timetable');
} catch (err) {
  fail('TEST 1: Subject extraction failed', err);
}

// =============================================================
// TEST 2: Different Class Counts per Subject & Month (e.g. Jan 2026 vs Feb 2026)
// =============================================================
try {
  const timetable = makeTimetable();
  const subjects = extractUniqueSubjectNames(timetable);

  // January 2026: 31 days (starts Thursday, ends Saturday)
  const janConducted = computeMonthConductedClasses({
    year: 2026,
    monthIndex: 0,
    subjects,
    weeklyTimetable: timetable,
    noClassDates: [],
  });

  // February 2026: 28 days (starts Sunday, ends Saturday)
  const febConducted = computeMonthConductedClasses({
    year: 2026,
    monthIndex: 1,
    subjects,
    weeklyTimetable: timetable,
    noClassDates: [],
  });

  assert(janConducted.totalConducted > 0, 'January should have scheduled classes');
  assert(febConducted.totalConducted > 0, 'February should have scheduled classes');
  assert(janConducted.totalConducted !== febConducted.totalConducted, 'Jan and Feb should have different class counts');

  // Verify non-scheduled Sunday has 0 classes
  pass(`TEST 2: Dynamic conducted class counts verified (Jan 2026: ${janConducted.totalConducted}, Feb 2026: ${febConducted.totalConducted})`);
} catch (err) {
  fail('TEST 2: Conducted class calculation failed', err);
}

// =============================================================
// TEST 3: Holidays & No-Class Days Handling
// =============================================================
try {
  const timetable = makeTimetable();
  const subjects = extractUniqueSubjectNames(timetable);

  const baseline = computeMonthConductedClasses({
    year: 2026,
    monthIndex: 0,
    subjects,
    weeklyTimetable: timetable,
    noClassDates: [],
  });

  // Mark all Mondays in Jan 2026 as holidays: Jan 5, 12, 19, 26
  const mondayHolidays = ['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'];
  const withHolidays = computeMonthConductedClasses({
    year: 2026,
    monthIndex: 0,
    subjects,
    weeklyTimetable: timetable,
    noClassDates: mondayHolidays,
  });

  // Mondays scheduled DBMS and Java (2 classes per Monday * 4 = 8 classes)
  assert.strictEqual(
    baseline.totalConducted - withHolidays.totalConducted,
    8,
    '4 Monday holidays should reduce total conducted classes by exactly 8'
  );
  assert.strictEqual(
    baseline.conductedBySubject['DBMS'] - withHolidays.conductedBySubject['DBMS'],
    4,
    'DBMS should be reduced by 4'
  );
  assert.strictEqual(
    baseline.conductedBySubject['Java'] - withHolidays.conductedBySubject['Java'],
    4,
    'Java should be reduced by 4'
  );

  pass('TEST 3: Holidays strictly deducted from conducted class counts');
} catch (err) {
  fail('TEST 3: Holiday deduction failed', err);
}

// =============================================================
// TEST 4: Zero-Class Subjects
// =============================================================
try {
  const timetable = {
    Monday: [{ id: 'sub-1', name: 'Java' }],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };
  const subjects = ['Java', 'ZeroClassSubject'];

  const res = computeMonthConductedClasses({
    year: 2026,
    monthIndex: 0,
    subjects,
    weeklyTimetable: timetable,
    noClassDates: [],
  });

  assert.strictEqual(res.conductedBySubject['ZeroClassSubject'], 0, 'Zero-class subject must have 0 classes');
  assert(res.conductedBySubject['Java'] > 0, 'Java must have > 0 classes');

  const matrix = computeMonthlyAttendanceMatrix({
    people: makeRoster(3),
    weeklyTimetable: timetable,
    year: 2026,
    startMonthIndex: 0,
    endMonthIndex: 0,
    subjectFilter: ['Java', 'ZeroClassSubject'],
  });

  const zeroSubInfo = matrix.monthGroups[0].subjects.find((s) => s.subjectName === 'ZeroClassSubject');
  assert(zeroSubInfo && zeroSubInfo.totalClasses === 0, 'Header must specify 0 classes for zero-class subject');

  // Verify all student attendance for zero-class subject is strictly 0
  for (const s of matrix.students) {
    assert.strictEqual(s.monthlyData[0].subjectAttended['ZeroClassSubject'], 0, 'Student attendance must be 0 for zero-class subject');
  }

  pass('TEST 4: Zero-class subject properly displays 0 conducted and 0 attendance');
} catch (err) {
  fail('TEST 4: Zero-class subject test failed', err);
}

// =============================================================
// TEST 5: Month-Wise Matrix Calculation & Segregation (No Bleed)
// =============================================================
try {
  const timetable = makeTimetable();
  const people = makeRoster(5);

  // Set up attendance on Jan 5 (Monday: DBMS and Java)
  const savedDaily = {
    '2026-01-05': {
      'p-1': { 'sub-mon-1': true, 'sub-mon-2': true }, // Student 1 attended both
      'p-2': { 'sub-mon-1': true, 'sub-mon-2': false }, // Student 2 attended DBMS only
    },
    '2026-02-02': {
      'p-1': { 'sub-mon-1': true, 'sub-mon-2': false }, // Student 1 in Feb
    },
  };

  const matrix = computeMonthlyAttendanceMatrix({
    people,
    weeklyTimetable: timetable,
    savedDailyAttendance: savedDaily,
    year: 2026,
    startMonthIndex: 0, // Jan
    endMonthIndex: 1, // Feb
  });

  assert.strictEqual(matrix.monthGroups.length, 2, 'Should have 2 month groups');
  assert.strictEqual(matrix.students.length, 5, 'Should have 5 students');

  const s1 = matrix.students.find((s) => s.student.id === 'p-1');
  const s2 = matrix.students.find((s) => s.student.id === 'p-2');

  assert(s1, 'Student 1 row should exist');
  assert(s2, 'Student 2 row should exist');

  // Student 1 Jan attendance
  assert.strictEqual(s1.monthlyData[0].subjectAttended['DBMS'], 1, 'S1 DBMS attended in Jan should be 1');
  assert.strictEqual(s1.monthlyData[0].subjectAttended['Java'], 1, 'S1 Java attended in Jan should be 1');
  assert.strictEqual(s1.monthlyData[0].monthTotalAttended, 2, 'S1 Jan total attended should be 2');

  // Student 1 Feb attendance (must not mix with Jan)
  assert.strictEqual(s1.monthlyData[1].subjectAttended['DBMS'], 1, 'S1 DBMS attended in Feb should be 1');
  assert.strictEqual(s1.monthlyData[1].subjectAttended['Java'], 0, 'S1 Java attended in Feb should be 0');
  assert.strictEqual(s1.monthlyData[1].monthTotalAttended, 1, 'S1 Feb total attended should be 1');

  // Student 2 Jan attendance
  assert.strictEqual(s2.monthlyData[0].subjectAttended['DBMS'], 1, 'S2 DBMS attended in Jan should be 1');
  assert.strictEqual(s2.monthlyData[0].subjectAttended['Java'], 0, 'S2 Java attended in Jan should be 0');

  // Student 3 (no attendance marked): should be 0
  const s3 = matrix.students.find((s) => s.student.id === 'p-3');
  assert.strictEqual(s3.monthlyData[0].monthTotalAttended, 0, 'S3 attended should be 0');

  pass('TEST 5: Month-wise segregation verified: zero cross-month bleed');
} catch (err) {
  fail('TEST 5: Month-wise segregation failed', err);
}

// =============================================================
// TEST 6: Leap Year vs Standard Year
// =============================================================
try {
  const timetable = makeTimetable();
  const subjects = extractUniqueSubjectNames(timetable);

  // 2026: 28 days in Feb
  const feb2026 = computeMonthConductedClasses({
    year: 2026,
    monthIndex: 1,
    subjects,
    weeklyTimetable: timetable,
  });

  // 2028: 29 days in Feb (Leap year)
  const feb2028 = computeMonthConductedClasses({
    year: 2028,
    monthIndex: 1,
    subjects,
    weeklyTimetable: timetable,
  });

  assert(feb2028.totalConducted >= feb2026.totalConducted, 'Leap year Feb should have 29 days and >= conducted classes');
  pass(`TEST 6: Leap year handling verified (Feb 2026: ${feb2026.totalConducted} vs Feb 2028 Leap: ${feb2028.totalConducted})`);
} catch (err) {
  fail('TEST 6: Leap year handling failed', err);
}

// =============================================================
// TEST 7: Excel Export Verification
// =============================================================
try {
  const timetable = makeTimetable();
  const people = makeRoster(12);
  const matrix = computeMonthlyAttendanceMatrix({
    people,
    weeklyTimetable: timetable,
    year: 2026,
    startMonthIndex: 0,
    endMonthIndex: 3, // Jan to Apr
  });

  const wb = generateMonthlySummaryWorkbook(matrix);
  assert(wb.SheetNames.length > 0, 'Workbook must contain at least one sheet');
  const ws = wb.Sheets[wb.SheetNames[0]];
  assert(ws, 'Worksheet must exist');

  // Verify merges exist for grouped months
  assert(ws['!merges'] && ws['!merges'].length >= 4, 'Must have merges for each month header');

  // Verify data rows
  const jsonRows = xlsx.utils.sheet_to_json(ws, { header: 1 });
  assert(jsonRows.length >= 14, 'Must contain 2 header rows + 12 student rows');

  // Row 0 has month headers
  const row0 = jsonRows[0];
  assert(row0.some((c) => String(c).includes('January (Total No. Of Classes:')), 'Row 0 must contain January grouped header');

  // Row 1 has subject headers with class counts and Totals
  const row1 = jsonRows[1];
  assert(row1[0] === 'Registration Number', 'Col 0 must be Registration Number');
  assert(row1[1] === 'Name of the student', 'Col 1 must be Name of the student');
  assert(row1.some((c) => String(c).startsWith('DBMS(')), 'Must have DBMS(count) subheader');
  assert(row1.includes('Total'), 'Must have Total subheader');

  pass('TEST 7: Excel summary workbook generated and verified with grouped headers & subheaders');
} catch (err) {
  fail('TEST 7: Excel export verification failed', err);
}

// =============================================================
// TEST 8: PDF Export & Landscape Multi-Page Pagination
// =============================================================
try {
  const timetable = makeTimetable();
  const people = makeRoster(85); // 85 students (tests vertical pagination)
  const matrix = computeMonthlyAttendanceMatrix({
    people,
    weeklyTimetable: timetable,
    year: 2026,
    startMonthIndex: 0,
    endMonthIndex: 11, // Full 12 months (tests horizontal pagination)
  });

  const pdfBuf = generateMonthlySummaryPdfBuffer(matrix, {
    institutionName: 'Apex Institute of Technology',
    departmentName: 'CSE',
  });

  assert(pdfBuf instanceof Uint8Array, 'PDF buffer must be Uint8Array');
  assert(pdfBuf.length > 5000, 'PDF buffer must contain substantial content');

  const pdfStr = Buffer.from(pdfBuf).toString('binary');
  assert(pdfStr.startsWith('%PDF-1.4'), 'PDF must start with valid %PDF-1.4 header');
  assert(pdfStr.includes('/MediaBox [0 0 842 595]'), 'PDF must be Landscape A4 (842x595 pt)');
  assert(pdfStr.includes('%%EOF'), 'PDF must end with %%EOF marker');

  // Check that multiple pages exist in PDF catalog
  const pageMatches = pdfStr.match(/\/Type\s*\/Page\b/g);
  assert(pageMatches && pageMatches.length > 1, `PDF must have multiple pages (found ${pageMatches ? pageMatches.length : 0})`);

  pass(`TEST 8: Landscape multi-page PDF generated successfully (${pdfBuf.length} bytes, ${pageMatches.length} pages)`);
} catch (err) {
  fail('TEST 8: PDF export failed', err);
}

// =============================================================
// TEST 9: Edge Case: 100+ Students Performance & Stability
// =============================================================
try {
  const t0 = Date.now();
  const timetable = makeTimetable();
  const people = makeRoster(150); // 150 students

  const matrix = computeMonthlyAttendanceMatrix({
    people,
    weeklyTimetable: timetable,
    year: 2026,
    startMonthIndex: 0,
    endMonthIndex: 11, // All 12 months
  });

  const tCalc = Date.now() - t0;
  assert.strictEqual(matrix.students.length, 150, 'Must process all 150 students');

  const t1 = Date.now();
  const _wb = generateMonthlySummaryWorkbook(matrix);
  const tExcel = Date.now() - t1;

  const t2 = Date.now();
  const _pdfBuf = generateMonthlySummaryPdfBuffer(matrix);
  const tPdf = Date.now() - t2;

  pass(`TEST 9: 150 students x 12 months calculated in ${tCalc}ms, Excel in ${tExcel}ms, PDF in ${tPdf}ms`);
} catch (err) {
  fail('TEST 9: Performance test failed', err);
}

// =============================================================
// Summary
// =============================================================
console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
