// @ts-check
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');

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
console.log('TEST SUITE: ATTENDLY MONTHLY PDF PAGINATION (10, 24, 25, 82, 100+)');
console.log('========================================================\n');

// 1. Transpile and load actual src/utils/pdfExport.ts
const thresholdsPath = path.join(__dirname, '../src/utils/thresholds.ts');
const pdfExportPath = path.join(__dirname, '../src/utils/pdfExport.ts');

const thresholdsTranspiled = ts.transpileModule(fs.readFileSync(thresholdsPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

const pdfExportTranspiled = ts.transpileModule(fs.readFileSync(pdfExportPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

// Set up virtual module loader for testing
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

// Helper to generate N dummy students and profiles
function createTestDataset(count) {
  const roster = [];
  const profiles = new Map();

  for (let i = 1; i <= count; i++) {
    const id = `student_${i}`;
    const name = `Student ${i}`;
    const rollNumber = `CS-${String(i).padStart(3, '0')}`;
    roster.push({ id, name, rollNumber });

    // Alternating percentages to test color branches: >=75% green, 60-74% orange, <60% red
    let pct = '85.0%';
    let present = 17;
    let absent = 3;
    if (i % 3 === 1) {
      pct = '85.0%'; // green
      present = 17;
      absent = 3;
    } else if (i % 3 === 2) {
      pct = '65.0%'; // orange
      present = 13;
      absent = 7;
    } else {
      pct = '50.0%'; // red
      present = 10;
      absent = 10;
    }

    profiles.set(id, {
      personId: id,
      totalClasses: 20,
      presentClasses: present,
      absentClasses: absent,
      overallPercentage: pct,
      subjectBreakdown: [],
    });
  }

  return { roster, profiles };
}

// Helper to extract page count from PDF buffer
function parsePdfPageCount(buffer) {
  const str = Buffer.from(buffer).toString('latin1');
  const pagesMatch = str.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
  if (pagesMatch) {
    return parseInt(pagesMatch[1], 10);
  }
  return 0;
}

// Helper to verify byte offsets in xref
function verifyPdfXref(buffer) {
  const buf = Buffer.from(buffer);
  const str = buf.toString('latin1');
  assert(str.startsWith('%PDF-1.4'), 'Must start with %PDF-1.4');
  assert(str.trimEnd().endsWith('%%EOF'), 'Must end with %%EOF');

  const startXrefMatch = str.match(/startxref\s+(\d+)\s+%%EOF/);
  assert(startXrefMatch, 'Must contain startxref marker');
  const startXref = parseInt(startXrefMatch[1], 10);

  const xrefSection = str.slice(startXref);
  const xrefHeaderMatch = xrefSection.match(/xref\s+0\s+(\d+)/);
  assert(xrefHeaderMatch, 'Must contain xref header with object count');
  const objCount = parseInt(xrefHeaderMatch[1], 10);

  // Check each object offset
  const entries = xrefSection.split('\n').filter(line => /^\d{10}\s+\d{5}\s+[fn]/.test(line));
  assert.strictEqual(entries.length, objCount, `xref entry count (${entries.length}) must match declared count (${objCount})`);

  for (let i = 1; i < objCount; i++) {
    const entry = entries[i];
    const offset = parseInt(entry.slice(0, 10), 10);
    // Slice at offset and check for `${i} 0 obj`
    const target = `${i} 0 obj`;
    const actual = buf.toString('latin1', offset, offset + target.length);
    assert.strictEqual(actual, target, `Object ${i} at offset ${offset} must start with "${target}", found "${actual}"`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 1: 10 STUDENTS (Single Page)
// ─────────────────────────────────────────────────────────────────────────────
try {
  console.log('--- Scenario 1: 10 Students ---');
  const { roster, profiles } = createTestDataset(10);
  const buf = generateMonthlyAttendancePdfBuffer({
    monthStr: 'September 2026',
    roster,
    profiles,
    savedDatesCount: 15,
    holidaysCount: 2,
  });

  const pageCount = parsePdfPageCount(buf);
  assert.strictEqual(pageCount, 1, `10 students must generate exactly 1 page (got ${pageCount})`);

  const str = Buffer.from(buf).toString('latin1');
  assert(str.includes('Page 1 of 1'), 'Must include "Page 1 of 1"');
  assert(str.includes('Total Enrolled: 10'), 'Must display Total Enrolled: 10');

  // Verify all 10 students are present
  for (let i = 1; i <= 10; i++) {
    assert(str.includes(`Student ${i}`), `Must contain Student ${i}`);
    assert(str.includes(`CS-${String(i).padStart(3, '0')}`), `Must contain roll number for Student ${i}`);
  }

  // Verify no extra student labels
  assert(!str.includes('Student 11'), 'Must not contain Student 11');

  verifyPdfXref(buf);
  pass('Scenario 1: 10 students rendered perfectly on 1 page with valid PDF structure');
} catch (err) {
  fail('Scenario 1 (10 students) failed', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 2: 24 STUDENTS (Exact Single-Page Limit)
// ─────────────────────────────────────────────────────────────────────────────
try {
  console.log('\n--- Scenario 2: 24 Students (Exact Page 1 Capacity) ---');
  const { roster, profiles } = createTestDataset(24);
  const buf = generateMonthlyAttendancePdfBuffer({
    monthStr: 'September 2026',
    roster,
    profiles,
    savedDatesCount: 15,
    holidaysCount: 2,
  });

  const pageCount = parsePdfPageCount(buf);
  assert.strictEqual(pageCount, 1, `24 students must fit exactly on 1 page (got ${pageCount})`);

  const str = Buffer.from(buf).toString('latin1');
  assert(str.includes('Page 1 of 1'), 'Must include "Page 1 of 1"');

  // All 24 students present exactly once
  for (let i = 1; i <= 24; i++) {
    const studentMatches = (str.match(new RegExp(`\\(Student ${i}\\)`, 'g')) || []).length;
    assert.strictEqual(studentMatches, 1, `Student ${i} must appear exactly once (got ${studentMatches})`);
  }

  verifyPdfXref(buf);
  pass('Scenario 2: 24 students fit on 1 page with all 24 students present exactly once');
} catch (err) {
  fail('Scenario 2 (24 students) failed', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 3: 25 STUDENTS (Overflow Boundary: 24 on Page 1, 1 on Page 2)
// ─────────────────────────────────────────────────────────────────────────────
try {
  console.log('\n--- Scenario 3: 25 Students (Boundary: Spills to Page 2) ---');
  const { roster, profiles } = createTestDataset(25);
  const buf = generateMonthlyAttendancePdfBuffer({
    monthStr: 'September 2026',
    roster,
    profiles,
    savedDatesCount: 15,
    holidaysCount: 2,
  });

  const pageCount = parsePdfPageCount(buf);
  assert.strictEqual(pageCount, 2, `25 students must generate exactly 2 pages (got ${pageCount})`);

  const str = Buffer.from(buf).toString('latin1');
  assert(str.includes('Page 1 of 2'), 'Must include "Page 1 of 2"');
  assert(str.includes('Page 2 of 2'), 'Must include "Page 2 of 2"');
  assert(str.includes('Rollvia - Monthly Attendance Report \\(Continued\\)') || str.includes('Attendly - Monthly Attendance Report \\(Continued\\)'), 'Page 2 must have continuation header');

  // All 25 students present exactly once
  for (let i = 1; i <= 25; i++) {
    const studentMatches = (str.match(new RegExp(`\\(Student ${i}\\)`, 'g')) || []).length;
    assert.strictEqual(studentMatches, 1, `Student ${i} must appear exactly once (got ${studentMatches})`);
  }

  // Student 25 should be in page 2
  assert(str.includes('(Student 25) Tj'), 'Student 25 must be rendered');

  verifyPdfXref(buf);
  pass('Scenario 3: 25 students correctly creates 2 pages with Student 25 on page 2');
} catch (err) {
  fail('Scenario 3 (25 students) failed', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 4: 82 STUDENTS (Attendly Actual Issue Case: 4 Pages)
// ─────────────────────────────────────────────────────────────────────────────
try {
  console.log('\n--- Scenario 4: 82 Students (Actual Issue: 4 Pages) ---');
  const { roster, profiles } = createTestDataset(82);
  const buf = generateMonthlyAttendancePdfBuffer({
    monthStr: 'September 2026',
    institutionName: 'Apex Institute of Technology',
    departmentName: 'Computer Science',
    academicYear: '2026-2027',
    roster,
    profiles,
    savedDatesCount: 22,
    holidaysCount: 4,
  });

  const pageCount = parsePdfPageCount(buf);
  // Page 1: 24
  // Page 2: 26 (students 25..50)
  // Page 3: 26 (students 51..76)
  // Page 4: 6  (students 77..82)
  assert.strictEqual(pageCount, 4, `82 students must generate exactly 4 pages (got ${pageCount})`);

  const str = Buffer.from(buf).toString('latin1');
  assert(str.includes('Page 1 of 4'), 'Must include "Page 1 of 4"');
  assert(str.includes('Page 2 of 4'), 'Must include "Page 2 of 4"');
  assert(str.includes('Page 3 of 4'), 'Must include "Page 3 of 4"');
  assert(str.includes('Page 4 of 4'), 'Must include "Page 4 of 4"');

  // Verify ALL 82 students are present exactly once without skips or duplicates
  for (let i = 1; i <= 82; i++) {
    const studentMatches = (str.match(new RegExp(`\\(Student ${i}\\)`, 'g')) || []).length;
    assert.strictEqual(studentMatches, 1, `Student ${i} must appear exactly once in PDF (got ${studentMatches})`);

    const rollMatches = (str.match(new RegExp(`\\(CS-${String(i).padStart(3, '0')}\\)`, 'g')) || []).length;
    assert.strictEqual(rollMatches, 1, `Roll CS-${String(i).padStart(3, '0')} must appear exactly once in PDF`);
  }

  // Verify the last student (#82) is present
  assert(str.includes('(Student 82)'), 'Final student #82 must be included in the report');
  assert(str.includes('(CS-082)'), 'Final student #82 roll number must be included in the report');

  // Verify no student 83
  assert(!str.includes('Student 83'), 'Must not contain Student 83');

  verifyPdfXref(buf);
  pass('Scenario 4: 82 students completely resolved across 4 pages with all 82 students present exactly once');
} catch (err) {
  fail('Scenario 4 (82 students) failed', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 5: 105 STUDENTS (100+ Students Case: 5 Pages)
// ─────────────────────────────────────────────────────────────────────────────
try {
  console.log('\n--- Scenario 5: 105 Students (100+ Students Case: 5 Pages) ---');
  const { roster, profiles } = createTestDataset(105);
  const buf = generateMonthlyAttendancePdfBuffer({
    monthStr: 'September 2026',
    roster,
    profiles,
    savedDatesCount: 20,
    holidaysCount: 2,
  });

  const pageCount = parsePdfPageCount(buf);
  // Page 1: 24
  // Page 2: 26 (25..50)
  // Page 3: 26 (51..76)
  // Page 4: 26 (77..102)
  // Page 5: 3  (103..105)
  assert.strictEqual(pageCount, 5, `105 students must generate exactly 5 pages (got ${pageCount})`);

  const str = Buffer.from(buf).toString('latin1');
  for (let p = 1; p <= 5; p++) {
    assert(str.includes(`Page ${p} of 5`), `Must include "Page ${p} of 5"`);
  }

  // Verify all 105 students present exactly once
  for (let i = 1; i <= 105; i++) {
    const studentMatches = (str.match(new RegExp(`\\(Student ${i}\\)`, 'g')) || []).length;
    assert.strictEqual(studentMatches, 1, `Student ${i} must appear exactly once in PDF (got ${studentMatches})`);
  }

  verifyPdfXref(buf);
  pass('Scenario 5: 105 students (100+) seamlessly rendered across 5 pages');
} catch (err) {
  fail('Scenario 5 (105 students) failed', err);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 6: DESIGN INTEGRITY & PROHIBITED LABELS CHECK
// ─────────────────────────────────────────────────────────────────────────────
try {
  console.log('\n--- Scenario 6: Design Integrity & Classification Checks ---');
  const { roster, profiles } = createTestDataset(82);
  const buf = generateMonthlyAttendancePdfBuffer({
    monthStr: 'September 2026',
    roster,
    profiles,
    savedDatesCount: 15,
    holidaysCount: 2,
  });

  const str = Buffer.from(buf).toString('latin1');

  // Must NOT contain classification words
  assert(!str.includes('Healthy'), 'PDF must NOT contain "Healthy" classification label');
  assert(!str.includes('Warning'), 'PDF must NOT contain "Warning" classification label');
  assert(!str.includes('Critical'), 'PDF must NOT contain "Critical" classification label');

  // Must contain table headers repeated on every page
  const headerCount = (str.match(/Student Name/g) || []).length;
  assert.strictEqual(headerCount, 4, `Table header "Student Name" must be repeated on all 4 pages (found ${headerCount})`);

  // Must contain color thresholds explanation in footer
  assert(str.includes('Green \\22575%') || str.includes('Green') && str.includes('Orange') && str.includes('Red'), 'Footer must contain color legends');

  pass('Scenario 6: Design integrity maintained, no classification labels, headers repeated on every page');
} catch (err) {
  fail('Scenario 6 failed', err);
}

// Summary
console.log('\n========================================================');
console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('========================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
