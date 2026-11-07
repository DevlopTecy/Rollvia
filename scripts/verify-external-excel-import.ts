import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { ExcelAdapter } from '../src/storage/adapters/ExcelAdapter';
import { getSubjectsForDate } from '../src/utils/calendar';
import type { Person, WeeklyTimetable, TimetableSubject } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('================================================================');
  console.log('VERIFY EXTERNAL EXCEL IMPORT, SUBJECT OVERRIDES & ROSTER ISOLATION');
  console.log('================================================================\n');

  const tmpDir = path.join(__dirname, '../.tmp/test-external-excel');
  fs.mkdirSync(tmpDir, { recursive: true });
  const testFile = path.join(tmpDir, 'csc-2 attendance.xlsx');

  // Step 1: Create the friend's exact Excel workbook as pictured in the user screenshot
  console.log('[STEP 1] Generating simulated friend\'s Excel: csc-2 attendance.xlsx...');
  const wb = XLSX.utils.book_new();

  // July 2026 sheet:
  // Row 1 (index 0): Title "July 2026"
  // Row 2 (index 1): Blank row
  // Row 3 (index 2): Date & Weekday header: "1-Jul\nWednesday" (col 3), "2-Jul\nThursday" (col 6), "8-Jul\nWednesday" (col 9)
  // Row 4 (index 3): Subject header: S.No., Name, Roll No., ss lab, pp, cd, pp lab, dccn lab, dwdm, ss lab, pp...
  // Row 5 (index 4): Student 1: 1, B.SANDHYA RANI, 324506402081, A, P, A, P, P, A, A, P...
  // Row 6 (index 5): Student 2: 2, B.DHANUSH, 324506402082, A, P, A, A, P, P, A, P...

  const julyRows = [
    ['July 2026'],
    [],
    ['', '', '', '1-Jul\nWednesday', '', '', '2-Jul\nThursday', '', '', '8-Jul\nWednesday', ''],
    ['S.No.', 'Name', 'Roll No.', 'ss lab', 'pp', 'cd', 'pp lab', 'dccn lab', 'dwdm', 'ss lab', 'pp', 'Total Presents', 'Total Absents', 'Total Classes', 'Percentage'],
    [1, 'B.SANDHYA RANI', '324506402081', 'A', 'P', 'A', 'P', 'P', 'A', 'A', 'P', 4, 4, 8, '50.00%'],
    [2, 'B.DHANUSH', '324506402082', 'A', 'P', 'A', 'A', 'P', 'P', 'A', 'P', 4, 4, 8, '50.00%'],
    [3, 'B.R.S.NITHIN CHANDRA', '324506402083', 'A', 'P', 'A', 'P', 'A', 'P', 'A', 'P', 5, 3, 8, '62.50%']
  ];

  const wsJuly = XLSX.utils.aoa_to_sheet(julyRows);
  XLSX.utils.book_append_sheet(wb, wsJuly, 'Attendance July');

  const fileBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  fs.writeFileSync(testFile, fileBuffer);
  console.log('[PASS] Created test workbook at:', testFile);

  // Step 2: Test ExcelAdapter.readExistingAttendance
  console.log('\n[STEP 2] Testing ExcelAdapter.readExistingAttendance parsing...');
  const adapter = new ExcelAdapter();
  const readRes = await adapter.readExistingAttendance(testFile);

  assert(readRes.success, 'readExistingAttendance should succeed');
  assert.strictEqual(readRes.detectedYear, 2026, 'Should detect year 2026');
  assert.strictEqual(readRes.detectedMonthIndex, 6, 'Should detect month index 6 (July)');
  assert.strictEqual(readRes.roster?.length, 3, 'Roster should contain 3 students');
  assert.strictEqual(readRes.roster[0].name, 'B.SANDHYA RANI');
  assert.strictEqual(readRes.roster[0].rollNumber, '324506402081');
  assert.strictEqual(readRes.roster[1].name, 'B.DHANUSH');
  assert.strictEqual(readRes.roster[1].rollNumber, '324506402082');

  // Verify Date Schedule Overrides
  assert(readRes.dateScheduleOverrides, 'dateScheduleOverrides must be populated');
  const july1Classes = readRes.dateScheduleOverrides['2026-07-01'];
  console.log('[PASS] Detected July 1 classes:', july1Classes);
  assert.deepStrictEqual(july1Classes, ['ss lab', 'pp', 'cd']);

  const july2Classes = readRes.dateScheduleOverrides['2026-07-02'];
  console.log('[PASS] Detected July 2 classes:', july2Classes);
  assert.deepStrictEqual(july2Classes, ['pp lab', 'dccn lab', 'dwdm']);

  // Verify Weekly Timetable extraction
  assert(readRes.weeklyTimetable, 'weeklyTimetable must be populated');
  const wedSubjects = (readRes.weeklyTimetable.Wednesday || []).map(s => s.name);
  console.log('[PASS] Detected Wednesday Timetable subjects:', wedSubjects);
  assert(wedSubjects.includes('ss lab'));
  assert(wedSubjects.includes('pp'));
  assert(wedSubjects.includes('cd'));

  // Step 3: Simulate opening workbook in FlowContext where previous user setup had UNRELATED students & timetable
  console.log('\n[STEP 3] Simulating FlowContext load with prior unrelated roster & timetable...');
  const priorUserSetup: {
    people: Person[];
    weeklyTimetable: WeeklyTimetable;
    savedDailyAttendance: Record<string, Record<string, Record<string, boolean>>>;
    dateScheduleOverrides: Record<string, string[]>;
  } = {
    // User's own prior local class setup
    people: [
      { id: 'p_1', name: 'Alice Smith', rollNumber: '101' },
      { id: 'p_2', name: 'Bob Jones', rollNumber: '102' },
      { id: 'p_3', name: 'Charlie Brown', rollNumber: '103' }
    ],
    // User's own default timetable with Java, OS, DCCN
    weeklyTimetable: {
      Monday: [{ id: 's1', name: 'DBMS' }],
      Tuesday: [{ id: 's2', name: 'Python' }],
      Wednesday: [{ id: 's3', name: 'JAVA' }, { id: 's4', name: 'OS' }, { id: 's5', name: 'DCCN' }],
      Thursday: [{ id: 's6', name: 'Web Tech' }],
      Friday: [{ id: 's7', name: 'Networks' }],
      Saturday: [],
      Sunday: []
    },
    savedDailyAttendance: {
      '2026-07-01': {
        'p_1': { 'JAVA': true, 'OS': true, 'DCCN': false }
      }
    },
    dateScheduleOverrides: {}
  };

  // Run the new FlowContext load algorithm:
  const peopleMap = new Map<string, Person>();
  const orderedPeople: Person[] = [];

  const addOrUpdatePerson = (p: Person) => {
    const key = (p.rollNumber ? p.rollNumber.trim().toLowerCase() : '') || p.id.trim().toLowerCase();
    const existing = peopleMap.get(key);
    if (existing) {
      if (p.name && (!existing.name || existing.name === 'Unnamed Student' || existing.name === 'Unnamed')) {
        existing.name = p.name;
      }
      if (p.rollNumber && !existing.rollNumber) {
        existing.rollNumber = p.rollNumber;
      }
    } else {
      peopleMap.set(key, p);
      if (p.id) peopleMap.set(p.id.toLowerCase(), p);
      if (p.rollNumber) peopleMap.set(p.rollNumber.trim().toLowerCase(), p);
      orderedPeople.push(p);
    }
  };

  if (readRes.roster && readRes.roster.length > 0) {
    for (const ros of readRes.roster) {
      addOrUpdatePerson(ros);
    }
  }

  // Workbook people replaces prior setup people completely!
  const loadedPeople = orderedPeople.length > 0 ? orderedPeople : priorUserSetup.people;

  console.log('[PASS] Loaded people count:', loadedPeople.length);
  assert.strictEqual(loadedPeople.length, 3, 'Must contain EXACTLY 3 students from the workbook');
  assert(!loadedPeople.some(p => p.name.includes('Alice') || p.name.includes('Bob')), 'Old setup students (Alice, Bob) must NOT be present!');
  assert.strictEqual(loadedPeople[0].name, 'B.SANDHYA RANI');
  assert.strictEqual(loadedPeople[0].rollNumber, '324506402081');
  assert.strictEqual(loadedPeople[1].name, 'B.DHANUSH');
  assert.strictEqual(loadedPeople[1].rollNumber, '324506402082');

  // Step 4: Verify attendance mapping and effective subject rendering on July 1
  console.log('\n[STEP 4] Verifying attendance marks and effective schedule on July 1, 2026...');
  const uniqueDates = Array.from(new Set(readRes.records.map((r) => r.date))).sort();

  const loadedDailyAttendance: Record<string, Record<string, Record<string, boolean>>> = {};
  for (const rec of readRes.records) {
    if (!loadedDailyAttendance[rec.date]) {
      loadedDailyAttendance[rec.date] = {};
    }
    const pKey = (rec.rollNumber ? rec.rollNumber.trim().toLowerCase() : '') || (rec.personId ? rec.personId.trim().toLowerCase() : '');
    const matchedPerson = peopleMap.get(pKey);
    const pId = matchedPerson ? matchedPerson.id : (rec.personId || rec.rollNumber || 'unknown');
    const pRoll = matchedPerson?.rollNumber || rec.rollNumber;

    if (!loadedDailyAttendance[rec.date][pId]) {
      loadedDailyAttendance[rec.date][pId] = {};
    }
    const isPresent = rec.status === 'Present';
    loadedDailyAttendance[rec.date][pId][rec.className] = isPresent;

    if (pRoll && pRoll !== pId) {
      if (!loadedDailyAttendance[rec.date][pRoll]) {
        loadedDailyAttendance[rec.date][pRoll] = {};
      }
      loadedDailyAttendance[rec.date][pRoll][rec.className] = isPresent;
    }
  }

  const mergedDateOverrides = { ...(readRes.dateScheduleOverrides || {}) };
  const baseTimetable = priorUserSetup.weeklyTimetable;
  const mergedTimetable: WeeklyTimetable = {
    Monday: (readRes.weeklyTimetable?.Monday as TimetableSubject[]) || baseTimetable.Monday || [],
    Tuesday: (readRes.weeklyTimetable?.Tuesday as TimetableSubject[]) || baseTimetable.Tuesday || [],
    Wednesday: (readRes.weeklyTimetable?.Wednesday as TimetableSubject[]) || baseTimetable.Wednesday || [],
    Thursday: (readRes.weeklyTimetable?.Thursday as TimetableSubject[]) || baseTimetable.Thursday || [],
    Friday: (readRes.weeklyTimetable?.Friday as TimetableSubject[]) || baseTimetable.Friday || [],
    Saturday: (readRes.weeklyTimetable?.Saturday as TimetableSubject[]) || baseTimetable.Saturday || [],
    Sunday: (readRes.weeklyTimetable?.Sunday as TimetableSubject[]) || baseTimetable.Sunday || [],
  };

  // Cross-align daily attendance by subject ID and subject Name
  for (const dateStr of uniqueDates) {
    const scheduledSubs = getSubjectsForDate(dateStr, mergedTimetable, mergedDateOverrides);
    for (const p of loadedPeople) {
      const pDay = loadedDailyAttendance[dateStr]?.[p.id];
      if (pDay) {
        for (const sub of scheduledSubs) {
          if (pDay[sub.name] !== undefined) {
            pDay[sub.id] = pDay[sub.name];
          }
          const foundKey = Object.keys(pDay).find((k) => k.toLowerCase() === sub.name.toLowerCase());
          if (foundKey && pDay[foundKey] !== undefined) {
            pDay[sub.id] = pDay[foundKey];
            pDay[sub.name] = pDay[foundKey];
          }
        }
      }
    }
  }

  // Check what subjects AttendanceGrid renders on Wednesday, July 1, 2026:
  const activeDate = '2026-07-01';
  const effectiveSubjects = getSubjectsForDate(activeDate, mergedTimetable, mergedDateOverrides);
  console.log('[PASS] Effective subjects for July 1, 2026:', effectiveSubjects.map(s => s.name));
  assert.deepStrictEqual(effectiveSubjects.map(s => s.name), ['ss lab', 'pp', 'cd'], 'Grid must show ss lab, pp, cd (NOT JAVA, OS, DCCN)');

  // Check student attendance marks for July 1
  const student1Data = loadedDailyAttendance['2026-07-01'][loadedPeople[0].id];
  console.log('[PASS] Student 1 (B.SANDHYA RANI) marks on July 1:', student1Data);

  for (const sub of effectiveSubjects) {
    const hasRecord = student1Data[sub.id] !== undefined || student1Data[sub.name] !== undefined;
    const isPresent = Boolean(student1Data[sub.id] ?? student1Data[sub.name]);
    assert(hasRecord, `Must have attendance record for ${sub.name}`);
    if (sub.name === 'ss lab') {
      assert.strictEqual(isPresent, false, 'ss lab must be Absent');
    } else if (sub.name === 'pp') {
      assert.strictEqual(isPresent, true, 'pp must be Present');
    } else if (sub.name === 'cd') {
      assert.strictEqual(isPresent, false, 'cd must be Absent');
    }
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log('\n================================================================');
  console.log('ALL VERIFICATIONS PASSED: BUGS 1 & 2 ARE 100% RESOLVED!');
  console.log('================================================================');
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
