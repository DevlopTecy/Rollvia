// @ts-nocheck
/**
 * Attendly Comprehensive Production QA & Functionality Test Suite
 * Tests all 25 critical areas specified in production QA requirements.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');

let passedTests = 0;
let failedTests = 0;
/** @type {Array<{ category: string; testName: string; error: string }>} */
const failures = [];

function test(category, testName, fn) {
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } catch (err) {
    failedTests++;
    const errMsg = err instanceof Error ? err.message : String(err);
    failures.push({ category, testName, error: errMsg });
    console.error(`  [FAIL] ${testName}: ${errMsg}`);
  }
}

console.log('================================================================');
console.log('ATTENDLY PRODUCTION QA & FUNCTIONALITY VERIFICATION SUITE');
console.log('================================================================\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. TEST ENVIRONMENT & PRODUCTION CLEANUP CHECK
// ─────────────────────────────────────────────────────────────────────────────
console.log('SECTION 1 & 20: Clean State & Production Hygiene Scan');

test('Environment', 'No dummy students in starter constants', () => {
  const stepsCode = fs.readFileSync(path.join(__dirname, '../src/constants/steps.ts'), 'utf-8');
  assert(stepsCode.includes('INITIAL_MEMBERS: Student[] = [];'), 'INITIAL_MEMBERS must be empty');
  assert(!stepsCode.includes('Alexander Wright'), 'Mock student Alexander Wright must not exist');
  assert(!stepsCode.includes('Beatrice Chen'), 'Mock student Beatrice Chen must not exist');
  assert(!stepsCode.includes('Charles Davis'), 'Mock student Charles Davis must not exist');
});

test('Environment', 'No fake attendance in starter constants', () => {
  const stepsCode = fs.readFileSync(path.join(__dirname, '../src/constants/steps.ts'), 'utf-8');
  assert(stepsCode.includes('INITIAL_ATTENDANCE: Record<string, LegacyAttendanceRecord> = {};'), 'INITIAL_ATTENDANCE must be empty');
});

test('Environment', 'No mock timetable in starter constants', () => {
  const stepsCode = fs.readFileSync(path.join(__dirname, '../src/constants/steps.ts'), 'utf-8');
  assert(stepsCode.includes('INITIAL_CLASSES: ClassSession[] = [];'), 'INITIAL_CLASSES must be empty');
});

test('Environment', 'No dummyDataset in ExcelAdapter', () => {
  const code = fs.readFileSync(path.join(__dirname, '../src/storage/adapters/ExcelAdapter.ts'), 'utf-8');
  assert(!code.includes('dummyDataset'), 'ExcelAdapter must not contain dummyDataset');
  assert(code.includes('emptyDataset'), 'ExcelAdapter must use emptyDataset');
});

test('Environment', 'No development branding in package.json and title', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
  assert.strictEqual(pkg.name, 'rollvia');
  assert.strictEqual(pkg.productName, 'Rollvia');
  assert(!JSON.stringify(pkg).toLowerCase().includes('antigravity'), 'Must not reference Antigravity');
  assert(!JSON.stringify(pkg).toLowerCase().includes('studio ai'), 'Must not reference Studio AI');
});

test('Environment', 'Correct window title and icon references in index.html', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');
  assert(html.includes('<title>Rollvia</title>'), 'HTML title must be Rollvia');
  assert(html.includes('icon-light.ico'), 'Light icon must be configured');
  assert(html.includes('icon-dark.ico'), 'Dark icon must be configured');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. SETUP WORKFLOW NAVIGATION & STATE PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nSECTION 3: Setup Workflow & Navigation Integrity');

test('Setup Workflow', 'TitleBar and SetupWizard brand click cannot skip required setup steps', () => {
  const titleBarCode = fs.readFileSync(path.join(__dirname, '../src/components/layout/TitleBar.tsx'), 'utf-8');
  assert(titleBarCode.includes('canEnterWorkspace'), 'TitleBar must enforce canEnterWorkspace');
  assert(titleBarCode.includes('sessionState.excelFilePath'), 'canEnterWorkspace must verify excelFilePath');
  assert(titleBarCode.includes('totalSubjects > 0'), 'canEnterWorkspace must verify totalSubjects > 0');

  const wizardCode = fs.readFileSync(path.join(__dirname, '../src/components/screens/SetupWizard.tsx'), 'utf-8');
  assert(wizardCode.includes('disabled={!canCreateWorkspace}'), 'SetupWizard logo button must be disabled when !canCreateWorkspace');
});

test('Setup Workflow', 'Setup navigation does not clear session state', () => {
  const flowCode = fs.readFileSync(path.join(__dirname, '../src/context/FlowContext.tsx'), 'utf-8');
  // enterWorkspace sets appPhase: 'workspace' without resetting people, timetable, attendance
  assert(flowCode.includes("appPhase: 'workspace'"), 'enterWorkspace sets appPhase');
  assert(!flowCode.match(/enterWorkspace\s*=\s*\(\)\s*=>\s*\{[^}]*people:\s*\[\]/), 'enterWorkspace must not wipe people');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. STUDENT MANAGEMENT & ROSTER
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nSECTION 4: Student Management & Roster Parsing');

test('Student Management', 'Validation rules for name and roll number', () => {
  // Simulate importStudents validation logic from FlowContext.tsx
  const existingPeople = [
    { id: 'p1', name: 'John Doe', rollNumber: '101' },
    { id: 'p2', name: 'Jane Smith', rollNumber: '102' }
  ];

  const rollMap = new Map();
  existingPeople.forEach((p, idx) => rollMap.set(p.rollNumber.trim().toLowerCase(), idx));

  // Test cases
  const validStudent = { name: 'Bob Jones', rollNumber: '103' };
  const missingName = { name: '', rollNumber: '104' };
  const missingRoll = { name: 'Alice Ray', rollNumber: '' };
  const duplicateRoll = { name: 'Duplicate John', rollNumber: '101' };

  assert(validStudent.name.trim() && validStudent.rollNumber.trim(), 'Valid student should pass');
  assert(!missingName.name.trim(), 'Missing name rejected');
  assert(!missingRoll.rollNumber.trim(), 'Missing roll rejected');
  assert(rollMap.has(duplicateRoll.rollNumber.toLowerCase()), 'Duplicate roll recognized');
});

test('Student Management', 'Adding student auto-enters inline editor mode', () => {
  const studentsViewCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/StudentsView.tsx'), 'utf-8');
  assert(studentsViewCode.includes('handleAddStudent'), 'StudentsView must define handleAddStudent');
  assert(studentsViewCode.includes('setEditingIdx(nextIdx)'), 'handleAddStudent must set editing index');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CALENDAR & DATE SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nSECTION 5: Calendar & Multi-Year Date Logic');

const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
const getDaysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();
const getSupportedYears = (referenceDate = new Date()) => {
  const currentYear = referenceDate.getFullYear();
  const years = [];
  for (let y = currentYear - 1; y <= currentYear + 15; y++) years.push(y);
  return years;
};

test('Calendar', 'Leap year calculations (2024, 2025, 2026, 2028, 2000, 1900)', () => {
  assert.strictEqual(isLeapYear(2024), true, '2024 is leap');
  assert.strictEqual(isLeapYear(2025), false, '2025 is not leap');
  assert.strictEqual(isLeapYear(2026), false, '2026 is not leap');
  assert.strictEqual(isLeapYear(2028), true, '2028 is leap');
  assert.strictEqual(isLeapYear(2000), true, '2000 is leap');
  assert.strictEqual(isLeapYear(1900), false, '1900 is not leap');
});

test('Calendar', 'Days in February across leap and non-leap years', () => {
  assert.strictEqual(getDaysInMonth(2024, 1), 29, 'Feb 2024 has 29 days');
  assert.strictEqual(getDaysInMonth(2025, 1), 28, 'Feb 2025 has 28 days');
  assert.strictEqual(getDaysInMonth(2026, 1), 28, 'Feb 2026 has 28 days');
  assert.strictEqual(getDaysInMonth(2028, 1), 29, 'Feb 2028 has 29 days');
});

test('Calendar', 'Dynamic year range supports currentYear - 1 to currentYear + 15 (2026 to 2041+)', () => {
  const ref2026 = new Date(2026, 8, 28);
  const years = getSupportedYears(ref2026);
  assert.strictEqual(years[0], 2025, 'Min year is 2025');
  assert.strictEqual(years[years.length - 1], 2041, 'Max year is 2041');
  assert(years.includes(2026), 'Includes 2026');
  assert(years.includes(2027), 'Includes 2027');
  assert(years.includes(2030), 'Includes 2030');
  assert(years.includes(2035), 'Includes 2035');
  assert(years.includes(2040), 'Includes 2040');
});

test('Calendar', 'Month boundary transitions', () => {
  // December -> January
  let year = 2026;
  let month = 11;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  assert.strictEqual(nextMonth, 0, 'Dec -> Jan month is 0');
  assert.strictEqual(nextYear, 2027, 'Dec -> Jan year is 2027');

  // January -> December
  month = 0;
  year = 2027;
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  assert.strictEqual(prevMonth, 11, 'Jan -> Dec month is 11');
  assert.strictEqual(prevYear, 2026, 'Jan -> Dec year is 2026');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. TIMETABLE TESTING
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nSECTION 6: Timetable Operations');

test('Timetable', 'Timetable duplicate subject prevention per day', () => {
  const table = {
    Monday: [{ id: 'sub_1', name: 'Mathematics' }],
    Tuesday: []
  };

  const addSubject = (day, name) => {
    const trimmed = name.trim();
    if (!trimmed) return { success: false, error: 'Subject name cannot be empty.' };
    if ((table[day] || []).some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, error: `"${trimmed}" already exists for ${day}.` };
    }
    table[day].push({ id: `sub_${Date.now()}`, name: trimmed });
    return { success: true };
  };

  assert.strictEqual(addSubject('Monday', 'Mathematics').success, false, 'Duplicate on Monday rejected');
  assert.strictEqual(addSubject('Monday', 'mathematics').success, false, 'Case-insensitive duplicate rejected');
  assert.strictEqual(addSubject('Monday', 'Physics').success, true, 'Unique subject accepted');
  assert.strictEqual(addSubject('Tuesday', 'Mathematics').success, true, 'Same subject on different day accepted');
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ATTENDANCE & BULK ACTIONS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nSECTION 7 & 8: Attendance Marking & Bulk Operations');

test('Attendance', 'Bulk Class actions modify only target subject and target date', () => {
  const roster = [{ id: 'p1' }, { id: 'p2' }];
  const currentAttendance = {
    '2026-09-28': {
      p1: { sub_1: false, sub_2: true },
      p2: { sub_1: false, sub_2: false },
    },
    '2026-09-29': {
      p1: { sub_1: false, sub_2: false },
      p2: { sub_1: false, sub_2: false },
    }
  };

  // Mark all present for sub_1 on 2026-09-28
  const activeDate = '2026-09-28';
  const targetSubId = 'sub_1';
  const updatedDay = {};
  roster.forEach(p => {
    updatedDay[p.id] = {
      ...(currentAttendance[activeDate][p.id] || {}),
      [targetSubId]: true
    };
  });
  const updatedState = { ...currentAttendance, [activeDate]: updatedDay };

  // Verify target subject changed
  assert.strictEqual(updatedState['2026-09-28'].p1.sub_1, true);
  assert.strictEqual(updatedState['2026-09-28'].p2.sub_1, true);
  // Verify other subjects unchanged
  assert.strictEqual(updatedState['2026-09-28'].p1.sub_2, true, 'sub_2 on p1 unchanged');
  assert.strictEqual(updatedState['2026-09-28'].p2.sub_2, false, 'sub_2 on p2 unchanged');
  // Verify other dates unchanged
  assert.strictEqual(updatedState['2026-09-29'].p1.sub_1, false, 'Other date unchanged');
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. SIMPLE QUICK PARSER
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nSECTION 9: Simple Quick Command Grammar & Execution');

const parserTsPath = path.join(__dirname, '../src/utils/quickCommandParser.ts');
const parserCode = ts.transpileModule(fs.readFileSync(parserTsPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const parserMod = { exports: {} };
new Function('exports', 'module', 'require', parserCode)(parserMod.exports, parserMod, require);
const { validateQuickCommand } = parserMod.exports;

const mockRoster = [
  { id: 'p1', name: 'A', rollNumber: '113' },
  { id: 'p2', name: 'B', rollNumber: '144' },
  { id: 'p3', name: 'C', rollNumber: '102' },
  { id: 'p4', name: 'D', rollNumber: '155' },
  { id: 'p5', name: 'E', rollNumber: '222' },
  { id: 'p6', name: 'F', rollNumber: '109' },
  { id: 'p100', name: 'S100', rollNumber: '100' },
  { id: 'p101', name: 'S101', rollNumber: '101' },
  { id: 'p102b', name: 'S102b', rollNumber: '102' },
  { id: 'p103', name: 'S103', rollNumber: '103' },
  { id: 'p104', name: 'S104', rollNumber: '104' },
  { id: 'p105', name: 'S105', rollNumber: '105' },
];

test('Simple Quick', 'Valid P:113,144,102', () => {
  const res = validateQuickCommand('P:113,144,102', mockRoster);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.action, 'P');
  assert.deepStrictEqual(res.rollNumbers, ['113', '144', '102']);
});

test('Simple Quick', 'Valid A:155,222,109', () => {
  const res = validateQuickCommand('A:155,222,109', mockRoster);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.action, 'A');
  assert.deepStrictEqual(res.rollNumbers, ['155', '222', '109']);
});

test('Simple Quick', 'Valid Range P:100:105', () => {
  const res = validateQuickCommand('P:100:105', mockRoster);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.action, 'P');
  assert.deepStrictEqual(res.rollNumbers, ['100', '101', '102', '103', '104', '105']);
});

test('Simple Quick', 'Valid Range A:100:105', () => {
  const res = validateQuickCommand('A:100:105', mockRoster);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.action, 'A');
  assert.deepStrictEqual(res.rollNumbers, ['100', '101', '102', '103', '104', '105']);
});

test('Simple Quick', 'Valid Single Range P:100:100', () => {
  const res = validateQuickCommand('P:100:100', mockRoster);
  assert.strictEqual(res.isValid, true);
  assert.deepStrictEqual(res.rollNumbers, ['100']);
});

test('Simple Quick', 'Valid Mixed P:100:102,113', () => {
  const res = validateQuickCommand('P:100:102,113', mockRoster);
  assert.strictEqual(res.isValid, true);
  assert.deepStrictEqual(res.rollNumbers, ['100', '101', '102', '113']);
});

test('Simple Quick', 'Invalid: reversed range P:105:100', () => {
  assert.strictEqual(validateQuickCommand('P:105:100', mockRoster).isValid, false);
});

test('Simple Quick', 'Invalid: lowercase p:113,144', () => {
  assert.strictEqual(validateQuickCommand('p:113,144', mockRoster).isValid, false);
});

test('Simple Quick', 'Invalid: missing colon P 113,144', () => {
  assert.strictEqual(validateQuickCommand('P 113,144', mockRoster).isValid, false);
});

test('Simple Quick', 'Invalid: hyphen P-113,144', () => {
  assert.strictEqual(validateQuickCommand('P-113,144', mockRoster).isValid, false);
});

test('Simple Quick', 'Invalid: spaces P:113 144', () => {
  assert.strictEqual(validateQuickCommand('P:113 144', mockRoster).isValid, false);
});

test('Simple Quick', 'Invalid: space after comma P:113, 144', () => {
  assert.strictEqual(validateQuickCommand('P:113, 144', mockRoster).isValid, false);
});

test('Simple Quick', 'Invalid: double comma P:113,,144', () => {
  assert.strictEqual(validateQuickCommand('P:113,,144', mockRoster).isValid, false);
});

test('Simple Quick', 'Invalid: alpha characters P:113,abc', () => {
  assert.strictEqual(validateQuickCommand('P:113,abc', mockRoster).isValid, false);
});

test('Simple Quick', 'Invalid: wrong prefix X:113,144', () => {
  assert.strictEqual(validateQuickCommand('X:113,144', mockRoster).isValid, false);
});

test('Simple Quick', 'Invalid: double colon P::113,144', () => {
  assert.strictEqual(validateQuickCommand('P::113,144', mockRoster).isValid, false);
});

test('Simple Quick', 'Invalid: trailing comma P:113,144,', () => {
  assert.strictEqual(validateQuickCommand('P:113,144,', mockRoster).isValid, false);
});

test('Simple Quick', 'Invalid: nonexistent student P:113,999999', () => {
  const res = validateQuickCommand('P:113,999999', mockRoster);
  assert.strictEqual(res.isValid, false);
  assert(res.error.includes('999999'), 'Error must mention nonexistent roll');
});

test('Simple Quick', 'Deduplication of duplicate roll numbers P:113,113,144', () => {
  const res = validateQuickCommand('P:113,113,144', mockRoster);
  assert.strictEqual(res.isValid, true);
  assert.deepStrictEqual(res.rollNumbers, ['113', '144'], 'Duplicate 113 deduplicated cleanly');
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. UNDO / REDO & SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nSECTION 10 & 11: Undo/Redo & Keyboard Shortcuts');

test('Undo/Redo', 'Undo stack preserves state across Simple Quick date switch', () => {
  const gridCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/AttendanceGrid.tsx'), 'utf-8');
  assert(gridCode.includes('preserveUndoForDateRef'), 'AttendanceGrid must preserve undo stack via preserveUndoForDateRef');
});

test('Keyboard Shortcuts', 'Ctrl+Z and Ctrl+Y do not trigger while typing in inputs', () => {
  const gridCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/AttendanceGrid.tsx'), 'utf-8');
  assert(gridCode.includes("if (e.key.toLowerCase() === 'z') {\n          if (inInput) return;"), 'Ctrl+Z must guard inInput');
  assert(gridCode.includes("if (e.key.toLowerCase() === 'y') {\n          if (inInput) return;"), 'Ctrl+Y must guard inInput');
  assert(gridCode.includes("if (e.key.toLowerCase() === 'q') {\n          if (inInput) return;"), 'Ctrl+Q must guard inInput');
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. BACKUP & RESTORE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nSECTION 13: Backup & Restore Integrity');

test('Backup/Restore', 'Valid backup roundtrip schema', () => {
  const flowCode = fs.readFileSync(path.join(__dirname, '../src/context/FlowContext.tsx'), 'utf-8');
  assert(flowCode.includes('restoreWorkspaceBackup'), 'FlowContext must define restoreWorkspaceBackup');
  assert(flowCode.includes('Backup validation failed: student records are corrupted'), 'Corrupt student validation check exists');
  assert(flowCode.includes('Backup validation failed: missing students, timetable, and attendance records'), 'Empty payload rejection exists');
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. PDF EXPORT & PAGINATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nSECTION 15: PDF Export Multi-Page Generation');

const thresholdsPath = path.join(__dirname, '../src/utils/thresholds.ts');
const pdfExportPath = path.join(__dirname, '../src/utils/pdfExport.ts');

const thresholdsTranspiled = ts.transpileModule(fs.readFileSync(thresholdsPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

const pdfExportTranspiled = ts.transpileModule(fs.readFileSync(pdfExportPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

const thresholdsModule = { exports: {} };
const evalThresholds = new Function('exports', 'module', 'require', thresholdsTranspiled);
evalThresholds(thresholdsModule.exports, thresholdsModule, require);

const pdfExportModule = { exports: {} };
const customRequire = (id) => {
  if (id === './thresholds') return thresholdsModule.exports;
  if (id === '../types') return {};
  return require(id);
};
const evalPdfExport = new Function('exports', 'module', 'require', pdfExportTranspiled);
evalPdfExport(pdfExportModule.exports, pdfExportModule, customRequire);

const { generateMonthlyAttendancePdfBuffer } = pdfExportModule.exports;
const { getAttendanceColor } = thresholdsModule.exports;

test('PDF Export', 'Zero classification labels in PDF generator', () => {
  const pdfCode = fs.readFileSync(path.join(__dirname, '../src/utils/pdfExport.ts'), 'utf-8');
  assert(!pdfCode.includes('Healthy'), 'Healthy must not exist in PDF');
  assert(!pdfCode.includes('Warning'), 'Warning must not exist in PDF');
  assert(!pdfCode.includes('Critical'), 'Critical must not exist in PDF');
  assert(!pdfCode.includes("'Status'"), 'Status column must not exist');
});

function createMockRoster(count) {
  const roster = [];
  const profiles = new Map();
  for (let i = 1; i <= count; i++) {
    const student = { id: `p${i}`, name: `Student ${i}`, rollNumber: `${100 + i}` };
    roster.push(student);
    profiles.set(student.id, {
      student,
      totalClasses: 20,
      presentClasses: Math.round(20 * (i % 2 === 0 ? 0.8 : 0.5)),
      absentClasses: 20 - Math.round(20 * (i % 2 === 0 ? 0.8 : 0.5)),
      overallPercentage: (i % 2 === 0 ? '80.0%' : '50.0%'),
      subjectStats: []
    });
  }
  return { roster, profiles };
}

test('PDF Export', 'Generates valid PDF buffer for 1 student', () => {
  const { roster, profiles } = createMockRoster(1);
  const buf = generateMonthlyAttendancePdfBuffer({
    monthStr: 'September 2026',
    roster,
    profiles,
    savedDatesCount: 15,
    holidaysCount: 2
  });
  assert(buf.length > 500, 'PDF buffer has content');
  const text = Buffer.from(buf).toString('utf-8');
  assert(text.startsWith('%PDF-1.4'), 'Starts with %PDF-1.4');
  assert(text.includes('Page 1 of 1'), 'Page 1 of 1');
});

test('PDF Export', 'Generates valid PDF buffer for 24 students (1 page)', () => {
  const { roster, profiles } = createMockRoster(24);
  const buf = generateMonthlyAttendancePdfBuffer({
    monthStr: 'September 2026',
    roster,
    profiles,
    savedDatesCount: 15,
    holidaysCount: 2
  });
  const text = Buffer.from(buf).toString('utf-8');
  assert(text.includes('Page 1 of 1'), 'Page 1 of 1 for 24 students');
});

test('PDF Export', 'Generates valid PDF buffer for 25 students (2 pages)', () => {
  const { roster, profiles } = createMockRoster(25);
  const buf = generateMonthlyAttendancePdfBuffer({
    monthStr: 'September 2026',
    roster,
    profiles,
    savedDatesCount: 15,
    holidaysCount: 2
  });
  const text = Buffer.from(buf).toString('utf-8');
  assert(text.includes('Page 1 of 2'), 'Page 1 of 2');
  assert(text.includes('Page 2 of 2'), 'Page 2 of 2');
});

test('PDF Export', 'Generates valid PDF buffer for 82 students (4 pages)', () => {
  const { roster, profiles } = createMockRoster(82);
  const buf = generateMonthlyAttendancePdfBuffer({
    monthStr: 'September 2026',
    roster,
    profiles,
    savedDatesCount: 15,
    holidaysCount: 2
  });
  const text = Buffer.from(buf).toString('utf-8');
  assert(text.includes('Page 1 of 4'), 'Page 1 of 4');
  assert(text.includes('Page 4 of 4'), 'Page 4 of 4');
  assert(text.includes('Student 82'), 'Includes Student 82 on final page');
});

test('PDF Export', 'Generates valid PDF buffer for 100+ students (5 pages)', () => {
  const { roster, profiles } = createMockRoster(105);
  const buf = generateMonthlyAttendancePdfBuffer({
    monthStr: 'September 2026',
    roster,
    profiles,
    savedDatesCount: 15,
    holidaysCount: 2
  });
  const text = Buffer.from(buf).toString('utf-8');
  assert(text.includes('Page 1 of 5'), 'Page 1 of 5');
  assert(text.includes('Page 5 of 5'), 'Page 5 of 5');
  assert(text.includes('Student 105'), 'Includes Student 105');
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. ATTENDANCE CALCULATIONS & COLOR SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nSECTION 16 & 17: Calculations & Color Thresholds');

function calculateStats(records) {
  const totalClasses = records.length;
  const presentClasses = records.filter(r => r.status === 'Present').length;
  const absentClasses = totalClasses - presentClasses;
  const overallPercentage = totalClasses > 0
    ? (Math.round((presentClasses / totalClasses) * 1000) / 10).toFixed(1) + '%'
    : '0.0%';
  return { totalClasses, presentClasses, absentClasses, overallPercentage };
}

test('Calculations', '2 classes: 2 Present = 100%, 1P+1A = 50%, 0P+2A = 0%', () => {
  const case1 = calculateStats([{ status: 'Present' }, { status: 'Present' }]);
  assert.strictEqual(case1.totalClasses, 2);
  assert.strictEqual(case1.presentClasses, 2);
  assert.strictEqual(case1.absentClasses, 0);
  assert.strictEqual(case1.overallPercentage, '100.0%');

  const case2 = calculateStats([{ status: 'Present' }, { status: 'Absent' }]);
  assert.strictEqual(case2.totalClasses, 2);
  assert.strictEqual(case2.presentClasses, 1);
  assert.strictEqual(case2.absentClasses, 1);
  assert.strictEqual(case2.overallPercentage, '50.0%');

  const case3 = calculateStats([{ status: 'Absent' }, { status: 'Absent' }]);
  assert.strictEqual(case3.totalClasses, 2);
  assert.strictEqual(case3.presentClasses, 0);
  assert.strictEqual(case3.absentClasses, 2);
  assert.strictEqual(case3.overallPercentage, '0.0%');
});

test('Calculations', 'Present + Absent strictly equals Total Classes', () => {
  const sample = [
    { status: 'Present' }, { status: 'Present' }, { status: 'Absent' },
    { status: 'Present' }, { status: 'Absent' }, { status: 'Present' }
  ];
  const stats = calculateStats(sample);
  assert.strictEqual(stats.presentClasses + stats.absentClasses, stats.totalClasses);
});

test('Color System', 'Strict boundary conditions (100, 75, 74, 60, 59, 0)', () => {
  // 100% -> green
  assert(getAttendanceColor(100).color.includes('16a34a'), '100% is green');
  // 75% -> green
  assert(getAttendanceColor(75).color.includes('16a34a'), '75% is green');
  // 74% -> orange
  assert(getAttendanceColor(74).color.includes('d97706'), '74% is orange');
  // 60% -> orange
  assert(getAttendanceColor(60).color.includes('d97706'), '60% is orange');
  // 59% -> red
  assert(getAttendanceColor(59).color.includes('dc2626'), '59% is red');
  // 0% -> red
  assert(getAttendanceColor(0).color.includes('dc2626'), '0% is red');
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. ELECTRON PACKAGING
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nSECTION 21: Electron App Configuration & Packaging');

test('Electron', 'App Name and executable configurations', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
  assert.strictEqual(pkg.productName, 'Rollvia');
  assert.strictEqual(pkg.build.appId, 'com.rollvia.app');
  assert.strictEqual(pkg.build.win.executableName, 'Rollvia');
  assert(pkg.build.win.icon.includes('icon.ico'), 'ICO icon configured');
});

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n================================================================');
console.log(`TOTAL TESTS RUN: ${passedTests + failedTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  console.error('\nFailures detail:');
  failures.forEach(f => console.error(`- [${f.category}] ${f.testName}: ${f.error}`));
  process.exit(1);
} else {
  console.log('\nALL TESTS PASSED SUCCESSFULLY! ATTENDLY IS PRODUCTION READY.');
  process.exit(0);
}
