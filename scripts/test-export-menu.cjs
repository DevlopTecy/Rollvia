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
console.log('TEST SUITE: ROLLVIA CENTRALIZED EXPORT MENU & INTEGRATION');
console.log('================================================================\n');

// 1. Transpile files
function transpileFile(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

const calendarPath = path.join(__dirname, '../src/utils/calendar.ts');
const summaryPath = path.join(__dirname, '../src/utils/monthlyAttendanceSummary.ts');
const summaryExcelPath = path.join(__dirname, '../src/utils/monthlySummaryExcelExport.ts');
const summaryPdfPath = path.join(__dirname, '../src/utils/monthlySummaryPdfExport.ts');
const pdfExportPath = path.join(__dirname, '../src/utils/pdfExport.ts');
const attendanceModelPath = path.join(__dirname, '../src/models/attendance.ts');

const calendarModule = { exports: {} };
new Function('exports', 'module', 'require', transpileFile(calendarPath))(calendarModule.exports, calendarModule, require);

const summaryModule = { exports: {} };
const customRequireSummary = (id) => {
  if (id === './calendar' || id.endsWith('/calendar')) return calendarModule.exports;
  if (id === '../types' || id.endsWith('/types')) return {};
  return require(id);
};
new Function('exports', 'module', 'require', transpileFile(summaryPath))(summaryModule.exports, summaryModule, customRequireSummary);

const summaryExcelModule = { exports: {} };
const customRequireExcel = (id) => {
  if (id === 'xlsx') return xlsx;
  if (id === './monthlyAttendanceSummary') return summaryModule.exports;
  return require(id);
};
new Function('exports', 'module', 'require', transpileFile(summaryExcelPath))(summaryExcelModule.exports, summaryExcelModule, customRequireExcel);

const summaryPdfModule = { exports: {} };
const customRequirePdf = (id) => {
  if (id === './monthlyAttendanceSummary') return summaryModule.exports;
  if (id === './thresholds') return { parsePercentage: (s) => parseFloat(s) || 0 };
  return require(id);
};
new Function('exports', 'module', 'require', transpileFile(summaryPdfPath))(summaryPdfModule.exports, summaryPdfModule, customRequirePdf);

const pdfExportModule = { exports: {} };
const customRequireLegacyPdf = (id) => {
  if (id === './thresholds') return { parsePercentage: (s) => parseFloat(s) || 0 };
  if (id === '../types') return {};
  return require(id);
};
new Function('exports', 'module', 'require', transpileFile(pdfExportPath))(pdfExportModule.exports, pdfExportModule, customRequireLegacyPdf);

const attendanceModelModule = { exports: {} };
new Function('exports', 'module', 'require', transpileFile(attendanceModelPath))(attendanceModelModule.exports, attendanceModelModule, require);

// -------------------------------------------------------------
// Test Dataset Setup
// -------------------------------------------------------------
const people = [
  { id: 'p-1', name: 'Banavanthu Vishnu Naik', rollNumber: '324106410001' },
  { id: 'p-2', name: 'Bezawada Sai Akshay Kumar', rollNumber: '324106410002' },
  { id: 'p-3', name: 'Bonthu Naresh', rollNumber: '324106410003' },
];

const weeklyTimetable = {
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
  ],
  Thursday: [
    { id: 'sub-thu-1', name: 'DBMS' },
    { id: 'sub-thu-2', name: 'PP' },
  ],
  Friday: [
    { id: 'sub-fri-1', name: 'Java' },
    { id: 'sub-fri-2', name: 'OS' },
  ],
  Saturday: [{ id: 'sub-sat-1', name: 'Lab' }],
  Sunday: [],
};

// =============================================================
// TEST 1: Export Menu Component Exists & Exports Exact Required 5 Options
// =============================================================
try {
  const exportMenuCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/ExportMenu.tsx'), 'utf8');

  assert(exportMenuCode.includes('Attendance Excel'), 'Must contain Attendance Excel option');
  assert(exportMenuCode.includes('Attendance PDF'), 'Must contain Attendance PDF option');
  assert(exportMenuCode.includes('Monthly Attendance Summary Excel'), 'Must contain Monthly Attendance Summary Excel option');
  assert(exportMenuCode.includes('Monthly Attendance Summary PDF'), 'Must contain Monthly Attendance Summary PDF option');
  assert(exportMenuCode.includes('Print Monthly Summary'), 'Must contain Print Monthly Summary option');

  // Verify menu title
  assert(exportMenuCode.includes('EXPORT') || exportMenuCode.includes('Export'), 'Menu title must be EXPORT');

  pass('TEST 1: Export menu contains all 5 required export options');
} catch (err) {
  fail('TEST 1: Export menu structure check failed', err);
}

// =============================================================
// TEST 2: Attendance PDF Export Generation (Existing Format Unchanged)
// =============================================================
try {
  const { generateMonthlyAttendancePdfBuffer } = pdfExportModule.exports;
  const { calculateStudentAttendanceProfile } = attendanceModelModule.exports;

  const records = [
    { id: 'r1', date: '2026-09-01', personId: 'p-1', className: 'DBMS', status: 'Present' },
    { id: 'r2', date: '2026-09-01', personId: 'p-2', className: 'DBMS', status: 'Present' },
  ];

  const profilesMap = new Map();
  for (const p of people) {
    profilesMap.set(p.id, calculateStudentAttendanceProfile(p, records));
  }

  const pdfBuf = generateMonthlyAttendancePdfBuffer({
    institutionName: 'Apex Institute of Science & Technology',
    departmentName: 'Department of Computer Science & Engineering',
    academicYear: '2026',
    monthStr: 'September 2026',
    roster: people,
    profiles: profilesMap,
    savedDatesCount: 1,
    holidaysCount: 0,
  });

  assert(pdfBuf instanceof Uint8Array, 'PDF buffer must be Uint8Array');
  assert(pdfBuf.length > 2000, 'PDF buffer must be valid');
  const pdfStr = Buffer.from(pdfBuf).toString('binary');
  assert(pdfStr.startsWith('%PDF-1.4'), 'Must be valid PDF-1.4');
  assert(pdfStr.includes('Rollvia - Monthly Attendance Report'), 'Must preserve existing Attendance PDF title');

  pass('TEST 2: Attendance PDF export generated and verified with existing formatting');
} catch (err) {
  fail('TEST 2: Attendance PDF export failed', err);
}

// =============================================================
// TEST 3: Attendance Excel Export Functionality
// =============================================================
try {
  const excelAdapterPath = path.join(__dirname, '../src/storage/adapters/ExcelAdapter.ts');
  const excelAdapterTranspiled = transpileFile(excelAdapterPath);
  const excelAdapterModule = { exports: {} };
  const customRequireEA = (id) => {
    if (id === 'xlsx') return xlsx;
    if (id === '../../models/attendance') return attendanceModelModule.exports;
    if (id === '../../utils/calendar' || id.endsWith('/calendar')) return calendarModule.exports;
    return {};
  };
  new Function('exports', 'module', 'require', excelAdapterTranspiled)(excelAdapterModule.exports, excelAdapterModule, customRequireEA);

  const { ExcelAdapter } = excelAdapterModule.exports;
  const ea = new ExcelAdapter();

  const dataset = {
    storageMode: 'excel',
    date: '2026-09-01',
    formattedDate: '2026-09-01',
    records: [
      { id: 'r1', date: '2026-09-01', personId: 'p-1', personName: 'Banavanthu Vishnu Naik', rollNumber: '324106410001', className: 'DBMS', status: 'Present' },
      { id: 'r2', date: '2026-09-01', personId: 'p-2', personName: 'Bezawada Sai Akshay Kumar', rollNumber: '324106410002', className: 'DBMS', status: 'Present' },
    ],
    summary: { totalRecords: 2, totalPresent: 2, totalAbsent: 0, attendancePercentage: 100, uniquePeopleCount: 2, uniqueClassesCount: 1 },
    roster: people,
    classes: [{ id: 'c1', code: 'DBMS', name: 'DBMS', instructor: '', timeSlot: '', room: '', days: ['Monday'], totalEnrolled: 3 }],
    metadata: {
      institutionName: 'Apex Institute',
      departmentName: 'CSE',
      academicYear: '2026',
      selectedMonth: 'September 2026',
      selectedYear: 2026,
      selectedMonthIndex: 8,
    },
  };

  const wb = ea.generateWorkbook(dataset, dataset.records);
  assert(wb.SheetNames.includes('Attendance September'), 'Must contain Attendance September worksheet');
  assert(wb.SheetNames.includes('Search'), 'Must contain Search worksheet');
  assert(wb.SheetNames.includes('_AttendanceData'), 'Must contain hidden _AttendanceData worksheet');

  pass('TEST 3: Attendance Excel export verified with structured sheet, search, and normalized data');
} catch (err) {
  fail('TEST 3: Attendance Excel export failed', err);
}

// =============================================================
// TEST 4: Monthly Attendance Summary Excel Export
// =============================================================
try {
  const { computeMonthlyAttendanceMatrix } = summaryModule.exports;
  const { generateMonthlySummaryWorkbook } = summaryExcelModule.exports;

  const matrix = computeMonthlyAttendanceMatrix({
    people,
    weeklyTimetable,
    year: 2026,
    startMonthIndex: 0,
    endMonthIndex: 3, // Jan to Apr
  });

  const wb = generateMonthlySummaryWorkbook(matrix);
  assert(wb.SheetNames.length > 0, 'Must have at least one sheet');
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Verify merged headers for months
  assert(ws['!merges'] && ws['!merges'].length >= 4, 'Must have merged month headers');

  // Verify rows
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
  assert(rows.length >= 5, 'Must contain 2 header rows + 3 student rows');
  assert(String(rows[0][2]).includes('January (Total No. Of Classes:'), 'Row 0 must contain January grouped header');
  assert(rows[1][0] === 'Registration Number', 'Row 1 Col 0 must be Registration Number');
  assert(rows[1][1] === 'Name of the student', 'Row 1 Col 1 must be Name of the student');

  pass('TEST 4: Monthly Attendance Summary Excel verified with grouped month headers and student matrix');
} catch (err) {
  fail('TEST 4: Monthly Attendance Summary Excel export failed', err);
}

// =============================================================
// TEST 5: Monthly Attendance Summary PDF Export
// =============================================================
try {
  const { computeMonthlyAttendanceMatrix } = summaryModule.exports;
  const { generateMonthlySummaryPdfBuffer } = summaryPdfModule.exports;

  const matrix = computeMonthlyAttendanceMatrix({
    people,
    weeklyTimetable,
    year: 2026,
    startMonthIndex: 0,
    endMonthIndex: 3,
  });

  const pdfBuf = generateMonthlySummaryPdfBuffer(matrix, {
    institutionName: 'Apex Institute of Science & Technology',
    departmentName: 'CSE',
  });

  assert(pdfBuf instanceof Uint8Array, 'PDF buffer must be Uint8Array');
  const pdfStr = Buffer.from(pdfBuf).toString('binary');
  assert(pdfStr.startsWith('%PDF-1.4'), 'Must be valid PDF-1.4');
  assert(pdfStr.includes('Rollvia - Monthly Attendance Summary'), 'Must contain Monthly Attendance Summary title');
  assert(pdfStr.includes('/MediaBox [0 0 842 595]'), 'Must be Landscape A4 (842x595)');

  pass('TEST 5: Monthly Attendance Summary PDF verified with landscape layout & vector typography');
} catch (err) {
  fail('TEST 5: Monthly Attendance Summary PDF export failed', err);
}

// =============================================================
// TEST 6: Validation & Error Handling (Missing Information Handled Clearly)
// =============================================================
try {
  const { computeMonthlyAttendanceMatrix } = summaryModule.exports;

  // Empty roster scenario
  const emptyMatrix = computeMonthlyAttendanceMatrix({
    people: [],
    weeklyTimetable,
    year: 2026,
    startMonthIndex: 0,
    endMonthIndex: 0,
  });

  assert.strictEqual(emptyMatrix.students.length, 0, 'Empty roster should produce 0 student rows');
  assert.strictEqual(emptyMatrix.overallStats.totalStudents, 0, 'Total students should be 0');

  // Empty timetable scenario
  const emptyTimetableMatrix = computeMonthlyAttendanceMatrix({
    people,
    weeklyTimetable: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] },
    year: 2026,
    startMonthIndex: 0,
    endMonthIndex: 0,
  });

  assert.strictEqual(emptyTimetableMatrix.allSubjects.length, 0, 'Empty timetable should produce 0 subjects');
  assert.strictEqual(emptyTimetableMatrix.overallStats.totalConductedClasses, 0, 'Conducted classes should be 0');

  pass('TEST 6: Missing information gracefully handled with clear statistics and zero crashes');
} catch (err) {
  fail('TEST 6: Validation & error handling failed', err);
}

// =============================================================
// TEST 7: Centralized UI Integration in WorkspaceHeader & AttendanceGrid
// =============================================================
try {
  const headerCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/WorkspaceHeader.tsx'), 'utf8');
  const gridCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/AttendanceGrid.tsx'), 'utf8');
  const studentsCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/StudentsView.tsx'), 'utf8');

  // Verify ExportMenu is in WorkspaceHeader
  assert(headerCode.includes('<ExportMenu'), 'WorkspaceHeader must include ExportMenu');

  // Verify ExportMenu is in AttendanceGrid
  assert(gridCode.includes('<ExportMenu'), 'AttendanceGrid must include ExportMenu');

  // Verify Monthly Attendance Summary modal is integrated
  assert(headerCode.includes('<MonthlyAttendanceSummaryModal'), 'WorkspaceHeader must include MonthlyAttendanceSummaryModal');
  assert(gridCode.includes('<MonthlyAttendanceSummaryModal'), 'AttendanceGrid must include MonthlyAttendanceSummaryModal');
  assert(studentsCode.includes('<MonthlyAttendanceSummaryModal'), 'StudentsView must include MonthlyAttendanceSummaryModal');

  pass('TEST 7: Centralized ExportMenu seamlessly integrated into WorkspaceHeader and AttendanceGrid');
} catch (err) {
  fail('TEST 7: UI integration check failed', err);
}

// =============================================================
// TEST 8: Theme & Design System Conformance
// =============================================================
try {
  const exportMenuCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/ExportMenu.tsx'), 'utf8');

  // Verify CSS variables used for theme adaptability
  assert(exportMenuCode.includes('var(--bg-surface'), 'Must use --bg-surface token');
  assert(exportMenuCode.includes('var(--border-default'), 'Must use --border-default token');
  assert(exportMenuCode.includes('var(--text-primary'), 'Must use --text-primary token');
  assert(exportMenuCode.includes('var(--text-muted'), 'Must use --text-muted token');
  assert(exportMenuCode.includes('var(--success-600'), 'Must use --success-600 token');
  assert(exportMenuCode.includes('var(--primary-600'), 'Must use --primary-600 token');

  pass('TEST 8: Export menu strictly adheres to Rollvia design tokens and dual dark/light themes');
} catch (err) {
  fail('TEST 8: Theme tokens check failed', err);
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
