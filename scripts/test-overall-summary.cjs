// @ts-check
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');
const xlsx = require('xlsx');

let passedTests = 0;
let failedTests = 0;

function pass(name) {
  passedTests++;
  console.log(`  [PASS] ${name}`);
}

function fail(name, err) {
  failedTests++;
  console.error(`  [FAIL] ${name}:`, err);
}

console.log('================================================================');
console.log('TEST SUITE: MONTHLY ATTENDANCE OVERALL SUMMARY (PRESENT/ABSENT/TOTAL/%)');
console.log('================================================================\n');

// 1. Transpile files
function transpile(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

const calendarPath = path.join(__dirname, '../src/utils/calendar.ts');
const summaryPath = path.join(__dirname, '../src/utils/monthlyAttendanceSummary.ts');
const excelExportPath = path.join(__dirname, '../src/utils/monthlySummaryExcelExport.ts');
const pdfExportPath = path.join(__dirname, '../src/utils/monthlySummaryPdfExport.ts');

const calendarMod = { exports: {} };
new Function('exports', 'module', 'require', transpile(calendarPath))(calendarMod.exports, calendarMod, require);

const summaryMod = { exports: {} };
const customRequire = (id) => {
  if (id === './calendar' || id.endsWith('/calendar')) return calendarMod.exports;
  if (id === '../types' || id.endsWith('/types')) return {};
  return require(id);
};
new Function('exports', 'module', 'require', transpile(summaryPath))(summaryMod.exports, summaryMod, customRequire);
const { computeMonthlyAttendanceMatrix } = summaryMod.exports;

const excelMod = { exports: {} };
const customExcelRequire = (id) => {
  if (id === 'xlsx') return xlsx;
  if (id === './monthlyAttendanceSummary' || id.endsWith('/monthlyAttendanceSummary')) return summaryMod.exports;
  return require(id);
};
new Function('exports', 'module', 'require', transpile(excelExportPath))(excelMod.exports, excelMod, customExcelRequire);
const { generateMonthlySummaryWorkbook } = excelMod.exports;

const pdfMod = { exports: {} };
new Function('exports', 'module', 'require', transpile(pdfExportPath))(pdfMod.exports, pdfMod, require);
const { generateMonthlySummaryPdfBuffer } = pdfMod.exports;

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: User Example Calculation (Present 11, Absent 95, Total 106, Attendance 10.4%)
// ─────────────────────────────────────────────────────────────────────────────
console.log('1. User Example Verification:');

try {
  const people = [{ id: 'stu_1', name: 'John Doe', rollNumber: '101' }];
  const timetable = {
    Monday: [{ id: 'sub_1', name: 'Math', time: '09:00', duration: 60 }],
    Tuesday: [{ id: 'sub_2', name: 'Physics', time: '10:00', duration: 60 }],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };

  /** @type {Array<any>} */
  const records = [];

  // Generate 11 Present records and 95 Absent records across Jan-Apr 2026
  let pCount = 0;
  let aCount = 0;

  // We create 106 records on dates in Jan..Apr
  for (let m = 0; m < 4; m++) {
    for (let d = 1; d <= 28; d++) {
      if (pCount + aCount >= 106) break;
      const dateStr = `2026-0${m + 1}-${String(d).padStart(2, '0')}`;
      const status = pCount < 11 ? 'Present' : 'Absent';
      if (status === 'Present') pCount++;
      else aCount++;

      records.push({
        id: `rec_${dateStr}_stu_1`,
        date: dateStr,
        personId: 'stu_1',
        personName: 'John Doe',
        rollNumber: '101',
        className: 'Math',
        status,
      });
    }
  }

  assert.strictEqual(pCount, 11, 'Must have 11 Present records');
  assert.strictEqual(aCount, 95, 'Must have 95 Absent records');
  assert.strictEqual(records.length, 106, 'Must have 106 total records');

  const matrix = computeMonthlyAttendanceMatrix({
    people,
    weeklyTimetable: timetable,
    attendanceRecords: records,
    year: 2026,
    startMonthIndex: 0,
    endMonthIndex: 3,
  });

  const s1 = matrix.students[0];
  assert(s1, 'Student row must exist');

  assert.strictEqual(s1.overallPresent, 11, 'overallPresent must be 11');
  assert.strictEqual(s1.overallAbsent, 95, 'overallAbsent must be 95');
  assert.strictEqual(s1.overallTotal, 106, 'overallTotal must be 106 (11 + 95)');
  assert.strictEqual(s1.overallPercentage, 10.4, 'overallPercentage must be 10.4% (11 / 106 * 100 = 10.377%)');

  pass('User Example: Present 11, Absent 95, Total 106, Attendance 10.4% calculated accurately');
} catch (err) {
  fail('User Example calculation failed', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: Multi-Student, Multi-Month & Multi-Subject Calculation
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2. Multi-Student, Multi-Month Calculation:');

try {
  const people = [
    { id: 'p_1', name: 'Alice', rollNumber: '1' },
    { id: 'p_2', name: 'Bob', rollNumber: '2' },
  ];

  const timetable = {
    Monday: [{ id: 's1', name: 'DBMS', time: '09:00', duration: 60 }],
    Tuesday: [{ id: 's2', name: 'Java', time: '10:00', duration: 60 }],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };

  // Alice: 8 Present, 2 Absent = Total 10 -> 80.0%
  // Bob: 5 Present, 15 Absent = Total 20 -> 25.0%
  /** @type {Array<any>} */
  const records = [];

  for (let i = 1; i <= 10; i++) {
    const day = String(i).padStart(2, '0');
    records.push({
      id: `r_alice_${i}`,
      date: `2026-01-${day}`,
      personId: 'p_1',
      personName: 'Alice',
      rollNumber: '1',
      className: i % 2 === 0 ? 'DBMS' : 'Java',
      status: i <= 8 ? 'Present' : 'Absent',
    });
  }

  for (let i = 1; i <= 20; i++) {
    const day = String(i).padStart(2, '0');
    records.push({
      id: `r_bob_${i}`,
      date: `2026-01-${day}`,
      personId: 'p_2',
      personName: 'Bob',
      rollNumber: '2',
      className: i % 2 === 0 ? 'DBMS' : 'Java',
      status: i <= 5 ? 'Present' : 'Absent',
    });
  }

  const matrix = computeMonthlyAttendanceMatrix({
    people,
    weeklyTimetable: timetable,
    attendanceRecords: records,
    year: 2026,
    startMonthIndex: 0,
    endMonthIndex: 0,
  });

  const alice = matrix.students.find((s) => s.student.id === 'p_1');
  const bob = matrix.students.find((s) => s.student.id === 'p_2');

  assert.strictEqual(alice.overallPresent, 8);
  assert.strictEqual(alice.overallAbsent, 2);
  assert.strictEqual(alice.overallTotal, 10);
  assert.strictEqual(alice.overallPercentage, 80.0);

  assert.strictEqual(bob.overallPresent, 5);
  assert.strictEqual(bob.overallAbsent, 15);
  assert.strictEqual(bob.overallTotal, 20);
  assert.strictEqual(bob.overallPercentage, 25.0);

  pass('Alice (8P, 2A, 10T, 80.0%) and Bob (5P, 15A, 20T, 25.0%) calculated correctly');
} catch (err) {
  fail('Multi-student calculation failed', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: savedDailyAttendance Integration
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n3. savedDailyAttendance Integration:');

try {
  const people = [{ id: 'p_10', name: 'Charlie', rollNumber: '10' }];
  const timetable = {
    Monday: [
      { id: 'c1', name: 'Math', time: '09:00', duration: 60 },
      { id: 'c2', name: 'English', time: '10:00', duration: 60 },
    ],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };

  const savedDaily = {
    '2026-01-05': {
      'p_10': { 'c1': true, 'c2': false }, // 1 Present, 1 Absent
    },
    '2026-01-12': {
      'p_10': { 'c1': true, 'c2': true },  // 2 Present, 0 Absent
    },
    '2026-01-19': {
      'p_10': { 'c1': false, 'c2': false }, // 0 Present, 2 Absent
    },
  };

  const matrix = computeMonthlyAttendanceMatrix({
    people,
    weeklyTimetable: timetable,
    savedDailyAttendance: savedDaily,
    year: 2026,
    startMonthIndex: 0,
    endMonthIndex: 0,
  });

  const charlie = matrix.students[0];
  assert.strictEqual(charlie.overallPresent, 3, 'Charlie must have 3 Present');
  assert.strictEqual(charlie.overallAbsent, 3, 'Charlie must have 3 Absent');
  assert.strictEqual(charlie.overallTotal, 6, 'Charlie must have 6 Total');
  assert.strictEqual(charlie.overallPercentage, 50.0, 'Charlie must have 50.0% Attendance');

  pass('Charlie savedDailyAttendance: 3 Present, 3 Absent, 6 Total, 50.0% verified');
} catch (err) {
  fail('savedDailyAttendance test failed', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: Excel Export Structure (Present | Absent | Total | Attendance %)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n4. Excel Export Overall Summary Headers & Values:');

try {
  const people = [{ id: 'stu_1', name: 'John Doe', rollNumber: '101' }];
  const timetable = {
    Monday: [{ id: 'sub_1', name: 'Math', time: '09:00', duration: 60 }],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };

  const matrix = computeMonthlyAttendanceMatrix({
    people,
    weeklyTimetable: timetable,
    attendanceRecords: [
      { id: '1', date: '2026-01-05', personId: 'stu_1', className: 'Math', status: 'Present' },
      { id: '2', date: '2026-01-12', personId: 'stu_1', className: 'Math', status: 'Absent' },
    ],
    year: 2026,
    startMonthIndex: 0,
    endMonthIndex: 0,
  });

  const wb = generateMonthlySummaryWorkbook(matrix);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const jsonRows = xlsx.utils.sheet_to_json(ws, { header: 1 });

  const row1 = jsonRows[1];
  assert(row1.includes('Present'), 'Excel header row 1 must include Present');
  assert(row1.includes('Absent'), 'Excel header row 1 must include Absent');
  assert(row1.includes('Total'), 'Excel header row 1 must include Total');
  assert(row1.includes('Attendance %'), 'Excel header row 1 must include Attendance %');

  const stuRow = jsonRows[2];
  // Find index of Present in row 1
  const presentIdx = row1.indexOf('Present');
  assert.strictEqual(stuRow[presentIdx], 1, 'Excel data: Present value must be 1');
  assert.strictEqual(stuRow[presentIdx + 1], 1, 'Excel data: Absent value must be 1');
  assert.strictEqual(stuRow[presentIdx + 2], 2, 'Excel data: Total value must be 2');
  assert.strictEqual(stuRow[presentIdx + 3], '50.0%', 'Excel data: Attendance % must be 50.0%');

  pass('Excel Export: Present | Absent | Total | Attendance % headers and values verified');
} catch (err) {
  fail('Excel export test failed', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: PDF Export Structure (Present | Absent | Total | Attd %)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n5. PDF Export Overall Summary Columns:');

try {
  const people = [{ id: 'stu_1', name: 'John Doe', rollNumber: '101' }];
  const timetable = {
    Monday: [{ id: 'sub_1', name: 'Math', time: '09:00', duration: 60 }],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };

  const matrix = computeMonthlyAttendanceMatrix({
    people,
    weeklyTimetable: timetable,
    attendanceRecords: [
      { id: '1', date: '2026-01-05', personId: 'stu_1', className: 'Math', status: 'Present' },
      { id: '2', date: '2026-01-12', personId: 'stu_1', className: 'Math', status: 'Absent' },
    ],
    year: 2026,
    startMonthIndex: 0,
    endMonthIndex: 0,
  });

  const pdfBuf = generateMonthlySummaryPdfBuffer(matrix, {
    institutionName: 'Rollvia University',
  });

  assert(pdfBuf instanceof Uint8Array, 'PDF buffer must be Uint8Array');
  const pdfStr = Buffer.from(pdfBuf).toString('binary');

  // Verify that PDF text commands include Present, Absent, Total, Attd %
  assert(pdfStr.includes('(Present)'), 'PDF must include (Present) header');
  assert(pdfStr.includes('(Absent)'), 'PDF must include (Absent) header');
  assert(pdfStr.includes('(Attd %)'), 'PDF must include (Attd %) header');

  pass('PDF Export: Present | Absent | Total | Attd % columns verified in PDF stream');
} catch (err) {
  fail('PDF export test failed', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6: UI Modal Source Inspection
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n6. UI Modal Code Verification:');

try {
  const modalCode = fs.readFileSync(
    path.join(__dirname, '../src/components/workspace/MonthlyAttendanceSummaryModal.tsx'),
    'utf8'
  );

  assert(modalCode.includes('Present') && modalCode.includes('Absent'), 'Modal must include Present and Absent headers');
  assert(modalCode.includes('Attendance %'), 'Modal must include Attendance % header');
  assert(modalCode.includes('sRow.overallPresent'), 'Modal must render sRow.overallPresent');
  assert(modalCode.includes('sRow.overallAbsent'), 'Modal must render sRow.overallAbsent');
  assert(modalCode.includes('sRow.overallTotal'), 'Modal must render sRow.overallTotal');
  assert(modalCode.includes('colSpan={4}'), 'Modal OVERALL SUMMARY header must span 4 columns');

  pass('UI Modal: thead and tbody render Present, Absent, Total, Attendance % across 4 columns');
} catch (err) {
  fail('UI modal test failed', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passedTests + failedTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
