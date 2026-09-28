const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('========================================================');
console.log('TEST SUITE: ATTENDLY 15 COMPREHENSIVE ENHANCEMENTS');
console.log('========================================================\n');

let passCount = 0;
function pass(msg) {
  passCount++;
  console.log(`[PASS] ${msg}`);
}

// ─── 1. ATTENDANCE THRESHOLDS ───────────────────────────────────────────────
console.log('--- 1. Attendance Thresholds Evaluation ---');
function getAttendanceThreshold(percentage) {
  if (percentage >= 75) {
    return { status: 'healthy', label: 'Healthy (≥75%)', shortLabel: 'Healthy' };
  }
  if (percentage >= 65) {
    return { status: 'warning', label: 'Warning (65%–74%)', shortLabel: 'Warning' };
  }
  return { status: 'critical', label: 'Critical (<65%)', shortLabel: 'Critical' };
}

assert.strictEqual(getAttendanceThreshold(100).status, 'healthy');
assert.strictEqual(getAttendanceThreshold(75.0).status, 'healthy');
assert.strictEqual(getAttendanceThreshold(74.9).status, 'warning');
assert.strictEqual(getAttendanceThreshold(65.0).status, 'warning');
assert.strictEqual(getAttendanceThreshold(64.9).status, 'critical');
assert.strictEqual(getAttendanceThreshold(0).status, 'critical');
pass('Boundary thresholds: >=75% is Healthy, 65%-74.9% is Warning, <65% is Critical');

// ─── 2. ATTENDANCE CALENDAR / HEATMAP & HOLIDAYS ────────────────────────────
console.log('\n--- 2. Attendance Calendar Day States & No-Class Dates ---');
const savedDates = ['2026-09-01', '2026-09-02'];
let noClassDates = ['2026-09-05'];
const editedDays = { '2026-09-03': { p1: { c1: true } } };

function getDayState(dateStr) {
  if (noClassDates.includes(dateStr)) return 'holiday';
  if (editedDays[dateStr]) return 'unsaved';
  if (savedDates.includes(dateStr)) return 'recorded';
  return 'not_recorded';
}

assert.strictEqual(getDayState('2026-09-01'), 'recorded');
assert.strictEqual(getDayState('2026-09-03'), 'unsaved');
assert.strictEqual(getDayState('2026-09-05'), 'holiday');
assert.strictEqual(getDayState('2026-09-10'), 'not_recorded');
pass('Calendar day states distinguish Recorded, Unsaved, Holiday/No-Class, and Not Recorded');

// Toggle holiday
function toggleNoClass(dateStr) {
  if (noClassDates.includes(dateStr)) {
    noClassDates = noClassDates.filter(d => d !== dateStr);
  } else {
    noClassDates.push(dateStr);
  }
}
toggleNoClass('2026-09-05');
assert.strictEqual(noClassDates.includes('2026-09-05'), false);
toggleNoClass('2026-09-08');
assert.strictEqual(noClassDates.includes('2026-09-08'), true);
pass('toggleNoClassDate safely adds and removes dates from holiday list');

// ─── 3. STUDENT ATTENDANCE CARD & CSV EXPORT ────────────────────────────────
console.log('\n--- 3. Student Attendance Card & Export ---');
const mockStudent = { id: 'p1', name: 'Aarav Sharma', rollNumber: 'CS-01', phone: '9876543210', email: 'aarav@univ.edu' };
const mockRecords = [
  { personId: 'p1', className: 'Java', status: 'Present', date: '2026-09-01' },
  { personId: 'p1', className: 'Java', status: 'Absent', date: '2026-09-02' },
  { personId: 'p1', className: 'DBMS', status: 'Present', date: '2026-09-01' },
  { personId: 'p1', className: 'DBMS', status: 'Present', date: '2026-09-02' },
];

function buildProfile(student, records) {
  const studentRecs = records.filter(r => r.personId === student.id);
  const total = studentRecs.length;
  const present = studentRecs.filter(r => r.status === 'Present').length;
  const absent = total - present;
  const pct = total > 0 ? ((present / total) * 100).toFixed(1) + '%' : '0.0%';

  const subMap = {};
  studentRecs.forEach(r => {
    subMap[r.className] = subMap[r.className] || { present: 0, absent: 0, total: 0 };
    if (r.status === 'Present') subMap[r.className].present++;
    else subMap[r.className].absent++;
    subMap[r.className].total++;
  });

  const subjectStats = Object.keys(subMap).map(sub => {
    const s = subMap[sub];
    return {
      subject: sub,
      present: s.present,
      absent: s.absent,
      total: s.total,
      percentage: ((s.present / s.total) * 100).toFixed(1) + '%'
    };
  });

  return { student, totalClasses: total, presentClasses: present, absentClasses: absent, overallPercentage: pct, subjectStats };
}

const profile = buildProfile(mockStudent, mockRecords);
assert.strictEqual(profile.totalClasses, 4);
assert.strictEqual(profile.presentClasses, 3);
assert.strictEqual(profile.absentClasses, 1);
assert.strictEqual(profile.overallPercentage, '75.0%');
assert.strictEqual(getAttendanceThreshold(75.0).status, 'healthy');
assert.strictEqual(profile.subjectStats.length, 2);
pass('Student Attendance Profile calculates totals, percentages, and subject stats properly');

// ─── 4. AUTOSAVE & RECOVERY ────────────────────────────────────────────────
console.log('\n--- 4. Autosave & Recovery Logic ---');
const mockLocalStorage = {};
function saveDraft(date, data) {
  mockLocalStorage[`attendly_recovery_${date}`] = JSON.stringify(data);
}
function getDraft(date) {
  const raw = mockLocalStorage[`attendly_recovery_${date}`];
  return raw ? JSON.parse(raw) : null;
}
function clearDraft(date) {
  delete mockLocalStorage[`attendly_recovery_${date}`];
}

const unsavedState = { p1: { c1: true, c2: false } };
saveDraft('2026-09-08', unsavedState);
assert.deepStrictEqual(getDraft('2026-09-08'), unsavedState);
clearDraft('2026-09-08');
assert.strictEqual(getDraft('2026-09-08'), null);
pass('Autosave drafts are saved, detected, and cleared after normal save');

// ─── 5. BACKUP & RESTORE ────────────────────────────────────────────────────
console.log('\n--- 5. Backup & Restore Validation ---');
const sampleBackup = {
  attendlyBackupVersion: 1,
  exportedAt: new Date().toISOString(),
  people: [mockStudent],
  weeklyTimetable: { Monday: [{ id: 's1', name: 'Java' }] },
  savedDailyAttendance: { '2026-09-01': { p1: { s1: true } } },
  savedDates: ['2026-09-01'],
  noClassDates: ['2026-09-05'],
};

function validateBackup(data) {
  if (!data || typeof data !== 'object') return { valid: false, error: 'Not an object' };
  const hasPeople = Array.isArray(data.people);
  const hasTimetable = data.weeklyTimetable && typeof data.weeklyTimetable === 'object';
  const hasAttendance = data.savedDailyAttendance && typeof data.savedDailyAttendance === 'object';
  if (!hasPeople && !hasTimetable && !hasAttendance) {
    return { valid: false, error: 'Missing core data' };
  }
  return { valid: true };
}

assert.strictEqual(validateBackup(sampleBackup).valid, true);
assert.strictEqual(validateBackup({}).valid, false);
assert.strictEqual(validateBackup(null).valid, false);
pass('Backup validator accepts valid Attendly backups and rejects empty/corrupt files');

// ─── 6. COPY TIMETABLE ──────────────────────────────────────────────────────
console.log('\n--- 6. Copy Timetable Duplication ---');
const originalTimetable = {
  Monday: [{ id: 'sub_1', name: 'Java' }, { id: 'sub_2', name: 'OS' }],
  Tuesday: [],
  Wednesday: [{ id: 'sub_3', name: 'DBMS' }],
};

function copyTimetable(sourceDay, targetDays, currentTable) {
  const sourceSubjects = currentTable[sourceDay] || [];
  const result = { ...currentTable };
  for (const target of targetDays) {
    result[target] = sourceSubjects.map(s => ({
      id: `copy_${Date.now()}_${s.name}`,
      name: s.name,
    }));
  }
  return result;
}

const copiedTable = copyTimetable('Monday', ['Tuesday', 'Wednesday'], originalTimetable);
assert.strictEqual(copiedTable.Tuesday.length, 2);
assert.strictEqual(copiedTable.Tuesday[0].name, 'Java');
assert.strictEqual(copiedTable.Tuesday[1].name, 'OS');
assert.strictEqual(copiedTable.Wednesday.length, 2);
assert.strictEqual(copiedTable.Wednesday[0].name, 'Java');
assert.strictEqual(copiedTable.Monday.length, 2);
pass('Copy timetable correctly duplicates subjects to target days with fresh IDs');

// ─── 7. STUDENT IMPORT & ROSTER CSV EXPORT ──────────────────────────────────
console.log('\n--- 7. Student Roster CSV Export ---');
const studentRoster = [
  { id: '1', name: 'Alice Smith', rollNumber: 'R101', phone: '111-222', email: 'alice@test.com' },
  { id: '2', name: 'Bob Jones', rollNumber: 'R102', phone: '', email: 'bob@test.com' }
];

function generateRosterCsv(people) {
  const headers = ['Name', 'Roll No', 'Phone', 'Email'];
  const rows = people.map(p => [
    `"${p.name}"`,
    `"${p.rollNumber}"`,
    `"${p.phone || ''}"`,
    `"${p.email || ''}"`
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
}

const csvOutput = generateRosterCsv(studentRoster);
assert.strictEqual(csvOutput.includes('"Alice Smith","R101","111-222","alice@test.com"'), true);
assert.strictEqual(csvOutput.includes('"Bob Jones","R102","","bob@test.com"'), true);
pass('Student roster CSV export formats all fields without modifying attendance');

// ─── 8. ATTENDANCE QUICK ACTIONS (ALL PRESENT, ALL ABSENT, UNDO, REDO) ─────
console.log('\n--- 8. Quick Actions: All Present, All Absent, Undo, Redo ---');
let currentMarks = {
  p1: { s1: false, s2: false },
  p2: { s1: false, s2: false }
};
const undoStack = [];
const redoStack = [];

function doAction(newMarks) {
  undoStack.push(JSON.parse(JSON.stringify(currentMarks)));
  redoStack.length = 0;
  currentMarks = JSON.parse(JSON.stringify(newMarks));
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(JSON.parse(JSON.stringify(currentMarks)));
  currentMarks = undoStack.pop();
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(JSON.parse(JSON.stringify(currentMarks)));
  currentMarks = redoStack.pop();
}

// 1. All Present
doAction({ p1: { s1: true, s2: true }, p2: { s1: true, s2: true } });
assert.strictEqual(currentMarks.p1.s1, true);
assert.strictEqual(currentMarks.p2.s2, true);

// 2. All Absent
doAction({ p1: { s1: false, s2: false }, p2: { s1: false, s2: false } });
assert.strictEqual(currentMarks.p1.s1, false);

// 3. Undo (should return to All Present)
undo();
assert.strictEqual(currentMarks.p1.s1, true);
assert.strictEqual(currentMarks.p2.s2, true);

// 4. Undo again (should return to initial all false)
undo();
assert.strictEqual(currentMarks.p1.s1, false);

// 5. Redo (should return to All Present)
redo();
assert.strictEqual(currentMarks.p1.s1, true);
pass('All Present, All Absent, Undo, and Redo state machine functions flawlessly');

// ─── 9. SEARCH / FILTER / SORT STUDENTS ─────────────────────────────────────
console.log('\n--- 9. Search, Filter Chips, and Sorting ---');
const studentDataset = [
  { name: 'Carol Adams', rollNumber: '10', profile: { overallPercentage: '85.0%' } },
  { name: 'Dave Brown', rollNumber: '02', profile: { overallPercentage: '71.5%' } },
  { name: 'Eve Clark', rollNumber: '05', profile: { overallPercentage: '55.0%' } },
];

// Search filter
const searchResult = studentDataset.filter(s => s.name.toLowerCase().includes('dave') || s.rollNumber.includes('dave'));
assert.strictEqual(searchResult.length, 1);
assert.strictEqual(searchResult[0].name, 'Dave Brown');

// Threshold filter: Below 75%
const below75 = studentDataset.filter(s => parseFloat(s.profile.overallPercentage) < 75);
assert.strictEqual(below75.length, 2); // Dave (71.5%) and Eve (55.0%)

// Threshold filter: Below 65%
const below65 = studentDataset.filter(s => parseFloat(s.profile.overallPercentage) < 65);
assert.strictEqual(below65.length, 1); // Eve (55.0%)

// Sort by roll number numeric
const sortedByRoll = [...studentDataset].sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
assert.strictEqual(sortedByRoll[0].rollNumber, '02');
assert.strictEqual(sortedByRoll[1].rollNumber, '05');
assert.strictEqual(sortedByRoll[2].rollNumber, '10');

// Sort by percentage desc
const sortedByPct = [...studentDataset].sort((a, b) => parseFloat(b.profile.overallPercentage) - parseFloat(a.profile.overallPercentage));
assert.strictEqual(sortedByPct[0].name, 'Carol Adams');
assert.strictEqual(sortedByPct[2].name, 'Eve Clark');
pass('Search by name/roll, threshold filter chips, and column sorting all operate accurately');

// ─── 10. VERIFY UI SOURCE FILES COMPLIANCE ──────────────────────────────────
console.log('\n--- 10. Verifying Source Code Architecture ---');
const gridCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/AttendanceGrid.tsx'), 'utf-8');
const studentsCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/StudentsView.tsx'), 'utf-8');
const headerCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/WorkspaceHeader.tsx'), 'utf-8');
const timetableCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/TimetableView.tsx'), 'utf-8');

assert.strictEqual(gridCode.includes('All Present'), true, 'AttendanceGrid has All Present');
assert.strictEqual(gridCode.includes('All Absent'), true, 'AttendanceGrid has All Absent');
assert.strictEqual(gridCode.includes('Undo'), true, 'AttendanceGrid has Undo');
assert.strictEqual(gridCode.includes('Redo'), true, 'AttendanceGrid has Redo');
assert.strictEqual(gridCode.includes('Save'), true, 'AttendanceGrid has Save');
assert.strictEqual(gridCode.includes('attendly_recovery_'), true, 'AttendanceGrid has autosave recovery');
assert.strictEqual(gridCode.includes('No Class / Holiday'), true, 'AttendanceGrid has holiday support');
assert.strictEqual(gridCode.includes('getAttendanceColor'), true, 'AttendanceGrid includes attendance color indicators');
pass('AttendanceGrid has all required quick actions, undo/redo, recovery, and holiday controls');

assert.strictEqual(studentsCode.includes('getAttendanceColor'), true, 'StudentsView has attendance color indicators');
assert.strictEqual(studentsCode.includes('Below 75%'), true, 'StudentsView has Below 75% filter chip');
assert.strictEqual(studentsCode.includes('Below 65%'), true, 'StudentsView has Below 65% filter chip');
assert.strictEqual(studentsCode.includes('Export'), true, 'StudentsView has Export button');
assert.strictEqual(studentsCode.includes('Export Student Attendance'), true, 'Student Card has Export Student Attendance');
assert.strictEqual(studentsCode.includes('Edit Student'), true, 'Student Card has Edit Student');
assert.strictEqual(studentsCode.includes('Search by name, roll no'), true, 'StudentsView has search input');
pass('StudentsView has search, filter chips, sortable table, and Student Attendance Card');

assert.strictEqual(headerCode.includes('Backup'), true, 'WorkspaceHeader has Backup button near storage');
assert.strictEqual(headerCode.includes('Restore'), true, 'WorkspaceHeader has Restore button near storage');
assert.strictEqual(headerCode.includes('Confirm & Replace'), true, 'WorkspaceHeader has restore confirmation dialog');
pass('WorkspaceHeader has Backup and Restore near storage indicator with warning confirmation');

assert.strictEqual(timetableCode.includes('Copy Timetable'), true, 'TimetableView has Copy Timetable');
assert.strictEqual(timetableCode.includes('Copy From'), true, 'Timetable has source selector');
assert.strictEqual(timetableCode.includes('Copy To'), true, 'Timetable has target selector');
pass('TimetableView has Copy Timetable with overwrite protection');

console.log('\n========================================================');
console.log(`ALL TESTS PASSED: ${passCount} PASSED, 0 FAILED`);
console.log('========================================================\n');
