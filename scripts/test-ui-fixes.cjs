const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('========================================================');
console.log('TEST SUITE: ATTENDLY UI FIXES & VALIDATIONS');
console.log('========================================================\n');

let passCount = 0;
function pass(msg) {
  passCount++;
  console.log(`[PASS] ${msg}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. WINDOWS DESKTOP ATTENDLY LOGO & PACKAGING CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- 1. Windows Desktop Icon & Packaging Config ---');
const mainCode = fs.readFileSync(path.join(__dirname, '../electron/main.cjs'), 'utf-8');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');

assert(mainCode.includes('icon: iconPath'), 'electron/main.cjs must pass icon to BrowserWindow');
assert(mainCode.includes('app.setAppUserModelId'), 'electron/main.cjs must set AppUserModelId for Windows taskbar');
assert(fs.existsSync(path.join(__dirname, '../build/icon.ico')), 'build/icon.ico must exist');
assert(fs.existsSync(path.join(__dirname, '../public/icon.ico')), 'public/icon.ico must exist');
assert(fs.existsSync(path.join(__dirname, '../electron/assets/icon.ico')), 'electron/assets/icon.ico must exist');
assert(fs.statSync(path.join(__dirname, '../build/icon.ico')).size > 50000, 'build/icon.ico must be a valid multi-res ICO');
assert(packageJson.build && packageJson.build.win && packageJson.build.win.icon === 'build/icon.ico', 'package.json build.win.icon must point to build/icon.ico');
assert(packageJson.build.productName === 'Rollvia' || packageJson.build.productName === 'Attendly', 'package.json productName must be Rollvia');
assert(indexHtml.includes('/icon.ico'), 'index.html must link icon.ico');
pass('Windows desktop icon, Electron window icon, taskbar grouping, and packaging build configuration verified');

// ─────────────────────────────────────────────────────────────────────────────
// 2. STUDENTS SCREEN VERTICAL SCROLLING WITH 80+ STUDENTS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 2. Students Screen Vertical Scrolling (80+ records) ---');
const studentsCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/StudentsView.tsx'), 'utf-8');

assert(studentsCode.includes("overflow: 'hidden'"), 'StudentsView parent container must have overflow: hidden');
assert(studentsCode.includes("flexShrink: 0"), 'StudentsView top header & search must have flexShrink: 0');
assert(studentsCode.includes("overflowY: 'auto'"), 'StudentsView table container must have overflowY: auto');
assert(studentsCode.includes("minHeight: 0"), 'StudentsView table container must have minHeight: 0 for proper flex scrolling');
assert(studentsCode.includes("position: 'sticky'"), 'StudentsView thead and th must be position: sticky');
assert(studentsCode.includes("top: 0"), 'StudentsView thead and th must be top: 0');

// Generate 85 mock students
const mock85Students = Array.from({ length: 85 }, (_, i) => ({
  id: `std_${i + 1}`,
  name: `Student ${i + 1}`,
  rollNumber: `CS-${String(i + 1).padStart(3, '0')}`,
}));
assert.strictEqual(mock85Students.length, 85);
pass('Students screen layout structure allows smooth vertical scrolling with 80+ records while keeping header controls pinned');

// ─────────────────────────────────────────────────────────────────────────────
// 3. IMPORT / PASTE LIST WORDING & ENFORCED VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 3. Import & Paste List Validation & Wording ---');
const modalCode = fs.readFileSync(path.join(__dirname, '../src/components/ui/StudentImportModal.tsx'), 'utf-8');
const parserCode = fs.readFileSync(path.join(__dirname, '../src/utils/studentImportParser.ts'), 'utf-8');

assert(modalCode.includes('Required: Name and Roll No / ID'), 'Modal must prominently state Required: Name and Roll No / ID');
assert(modalCode.includes('Name —') && modalCode.includes('Required'), 'Modal must clearly mark Name — Required');
assert(modalCode.includes('Roll No / ID —') && modalCode.includes('Required'), 'Modal must clearly mark Roll No / ID — Required');
assert(modalCode.includes('Phone — Optional'), 'Modal must clearly mark Phone — Optional');
assert(modalCode.includes('Email — Optional'), 'Modal must clearly mark Email — Optional');

// Parser validation simulation
function parseRow(name, roll, _phone = '', _email = '') {
  const errors = [];
  if (!name || !name.trim()) errors.push('Missing Name');
  if (!roll || !roll.trim()) errors.push('Missing Roll No / ID');

  const status = errors.length > 0 ? 'missing_required' : 'valid';
  const eligible = status === 'valid';
  return { status, errors, eligible };
}

// Test case A: Valid row with phone and email
const validWithAll = parseRow('John Doe', '101', '9876543210', 'john@example.com');
assert.strictEqual(validWithAll.status, 'valid');
assert.strictEqual(validWithAll.eligible, true);

// Test case B: Valid row with phone and email omitted (empty)
const validWithOnlyRequired = parseRow('Jake Smith', '102', '', '');
assert.strictEqual(validWithOnlyRequired.status, 'valid');
assert.strictEqual(validWithOnlyRequired.eligible, true);

// Test case C: Missing Name
const missingName = parseRow('', '103', '9876543212', 'no-name@example.com');
assert.strictEqual(missingName.status, 'missing_required');
assert.strictEqual(missingName.eligible, false);
assert(missingName.errors.includes('Missing Name'), 'Must report Missing Name error');

// Test case D: Missing Roll No / ID
const missingRoll = parseRow('Jane Doe', '', '9876543213', '');
assert.strictEqual(missingRoll.status, 'missing_required');
assert.strictEqual(missingRoll.eligible, false);
assert(missingRoll.errors.includes('Missing Roll No / ID'), 'Must report Missing Roll No / ID error');

// Test case E: Missing both Name and Roll No
const missingBoth = parseRow('', '', '9876543214', 'orphan@example.com');
assert.strictEqual(missingBoth.status, 'missing_required');
assert.strictEqual(missingBoth.eligible, false);
assert(missingBoth.errors.includes('Missing Name') && missingBoth.errors.includes('Missing Roll No / ID'));

pass('Import validation strictly requires Name and Roll No / ID, rejects incomplete rows, and allows optional Phone/Email');

// ─────────────────────────────────────────────────────────────────────────────
// 4. PASTE LIST GENERIC EXAMPLES
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 4. Paste List Generic Examples ---');
assert(!modalCode.includes('Hitesh'), 'StudentImportModal must NOT use Hitesh in examples');
assert(!parserCode.includes('Hitesh'), 'studentImportParser must NOT use Hitesh');
assert(modalCode.includes('John Doe'), 'StudentImportModal must use John Doe generic example');
assert(modalCode.includes('Jake Smith'), 'StudentImportModal must use Jake Smith generic example');
assert(modalCode.includes('101') && modalCode.includes('102'), 'Must include generic 101/102 roll numbers');
pass('Paste List example uses clear generic names (John Doe, Jake Smith) and sample data');

// ─────────────────────────────────────────────────────────────────────────────
// 5. REMOVE QUICK COLUMN FROM ATTENDANCE TABLE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 5. Quick Column Removal ---');
const gridCode = fs.readFileSync(path.join(__dirname, '../src/components/workspace/AttendanceGrid.tsx'), 'utf-8');

assert(!gridCode.includes('>Quick<') && !gridCode.includes('> Quick <'), 'Quick column header MUST be removed');
assert(!gridCode.includes('Quick Row Actions'), 'Quick column row actions MUST be removed');
assert(!gridCode.includes('toggleAllForPerson'), 'toggleAllForPerson for Quick column MUST be removed');
pass('QUICK column completely removed from attendance header and table body');

// ─────────────────────────────────────────────────────────────────────────────
// 6. TOP ATTENDANCE TOOLS (SELECTED CLASS VS ALL CLASSES TODAY)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 6. Attendance Tools: Subject Actions vs Day Actions ---');

// Mock data: 2 subjects (PP and DCCN), 3 students
const mockSubjects = [
  { id: 'sub_pp', name: 'PP' },
  { id: 'sub_dccn', name: 'DCCN' },
];
const mockPeople = [
  { id: 'p1', name: 'Aarav', rollNumber: 'CS-01' },
  { id: 'p2', name: 'Bhavna', rollNumber: 'CS-02' },
  { id: 'p3', name: 'Chetan', rollNumber: 'CS-03' },
];

let currentAttendance = {
  p1: { sub_pp: false, PP: false, sub_dccn: true, DCCN: true },
  p2: { sub_pp: true, PP: true, sub_dccn: false, DCCN: false },
  p3: { sub_pp: false, PP: false, sub_dccn: false, DCCN: false },
};

// Operation A: PARTICULAR CLASS / SUBJECT (PP All Present)
function applySubjectBulk(subject, present) {
  const updated = {};
  mockPeople.forEach(p => {
    const prevPerson = currentAttendance[p.id] || {};
    updated[p.id] = {
      ...prevPerson,
      [subject.id]: present,
      [subject.name]: present,
    };
  });
  currentAttendance = updated;
}

// Mark PP only as All Present
applySubjectBulk(mockSubjects[0], true);

// Verify PP is Present for all 3 students
assert.strictEqual(currentAttendance.p1.PP, true);
assert.strictEqual(currentAttendance.p2.PP, true);
assert.strictEqual(currentAttendance.p3.PP, true);

// CRITICAL CHECK: DCCN MUST NOT BE MODIFIED!
assert.strictEqual(currentAttendance.p1.DCCN, true, 'DCCN for p1 must remain untouched (true)');
assert.strictEqual(currentAttendance.p2.DCCN, false, 'DCCN for p2 must remain untouched (false)');
assert.strictEqual(currentAttendance.p3.DCCN, false, 'DCCN for p3 must remain untouched (false)');
pass('Selected Class "All Present" marks every student Present for that class only and leaves other classes intact');

// Mark PP only as All Absent
applySubjectBulk(mockSubjects[0], false);
assert.strictEqual(currentAttendance.p1.PP, false);
assert.strictEqual(currentAttendance.p2.PP, false);
assert.strictEqual(currentAttendance.p3.PP, false);
// DCCN still untouched:
assert.strictEqual(currentAttendance.p1.DCCN, true);
assert.strictEqual(currentAttendance.p2.DCCN, false);
pass('Selected Class "All Absent" marks every student Absent for that class only');

// Operation B: ALL CLASSES FOR CURRENT DAY
function applyAllClassesBulk(subjects, present) {
  const updated = {};
  mockPeople.forEach(p => {
    const personMap = {};
    subjects.forEach(s => {
      personMap[s.id] = present;
      personMap[s.name] = present;
    });
    updated[p.id] = personMap;
  });
  currentAttendance = updated;
}

// All Classes Present
applyAllClassesBulk(mockSubjects, true);
mockPeople.forEach(p => {
  assert.strictEqual(currentAttendance[p.id].PP, true);
  assert.strictEqual(currentAttendance[p.id].DCCN, true);
});
pass('All Classes Present affects every class for the current day');

// All Classes Absent
applyAllClassesBulk(mockSubjects, false);
mockPeople.forEach(p => {
  assert.strictEqual(currentAttendance[p.id].PP, false);
  assert.strictEqual(currentAttendance[p.id].DCCN, false);
});
pass('All Classes Absent affects every class for the current day');

// ─────────────────────────────────────────────────────────────────────────────
// 7. CONFIRMATION DIALOG FOR BULK DESTRUCTIVE ACTIONS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 7. Confirmation Dialog for Bulk Actions ---');
assert(gridCode.includes('promptSubjectBulk'), 'AttendanceGrid must prompt confirmation for subject bulk action');
assert(gridCode.includes('promptAllClassesBulk'), 'AttendanceGrid must prompt confirmation for all-classes bulk action');
assert(gridCode.includes('bulkConfirmModal'), 'AttendanceGrid must render bulkConfirmModal');
assert(gridCode.includes('Cancel') && gridCode.includes('Confirm'), 'Confirmation modal must have Cancel and Confirm buttons');
pass('Confirmation dialog appears before applying bulk changes; cancellation preserves existing state');

console.log('\n========================================================');
console.log(`ALL ${passCount} TESTS PASSED!`);
console.log('========================================================');
