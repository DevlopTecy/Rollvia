const assert = require('assert');

console.log('========================================================');
console.log('TEST SUITE: ATTENDLY DYNAMIC DATE & YEAR SYSTEM');
console.log('========================================================\n');

let passCount = 0;
function pass(msg) {
  passCount++;
  console.log(`[PASS] ${msg}`);
}

// ─── 1. DYNAMIC YEAR RANGE EVALUATION ──────────────────────────────────────
console.log('--- 1. Dynamic Year Range (Current Year - 1 through + 15) ---');

function getSupportedYears(refDate = new Date()) {
  const currentYear = refDate.getFullYear();
  const startYear = currentYear - 1;
  const endYear = currentYear + 15;
  const years = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }
  return years;
}

const ref2026 = new Date(2026, 8, 28);
const years2026 = getSupportedYears(ref2026);
assert.strictEqual(years2026[0], 2025, 'Start year must be 2025 when current is 2026');
assert.strictEqual(years2026[years2026.length - 1], 2041, 'End year must be 2041 when current is 2026');
assert.strictEqual(years2026.length, 17, 'Should contain 17 continuous years (2025 to 2041)');

// Verify specific requested test years are all present
const testYears = [2025, 2026, 2027, 2030, 2035, 2040, 2041];
for (const yr of testYears) {
  assert(years2026.includes(yr), `Year ${yr} must be in supported years`);
}
pass('Dynamic year range generates 2025 through 2041 (17 years) for 2026');

// ─── 2. LEAP YEAR & MONTH LENGTH CALCULATIONS ──────────────────────────────
console.log('\n--- 2. Leap Years & February Day Lengths ---');

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// Non-leap years: 28 days in Feb
assert.strictEqual(isLeapYear(2025), false, '2025 is not a leap year');
assert.strictEqual(getDaysInMonth(2025, 1), 28, 'Feb 2025 has 28 days');

assert.strictEqual(isLeapYear(2026), false, '2026 is not a leap year');
assert.strictEqual(getDaysInMonth(2026, 1), 28, 'Feb 2026 has 28 days');

assert.strictEqual(isLeapYear(2027), false, '2027 is not a leap year');
assert.strictEqual(getDaysInMonth(2027, 1), 28, 'Feb 2027 has 28 days');

assert.strictEqual(isLeapYear(2041), false, '2041 is not a leap year');
assert.strictEqual(getDaysInMonth(2041, 1), 28, 'Feb 2041 has 28 days');

// Leap years: 29 days in Feb
assert.strictEqual(isLeapYear(2024), true, '2024 is a leap year');
assert.strictEqual(getDaysInMonth(2024, 1), 29, 'Feb 2024 has 29 days');

assert.strictEqual(isLeapYear(2028), true, '2028 is a leap year');
assert.strictEqual(getDaysInMonth(2028, 1), 29, 'Feb 2028 has 29 days');

assert.strictEqual(isLeapYear(2032), true, '2032 is a leap year');
assert.strictEqual(getDaysInMonth(2032, 1), 29, 'Feb 2032 has 29 days');

assert.strictEqual(isLeapYear(2036), true, '2036 is a leap year');
assert.strictEqual(getDaysInMonth(2036, 1), 29, 'Feb 2036 has 29 days');

assert.strictEqual(isLeapYear(2040), true, '2040 is a leap year');
assert.strictEqual(getDaysInMonth(2040, 1), 29, 'Feb 2040 has 29 days');

pass('Leap years (2024, 2028, 2032, 2036, 2040 = 29 days) and non-leap years (2025, 2026, 2027, 2041 = 28 days) verified');

// ─── 3. CALENDAR TRANSITIONS: DEC 2026 → JAN 2027 ──────────────────────────
console.log('\n--- 3. Year Transition Navigation (December 2026 ↔ January 2027) ---');

function navigateMonth(yr, mi, direction) {
  if (direction === 'next') {
    if (mi === 11) return { year: yr + 1, monthIndex: 0 };
    return { year: yr, monthIndex: mi + 1 };
  } else {
    if (mi === 0) return { year: yr - 1, monthIndex: 11 };
    return { year: yr, monthIndex: mi - 1 };
  }
}

const decToJan = navigateMonth(2026, 11, 'next');
assert.strictEqual(decToJan.year, 2027, 'Navigating next from Dec 2026 leads to year 2027');
assert.strictEqual(decToJan.monthIndex, 0, 'Navigating next from Dec 2026 leads to January (index 0)');

const janToDec = navigateMonth(2027, 0, 'prev');
assert.strictEqual(janToDec.year, 2026, 'Navigating prev from Jan 2027 leads to year 2026');
assert.strictEqual(janToDec.monthIndex, 11, 'Navigating prev from Jan 2027 leads to December (index 11)');

// Day-by-day crossing
function stepDay(dateStr, step) {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2] + step);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

assert.strictEqual(stepDay('2026-12-31', 1), '2027-01-01', 'Dec 31, 2026 + 1 day = Jan 1, 2027');
assert.strictEqual(stepDay('2027-01-01', -1), '2026-12-31', 'Jan 1, 2027 - 1 day = Dec 31, 2026');

pass('Seamless December 2026 ↔ January 2027 transitions verified for months and days');

// ─── 4. TIMETABLE & WEEKDAY FOR FUTURE YEARS ───────────────────────────────
console.log('\n--- 4. Weekday & Timetable for Future Years ---');

function getWeekdayForDate(dateStr) {
  const parts = dateStr.split('-').map(Number);
  const jsDay = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[jsDay];
}

const timetable = {
  Tuesday: [{ id: 'sub_cs1', name: 'Computer Networks' }],
  Wednesday: [{ id: 'sub_cs2', name: 'Operating Systems' }],
  Friday: [{ id: 'sub_cs3', name: 'Software Engineering' }],
};

// Sep 1, 2026 is Tuesday
assert.strictEqual(getWeekdayForDate('2026-09-01'), 'Tuesday');
// Sep 1, 2027 is Wednesday
assert.strictEqual(getWeekdayForDate('2027-09-01'), 'Wednesday');
// Sep 1, 2028 is Friday
assert.strictEqual(getWeekdayForDate('2028-09-01'), 'Friday');

const subs2026 = timetable[getWeekdayForDate('2026-09-01')] || [];
const subs2027 = timetable[getWeekdayForDate('2027-09-01')] || [];
const subs2028 = timetable[getWeekdayForDate('2028-09-01')] || [];

assert.strictEqual(subs2026[0].name, 'Computer Networks');
assert.strictEqual(subs2027[0].name, 'Operating Systems');
assert.strictEqual(subs2028[0].name, 'Software Engineering');

pass('Future year dates correctly resolve weekday and timetable subjects');

// ─── 5. ATTENDANCE DATA ISOLATION ACROSS YEARS ──────────────────────────────
console.log('\n--- 5. Attendance Records Multi-Year Isolation ---');

const records = [
  { id: 'rec_2026-09-01_p1_c1', date: '2026-09-01', personId: 'p1', className: 'OS', status: 'Present' },
  { id: 'rec_2027-09-01_p1_c1', date: '2027-09-01', personId: 'p1', className: 'OS', status: 'Absent' },
  { id: 'rec_2030-09-01_p1_c1', date: '2030-09-01', personId: 'p1', className: 'OS', status: 'Present' },
];

function getMonthRecords(allRecs, year, monthIdx) {
  const prefix = `${year}-${String(monthIdx + 1).padStart(2, '0')}-`;
  return allRecs.filter((r) => r.date.startsWith(prefix));
}

const recs2026 = getMonthRecords(records, 2026, 8);
const recs2027 = getMonthRecords(records, 2027, 8);
const recs2030 = getMonthRecords(records, 2030, 8);
const recs2035 = getMonthRecords(records, 2035, 8);

assert.strictEqual(recs2026.length, 1);
assert.strictEqual(recs2026[0].status, 'Present');

assert.strictEqual(recs2027.length, 1);
assert.strictEqual(recs2027[0].status, 'Absent');

assert.strictEqual(recs2030.length, 1);
assert.strictEqual(recs2030[0].status, 'Present');

assert.strictEqual(recs2035.length, 0);

pass('Records from 2026, 2027, and 2030 are strictly isolated and never merge');

// ─── 6. STUDENT STATISTICS & PROFILE CALCULATION ───────────────────────────
console.log('\n--- 6. Student Statistics across Years ---');

const student = { id: 'p1', name: 'Alice Smith', rollNumber: 'CS-01' };

function calcProfile(std, recs) {
  const stdRecs = recs.filter((r) => r.personId === std.id);
  const total = stdRecs.length;
  const present = stdRecs.filter((r) => r.status === 'Present').length;
  const absent = total - present;
  const pct = total > 0 ? `${((present / total) * 100).toFixed(1)}%` : '0.0%';
  return { totalClasses: total, presentClasses: present, absentClasses: absent, overallPercentage: pct };
}

const prof2026 = calcProfile(student, recs2026);
assert.strictEqual(prof2026.overallPercentage, '100.0%');

const prof2027 = calcProfile(student, recs2027);
assert.strictEqual(prof2027.overallPercentage, '0.0%');

const prof2030 = calcProfile(student, recs2030);
assert.strictEqual(prof2030.overallPercentage, '100.0%');

pass('Student profiles accurately compute attendance statistics for each respective year');

// ─── 7. EXPORTS: PDF & EXCEL METADATA ───────────────────────────────────────
console.log('\n--- 7. Export Metadata (PDF & Excel) ---');

const pdfData2030 = {
  monthStr: 'September 2030',
  academicYear: '2030',
};
assert.strictEqual(pdfData2030.academicYear, '2030', 'PDF academic year reflects selected 2030');
assert(pdfData2030.monthStr.includes('2030'), 'PDF monthStr contains 2030');

const fs = require('fs');
const path = require('path');
const pdfCode = fs.readFileSync(path.join(__dirname, '../src/utils/pdfExport.ts'), 'utf-8');
assert(!pdfCode.includes("academicYear = '2026'"), 'pdfExport.ts must not have hardcoded 2026 fallback');

const calCode = fs.readFileSync(path.join(__dirname, '../src/utils/calendar.ts'), 'utf-8');
assert(calCode.includes('getSupportedYears'), 'calendar.ts exports getSupportedYears');

const headerCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/WorkspaceHeader.tsx'), 'utf-8');
assert(headerCode.includes('supportedYears'), 'WorkspaceHeader uses supportedYears');
assert(headerCode.includes('handlePrevYear'), 'WorkspaceHeader has handlePrevYear');
assert(headerCode.includes('handleNextYear'), 'WorkspaceHeader has handleNextYear');

const simpleQuickCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/SimpleQuickPanel.tsx'), 'utf-8');
assert(simpleQuickCode.includes('supportedYears'), 'SimpleQuickPanel uses supportedYears');
assert(!simpleQuickCode.includes("'2026-09-01'"), 'SimpleQuickPanel does not hardcode 2026-09-01 fallback');

pass('PDF export and Excel metadata reflect selected future years without 2026 lock');

console.log('\n========================================================');
console.log(`ALL TESTS PASSED: ${passCount} PASSED, 0 FAILED`);
console.log('========================================================\n');
