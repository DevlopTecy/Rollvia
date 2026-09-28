// @ts-check
const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let failedTests = 0;

/** @param {string} msg */
function pass(msg) {
  passedTests++;
  console.log(`[PASS] ${msg}`);
}

/**
 * @param {string} msg
 * @param {unknown} [err]
 */
function fail(msg, err) {
  failedTests++;
  console.error(`[FAIL] ${msg}`, err || '');
}

console.log('========================================================');
console.log('TEST SUITE: ATTENDLY PRODUCTION CLEANUP VERIFICATION');
console.log('========================================================\n');

// 1. Verify that INITIAL_MEMBERS, INITIAL_CLASSES, INITIAL_ATTENDANCE are clean/empty
try {
  console.log('--- 1. Verification of Clean Starter Constants ---');
  const stepsCode = fs.readFileSync(path.join(__dirname, '../src/constants/steps.ts'), 'utf-8');

  // Verify INITIAL_MEMBERS is empty
  assert(stepsCode.includes('export const INITIAL_MEMBERS: Student[] = [];'), 'INITIAL_MEMBERS must be an empty array');
  assert(!stepsCode.includes('Alexander Wright'), 'INITIAL_MEMBERS must not contain mock student "Alexander Wright"');
  assert(!stepsCode.includes('Beatrice Chen'), 'INITIAL_MEMBERS must not contain mock student "Beatrice Chen"');

  // Verify INITIAL_CLASSES is empty
  assert(stepsCode.includes('export const INITIAL_CLASSES: ClassSession[] = [];'), 'INITIAL_CLASSES must be an empty array');
  assert(!stepsCode.includes('Prof. Elena Vance'), 'INITIAL_CLASSES must not contain mock instructor "Prof. Elena Vance"');

  // Verify INITIAL_ATTENDANCE is empty
  assert(stepsCode.includes('export const INITIAL_ATTENDANCE: Record<string, LegacyAttendanceRecord> = {};'), 'INITIAL_ATTENDANCE must be an empty record');

  pass('Starter constants are completely clean of mock students, mock classes, and mock attendance');
} catch (err) {
  fail('Clean starter constants check failed', err);
}

// 2. Verify Fresh Installation Initial State
try {
  console.log('\n--- 2. Fresh Installation Clean State Verification ---');
  const flowCode = fs.readFileSync(path.join(__dirname, '../src/context/FlowContext.tsx'), 'utf-8');

  // People should come from persisted roster (empty on fresh install)
  assert(flowCode.includes('people: initialPersistedRoster'), 'FlowContext must initialize people from persisted roster');
  assert(flowCode.includes('savedDailyAttendance: {}'), 'savedDailyAttendance must initialize empty');
  assert(flowCode.includes('savedDates: []'), 'savedDates must initialize empty');
  assert(flowCode.includes('attendanceRecords: []'), 'attendanceRecords must initialize empty');

  // Verify rosterStorage.ts returns empty array on empty localStorage
  const rosterStorageCode = fs.readFileSync(path.join(__dirname, '../src/utils/rosterStorage.ts'), 'utf-8');
  assert(rosterStorageCode.includes('return [];'), 'loadPersistedRoster must return empty array when no data in localStorage');

  pass('Fresh installation is guaranteed to start with zero test students and zero fake records');
} catch (err) {
  fail('Fresh install state check failed', err);
}

// 3. Verify No Prohibited Mock/Dummy Tokens in Production Code
try {
  console.log('\n--- 3. Codebase Prohibited Mock/Dummy Tokens Scan ---');
  const excelAdapterCode = fs.readFileSync(path.join(__dirname, '../src/storage/adapters/ExcelAdapter.ts'), 'utf-8');
  assert(!excelAdapterCode.includes('dummyDataset'), 'ExcelAdapter must not use "dummyDataset"');
  assert(excelAdapterCode.includes('emptyDataset'), 'ExcelAdapter uses "emptyDataset"');

  const peopleScreenCode = fs.readFileSync(path.join(__dirname, '../src/components/screens/PeopleSetupScreen.tsx'), 'utf-8');
  assert(!peopleScreenCode.includes('Alexander Wright'), 'PeopleSetupScreen must not reference Alexander Wright');

  pass('Production code is free of mock, dummy, and test-data variables');
} catch (err) {
  fail('Prohibited tokens scan failed', err);
}

// 4. Verify Legitimate User Placeholders are Preserved
try {
  console.log('\n--- 4. Essential User Instructional Examples Preserved ---');
  const importModalCode = fs.readFileSync(path.join(__dirname, '../src/components/ui/StudentImportModal.tsx'), 'utf-8');
  assert(importModalCode.includes('John Doe') && importModalCode.includes('Jake Smith'), 'Import dialog instructional example must be preserved');

  const simpleQuickCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/SimpleQuickPanel.tsx'), 'utf-8');
  assert(simpleQuickCode.includes('placeholder="P:113,144,102"'), 'Simple Quick input command format placeholder must be preserved');

  pass('Essential user instructional placeholders preserved properly');
} catch (err) {
  fail('User instructional placeholders check failed', err);
}

// 5. Verify Core Functionality Integrations Unbroken
try {
  console.log('\n--- 5. Core Systems Verification ---');
  // Check Storage Setup components exist
  const setupWizardCode = fs.readFileSync(path.join(__dirname, '../src/components/screens/SetupWizard.tsx'), 'utf-8');
  assert(setupWizardCode.includes('selectExistingExcelWorkbook'), 'SetupWizard must support selecting Excel workbook');
  assert(setupWizardCode.includes('createNewExcelWorkbook'), 'SetupWizard must support creating Excel workbook');

  // Check Students Setup / Import
  assert(setupWizardCode.includes('importStudents'), 'SetupWizard must support student roster import');

  // Check Timetable
  const timetableCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/TimetableView.tsx'), 'utf-8');
  assert(timetableCode.includes('addTimetableSubject'), 'Timetable must support adding subjects');
  assert(timetableCode.includes('deleteTimetableSubject'), 'Timetable must support deleting subjects');
  assert(timetableCode.includes('Copy Timetable'), 'Timetable must support copying timetable');

  // Check Attendance Grid & Simple Quick
  const attendanceGridCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/AttendanceGrid.tsx'), 'utf-8');
  assert(attendanceGridCode.includes('SimpleQuickPanel'), 'AttendanceGrid must include SimpleQuickPanel');
  assert(attendanceGridCode.includes('downloadMonthlyAttendancePdf'), 'AttendanceGrid must include PDF export');

  // Check PDF Export
  const pdfExportCode = fs.readFileSync(path.join(__dirname, '../src/utils/pdfExport.ts'), 'utf-8');
  assert(pdfExportCode.includes('generateMonthlyAttendancePdfBuffer'), 'pdfExport must export generateMonthlyAttendancePdfBuffer');

  pass('Storage, Students, Timetable, Attendance, Simple Quick, Excel, and PDF export all intact');
} catch (err) {
  fail('Core systems check failed', err);
}

// Summary
console.log('\n========================================================');
console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('========================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
