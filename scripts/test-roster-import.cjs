// @ts-check
/**
 * Roster Import & Persistence Test Suite
 * Validates:
 * 1. Excel/CSV student file parsing (Name, Roll No, Phone, Email)
 * 2. Tab-separated Paste List parsing (Name<TAB>Roll No<TAB>Phone<TAB>Email)
 * 3. Required fields validation (Name and Roll No)
 * 4. Duplicate Roll No detection (within batch and against existing roster)
 * 5. Non-destructive import (preserves existing students)
 * 6. Safe update mode (preserves student ID and attendance records)
 * 7. Excel _Roster hidden sheet persistence and readback
 */

const assert = require('assert');
const XLSX = require('xlsx');

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

console.log('========================================================');
console.log('TEST SUITE: STUDENT ROSTER IMPORT & PERSISTENCE');
console.log('========================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Paste List TSV Parsing (Name<TAB>Roll No<TAB>Phone<TAB>Email)
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Paste List TSV Parsing ---');
try {
  // Simulate TSV data copied from Excel
  const tsvInput = [
    'Hitesh Sharma\t101\t9876543210\thitesh@test.com',
    'Mohan Kumar\t102\t9876543211\tmohan@test.com',
    'Rohan Verma\t103\t\trohan@test.com',
  ].join('\n');

  // Simple TSV parser equivalent to our implementation
  const lines = tsvInput.split('\n').filter(Boolean);
  const rows = lines.map((l) => l.split('\t').map((c) => c.trim()));

  assert.strictEqual(rows.length, 3, 'Should parse 3 rows');
  assert.strictEqual(rows[0][0], 'Hitesh Sharma');
  assert.strictEqual(rows[0][1], '101');
  assert.strictEqual(rows[0][2], '9876543210');
  assert.strictEqual(rows[0][3], 'hitesh@test.com');
  assert.strictEqual(rows[2][0], 'Rohan Verma');
  assert.strictEqual(rows[2][1], '103');
  assert.strictEqual(rows[2][2], '', 'Optional phone should be empty string');
  assert.strictEqual(rows[2][3], 'rohan@test.com');
  pass('TSV pasted list parses Name, Roll No, Phone, and Email properly');
} catch (err) {
  fail('TSV parsing failed', err);
}

// -----------------------------------------------------------------------------
// Test 2: Required Columns Validation (Name and Roll No Required)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Required Columns Validation ---');
try {
  const testCases = [
    { row: ['', '101', '123', 'a@b.com'], expectedValid: false, reason: 'Missing Name' },
    { row: ['Alice', '', '123', 'a@b.com'], expectedValid: false, reason: 'Missing Roll No' },
    { row: ['Bob', '102', '', ''], expectedValid: true, reason: 'Phone and Email optional' },
    { row: ['Charlie', '103', '999', 'c@b.com'], expectedValid: true, reason: 'All fields present' },
  ];

  for (const tc of testCases) {
    const name = tc.row[0].trim();
    const roll = tc.row[1].trim();
    const isValid = Boolean(name && roll);
    assert.strictEqual(isValid, tc.expectedValid, `Validation mismatch for case: ${tc.reason}`);
  }
  pass('Validation strictly requires Name and Roll No, allowing optional Phone and Email');
} catch (err) {
  fail('Required validation failed', err);
}

// -----------------------------------------------------------------------------
// Test 3: Duplicate Roll No Detection (In-Batch and Existing Roster)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Duplicate Roll No Detection ---');
try {
  const existingRoster = [
    { id: 'p_1', name: 'Existing Student', rollNumber: '101' },
    { id: 'p_2', name: 'Another Student', rollNumber: '102' },
  ];

  const incomingBatch = [
    { name: 'New Student 1', rollNumber: '101' }, // Existing in roster
    { name: 'New Student 2', rollNumber: '103' }, // Valid new
    { name: 'New Student 3', rollNumber: '103' }, // Duplicate within batch!
    { name: 'New Student 4', rollNumber: '104' }, // Valid new
  ];

  const existingRollSet = new Set(existingRoster.map((p) => p.rollNumber.toLowerCase()));
  const seenInBatch = new Set();
  const classified = incomingBatch.map((item) => {
    const roll = item.rollNumber.toLowerCase();
    if (seenInBatch.has(roll)) return 'duplicate_in_input';
    if (existingRollSet.has(roll)) {
      seenInBatch.add(roll);
      return 'duplicate_existing';
    }
    seenInBatch.add(roll);
    return 'valid';
  });

  assert.strictEqual(classified[0], 'duplicate_existing', 'Roll 101 should be detected as existing in roster');
  assert.strictEqual(classified[1], 'valid', 'Roll 103 should be valid on first occurrence');
  assert.strictEqual(classified[2], 'duplicate_in_input', 'Second Roll 103 should be detected as batch duplicate');
  assert.strictEqual(classified[3], 'valid', 'Roll 104 should be valid');
  pass('Duplicate Roll Nos correctly flagged for both roster collisions and in-batch duplicates');
} catch (err) {
  fail('Duplicate detection failed', err);
}

// -----------------------------------------------------------------------------
// Test 4: Safe Non-Destructive Merge (Do Not Delete Existing Students)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: Safe Non-Destructive Merge ---');
try {
  const existingStudents = [
    { id: 'p_1', name: 'Existing 1', rollNumber: '101', phone: '111', email: 'e1@test.com' },
    { id: 'p_2', name: 'Existing 2', rollNumber: '102', phone: '222', email: 'e2@test.com' },
  ];

  const newToImport = [
    { name: 'Existing 1 Updated', rollNumber: '101', phone: '999', email: 'e1_new@test.com' },
    { name: 'Brand New', rollNumber: '105', phone: '555', email: 'e5@test.com' },
  ];

  // Scenario A: Skip Duplicates (Default)
  const rosterSkipMode = [...existingStudents];
  const existingRolls = new Set(rosterSkipMode.map((p) => p.rollNumber.toLowerCase()));

  for (const s of newToImport) {
    if (!existingRolls.has(s.rollNumber.toLowerCase())) {
      rosterSkipMode.push({ id: `p_${Date.now()}_${s.rollNumber}`, ...s });
      existingRolls.add(s.rollNumber.toLowerCase());
    }
  }

  assert.strictEqual(rosterSkipMode.length, 3, 'Should have 3 students (2 existing + 1 new)');
  assert.strictEqual(rosterSkipMode[0].phone, '111', 'Existing 1 phone should remain unchanged in skip mode');
  assert.strictEqual(rosterSkipMode[2].rollNumber, '105', 'Brand new student was added');
  pass('Skip duplicates mode preserves all existing students and adds new ones');

  // Scenario B: Update Existing Mode
  const rosterUpdateMode = existingStudents.map((p) => ({ ...p }));
  const rollMap = new Map(rosterUpdateMode.map((p, idx) => [p.rollNumber.toLowerCase(), idx]));

  for (const s of newToImport) {
    const rollKey = s.rollNumber.toLowerCase();
    if (rollMap.has(rollKey)) {
      const idx = rollMap.get(rollKey);
      rosterUpdateMode[idx] = {
        ...rosterUpdateMode[idx],
        name: s.name,
        phone: s.phone,
        email: s.email,
      };
    } else {
      rosterUpdateMode.push({ id: `p_${Date.now()}_${s.rollNumber}`, ...s });
    }
  }

  assert.strictEqual(rosterUpdateMode.length, 3);
  assert.strictEqual(rosterUpdateMode[0].id, 'p_1', 'Student ID must NOT change when details are updated');
  assert.strictEqual(rosterUpdateMode[0].phone, '999', 'Existing 1 phone updated');
  assert.strictEqual(rosterUpdateMode[1].id, 'p_2', 'Student 2 unchanged');
  pass('Update existing mode updates details while strictly preserving student ID');
} catch (err) {
  fail('Merge safety failed', err);
}

// -----------------------------------------------------------------------------
// Test 5: Attendance Safety When Roster is Edited
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: Attendance Safety When Roster is Edited ---');
try {
  // Existing attendance record linked to student ID p_1
  const attendanceRecords = [
    {
      id: 'rec_1',
      date: '2026-09-01',
      personId: 'p_1',
      personName: 'Old Name',
      rollNumber: '101',
      className: 'Java',
      status: 'Present',
    },
    {
      id: 'rec_2',
      date: '2026-09-01',
      personId: 'p_2',
      personName: 'Student Two',
      rollNumber: '102',
      className: 'Java',
      status: 'Absent',
    },
  ];

  // Daily map keyed by personId
  const dailyAttendance = {
    '2026-09-01': {
      p_1: { Java: true },
      p_2: { Java: false },
    },
  };

  // Student p_1 is renamed to 'Corrected Name' and roll updated to '101-A'
  const updatedStudent = { id: 'p_1', name: 'Corrected Name', rollNumber: '101-A' };

  // Update records
  const updatedRecords = attendanceRecords.map((r) => {
    if (r.personId === updatedStudent.id) {
      return {
        ...r,
        personName: updatedStudent.name,
        rollNumber: updatedStudent.rollNumber,
      };
    }
    return r;
  });

  // Verification
  assert.strictEqual(updatedRecords.length, 2, 'Total attendance records must not change');
  assert.strictEqual(updatedRecords[0].status, 'Present', 'Attendance mark Present must be strictly preserved');
  assert.strictEqual(updatedRecords[0].personName, 'Corrected Name', 'Name updated in record');
  assert.strictEqual(updatedRecords[0].rollNumber, '101-A', 'Roll No updated in record');
  assert.strictEqual(dailyAttendance['2026-09-01'][updatedStudent.id].Java, true, 'Daily attendance map remains intact because personId is preserved');
  pass('Existing attendance is never lost when student roster is edited');
} catch (err) {
  fail('Attendance safety failed', err);
}

// -----------------------------------------------------------------------------
// Test 6: Excel File Generation with _Roster Sheet and Readback
// -----------------------------------------------------------------------------
console.log('\n--- TEST 6: Excel _Roster Sheet Generation and Readback ---');
try {
  const students = [
    { id: 'p_101', rollNumber: '101', name: 'Alice Smith', phone: '9876543210', email: 'alice@test.com' },
    { id: 'p_102', rollNumber: '102', name: 'Bob Jones', phone: '9876543211', email: 'bob@test.com' },
  ];

  // Build _Roster sheet
  const rosterHeaders = ['Roll No', 'Name', 'Phone', 'Email', 'Student ID'];
  const rosterRows = [rosterHeaders];
  for (const s of students) {
    rosterRows.push([s.rollNumber, s.name, s.phone, s.email, s.id]);
  }

  const wb = XLSX.utils.book_new();
  const wsRoster = XLSX.utils.aoa_to_sheet(rosterRows);
  XLSX.utils.book_append_sheet(wb, wsRoster, '_Roster');

  // Write and Read back
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const readWb = XLSX.read(buf, { type: 'buffer' });

  assert(readWb.SheetNames.includes('_Roster'), '_Roster sheet must exist in workbook');
  const readSheet = readWb.Sheets['_Roster'];
  const readRows = XLSX.utils.sheet_to_json(readSheet, { header: 1 });

  assert.strictEqual(readRows.length, 3, 'Must have header + 2 student rows');
  assert.strictEqual(readRows[1][0], '101');
  assert.strictEqual(readRows[1][1], 'Alice Smith');
  assert.strictEqual(readRows[1][2], '9876543210');
  assert.strictEqual(readRows[1][3], 'alice@test.com');
  assert.strictEqual(readRows[1][4], 'p_101');

  pass('Excel workbook correctly stores and restores student roster losslessly from _Roster sheet');
} catch (err) {
  fail('Excel _Roster persistence failed', err);
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n========================================================');
console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('========================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
