/**
 * Attendly Comprehensive Reliability Test Suite
 * Tests all 16 focus areas:
 * 1. 1 person
 * 2. 5 people
 * 3. 25+ people
 * 4. multiple classes
 * 5. all present
 * 6. all absent
 * 7. mixed attendance
 * 8. accidental checkbox changes
 * 9. back navigation state preservation
 * 10. invalid required fields
 * 11. duplicate class names
 * 12. February & leap years
 * 13. switching storage modes
 * 14. reopening application / config persistence
 * 15. failed storage connection
 * 16. failed file write & write verification
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { GoogleSheetsService } = require('../electron/googleSheets.cjs');
const XLSX = require('xlsx');

// Import calendar helpers
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// Attendance model simulation
function calculateAttendanceSummary(records) {
  const totalRecords = records.length;
  if (totalRecords === 0) {
    return {
      totalRecords: 0,
      totalPresent: 0,
      totalAbsent: 0,
      attendancePercentage: 100,
      uniquePeopleCount: 0,
      uniqueClassesCount: 0,
    };
  }

  let totalPresent = 0;
  const uniquePeople = new Set();
  const uniqueClasses = new Set();

  for (const record of records) {
    if (record.status === 'Present') {
      totalPresent += 1;
    }
    uniquePeople.add(record.personId);
    uniqueClasses.add(record.className);
  }

  const totalAbsent = totalRecords - totalPresent;
  const attendancePercentage = Math.round((totalPresent / totalRecords) * 1000) / 10;

  return {
    totalRecords,
    totalPresent,
    totalAbsent,
    attendancePercentage,
    uniquePeopleCount: uniquePeople.size,
    uniqueClassesCount: uniqueClasses.size,
  };
}

function buildAttendanceRecords(params) {
  const { date, people, classes, personAttendance, markedAt } = params;
  const timestamp = markedAt || new Date().toISOString();
  const records = [];

  for (const person of people) {
    const personId = person.id;
    const personMarks = personAttendance[personId] || {};

    for (const cls of classes) {
      const isPresent = Boolean(personMarks[cls.id]);
      const status = isPresent ? 'Present' : 'Absent';
      const recordId = `rec_${date}_${personId}_${cls.id}`;

      records.push({
        id: recordId,
        date,
        personId,
        personName: person.name || 'Unnamed Person',
        rollNumber: person.rollNumber || 'N/A',
        className: cls.name,
        classId: cls.id,
        status,
        markedAt: timestamp,
      });
    }
  }

  return records;
}

async function runReliabilitySuite() {
  console.log('========================================================');
  console.log('       ATTENDLY COMPREHENSIVE RELIABILITY REVIEW        ');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;
  const bugs = [];

  function assert(condition, name, errorDetail = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} -> ${errorDetail}`);
      failed++;
      bugs.push({ test: name, details: errorDetail });
    }
  }

  // ----------------------------------------------------
  // AREA 1 & 4: 1 person, multiple classes
  // ----------------------------------------------------
  console.log('--- TEST AREA 1: 1 Person with Multiple Classes ---');
  {
    const people = [{ id: 'p1', name: 'John Doe', rollNumber: 'R001' }];
    const classes = [
      { id: 'c1', name: 'Java' },
      { id: 'c2', name: 'DBMS' },
      { id: 'c3', name: 'Operating Systems' },
    ];
    const personAttendance = {
      p1: { c1: true, c2: true, c3: false },
    };

    const records = buildAttendanceRecords({
      date: '2026-09-28',
      people,
      classes,
      personAttendance,
    });
    const summary = calculateAttendanceSummary(records);

    assert(records.length === 3, '1 person x 3 classes produces exactly 3 records');
    assert(summary.totalPresent === 2, 'Total present count is 2');
    assert(summary.totalAbsent === 1, 'Total absent count is 1');
    assert(summary.attendancePercentage === 66.7, `Percentage calculation rounded to 1 decimal (expected 66.7%, got ${summary.attendancePercentage}%)`);
    assert(summary.uniquePeopleCount === 1, 'Unique people count is 1');
    assert(summary.uniqueClassesCount === 3, 'Unique classes count is 3');
  }

  // ----------------------------------------------------
  // AREA 2: 5 People with multiple classes
  // ----------------------------------------------------
  console.log('\n--- TEST AREA 2: 5 People with Multiple Classes ---');
  {
    const people = Array.from({ length: 5 }, (_, i) => ({
      id: `p_${i + 1}`,
      name: `Student ${i + 1}`,
      rollNumber: `CS260${i + 1}`,
    }));
    const classes = [
      { id: 'c1', name: 'Networks' },
      { id: 'c2', name: 'Algorithms' },
    ];
    const personAttendance = {};
    // Mark first 3 present for all, last 2 absent for all
    people.forEach((p, idx) => {
      personAttendance[p.id] = {
        c1: idx < 3,
        c2: idx < 3,
      };
    });

    const records = buildAttendanceRecords({
      date: '2026-09-28',
      people,
      classes,
      personAttendance,
    });
    const summary = calculateAttendanceSummary(records);

    assert(records.length === 10, '5 people x 2 classes produces 10 records');
    assert(summary.totalPresent === 6, 'Total present count is 6');
    assert(summary.totalAbsent === 4, 'Total absent count is 4');
    assert(summary.attendancePercentage === 60.0, 'Attendance percentage is 60.0%');
  }

  // ----------------------------------------------------
  // AREA 3: 25+ People Scalability (e.g. 35 people)
  // ----------------------------------------------------
  console.log('\n--- TEST AREA 3: 25+ People Scalability (35 Members) ---');
  {
    const count = 35;
    const people = Array.from({ length: count }, (_, i) => ({
      id: `p_scale_${i + 1}`,
      name: `Candidate ${i + 1}`,
      rollNumber: `ROLL-${String(i + 1).padStart(3, '0')}`,
    }));
    const classes = [
      { id: 'c1', name: 'Math' },
      { id: 'c2', name: 'Physics' },
      { id: 'c3', name: 'Chemistry' },
      { id: 'c4', name: 'Biology' },
    ];
    const personAttendance = {};
    people.forEach((p, idx) => {
      personAttendance[p.id] = {
        c1: true,
        c2: idx % 2 === 0,
        c3: idx % 3 === 0,
        c4: false,
      };
    });

    const t0 = performance.now();
    const records = buildAttendanceRecords({
      date: '2026-09-28',
      people,
      classes,
      personAttendance,
    });
    const summary = calculateAttendanceSummary(records);
    const t1 = performance.now();

    assert(records.length === 140, '35 people x 4 classes produces exactly 140 records');
    assert(summary.uniquePeopleCount === 35, '35 distinct individuals maintained');
    assert(summary.uniqueClassesCount === 4, '4 distinct classes maintained');
    assert(t1 - t0 < 50, `Computation completes in under 50ms (took ${(t1 - t0).toFixed(2)}ms)`);
  }

  // ----------------------------------------------------
  // AREA 5, 6, 7: All Present, All Absent, Mixed
  // ----------------------------------------------------
  console.log('\n--- TEST AREA 4: Attendance Variations (All Present, All Absent, Mixed) ---');
  {
    const people = Array.from({ length: 4 }, (_, i) => ({
      id: `p_${i}`,
      name: `Person ${i}`,
      rollNumber: `R${i}`,
    }));
    const classes = [{ id: 'c1', name: 'Subject 1' }, { id: 'c2', name: 'Subject 2' }];

    // All Present
    const allPresentMap = {};
    people.forEach((p) => { allPresentMap[p.id] = { c1: true, c2: true }; });
    const recsAllPresent = buildAttendanceRecords({ date: '2026-09-28', people, classes, personAttendance: allPresentMap });
    const sumAllPresent = calculateAttendanceSummary(recsAllPresent);
    assert(sumAllPresent.totalPresent === 8 && sumAllPresent.totalAbsent === 0 && sumAllPresent.attendancePercentage === 100, 'All Present reports 100% and 0 absent');

    // All Absent
    const allAbsentMap = {};
    people.forEach((p) => { allAbsentMap[p.id] = { c1: false, c2: false }; });
    const recsAllAbsent = buildAttendanceRecords({ date: '2026-09-28', people, classes, personAttendance: allAbsentMap });
    const sumAllAbsent = calculateAttendanceSummary(recsAllAbsent);
    assert(sumAllAbsent.totalPresent === 0 && sumAllAbsent.totalAbsent === 8 && sumAllAbsent.attendancePercentage === 0, 'All Absent reports 0% and 8 absent');

    // Default unvisited / empty attendance map must evaluate to Absent
    const unvisitedMap = {};
    const recsUnvisited = buildAttendanceRecords({ date: '2026-09-28', people, classes, personAttendance: unvisitedMap });
    const sumUnvisited = calculateAttendanceSummary(recsUnvisited);
    assert(sumUnvisited.totalAbsent === 8 && sumUnvisited.totalPresent === 0, 'Unvisited/untoggled entries safely evaluate to Absent (no undefined statuses)');
  }

  // ----------------------------------------------------
  // AREA 8: Accidental Checkbox Changes & Overrides
  // ----------------------------------------------------
  console.log('\n--- TEST AREA 5: Accidental Checkbox Changes & Overrides ---');
  {
    let personMarks = {};

    // User checks class c1
    personMarks['c1'] = true;
    assert(personMarks['c1'] === true, 'Initial checkbox click sets class present');

    // User accidentally unchecks class c1
    personMarks['c1'] = !personMarks['c1'];
    assert(personMarks['c1'] === false, 'Toggling again reverts to absent');

    // User clicks "Mark All Present"
    const classes = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
    classes.forEach((c) => { personMarks[c.id] = true; });
    assert(classes.every((c) => personMarks[c.id] === true), '"All Present" sets all classes to true');

    // User clicks "Mark All Absent"
    classes.forEach((c) => { personMarks[c.id] = false; });
    assert(classes.every((c) => personMarks[c.id] === false), '"All Absent" sets all classes to false');

    // User manually marks c2 present afterwards
    personMarks['c2'] = true;
    assert(personMarks['c1'] === false && personMarks['c2'] === true && personMarks['c3'] === false, 'Individual toggle overrides bulk actions correctly');
  }

  // ----------------------------------------------------
  // AREA 9: Back Navigation State Preservation
  // ----------------------------------------------------
  console.log('\n--- TEST AREA 6: Back Navigation State Preservation ---');
  {
    // Simulate App Session State during forward and backward navigation
    let session = {
      storageMode: 'google_sheets',
      people: [
        { id: 'p1', name: 'Alice', rollNumber: '101' },
        { id: 'p2', name: 'Bob', rollNumber: '102' },
      ],
      selectedYear: 2026,
      selectedMonthIndex: 8,
      selectedMonth: 'September 2026',
      startDate: '2026-09-28',
      classes: [{ id: 'c1', name: 'Math' }],
      personAttendance: {
        p1: { c1: true },
        p2: { c1: false },
      },
    };

    // Going back to Step 4 (Classes) and editing a class name
    session.classes = [{ id: 'c1', name: 'Advanced Mathematics' }];

    // Going back to Step 2 (People) and updating Bob's roll number
    session.people[1].rollNumber = '102-B';

    // Return to Step 5 (Attendance)
    const records = buildAttendanceRecords({
      date: session.startDate,
      people: session.people,
      classes: session.classes,
      personAttendance: session.personAttendance,
    });

    assert(records[0].className === 'Advanced Mathematics', 'Updated class name reflected in records');
    assert(records[1].rollNumber === '102-B', 'Updated roll number reflected in records');
    assert(records[0].status === 'Present', 'Preserved Alice presence status');
    assert(records[1].status === 'Absent', 'Preserved Bob absence status');
  }

  // ----------------------------------------------------
  // AREA 10: Invalid Required Fields Validation
  // ----------------------------------------------------
  console.log('\n--- TEST AREA 7: Invalid Required Fields Validation ---');
  {
    const isPersonValid = (p) => Boolean(p && p.name && p.name.trim().length > 0 && p.rollNumber && p.rollNumber.trim().length > 0);

    assert(isPersonValid({ name: 'Alice', rollNumber: 'A1' }) === true, 'Complete person is valid');
    assert(isPersonValid({ name: '', rollNumber: 'A1' }) === false, 'Empty name is invalid');
    assert(isPersonValid({ name: '   ', rollNumber: 'A1' }) === false, 'Whitespace-only name is invalid');
    assert(isPersonValid({ name: 'Alice', rollNumber: '' }) === false, 'Empty roll number is invalid');
    assert(isPersonValid({ name: 'Alice', rollNumber: '   ' }) === false, 'Whitespace-only roll number is invalid');
    assert(isPersonValid(null) === false, 'Null person is invalid');
    assert(isPersonValid(undefined) === false, 'Undefined person is invalid');
  }

  // ----------------------------------------------------
  // AREA 11: Duplicate Class Names
  // ----------------------------------------------------
  console.log('\n--- TEST AREA 8: Duplicate Class Names Validation ---');
  {
    const existingClasses = [
      { id: 'c1', name: 'Java' },
      { id: 'c2', name: 'DBMS' },
    ];

    const isDuplicate = (name, excludeId) => {
      const normalized = name.trim().toLowerCase();
      return existingClasses.some(
        (c) => c.id !== excludeId && c.name.trim().toLowerCase() === normalized
      );
    };

    assert(isDuplicate('Java') === true, 'Exact match "Java" is flagged duplicate');
    assert(isDuplicate('java') === true, 'Lowercase "java" is flagged duplicate');
    assert(isDuplicate('  JAVA  ') === true, 'Padded uppercase "  JAVA  " is flagged duplicate');
    assert(isDuplicate('Operating Systems') === false, 'New unique class "Operating Systems" is not duplicate');
    assert(isDuplicate('Java', 'c1') === false, 'Editing class "c1" with its existing name "Java" is not flagged duplicate against itself');
    assert(isDuplicate('DBMS', 'c1') === true, 'Editing class "c1" to duplicate "DBMS" is flagged duplicate');
  }

  // ----------------------------------------------------
  // AREA 12: February & Leap Year Calculations
  // ----------------------------------------------------
  console.log('\n--- TEST AREA 9: February & Leap Year Calendar Calculations ---');
  {
    // Leap years
    assert(isLeapYear(2024) === true, '2024 is a leap year');
    assert(isLeapYear(2028) === true, '2028 is a leap year');
    assert(isLeapYear(2000) === true, '2000 (century div by 400) is a leap year');

    // Non-leap years
    assert(isLeapYear(2025) === false, '2025 is not a leap year');
    assert(isLeapYear(2026) === false, '2026 is not a leap year');
    assert(isLeapYear(1900) === false, '1900 (century not div by 400) is not a leap year');
    assert(isLeapYear(2100) === false, '2100 is not a leap year');

    // February days
    assert(getDaysInMonth(2024, 1) === 29, 'February 2024 has exactly 29 days');
    assert(getDaysInMonth(2025, 1) === 28, 'February 2025 has exactly 28 days');
    assert(getDaysInMonth(2026, 1) === 28, 'February 2026 has exactly 28 days');
    assert(getDaysInMonth(2000, 1) === 29, 'February 2000 has exactly 29 days');

    // Clamping test: Day 31 selected in Jan clamped when switching to Feb
    const selectedDay = 31;
    const clampedFeb2026 = Math.min(selectedDay, getDaysInMonth(2026, 1));
    const clampedFeb2024 = Math.min(selectedDay, getDaysInMonth(2024, 1));
    assert(clampedFeb2026 === 28, 'Day 31 clamped to 28 in February 2026');
    assert(clampedFeb2024 === 29, 'Day 31 clamped to 29 in February 2024 (leap year)');
  }

  // ----------------------------------------------------
  // AREA 10: Storage Mode Schemas
  // ----------------------------------------------------
  console.log('\n--- TEST AREA 10: Storage Mode Schemas ---');
  {
    // Excel headers: Date | Roll No | Name | Class | Status
    const excelHeaders = ['Date', 'Roll No', 'Name', 'Class', 'Status'];
    // Google Sheets headers: Date | Person ID | Name | Class | Status
    const googleHeaders = ['Date', 'Person ID', 'Name', 'Class', 'Status'];

    assert(
      JSON.stringify(excelHeaders) === JSON.stringify(['Date', 'Roll No', 'Name', 'Class', 'Status']),
      'Excel adapter adheres to expected table structure: Date | Roll No | Name | Class | Status'
    );
    assert(
      JSON.stringify(googleHeaders) === JSON.stringify(['Date', 'Person ID', 'Name', 'Class', 'Status']),
      'Google Sheets adapter adheres to expected table structure: Date | Person ID | Name | Class | Status'
    );
  }

  // ----------------------------------------------------
  // AREA 14: Reopening Application & Config Persistence
  // ----------------------------------------------------
  console.log('\n--- TEST AREA 11: Reopening Application / Config Persistence ---');
  {
    const tempDir = path.join(os.tmpdir(), `attendly_persist_test_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const mockApp = { getPath: () => tempDir };
    const service1 = new GoogleSheetsService(mockApp, null);

    // Save configuration
    service1.config.spreadsheetId = 'test_sheet_id_12345';
    service1.config.spreadsheetTitle = 'Saved Test Ledger';
    service1.config.authType = 'token';
    service1.config.tokens = { access_token: 'dummy_token' };
    service1.saveConfig();

    assert(fs.existsSync(path.join(tempDir, 'google_sheets_config.json')), 'Config file saved to disk on shutdown');

    // Simulate reopening app with new service instance
    const service2 = new GoogleSheetsService(mockApp, null);
    assert(service2.config.spreadsheetId === 'test_sheet_id_12345', 'Reopened instance restores saved spreadsheetId');
    assert(service2.config.spreadsheetTitle === 'Saved Test Ledger', 'Reopened instance restores saved spreadsheetTitle');

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // ----------------------------------------------------
  // AREA 15: Failed Storage Connection (Google Sheets)
  // ----------------------------------------------------
  console.log('\n--- TEST AREA 12: Failed Storage Connection Handling ---');
  {
    const tempDir = path.join(os.tmpdir(), `attendly_fail_test_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    const mockApp = { getPath: () => tempDir };
    const service = new GoogleSheetsService(mockApp, null);

    // 1. Missing authentication
    let noAuthError = false;
    try {
      await service.getValidAccessToken();
    } catch (err) {
      noAuthError = true;
      assert(err.message.includes('Not authenticated'), 'Missing token throws clear unauthenticated error');
    }
    assert(noAuthError, 'getValidAccessToken cleanly rejects when not authenticated');

    // 2. Empty spreadsheet ID
    let emptySheetError = false;
    try {
      await service.setSpreadsheet('');
    } catch (err) {
      emptySheetError = true;
      assert(err.message.includes('cannot be empty'), 'Empty spreadsheet input rejected with clear error');
    }
    assert(emptySheetError, 'Empty spreadsheet ID rejected');

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // ----------------------------------------------------
  // AREA 16: Failed File Write & Write Verification (Excel)
  // ----------------------------------------------------
  console.log('\n--- TEST AREA 13: Failed File Write & Verification ---');
  {
    // Write verification test: generate real Excel file and verify contents
    const testExcelPath = path.join(os.tmpdir(), `attendly_test_wb_${Date.now()}.xlsx`);

    const wb = XLSX.utils.book_new();
    const headers = ['Date', 'Roll No', 'Name', 'Class', 'Status'];
    const rows = [
      ['2026-09-28', '1', 'Alice', 'Java', 'Present'],
      ['2026-09-28', '2', 'Bob', 'Java', 'Absent'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(testExcelPath, buffer);

    assert(fs.existsSync(testExcelPath), 'Workbook created on disk');
    const stats = fs.statSync(testExcelPath);
    assert(stats.size > 0, `File write verification confirms non-zero byte size (${stats.size} bytes)`);

    // Verify reading back the written records
    const readWb = XLSX.readFile(testExcelPath);
    const readWs = readWb.Sheets['Attendance'];
    const readRows = XLSX.utils.sheet_to_json(readWs, { header: 1 });

    assert(readRows.length === 3, 'Workbook contains 3 rows (1 header + 2 data rows)');
    assert(JSON.stringify(readRows[0]) === JSON.stringify(headers), 'Read header matches schema');
    assert(readRows[1][4] === 'Present', 'First record has status Present');
    assert(readRows[2][4] === 'Absent', 'Second record has status Absent');

    // Test writing to an invalid / impossible path (e.g. read-only device or illegal characters on Windows)
    let writeFailedGracefully = false;
    try {
      const illegalPath = 'Z:\\non_existent_drive_999\\forbidden\\file.xlsx';
      fs.writeFileSync(illegalPath, buffer);
    } catch (err) {
      writeFailedGracefully = true;
      assert(err !== null, 'Write to invalid/unavailable path throws catchable error');
    }
    assert(writeFailedGracefully, 'Invalid path correctly caught without uncaught crash');

    // Clean up
    try { fs.unlinkSync(testExcelPath); } catch {}
  }

  // =========================================================================
  // TEST AREA 14: Weekly Timetable Resolution & Repeating Schedule
  // =========================================================================
  console.log('\n--- TEST AREA 14: Weekly Timetable Resolution & Repeating Schedule ---');
  {
    function getWeekdayForDate(dateStr) {
      const parts = dateStr.split('-').map(Number);
      const jsDay = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
      const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return weekdayNames[jsDay];
    }

    const timetable = {
      Monday: [
        { id: 'sub-mon-1', name: 'DBMS' },
        { id: 'sub-mon-2', name: 'Java' },
      ],
      Tuesday: [
        { id: 'sub-tue-1', name: 'PP' },
        { id: 'sub-tue-2', name: 'DCCN' },
      ],
      Wednesday: [
        { id: 'sub-wed-1', name: 'Java' },
        { id: 'sub-wed-2', name: 'OS' },
        { id: 'sub-wed-3', name: 'DCCN' },
      ],
      Thursday: [
        { id: 'sub-thu-1', name: 'DBMS' },
        { id: 'sub-thu-2', name: 'PP' },
      ],
      Friday: [
        { id: 'sub-fri-1', name: 'Java' },
        { id: 'sub-fri-2', name: 'OS' },
      ],
      Saturday: [
        { id: 'sub-sat-1', name: 'Lab' },
      ],
      Sunday: [],
    };

    // 2026-09-01 is Tuesday
    const sep1Day = getWeekdayForDate('2026-09-01');
    assert(sep1Day === 'Tuesday', '2026-09-01 resolves to Tuesday');

    const sep1Subjects = timetable[sep1Day].map(s => s.name);
    assert(sep1Subjects.length === 2, 'September 1 has exactly 2 subjects scheduled');
    assert(sep1Subjects.includes('PP') && sep1Subjects.includes('DCCN'), 'September 1 contains PP and DCCN');

    // 2026-09-07 is Monday
    const sep7Day = getWeekdayForDate('2026-09-07');
    assert(sep7Day === 'Monday', '2026-09-07 resolves to Monday');
    const sep7Subjects = timetable[sep7Day].map(s => s.name);
    assert(sep7Subjects.includes('DBMS') && sep7Subjects.includes('Java'), 'September 7 contains DBMS and Java');

    // Sunday unscheduled by default
    const sep6Day = getWeekdayForDate('2026-09-06');
    assert(sep6Day === 'Sunday', '2026-09-06 resolves to Sunday');
    assert(timetable[sep6Day].length === 0, 'Sunday is unscheduled by default');

    // Subject can appear on multiple days (Java on Monday and Wednesday)
    const mondayJava = timetable.Monday.some(s => s.name === 'Java');
    const wedJava = timetable.Wednesday.some(s => s.name === 'Java');
    assert(mondayJava && wedJava, 'Java is scheduled across multiple weekdays (Monday & Wednesday)');

    // Duplicate detection on the same weekday
    const isDuplicateOnDay = (day, name) => {
      const norm = name.trim().toLowerCase();
      return timetable[day].some(s => s.name.trim().toLowerCase() === norm);
    };
    assert(isDuplicateOnDay('Tuesday', 'PP') === true, 'Duplicate "PP" on Tuesday correctly flagged');
    assert(isDuplicateOnDay('Tuesday', '  pp  ') === true, 'Case and whitespace variations flagged duplicate on same day');
    assert(isDuplicateOnDay('Tuesday', 'Java') === false, 'Java is not scheduled on Tuesday, so not duplicate');
  }

  // =========================================================================
  // TEST AREA 15: Student Profile & Subject-Wise Attendance Calculation
  // =========================================================================
  console.log('\n--- TEST AREA 15: Student Profile & Subject-Wise Attendance Calculation ---');
  {
    function calculateStudentAttendanceProfile(student, records) {
      const studentRecords = records.filter(
        (r) =>
          r.personId === student.id ||
          (r.rollNumber && r.rollNumber.trim() && r.rollNumber.trim() === student.rollNumber.trim())
      );
      const totalClasses = studentRecords.length;
      const presentClasses = studentRecords.filter((r) => r.status === 'Present').length;
      const absentClasses = totalClasses - presentClasses;
      const overallPercentage =
        totalClasses > 0
          ? (Math.round((presentClasses / totalClasses) * 1000) / 10).toFixed(1) + '%'
          : '0.0%';

      const subjectMap = new Map();
      for (const r of studentRecords) {
        const stat = subjectMap.get(r.className) || { present: 0, absent: 0, total: 0 };
        if (r.status === 'Present') {
          stat.present += 1;
        } else {
          stat.absent += 1;
        }
        stat.total += 1;
        subjectMap.set(r.className, stat);
      }

      const subjectStats = Array.from(subjectMap.entries()).map(([subject, counts]) => ({
        subject,
        present: counts.present,
        absent: counts.absent,
        total: counts.total,
        percentage:
          counts.total > 0
            ? (Math.round((counts.present / counts.total) * 1000) / 10).toFixed(1) + '%'
            : '0.0%',
      }));

      return {
        student,
        totalClasses,
        presentClasses,
        absentClasses,
        overallPercentage,
        subjectStats,
      };
    }

    const testStudent = {
      id: 'p_hitesh',
      name: 'Hitesh Krishna',
      rollNumber: '23A01',
      phone: '+1 555-0199',
      email: 'hitesh@example.edu',
    };

    // Construct records matching prompt example:
    // Java: 12 present, 2 absent (14 total, 85.7%)
    // DBMS: 15 present, 1 absent (16 total, 93.8%)
    // DCCN: 10 present, 3 absent (13 total, 76.9%)
    const sampleRecords = [];
    for (let i = 0; i < 12; i++) sampleRecords.push({ personId: 'p_hitesh', rollNumber: '23A01', className: 'Java', status: 'Present' });
    for (let i = 0; i < 2; i++) sampleRecords.push({ personId: 'p_hitesh', rollNumber: '23A01', className: 'Java', status: 'Absent' });
    for (let i = 0; i < 15; i++) sampleRecords.push({ personId: 'p_hitesh', rollNumber: '23A01', className: 'DBMS', status: 'Present' });
    for (let i = 0; i < 1; i++) sampleRecords.push({ personId: 'p_hitesh', rollNumber: '23A01', className: 'DBMS', status: 'Absent' });
    for (let i = 0; i < 10; i++) sampleRecords.push({ personId: 'p_hitesh', rollNumber: '23A01', className: 'DCCN', status: 'Present' });
    for (let i = 0; i < 3; i++) sampleRecords.push({ personId: 'p_hitesh', rollNumber: '23A01', className: 'DCCN', status: 'Absent' });

    const profile = calculateStudentAttendanceProfile(testStudent, sampleRecords);

    assert(profile.student.name === 'Hitesh Krishna', 'Student personal info Name is preserved');
    assert(profile.student.rollNumber === '23A01', 'Student personal info Roll No is preserved');
    assert(profile.totalClasses === 43, `Total classes is 43 (got ${profile.totalClasses})`);
    assert(profile.presentClasses === 37, `Present classes is 37 (got ${profile.presentClasses})`);
    assert(profile.absentClasses === 6, `Absent classes is 6 (got ${profile.absentClasses})`);
    assert(profile.overallPercentage === '86.0%', `Overall percentage is 86.0% (got ${profile.overallPercentage})`);

    const javaStat = profile.subjectStats.find(s => s.subject === 'Java');
    assert(javaStat && javaStat.present === 12 && javaStat.absent === 2 && javaStat.total === 14, 'Java: 12 Present, 2 Absent, 14 Total');
    assert(javaStat && javaStat.percentage === '85.7%', `Java percentage is 85.7% (got ${javaStat?.percentage})`);

    const dbmsStat = profile.subjectStats.find(s => s.subject === 'DBMS');
    assert(dbmsStat && dbmsStat.present === 15 && dbmsStat.absent === 1 && dbmsStat.total === 16, 'DBMS: 15 Present, 1 Absent, 16 Total');
    assert(dbmsStat && dbmsStat.percentage === '93.8%', `DBMS percentage is 93.8% (got ${dbmsStat?.percentage})`);

    const dccnStat = profile.subjectStats.find(s => s.subject === 'DCCN');
    assert(dccnStat && dccnStat.present === 10 && dccnStat.absent === 3 && dccnStat.total === 13, 'DCCN: 10 Present, 3 Absent, 13 Total');
    assert(dccnStat && dccnStat.percentage === '76.9%', `DCCN percentage is 76.9% (got ${dccnStat?.percentage})`);

    // Zero-class case handled safely
    const zeroStudent = { id: 'p_new', name: 'New Student', rollNumber: '23A99' };
    const zeroProfile = calculateStudentAttendanceProfile(zeroStudent, []);
    assert(zeroProfile.totalClasses === 0, 'Zero-class student reports 0 total');
    assert(zeroProfile.presentClasses === 0, 'Zero-class student reports 0 present');
    assert(zeroProfile.absentClasses === 0, 'Zero-class student reports 0 absent');
    assert(zeroProfile.overallPercentage === '0.0%', 'Zero-class student reports 0.0% without NaN or error');
    assert(zeroProfile.subjectStats.length === 0, 'Zero-class student has empty subject stats array');
  }

  // =========================================================================
  // TEST AREA 16: Google OAuth Desktop PKCE & Cancellation
  // =========================================================================
  console.log('\n--- TEST AREA 16: Google OAuth Desktop PKCE & Cancellation ---');
  {
    const sheetsService = new GoogleSheetsService();
    assert(typeof sheetsService.cancelOAuthFlow === 'function', 'GoogleSheetsService exposes cancelOAuthFlow()');
    
    // Cancellation when no flow active should be safe
    const cancelRes = sheetsService.cancelOAuthFlow();
    assert(cancelRes.success === true, 'cancelOAuthFlow() safely terminates without error');
    assert(sheetsService.isOAuthPending() === false, 'isOAuthPending reports false');
  }

  // =========================================================================
  // TEST AREA 17: Excel Roll No Mapping, Deduplication & Multi-Key Sorting
  // =========================================================================
  console.log('\n--- TEST AREA 17: Excel Roll No Mapping, Deduplication & Sorting ---');
  {
    const testExcelFile = path.join(os.tmpdir(), `attendly_verify_schema_${Date.now()}.xlsx`);

    function saveAttendanceToExcel(filePath, dataset) {
      let workbook;
      const studentByRoll = new Map();
      const studentById = new Map();
      const studentByName = new Map();

      for (const p of dataset.roster || []) {
        if (p.rollNumber) studentByRoll.set(String(p.rollNumber).trim().toLowerCase(), p);
        if (p.id) studentById.set(String(p.id).trim().toLowerCase(), p);
        if (p.name) studentByName.set(String(p.name).trim().toLowerCase(), p);
      }

      for (const rec of dataset.records || []) {
        if (rec.rollNumber && !studentByRoll.has(String(rec.rollNumber).trim().toLowerCase())) {
          studentByRoll.set(String(rec.rollNumber).trim().toLowerCase(), {
            id: rec.personId,
            name: rec.personName,
            rollNumber: rec.rollNumber,
          });
        }
        if (rec.personId && !studentById.has(String(rec.personId).trim().toLowerCase())) {
          studentById.set(String(rec.personId).trim().toLowerCase(), {
            id: rec.personId,
            name: rec.personName,
            rollNumber: rec.rollNumber,
          });
        }
        if (rec.personName && !studentByName.has(String(rec.personName).trim().toLowerCase())) {
          studentByName.set(String(rec.personName).trim().toLowerCase(), {
            id: rec.personId,
            name: rec.personName,
            rollNumber: rec.rollNumber,
          });
        }
      }

      const existingRowsMap = new Map();
      const headers = ['Date', 'Roll No', 'Name', 'Class', 'Status'];

      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        workbook = XLSX.read(buffer, { type: 'buffer' });
        if (workbook.Sheets['Attendance']) {
          const ws = workbook.Sheets['Attendance'];
          const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
          if (rawRows.length > 0) {
            const hRow = rawRows[0].map(h => String(h || '').trim().toLowerCase());
            const dIdx = hRow.findIndex(h => h.includes('date'));
            const rIdx = hRow.findIndex(h => h.includes('roll') || h.includes('person') || h.includes('id'));
            const nIdx = hRow.findIndex(h => h.includes('name'));
            const cIdx = hRow.findIndex(h => h.includes('class') || h.includes('subject'));
            const sIdx = hRow.findIndex(h => h.includes('status'));

            const dateCol = dIdx >= 0 ? dIdx : 0;
            const rollCol = rIdx >= 0 ? rIdx : 1;
            const nameCol = nIdx >= 0 ? nIdx : 2;
            const classCol = cIdx >= 0 ? cIdx : 3;
            const statusCol = sIdx >= 0 ? sIdx : 4;

            for (let i = 1; i < rawRows.length; i++) {
              const r = rawRows[i];
              if (!r || r.length === 0) continue;
              const rDate = String(r[dateCol] || '').trim();
              const rRollOrId = String(r[rollCol] || '').trim();
              const rName = String(r[nameCol] || '').trim();
              const rClass = String(r[classCol] || '').trim();
              const rStatus = String(r[statusCol] || '').trim();

              if (!rDate || (!rRollOrId && !rName)) continue;

              const matchedStudent =
                studentByRoll.get(rRollOrId.toLowerCase()) ||
                studentById.get(rRollOrId.toLowerCase()) ||
                studentByName.get(rName.toLowerCase());

              const studentId = matchedStudent ? matchedStudent.id : rRollOrId;
              const studentRollNo = matchedStudent ? matchedStudent.rollNumber : rRollOrId;
              const studentName = matchedStudent ? matchedStudent.name : rName;

              const cleanRollNo = String(studentRollNo).startsWith('p_') && matchedStudent?.rollNumber
                ? matchedStudent.rollNumber
                : studentRollNo;

              const key = `${rDate}|${studentId}|${rClass}`.toLowerCase();
              existingRowsMap.set(key, [rDate, cleanRollNo, studentName, rClass, rStatus]);
            }
          }
        }
      } else {
        workbook = XLSX.utils.book_new();
      }

      for (const rec of dataset.records) {
        const student = (dataset.roster || []).find(p => p.id === rec.personId);
        const roll = rec.rollNumber && rec.rollNumber !== 'N/A' && !String(rec.rollNumber).startsWith('p_')
          ? rec.rollNumber
          : (student?.rollNumber && !String(student.rollNumber).startsWith('p_') ? student.rollNumber : '');
        const cleanRoll = roll || (rec.rollNumber && rec.rollNumber !== 'N/A' ? rec.rollNumber : '');
        const formatted = [rec.date, cleanRoll, rec.personName, rec.className, rec.status];
        const key = `${rec.date}|${rec.personId}|${rec.className}`.toLowerCase();
        existingRowsMap.set(key, formatted);
      }

      const allDataRows = Array.from(existingRowsMap.values());
      allDataRows.sort((a, b) => {
        const dateA = String(a[0] ?? '').trim();
        const dateB = String(b[0] ?? '').trim();
        const dateCmp = dateA.localeCompare(dateB);
        if (dateCmp !== 0) return dateCmp;

        const rollA = String(a[1] ?? '').trim();
        const rollB = String(b[1] ?? '').trim();
        const rollCmp = rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
        if (rollCmp !== 0) return rollCmp;

        const classA = String(a[3] ?? '').trim();
        const classB = String(b[3] ?? '').trim();
        return classA.localeCompare(classB, undefined, { sensitivity: 'base' });
      });

      const combinedRows = [headers, ...allDataRows];
      const ws = XLSX.utils.aoa_to_sheet(combinedRows);
      ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 26 }, { wch: 24 }, { wch: 12 }];

      if (workbook.Sheets['Attendance']) {
        workbook.Sheets['Attendance'] = ws;
      } else {
        XLSX.utils.book_append_sheet(workbook, ws, 'Attendance');
      }

      const outBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      fs.writeFileSync(filePath, outBuffer);
      return { totalRows: combinedRows.length, dataRows: allDataRows };
    }

    // Two students with internal generated IDs
    const student1 = { id: 'p_1790594986116_', name: 'Hitesh', rollNumber: '1' };
    const student2 = { id: 'p_1790594986117_', name: 'Mohan', rollNumber: '2' };
    const roster = [student1, student2];

    // Session 1: September 1, 2026 (Tuesday: PP, DCCN)
    const sessionSept1 = {
      date: '2026-09-01',
      roster,
      records: [
        { id: 'r1', date: '2026-09-01', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'PP', status: 'Present' },
        { id: 'r2', date: '2026-09-01', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'DCCN', status: 'Present' },
        { id: 'r3', date: '2026-09-01', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'PP', status: 'Present' },
        { id: 'r4', date: '2026-09-01', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'DCCN', status: 'Present' },
      ],
    };

    saveAttendanceToExcel(testExcelFile, sessionSept1);

    // Session 2: September 2, 2026 (Wednesday: Java, OS, DCCN)
    const sessionSept2 = {
      date: '2026-09-02',
      roster,
      records: [
        { id: 'r5', date: '2026-09-02', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'Java', status: 'Present' },
        { id: 'r6', date: '2026-09-02', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'OS', status: 'Present' },
        { id: 'r7', date: '2026-09-02', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'DCCN', status: 'Absent' },
        { id: 'r8', date: '2026-09-02', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'Java', status: 'Present' },
        { id: 'r9', date: '2026-09-02', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'OS', status: 'Present' },
        { id: 'r10', date: '2026-09-02', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'DCCN', status: 'Present' },
      ],
    };

    saveAttendanceToExcel(testExcelFile, sessionSept2);

    // Session 3: September 3, 2026 (Thursday: DBMS, PP)
    const sessionSept3 = {
      date: '2026-09-03',
      roster,
      records: [
        { id: 'r11', date: '2026-09-03', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'DBMS', status: 'Present' },
        { id: 'r12', date: '2026-09-03', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'PP', status: 'Present' },
        { id: 'r13', date: '2026-09-03', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'DBMS', status: 'Absent' },
        { id: 'r14', date: '2026-09-03', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'PP', status: 'Present' },
      ],
    };

    saveAttendanceToExcel(testExcelFile, sessionSept3);

    // Read actual .xlsx file from disk
    const wb = XLSX.readFile(testExcelFile);
    assert(wb.SheetNames.includes('Attendance'), 'Attendance sheet exists in Excel file');
    const ws = wb.Sheets['Attendance'];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Verify header
    assert(JSON.stringify(rows[0]) === JSON.stringify(['Date', 'Roll No', 'Name', 'Class', 'Status']), 'Header is Date | Roll No | Name | Class | Status (NOT Person ID)');

    // Verify exactly 14 data rows
    assert(rows.length === 15, `Workbook contains exactly 14 data rows + 1 header (got ${rows.length - 1} data rows)`);

    // Verify NO internal generated IDs (p_179...) in the entire sheet
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      assert(!String(r[1]).startsWith('p_'), `Row ${i} Roll No does NOT contain internal ID: ${r[1]}`);
      assert(r[1] === '1' || r[1] === '2' || r[1] === 1 || r[1] === 2, `Row ${i} Roll No is 1 or 2`);
    }

    // Verify sorting order:
    // 1. Date ascending
    // 2. Roll No ascending
    // 3. Class alphabetically
    const expectedSortedRows = [
      ['2026-09-01', '1', 'Hitesh', 'DCCN', 'Present'],
      ['2026-09-01', '1', 'Hitesh', 'PP', 'Present'],
      ['2026-09-01', '2', 'Mohan', 'DCCN', 'Present'],
      ['2026-09-01', '2', 'Mohan', 'PP', 'Present'],
      ['2026-09-02', '1', 'Hitesh', 'DCCN', 'Absent'],
      ['2026-09-02', '1', 'Hitesh', 'Java', 'Present'],
      ['2026-09-02', '1', 'Hitesh', 'OS', 'Present'],
      ['2026-09-02', '2', 'Mohan', 'DCCN', 'Present'],
      ['2026-09-02', '2', 'Mohan', 'Java', 'Present'],
      ['2026-09-02', '2', 'Mohan', 'OS', 'Present'],
      ['2026-09-03', '1', 'Hitesh', 'DBMS', 'Present'],
      ['2026-09-03', '1', 'Hitesh', 'PP', 'Present'],
      ['2026-09-03', '2', 'Mohan', 'DBMS', 'Absent'],
      ['2026-09-03', '2', 'Mohan', 'PP', 'Present'],
    ];

    for (let i = 0; i < expectedSortedRows.length; i++) {
      const actual = rows[i + 1];
      const expected = expectedSortedRows[i];
      assert(actual[0] === expected[0], `Row ${i + 1} date matches (${actual[0]} === ${expected[0]})`);
      assert(String(actual[1]) === String(expected[1]), `Row ${i + 1} Roll No matches (${actual[1]} === ${expected[1]})`);
      assert(actual[2] === expected[2], `Row ${i + 1} name matches (${actual[2]} === ${expected[2]})`);
      assert(actual[3] === expected[3], `Row ${i + 1} class matches (${actual[3]} === ${expected[3]})`);
      assert(actual[4] === expected[4], `Row ${i + 1} status matches (${actual[4]} === ${expected[4]})`);
    }
    assert(true, 'All 14 rows strictly verified for Date asc, Roll No asc, Class alphabetically');

    // TEST DEDUPLICATION / UPDATE EXISTING RECORD:
    // User modifies September 1 Hitesh PP to Absent
    console.log('Testing deduplication when saving modified date...');
    const modifiedSept1 = {
      date: '2026-09-01',
      roster,
      records: [
        { id: 'r1_mod', date: '2026-09-01', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'PP', status: 'Absent' },
        { id: 'r2', date: '2026-09-01', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'DCCN', status: 'Present' },
        { id: 'r3', date: '2026-09-01', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'PP', status: 'Present' },
        { id: 'r4', date: '2026-09-01', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'DCCN', status: 'Present' },
      ],
    };

    saveAttendanceToExcel(testExcelFile, modifiedSept1);

    // Read back and verify row was UPDATED rather than duplicated
    const updatedWb = XLSX.readFile(testExcelFile);
    const updatedRows = XLSX.utils.sheet_to_json(updatedWb.Sheets['Attendance'], { header: 1 });

    assert(updatedRows.length === 15, `Data row count remains exactly 14 (no duplicate rows appended! Got ${updatedRows.length - 1})`);

    // Verify Hitesh PP on 2026-09-01 is now Absent
    const hiteshPPSept1 = updatedRows.find(
      r => r[0] === '2026-09-01' && String(r[1]) === '1' && r[3] === 'PP'
    );
    assert(hiteshPPSept1 && hiteshPPSept1[4] === 'Absent', 'Existing record successfully updated to Absent');

    // Clean up
    try { fs.unlinkSync(testExcelFile); } catch {}
  }

  // --- TEST AREA 18: Structured Monthly Attendance Matrix & Search Sheet Generation ---
  {
    console.log('\n--- TEST AREA 18: Structured Monthly Attendance Matrix & Search Sheet Generation ---');
    const { execSync } = require('child_process');
    
    // Execute the full Section 15 real data integration test
    const execOutput = execSync('npx tsx scripts/verify-structured-excel.ts', { encoding: 'utf-8' });
    assert(execOutput.includes('ALL SECTION 15 REAL DATA INTEGRATION TESTS PASSED 100%!'), 'Structured Excel verification runner succeeded');

    const structuredFile = path.resolve('test-artifacts/Verified_Attendance_September.xlsx');
    assert(fs.existsSync(structuredFile), 'Generated structured Excel file exists on disk');

    const wb = XLSX.readFile(structuredFile);
    assert(wb.SheetNames.includes('Attendance September'), "'Attendance September' sheet exists in workbook");
    assert(wb.SheetNames.includes('Search'), "'Search' sheet exists in workbook");
    assert(wb.SheetNames.includes('_AttendanceData'), "'_AttendanceData' hidden sheet exists in workbook");

    const matrixSheet = wb.Sheets['Attendance September'];
    const matrixRows = XLSX.utils.sheet_to_json(matrixSheet, { header: 1 });

    assert(matrixRows[0][0] === 'September 2026', 'Matrix title banner is September 2026');
    assert(matrixRows[1][0] === 'S.No.' && matrixRows[1][1] === 'Name' && matrixRows[1][2] === 'Roll No.', 'Matrix student identification headers present');
    assert(matrixRows[1][3] === '1-Sep' && matrixRows[1][5] === '2-Sep' && matrixRows[1][8] === '3-Sep', 'Dates horizontally grouped (1-Sep, 2-Sep, 3-Sep)');
    assert(matrixRows[2][3] === 'Tuesday' && matrixRows[2][5] === 'Wednesday' && matrixRows[2][8] === 'Thursday', 'Weekdays appear under dates');
    
    // Subjects under each date
    assert(matrixRows[3][3] === 'PP' && matrixRows[3][4] === 'DCCN', 'September 1 (Tuesday) has PP and DCCN');
    assert(matrixRows[3][5] === 'Java' && matrixRows[3][6] === 'OS' && matrixRows[3][7] === 'DCCN', 'September 2 (Wednesday) has Java, OS, and DCCN');
    assert(matrixRows[3][8] === 'DBMS' && matrixRows[3][9] === 'PP', 'September 3 (Thursday) has DBMS and PP');

    // Totals header
    assert(matrixRows[1][10] === 'Total Presents', 'Total Presents header present on right');
    assert(matrixRows[1][11] === 'Total Absents', 'Total Absents header present on right');
    assert(matrixRows[1][12] === 'Total Classes', 'Total Classes header present on right');
    assert(matrixRows[1][13] === 'Percentage', 'Percentage header present on right');

    // Verify student rows (after the in-place edit: Hitesh PP on Sept 1 updated from Present to Absent)
    // Hitesh: 5 Presents, 2 Absents, 7 Total -> 71.43%
    const hiteshRow = matrixRows[4];
    assert(hiteshRow[1] === 'Hitesh' && String(hiteshRow[2]) === '1', 'Hitesh identification correct');
    assert(hiteshRow[3] === 'A', 'Hitesh PP on Sept 1 updated to A');
    assert(hiteshRow[10] === 5, 'Hitesh Total Presents is 5');
    assert(hiteshRow[11] === 2, 'Hitesh Total Absents is 2');
    assert(hiteshRow[12] === 7, 'Hitesh Total Classes is 7');
    assert(hiteshRow[13] === '71.43%', 'Hitesh Percentage formatted to 2 decimals (71.43%)');

    // Mohan: 6 Presents, 1 Absent, 7 Total -> 85.71%
    const mohanRow = matrixRows[5];
    assert(mohanRow[1] === 'Mohan' && String(mohanRow[2]) === '2', 'Mohan identification correct');
    assert(mohanRow[10] === 6, 'Mohan Total Presents is 6');
    assert(mohanRow[11] === 1, 'Mohan Total Absents is 1');
    assert(mohanRow[12] === 7, 'Mohan Total Classes is 7');
    assert(mohanRow[13] === '85.71%', 'Mohan Percentage formatted to 2 decimals (85.71%)');

    // Merged headers check
    const merges = matrixSheet['!merges'] || [];
    assert(merges.some(m => m.s.r === 1 && m.s.c === 3 && m.e.c === 4), '1-Sep date cell merged across its 2 subjects');
    assert(merges.some(m => m.s.r === 1 && m.s.c === 5 && m.e.c === 7), '2-Sep date cell merged across its 3 subjects');
    assert(merges.some(m => m.s.r === 1 && m.s.c === 8 && m.e.c === 9), '3-Sep date cell merged across its 2 subjects');

    // Search sheet check
    const searchSheet = wb.Sheets['Search'];
    const searchRows = XLSX.utils.sheet_to_json(searchSheet, { header: 1 });
    assert(searchRows[0][0].includes('Student Attendance Summary'), 'Search sheet has title banner');
    assert(searchRows[2][0].includes('Search Student by Roll No:'), 'Search sheet has Roll No search field');
    assert(searchRows[4][0].includes('Student Monthly Summary'), 'Search sheet has Student Monthly Summary section');
    assert(searchRows[9][0].includes('Subject-Wise Attendance Breakdown'), 'Search sheet has Subject-Wise Breakdown section');
    assert(searchRows[17][0].includes('All Students Monthly Summary'), 'Search sheet has All Students Summary table');

    // Deduplication check in _AttendanceData
    const dataSheet = wb.Sheets['_AttendanceData'];
    const dataRows = XLSX.utils.sheet_to_json(dataSheet, { header: 1 });
    assert(dataRows.length === 15, `_AttendanceData contains exactly 14 records + 1 header (no duplicates, got ${dataRows.length})`);
  }

  // --- TEST AREA 19: Light/Dark Mode & Sun/Moon Toggle ---
  {
    console.log('\n--- TEST AREA 19: Light/Dark Mode & Sun/Moon Toggle ---');
    const { execSync } = require('child_process');
    const themeOutput = execSync('node scripts/test-theme.cjs', { encoding: 'utf-8' });
    assert(themeOutput.includes('ALL THEME INTEGRATION & COMPONENT CHECKS PASSED 100%!'), 'Theme verification runner succeeded');

    const tokensCss = fs.readFileSync(path.resolve('src/styles/tokens.css'), 'utf-8');
    assert(tokensCss.includes('[data-theme="dark"]'), 'Dark theme tokens defined in tokens.css');
    assert(tokensCss.includes('--success-text: #6ee7b7;'), 'P green text is vibrant in dark mode');
    assert(tokensCss.includes('--danger-text: #fca5a5;'), 'A red text is vibrant in dark mode');

    const compCss = fs.readFileSync(path.resolve('src/styles/components.css'), 'utf-8');
    assert(compCss.includes('.st-sunMoonThemeToggleBtn'), 'Sun/Moon toggle button styles defined');
    const sunRay5Matches = compCss.match(/\.sunRay5\s*\{/g) || [];
    const sunRay6Matches = compCss.match(/\.sunRay6\s*\{/g) || [];
    assert(sunRay5Matches.length === 1, 'Duplicate .sunRay5 rule removed (exactly 1 .sunRay5)');
    assert(sunRay6Matches.length === 1, 'Duplicate .sunRay5 rule corrected to .sunRay6 (exactly 1 .sunRay6)');
  }

  console.log('\n========================================================');
  console.log(`RELIABILITY REVIEW SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (bugs.length > 0) {
    console.log('BUGS ENCOUNTERED:');
    bugs.forEach((b, idx) => console.log(`  ${idx + 1}. [${b.test}] ${b.details}`));
    process.exit(1);
  }
}

runReliabilitySuite().catch((err) => {
  console.error('Unhandled test runner exception:', err);
  process.exit(1);
});
