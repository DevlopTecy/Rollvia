import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { ExcelAdapter } from '../src/storage/adapters/ExcelAdapter';
import type { AttendanceDataset, AttendanceRecord } from '../src/models/attendance';
import type { Person, WeeklyTimetable } from '../src/types';

const testDir = path.resolve('test-artifacts');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

const targetFilePath = path.join(testDir, 'Verified_Attendance_September.xlsx');
if (fs.existsSync(targetFilePath)) {
  fs.unlinkSync(targetFilePath);
}

console.log('===============================================================');
console.log('REAL EXCEL STRUCTURED WORKBOOK VERIFICATION (SECTION 15 SPEC)');
console.log('===============================================================\n');

const adapter = new ExcelAdapter();

// 1. Setup Student 1 and Student 2 with internal generated IDs and configured Roll Nos
const student1: Person = {
  id: 'p_1790594986116_',
  name: 'Hitesh',
  rollNumber: '1',
  email: 'hitesh@example.com',
};

const student2: Person = {
  id: 'p_1790594986117_',
  name: 'Mohan',
  rollNumber: '2',
  email: 'mohan@example.com',
};

const roster: Person[] = [student1, student2];

// Timetable definition matching prompt:
// Monday: DBMS, Java
// Tuesday: PP, DCCN
// Wednesday: Java, OS, DCCN
const timetable: WeeklyTimetable = {
  Monday: [
    { id: 't_mon_1', name: 'DBMS' },
    { id: 't_mon_2', name: 'Java' },
  ],
  Tuesday: [
    { id: 't_tue_1', name: 'PP' },
    { id: 't_tue_2', name: 'DCCN' },
  ],
  Wednesday: [
    { id: 't_wed_1', name: 'Java' },
    { id: 't_wed_2', name: 'OS' },
    { id: 't_wed_3', name: 'DCCN' },
  ],
  Thursday: [
    { id: 't_thu_1', name: 'DBMS' },
    { id: 't_thu_2', name: 'PP' },
  ],
  Friday: [
    { id: 't_fri_1', name: 'Java' },
    { id: 't_fri_2', name: 'OS' },
  ],
  Saturday: [
    { id: 't_sat_1', name: 'Lab' },
  ],
  Sunday: [],
};

async function runScenario() {
  // -------------------------------------------------------------
  // Step 1: Save Session 1 (September 1 - Tuesday: PP, DCCN)
  // -------------------------------------------------------------
  console.log('Step 1: Saving Session 1 (2026-09-01 - Tuesday: PP, DCCN)...');
  const session1Records: AttendanceRecord[] = [
    { id: 'rec_1_pp', date: '2026-09-01', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber || '1', className: 'PP', status: 'Present' },
    { id: 'rec_1_dccn', date: '2026-09-01', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber || '1', className: 'DCCN', status: 'Present' },
    { id: 'rec_2_pp', date: '2026-09-01', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber || '2', className: 'PP', status: 'Present' },
    { id: 'rec_2_dccn', date: '2026-09-01', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber || '2', className: 'DCCN', status: 'Present' },
  ];

  const dataset1: AttendanceDataset = {
    storageMode: 'excel',
    date: '2026-09-01',
    formattedDate: '1 September 2026',
    roster,
    classes: [{ id: 'c_pp', name: 'PP' }, { id: 'c_dccn', name: 'DCCN' }],
    records: session1Records,
    summary: {
      totalRecords: 4,
      totalPresent: 4,
      totalAbsent: 0,
      attendancePercentage: 100,
      uniquePeopleCount: 2,
      uniqueClassesCount: 2,
    },
    metadata: {
      recordedAt: new Date().toISOString(),
      selectedMonth: 'September 2026',
      weeklyTimetable: timetable,
      onlyRecordedDates: true,
    },
  };

  const saveRes1 = await adapter.save(dataset1, targetFilePath);
  if (!saveRes1.success) {
    throw new Error(`Session 1 save failed: ${saveRes1.message}`);
  }
  console.log('✓ Session 1 saved successfully');

  // -------------------------------------------------------------
  // Step 2: Save Session 2 (September 2 - Wednesday: Java, OS, DCCN)
  // -------------------------------------------------------------
  console.log('Step 2: Saving Session 2 (2026-09-02 - Wednesday: Java, OS, DCCN)...');
  const session2Records: AttendanceRecord[] = [
    { id: 'rec_1_java', date: '2026-09-02', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber || '1', className: 'Java', status: 'Present' },
    { id: 'rec_1_os', date: '2026-09-02', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber || '1', className: 'OS', status: 'Present' },
    { id: 'rec_1_dccn2', date: '2026-09-02', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber || '1', className: 'DCCN', status: 'Absent' },
    { id: 'rec_2_java', date: '2026-09-02', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber || '2', className: 'Java', status: 'Present' },
    { id: 'rec_2_os', date: '2026-09-02', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber || '2', className: 'OS', status: 'Present' },
    { id: 'rec_2_dccn2', date: '2026-09-02', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber || '2', className: 'DCCN', status: 'Present' },
  ];

  const dataset2: AttendanceDataset = {
    storageMode: 'excel',
    date: '2026-09-02',
    formattedDate: '2 September 2026',
    roster,
    classes: [{ id: 'c_java', name: 'Java' }, { id: 'c_os', name: 'OS' }, { id: 'c_dccn', name: 'DCCN' }],
    records: session2Records,
    summary: {
      totalRecords: 6,
      totalPresent: 5,
      totalAbsent: 1,
      attendancePercentage: 83.3,
      uniquePeopleCount: 2,
      uniqueClassesCount: 3,
    },
    metadata: {
      recordedAt: new Date().toISOString(),
      selectedMonth: 'September 2026',
      weeklyTimetable: timetable,
      onlyRecordedDates: true,
    },
  };

  const saveRes2 = await adapter.save(dataset2, targetFilePath);
  if (!saveRes2.success) {
    throw new Error(`Session 2 save failed: ${saveRes2.message}`);
  }
  console.log('✓ Session 2 saved successfully');

  // -------------------------------------------------------------
  // Step 3: Save Session 3 (September 3 - Thursday: DBMS, PP)
  // -------------------------------------------------------------
  console.log('Step 3: Saving Session 3 (2026-09-03 - Thursday: DBMS, PP)...');
  const session3Records: AttendanceRecord[] = [
    { id: 'rec_1_dbms', date: '2026-09-03', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber || '1', className: 'DBMS', status: 'Present' },
    { id: 'rec_1_pp3', date: '2026-09-03', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber || '1', className: 'PP', status: 'Present' },
    { id: 'rec_2_dbms', date: '2026-09-03', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber || '2', className: 'DBMS', status: 'Absent' },
    { id: 'rec_2_pp3', date: '2026-09-03', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber || '2', className: 'PP', status: 'Present' },
  ];

  const dataset3: AttendanceDataset = {
    storageMode: 'excel',
    date: '2026-09-03',
    formattedDate: '3 September 2026',
    roster,
    classes: [{ id: 'c_dbms', name: 'DBMS' }, { id: 'c_pp', name: 'PP' }],
    records: session3Records,
    summary: {
      totalRecords: 4,
      totalPresent: 3,
      totalAbsent: 1,
      attendancePercentage: 75.0,
      uniquePeopleCount: 2,
      uniqueClassesCount: 2,
    },
    metadata: {
      recordedAt: new Date().toISOString(),
      selectedMonth: 'September 2026',
      weeklyTimetable: timetable,
      onlyRecordedDates: true,
    },
  };

  const saveRes3 = await adapter.save(dataset3, targetFilePath);
  if (!saveRes3.success) {
    throw new Error(`Session 3 save failed: ${saveRes3.message}`);
  }
  console.log('✓ Session 3 saved successfully');

  const readWorkbook = (filePath: string) => {
    const buf = fs.readFileSync(filePath);
    return XLSX.read(buf, { type: 'buffer' });
  };

  const wb = readWorkbook(targetFilePath);

  // 1. Verify sheet names
  console.log('Sheets in workbook:', wb.SheetNames);
  if (!wb.SheetNames.includes('Attendance September')) {
    throw new Error("Missing worksheet 'Attendance September'");
  }
  if (!wb.SheetNames.includes('Search')) {
    throw new Error("Missing worksheet 'Search'");
  }
  console.log("✓ 'Attendance September' sheet exists");
  console.log("✓ 'Search' sheet exists");

  // 2. Inspect 'Attendance September'
  const wsAttendance = wb.Sheets['Attendance September'];
  const attendanceRows = XLSX.utils.sheet_to_json<(string | number)[]>(wsAttendance, { header: 1 });

  console.log('\n--- Attendance September Matrix Contents ---');
  attendanceRows.forEach((r, idx) => {
    console.log(`Row ${idx}:`, JSON.stringify(r));
  });

  // Verify Title Banner
  if (attendanceRows[0][0] !== 'September 2026') {
    throw new Error(`Expected banner 'September 2026', got '${attendanceRows[0][0]}'`);
  }
  console.log("✓ Title banner is 'September 2026'");

  // Verify Date Headers (Horizontally grouped)
  const dateRow = attendanceRows[1];
  console.log('Date Header Row:', JSON.stringify(dateRow));
  if (dateRow[0] !== 'S.No.' || dateRow[1] !== 'Name' || dateRow[2] !== 'Roll No.') {
    throw new Error(`Header columns 0-2 must be S.No. | Name | Roll No., got ${dateRow.slice(0, 3)}`);
  }
  if (dateRow[3] !== '1-Sep' || dateRow[5] !== '2-Sep' || dateRow[8] !== '3-Sep') {
    throw new Error(`Date columns mismatch: Col 3=${dateRow[3]}, Col 5=${dateRow[5]}, Col 8=${dateRow[8]}`);
  }
  console.log('✓ Dates are horizontally arranged: 1-Sep, 2-Sep, 3-Sep');

  // Verify Weekdays under dates
  const weekdayRow = attendanceRows[2];
  console.log('Weekday Row:', JSON.stringify(weekdayRow));
  if (weekdayRow[3] !== 'Tuesday' || weekdayRow[5] !== 'Wednesday' || weekdayRow[8] !== 'Thursday') {
    throw new Error(`Weekday mismatch: Col 3=${weekdayRow[3]}, Col 5=${weekdayRow[5]}, Col 8=${weekdayRow[8]}`);
  }
  console.log('✓ Weekdays appear under dates: Tuesday, Wednesday, Thursday');

  // Verify Subjects under weekdays
  const subjectRow = attendanceRows[3];
  console.log('Subject Row:', JSON.stringify(subjectRow));
  if (
    subjectRow[3] !== 'PP' || subjectRow[4] !== 'DCCN' ||
    subjectRow[5] !== 'Java' || subjectRow[6] !== 'OS' || subjectRow[7] !== 'DCCN' ||
    subjectRow[8] !== 'DBMS' || subjectRow[9] !== 'PP'
  ) {
    throw new Error(`Subject sequence mismatch: ${JSON.stringify(subjectRow.slice(3, 10))}`);
  }
  console.log('✓ Correct subjects appear under each date according to timetable:');
  console.log('    1-Sep (Tuesday): PP, DCCN');
  console.log('    2-Sep (Wednesday): Java, OS, DCCN');
  console.log('    3-Sep (Thursday): DBMS, PP');

  // Verify Student Rows & P/A values
  const hiteshRow = attendanceRows[4];
  const mohanRow = attendanceRows[5];

  console.log('\nHitesh Row:', JSON.stringify(hiteshRow));
  console.log('Mohan Row:', JSON.stringify(mohanRow));

  if (hiteshRow[1] !== 'Hitesh' || String(hiteshRow[2]) !== '1') {
    throw new Error(`Student 1 must be Hitesh, Roll 1; got ${hiteshRow[1]}, ${hiteshRow[2]}`);
  }
  if (mohanRow[1] !== 'Mohan' || String(mohanRow[2]) !== '2') {
    throw new Error(`Student 2 must be Mohan, Roll 2; got ${mohanRow[1]}, ${mohanRow[2]}`);
  }
  console.log('✓ Student names and Roll Nos are strictly verified (NO internal IDs)');

  // Verify P/A cell values
  // Hitesh: 1-Sep(P, P), 2-Sep(P, P, A), 3-Sep(P, P)
  // Mohan:  1-Sep(P, P), 2-Sep(P, P, P), 3-Sep(A, P)
  const hiteshAttendance = hiteshRow.slice(3, 10);
  const mohanAttendance = mohanRow.slice(3, 10);

  if (JSON.stringify(hiteshAttendance) !== JSON.stringify(['P', 'P', 'P', 'P', 'A', 'P', 'P'])) {
    throw new Error(`Hitesh attendance mismatch: ${JSON.stringify(hiteshAttendance)}`);
  }
  if (JSON.stringify(mohanAttendance) !== JSON.stringify(['P', 'P', 'P', 'P', 'P', 'A', 'P'])) {
    throw new Error(`Mohan attendance mismatch: ${JSON.stringify(mohanAttendance)}`);
  }
  console.log('✓ Compact P/A values match expected marks for all 14 class instances');

  // Verify Totals and Percentages on the right
  // Hitesh: Presents=6, Absents=1, Total=7, Percentage=85.71%
  // Mohan:  Presents=6, Absents=1, Total=7, Percentage=85.71%
  if (hiteshRow[10] !== 6 || hiteshRow[11] !== 1 || hiteshRow[12] !== 7 || hiteshRow[13] !== '85.71%') {
    throw new Error(`Hitesh totals mismatch: ${JSON.stringify(hiteshRow.slice(10, 14))}`);
  }
  if (mohanRow[10] !== 6 || mohanRow[11] !== 1 || mohanRow[12] !== 7 || mohanRow[13] !== '85.71%') {
    throw new Error(`Mohan totals mismatch: ${JSON.stringify(mohanRow.slice(10, 14))}`);
  }
  console.log('✓ Totals and percentages are correct: 6 Presents, 1 Absent, 7 Classes, 85.71%');

  // 3. Inspect 'Search' sheet
  const wsSearch = wb.Sheets['Search'];
  const searchRows = XLSX.utils.sheet_to_json<(string | number)[]>(wsSearch, { header: 1 });

  console.log('\n--- Search Sheet Contents ---');
  searchRows.forEach((r, idx) => {
    console.log(`Row ${idx}:`, JSON.stringify(r));
  });

  const searchStudentRoll = searchRows[2][1];
  if (String(searchStudentRoll) !== '1') {
    throw new Error(`Search student roll number mismatch: ${searchStudentRoll}`);
  }
  console.log("✓ Search sheet allows searching by Roll No (defaults to '1')");

  // Verify summary student master list in Search sheet
  const searchTableHitesh = searchRows[19];
  const searchTableMohan = searchRows[20];

  if (
    searchTableHitesh[1] !== 'Hitesh' || String(searchTableHitesh[2]) !== '1' ||
    searchTableHitesh[3] !== 6 || searchTableHitesh[4] !== 1 ||
    searchTableHitesh[5] !== 7 || searchTableHitesh[6] !== '85.71%'
  ) {
    throw new Error(`Search summary Hitesh mismatch: ${JSON.stringify(searchTableHitesh)}`);
  }

  if (
    searchTableMohan[1] !== 'Mohan' || String(searchTableMohan[2]) !== '2' ||
    searchTableMohan[3] !== 6 || searchTableMohan[4] !== 1 ||
    searchTableMohan[5] !== 7 || searchTableMohan[6] !== '85.71%'
  ) {
    throw new Error(`Search summary Mohan mismatch: ${JSON.stringify(searchTableMohan)}`);
  }
  console.log('✓ Search summary contains the exact same students and calculated totals');

  // -------------------------------------------------------------
  // Step 5: Edit existing attendance record and save again
  // Edit September 1: Hitesh PP: Present -> Absent
  // -------------------------------------------------------------
  console.log('\nStep 5: Updating existing record (2026-09-01, Hitesh, PP: Present -> Absent)...');
  const modifiedSession1Records: AttendanceRecord[] = [
    { id: 'rec_1_pp', date: '2026-09-01', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber || '1', className: 'PP', status: 'Absent' }, // MODIFIED
    { id: 'rec_1_dccn', date: '2026-09-01', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber || '1', className: 'DCCN', status: 'Present' },
    { id: 'rec_2_pp', date: '2026-09-01', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber || '2', className: 'PP', status: 'Present' },
    { id: 'rec_2_dccn', date: '2026-09-01', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber || '2', className: 'DCCN', status: 'Present' },
  ];

  const dataset1Mod: AttendanceDataset = {
    storageMode: 'excel',
    date: '2026-09-01',
    formattedDate: '1 September 2026',
    roster,
    classes: [{ id: 'c_pp', name: 'PP' }, { id: 'c_dccn', name: 'DCCN' }],
    records: modifiedSession1Records,
    summary: {
      totalRecords: 4,
      totalPresent: 3,
      totalAbsent: 1,
      attendancePercentage: 75.0,
      uniquePeopleCount: 2,
      uniqueClassesCount: 2,
    },
    metadata: {
      recordedAt: new Date().toISOString(),
      selectedMonth: 'September 2026',
      weeklyTimetable: timetable,
      onlyRecordedDates: true,
    },
  };

  const saveResMod = await adapter.save(dataset1Mod, targetFilePath);
  if (!saveResMod.success) {
    throw new Error(`Save after modification failed: ${saveResMod.message}`);
  }

  // Read back updated workbook
  const wbMod = readWorkbook(targetFilePath);
  const wsAttendanceMod = wbMod.Sheets['Attendance September'];
  const modAttendanceRows = XLSX.utils.sheet_to_json<(string | number)[]>(wsAttendanceMod, { header: 1 });

  const updatedHiteshRow = modAttendanceRows[4];
  console.log('\nUpdated Hitesh Row:', JSON.stringify(updatedHiteshRow));

  if (updatedHiteshRow[3] !== 'A') {
    throw new Error(`Expected Hitesh PP on 1-Sep to be 'A', got '${updatedHiteshRow[3]}'`);
  }
  if (updatedHiteshRow[10] !== 5 || updatedHiteshRow[11] !== 2 || updatedHiteshRow[12] !== 7 || updatedHiteshRow[13] !== '71.43%') {
    throw new Error(`Updated totals mismatch: ${JSON.stringify(updatedHiteshRow.slice(10, 14))}`);
  }
  console.log("✓ In-place update succeeded: Hitesh PP updated to 'A', Presents=5, Absents=2, Percentage=71.43%");

  // Verify raw records count to ensure NO duplicate rows were created
  const readRes = await adapter.readExistingAttendance(targetFilePath);
  if (readRes.totalRecords !== 14) {
    throw new Error(`Expected exactly 14 records in total, got ${readRes.totalRecords} (duplicates were created!)`);
  }
  console.log(`✓ Deduplication verified: exactly 14 total records (no duplicate rows created)`);

  console.log('\n===============================================================');
  console.log('✓ ALL SECTION 15 REAL DATA INTEGRATION TESTS PASSED 100%!');
  console.log('===============================================================\n');
}

runScenario().catch((err) => {
  console.error('Scenario failed:', err);
  process.exit(1);
});
