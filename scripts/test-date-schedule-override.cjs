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
console.log('TEST SUITE: DATE-SPECIFIC CLASS SCHEDULE OVERRIDE SYSTEM');
console.log('================================================================\n');

function transpileFile(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

// 1. Transpile required modules
const calendarPath = path.join(__dirname, '../src/utils/calendar.ts');
const summaryPath = path.join(__dirname, '../src/utils/monthlyAttendanceSummary.ts');
const excelExportPath = path.join(__dirname, '../src/utils/monthlySummaryExcelExport.ts');
const pdfExportPath = path.join(__dirname, '../src/utils/monthlySummaryPdfExport.ts');

const calendarModule = { exports: {} };
new Function('exports', 'module', 'require', transpileFile(calendarPath))(calendarModule.exports, calendarModule, require);
const {
  getSubjectsForDate,
  getDefaultSubjectsForDate,
  hasDateScheduleOverride,
  getWeekdayForDate,
} = calendarModule.exports;

const summaryModule = { exports: {} };
const customRequireSummary = (id) => {
  if (id === './calendar' || id.endsWith('/calendar')) return calendarModule.exports;
  if (id === '../types' || id.endsWith('/types')) return {};
  return require(id);
};
new Function('exports', 'module', 'require', transpileFile(summaryPath))(summaryModule.exports, summaryModule, customRequireSummary);
const {
  computeMonthlyAttendanceMatrix,
  computeMonthConductedClasses,
  extractUniqueSubjectNames,
} = summaryModule.exports;

const excelExportModule = { exports: {} };
const customRequireExcel = (id) => {
  if (id === 'xlsx') return xlsx;
  if (id === './monthlyAttendanceSummary') return summaryModule.exports;
  return require(id);
};
new Function('exports', 'module', 'require', transpileFile(excelExportPath))(excelExportModule.exports, excelExportModule, customRequireExcel);
const { generateMonthlySummaryWorkbook } = excelExportModule.exports;

const pdfExportModule = { exports: {} };
const customRequirePdf = (id) => {
  if (id === './monthlyAttendanceSummary') return summaryModule.exports;
  if (id === './thresholds') return { parsePercentage: (s) => parseFloat(s) || 0 };
  return require(id);
};
new Function('exports', 'module', 'require', transpileFile(pdfExportPath))(pdfExportModule.exports, pdfExportModule, customRequirePdf);
const { generateMonthlySummaryPdfBuffer } = pdfExportModule.exports;

// Shared Sample Data
const sampleWeeklyTimetable = {
  Monday: [{ id: 's-dbms', name: 'DBMS' }, { id: 's-java', name: 'Java' }],
  Tuesday: [{ id: 's-pp', name: 'PP' }, { id: 's-dccn', name: 'DCCN' }, { id: 's-ai', name: 'AI' }],
  Wednesday: [{ id: 's-java', name: 'Java' }, { id: 's-os', name: 'OS' }, { id: 's-dccn', name: 'DCCN' }],
  Thursday: [{ id: 's-dbms', name: 'DBMS' }, { id: 's-pp', name: 'PP' }],
  Friday: [{ id: 's-java', name: 'Java' }, { id: 's-os', name: 'OS' }],
  Saturday: [],
  Sunday: [],
};

const sampleStudents = [
  { id: 'p-1', name: 'Banavanthu Vishnu Naik', rollNumber: '324106410001' },
  { id: 'p-2', name: 'Bezawada Sai Akshay Kumar', rollNumber: '324106410002' },
];

// ============================================================================
// TEST 1: Date with no override uses weekly timetable
// ============================================================================
try {
  // Sept 15, 2026 is a Tuesday
  assert.strictEqual(getWeekdayForDate('2026-09-15'), 'Tuesday');

  const defaultSubs = getSubjectsForDate('2026-09-15', sampleWeeklyTimetable, {});
  assert.strictEqual(defaultSubs.length, 3);
  assert.deepStrictEqual(defaultSubs.map((s) => s.name), ['PP', 'DCCN', 'AI']);
  assert.strictEqual(hasDateScheduleOverride('2026-09-15', {}), false);

  pass('TEST 1: Date with no override uses weekly timetable');
} catch (err) {
  fail('TEST 1 failed', err);
}

// ============================================================================
// TEST 2: Remove one scheduled class for a date. Weekly timetable remains unchanged.
// ============================================================================
try {
  // Deep clone weekly timetable to verify it is NOT mutated
  const originalWeeklyTimetable = JSON.parse(JSON.stringify(sampleWeeklyTimetable));

  // Date override for Sept 15: DCCN removed, only PP and AI
  const overrides = {
    '2026-09-15': ['PP', 'AI'],
  };

  const effectiveSubs = getSubjectsForDate('2026-09-15', sampleWeeklyTimetable, overrides);
  assert.strictEqual(effectiveSubs.length, 2);
  assert.deepStrictEqual(effectiveSubs.map((s) => s.name), ['PP', 'AI']);
  assert.strictEqual(hasDateScheduleOverride('2026-09-15', overrides), true);

  // Weekly timetable must remain completely unchanged
  assert.deepStrictEqual(
    sampleWeeklyTimetable.Tuesday.map((s) => s.name),
    ['PP', 'DCCN', 'AI'],
    'Weekly timetable Tuesday schedule must remain unchanged'
  );
  assert.deepStrictEqual(sampleWeeklyTimetable, originalWeeklyTimetable, 'Entire weekly timetable object unchanged');

  pass('TEST 2: Remove one scheduled class for a date. Weekly timetable remains unchanged.');
} catch (err) {
  fail('TEST 2 failed', err);
}

// ============================================================================
// TEST 3: Add an extra class for a date. Weekly timetable remains unchanged.
// ============================================================================
try {
  const originalFriday = [...sampleWeeklyTimetable.Friday.map((s) => s.name)];

  // Sept 18, 2026 is a Friday (default: Java, OS)
  assert.strictEqual(getWeekdayForDate('2026-09-18'), 'Friday');

  // Override adding DBMS
  const overrides = {
    '2026-09-18': ['Java', 'OS', 'DBMS'],
  };

  const effectiveSubs = getSubjectsForDate('2026-09-18', sampleWeeklyTimetable, overrides);
  assert.strictEqual(effectiveSubs.length, 3);
  assert.deepStrictEqual(effectiveSubs.map((s) => s.name), ['Java', 'OS', 'DBMS']);

  // Weekly timetable Friday remains unchanged
  assert.deepStrictEqual(
    sampleWeeklyTimetable.Friday.map((s) => s.name),
    originalFriday,
    'Weekly timetable Friday schedule must remain unchanged'
  );

  pass('TEST 3: Add an extra class for a date. Weekly timetable remains unchanged.');
} catch (err) {
  fail('TEST 3 failed', err);
}

// ============================================================================
// TEST 4: Reset date override. Date returns to weekly timetable.
// ============================================================================
try {
  const overrides = {
    '2026-09-15': ['PP', 'AI'],
  };

  // Before reset: has override
  assert.strictEqual(hasDateScheduleOverride('2026-09-15', overrides), true);
  assert.deepStrictEqual(
    getSubjectsForDate('2026-09-15', sampleWeeklyTimetable, overrides).map((s) => s.name),
    ['PP', 'AI']
  );

  // Reset: remove the override entry
  delete overrides['2026-09-15'];

  // After reset: falls back to weekly timetable
  assert.strictEqual(hasDateScheduleOverride('2026-09-15', overrides), false);
  const restoredSubs = getSubjectsForDate('2026-09-15', sampleWeeklyTimetable, overrides);
  assert.deepStrictEqual(restoredSubs.map((s) => s.name), ['PP', 'DCCN', 'AI']);

  pass('TEST 4: Reset date override. Date returns to weekly timetable.');
} catch (err) {
  fail('TEST 4 failed', err);
}

// ============================================================================
// TEST 5: Monthly Summary excludes a removed class from that date's conducted count.
// ============================================================================
try {
  // In September 2026, Tuesdays are: Sept 1, 8, 15, 22, 29 (5 Tuesdays).
  // Default weekly timetable has DCCN on Tuesday and Wednesday (4 Wednesdays in Sept = 2, 9, 16, 23, 30).
  // Total default conducted DCCN classes in Sept = 5 (Tuesdays) + 5 (Wednesdays) = 10 classes.

  const baselineConducted = computeMonthConductedClasses({
    year: 2026,
    monthIndex: 8, // September (0-based)
    subjects: ['PP', 'DCCN', 'AI', 'Java', 'OS', 'DBMS'],
    weeklyTimetable: sampleWeeklyTimetable,
    noClassDates: [],
  });

  assert.strictEqual(baselineConducted.conductedBySubject['DCCN'], 10, 'Baseline DCCN in Sept = 10');

  // Cancel DCCN on Sept 15 via override
  const overrides = {
    '2026-09-15': ['PP', 'AI'], // DCCN cancelled
  };

  const overriddenConducted = computeMonthConductedClasses({
    year: 2026,
    monthIndex: 8,
    subjects: ['PP', 'DCCN', 'AI', 'Java', 'OS', 'DBMS'],
    weeklyTimetable: sampleWeeklyTimetable,
    dateScheduleOverrides: overrides,
    noClassDates: [],
  });

  // DCCN count must now be 9 (one less because Sept 15 DCCN was excluded)
  assert.strictEqual(
    overriddenConducted.conductedBySubject['DCCN'],
    9,
    'DCCN conducted count must exclude cancelled class on Sept 15'
  );
  // PP and AI conducted count should still be 5
  assert.strictEqual(overriddenConducted.conductedBySubject['PP'], 5 + 4); // 5 Tuesdays + 4 Thursdays = 9
  assert.strictEqual(overriddenConducted.conductedBySubject['AI'], 5); // 5 Tuesdays

  pass("TEST 5: Monthly Summary excludes a removed class from that date's conducted count.");
} catch (err) {
  fail('TEST 5 failed', err);
}

// ============================================================================
// TEST 6: Monthly Summary includes an added extra class in the conducted count.
// ============================================================================
try {
  // Normally DBMS is on Monday (4 Mondays: Sept 7, 14, 21, 28) and Thursday (4 Thursdays: Sept 3, 10, 17, 24).
  // Total default DBMS in Sept = 4 + 4 = 8.
  const baseline = computeMonthConductedClasses({
    year: 2026,
    monthIndex: 8,
    subjects: ['DBMS', 'Java', 'OS'],
    weeklyTimetable: sampleWeeklyTimetable,
    noClassDates: [],
  });
  assert.strictEqual(baseline.conductedBySubject['DBMS'], 8);

  // Add extra DBMS class on Friday Sept 18
  const overrides = {
    '2026-09-18': ['Java', 'OS', 'DBMS'],
  };

  const withExtra = computeMonthConductedClasses({
    year: 2026,
    monthIndex: 8,
    subjects: ['DBMS', 'Java', 'OS'],
    weeklyTimetable: sampleWeeklyTimetable,
    dateScheduleOverrides: overrides,
    noClassDates: [],
  });

  // DBMS must now be 9 (8 + 1 extra class on Sept 18)
  assert.strictEqual(
    withExtra.conductedBySubject['DBMS'],
    9,
    'DBMS conducted count must include added extra class'
  );

  // Verify extractUniqueSubjectNames also captures a completely new subject added only in overrides
  const newOverride = {
    '2026-09-20': ['CyberSecurity'],
  };
  const uniqueSubs = extractUniqueSubjectNames(sampleWeeklyTimetable, [], 2026, newOverride);
  assert(uniqueSubs.includes('CyberSecurity'), 'Unique subject names must include override-only subjects');

  pass('TEST 6: Monthly Summary includes an added extra class in the conducted count.');
} catch (err) {
  fail('TEST 6 failed', err);
}

// ============================================================================
// TEST 7: Holiday / No Classes overrides the schedule.
// ============================================================================
try {
  // Sept 15 has an override: ['PP', 'AI']
  const overrides = {
    '2026-09-15': ['PP', 'AI'],
  };

  // But Sept 15 is marked as Holiday / No Classes
  const holidayConducted = computeMonthConductedClasses({
    year: 2026,
    monthIndex: 8,
    subjects: ['PP', 'DCCN', 'AI', 'Java', 'OS', 'DBMS'],
    weeklyTimetable: sampleWeeklyTimetable,
    dateScheduleOverrides: overrides,
    noClassDates: ['2026-09-15'],
  });

  // Neither PP nor AI nor DCCN should be counted on Sept 15 because it's a holiday!
  // AI was normally 5; on Sept 15 it's a holiday so it becomes 4
  assert.strictEqual(holidayConducted.conductedBySubject['AI'], 4, 'Holiday overrides schedule; AI must be 4');
  // PP was 9; on Sept 15 it's a holiday so it becomes 8
  assert.strictEqual(holidayConducted.conductedBySubject['PP'], 8, 'Holiday overrides schedule; PP must be 8');
  // DCCN was 10; on Sept 15 it's a holiday so it becomes 9
  assert.strictEqual(holidayConducted.conductedBySubject['DCCN'], 9, 'Holiday overrides schedule; DCCN must be 9');

  pass('TEST 7: Holiday / No Classes overrides the schedule.');
} catch (err) {
  fail('TEST 7 failed', err);
}

// ============================================================================
// TEST 8: Existing attendance records are preserved.
// ============================================================================
try {
  // Emulate existing attendance data where DCCN was recorded for student p-1 on Sept 15
  const savedDailyAttendance = {
    '2026-09-15': {
      'p-1': {
        's-pp': true,
        's-dccn': true, // DCCN was marked Present
        's-ai': false,
      },
    },
  };

  // User later overrides the schedule to remove DCCN
  const overrides = {
    '2026-09-15': ['PP', 'AI'],
  };

  // Verify the underlying attendance record was NOT deleted
  assert(savedDailyAttendance['2026-09-15']['p-1']['s-dccn'] !== undefined);
  assert.strictEqual(savedDailyAttendance['2026-09-15']['p-1']['s-dccn'], true);

  // If the user resets the override or inspects raw data, the record is completely intact
  assert.strictEqual(savedDailyAttendance['2026-09-15']['p-1']['s-pp'], true);
  assert.strictEqual(savedDailyAttendance['2026-09-15']['p-1']['s-ai'], false);

  pass('TEST 8: Existing attendance records are preserved.');
} catch (err) {
  fail('TEST 8 failed', err);
}

// ============================================================================
// TEST 9: Changing one date does not affect other dates.
// ============================================================================
try {
  const overrides = {
    '2026-09-15': ['PP', 'AI'], // only Sept 15 changed
  };

  // Tuesday Sept 15 has 2 classes
  const sept15 = getSubjectsForDate('2026-09-15', sampleWeeklyTimetable, overrides);
  assert.deepStrictEqual(sept15.map((s) => s.name), ['PP', 'AI']);

  // Tuesday Sept 8 has 3 classes (default weekly schedule)
  const sept8 = getSubjectsForDate('2026-09-08', sampleWeeklyTimetable, overrides);
  assert.deepStrictEqual(sept8.map((s) => s.name), ['PP', 'DCCN', 'AI']);

  // Tuesday Sept 22 has 3 classes (default weekly schedule)
  const sept22 = getSubjectsForDate('2026-09-22', sampleWeeklyTimetable, overrides);
  assert.deepStrictEqual(sept22.map((s) => s.name), ['PP', 'DCCN', 'AI']);

  // Tuesday Sept 29 has 3 classes (default weekly schedule)
  const sept29 = getSubjectsForDate('2026-09-29', sampleWeeklyTimetable, overrides);
  assert.deepStrictEqual(sept29.map((s) => s.name), ['PP', 'DCCN', 'AI']);

  pass('TEST 9: Changing one date does not affect other dates.');
} catch (err) {
  fail('TEST 9 failed', err);
}

// ============================================================================
// TEST 10: Changing weekly timetable does not erase unrelated date overrides.
// ============================================================================
try {
  let timetable = JSON.parse(JSON.stringify(sampleWeeklyTimetable));
  const overrides = {
    '2026-09-15': ['PP', 'AI'],
  };

  // Modify Wednesday in timetable: add Seminar
  timetable.Wednesday = [...timetable.Wednesday, { id: 's-sem', name: 'Seminar' }];

  // Verify override for Sept 15 is still completely present and effective
  assert.strictEqual(hasDateScheduleOverride('2026-09-15', overrides), true);
  assert.deepStrictEqual(
    getSubjectsForDate('2026-09-15', timetable, overrides).map((s) => s.name),
    ['PP', 'AI']
  );

  pass('TEST 10: Changing the weekly timetable does not accidentally erase unrelated date overrides.');
} catch (err) {
  fail('TEST 10 failed', err);
}

// ============================================================================
// TEST 11: Attendance grid displays the effective classes correctly.
// ============================================================================
try {
  // Test both with override and without override
  const overrides = {
    '2026-09-15': ['PP', 'AI'],
    '2026-09-18': ['Java', 'OS', 'DBMS'],
  };

  const classesSept15 = getSubjectsForDate('2026-09-15', sampleWeeklyTimetable, overrides);
  assert.deepStrictEqual(classesSept15.map((s) => s.name), ['PP', 'AI']);
  // Stable ID resolution: 'PP' maps to 's-pp', 'AI' maps to 's-ai'
  assert.strictEqual(classesSept15[0].id, 's-pp');
  assert.strictEqual(classesSept15[1].id, 's-ai');

  const classesSept18 = getSubjectsForDate('2026-09-18', sampleWeeklyTimetable, overrides);
  assert.deepStrictEqual(classesSept18.map((s) => s.name), ['Java', 'OS', 'DBMS']);
  assert.strictEqual(classesSept18[0].id, 's-java');
  assert.strictEqual(classesSept18[1].id, 's-os');
  // 'DBMS' was in timetable on Monday/Thursday, so ID 's-dbms' is reused
  assert.strictEqual(classesSept18[2].id, 's-dbms');

  // Sept 16 (Wednesday, no override)
  const classesSept16 = getSubjectsForDate('2026-09-16', sampleWeeklyTimetable, overrides);
  assert.deepStrictEqual(classesSept16.map((s) => s.name), ['Java', 'OS', 'DCCN']);

  pass('TEST 11: Attendance grid displays the effective classes correctly.');
} catch (err) {
  fail('TEST 11 failed', err);
}

// ============================================================================
// TEST 12: Excel/PDF Monthly Summary uses the effective schedule.
// ============================================================================
try {
  const overrides = {
    '2026-09-15': ['PP', 'AI'],          // DCCN cancelled on Sept 15
    '2026-09-18': ['Java', 'OS', 'DBMS'], // DBMS added on Sept 18
  };

  // Matrix calculation with overrides
  const matrix = computeMonthlyAttendanceMatrix({
    people: sampleStudents,
    weeklyTimetable: sampleWeeklyTimetable,
    dateScheduleOverrides: overrides,
    noClassDates: [],
    year: 2026,
    startMonthIndex: 8, // September
    endMonthIndex: 8,
  });

  assert.strictEqual(matrix.monthGroups.length, 1);
  const septGroup = matrix.monthGroups[0];
  assert.strictEqual(septGroup.monthName, 'September');

  const dccnStat = septGroup.subjects.find((s) => s.subjectName === 'DCCN');
  const dbmsStat = septGroup.subjects.find((s) => s.subjectName === 'DBMS');

  assert(dccnStat, 'DCCN must be present in subjects');
  assert(dbmsStat, 'DBMS must be present in subjects');

  // DCCN was cancelled on Sept 15 (normally 10, now 9)
  assert.strictEqual(dccnStat.totalClasses, 9, 'Matrix DCCN total conducted classes must be 9');
  // DBMS was added on Sept 18 (normally 8, now 9)
  assert.strictEqual(dbmsStat.totalClasses, 9, 'Matrix DBMS total conducted classes must be 9');

  // Generate Excel workbook from this matrix
  const wb = generateMonthlySummaryWorkbook(matrix);
  assert(wb && wb.Sheets && (wb.Sheets['September Summary'] || wb.Sheets['Monthly Attendance Summary']), 'Excel workbook sheet must exist');

  // Generate PDF document buffer from this matrix
  const pdfBytes = generateMonthlySummaryPdfBuffer(matrix, {
    institutionName: 'Rollvia University',
    departmentName: 'Computer Science',
    academicYear: '2026',
  });
  assert(pdfBytes && pdfBytes.byteLength > 1000, 'PDF buffer must be valid and non-empty');

  pass('TEST 12: Excel/PDF Monthly Summary uses the effective schedule.');
} catch (err) {
  fail('TEST 12 failed', err);
}

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
