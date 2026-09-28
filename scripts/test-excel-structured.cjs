const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const artifactsDir = path.resolve('test-artifacts');
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

const testFilePath = path.join(artifactsDir, 'Structured_Attendance_Prototype.xlsx');
if (fs.existsSync(testFilePath)) {
  fs.unlinkSync(testFilePath);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

function getWeekdayForDate(dateStr) {
  if (!dateStr) return 'Monday';
  const parts = dateStr.split('-').map(Number);
  const jsDay = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
  return WEEKDAY_NAMES[jsDay];
}

function parseMonthAndYear(dateStr, metadata) {
  if (metadata && metadata.selectedMonth) {
    const parts = metadata.selectedMonth.trim().split(/\s+/);
    if (parts.length >= 2) {
      const mName = parts[0];
      const yNum = parseInt(parts[1], 10);
      const mIdx = MONTH_NAMES.findIndex(m => m.toLowerCase() === mName.toLowerCase());
      if (mIdx >= 0 && !isNaN(yNum)) {
        return { monthName: MONTH_NAMES[mIdx], year: yNum, monthIndex: mIdx };
      }
    }
  }

  if (dateStr && dateStr.includes('-')) {
    const parts = dateStr.split('-').map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const yNum = parts[0];
      const mIdx = parts[1] - 1;
      return { monthName: MONTH_NAMES[mIdx] || 'September', year: yNum, monthIndex: mIdx };
    }
  }

  return { monthName: 'September', year: 2026, monthIndex: 8 };
}

/**
 * Builds the structured Excel workbook
 */
function buildStructuredWorkbook(params) {
  const {
    dataset,
    existingRecords = [],
    filePath,
  } = params;

  // 1. Resolve date and month
  const { monthName, year, monthIndex } = parseMonthAndYear(dataset.date, dataset.metadata);
  const monthlySheetName = `Attendance ${monthName}`;
  const searchSheetName = 'Search';
  const rawDataSheetName = '_AttendanceData';

  // 2. Merge existing records with current session records (Deduplication)
  // Unique composite key: Date + Student ID/Roll + Class
  const recordsMap = new Map();

  function makeRecordKey(rec) {
    const rDate = String(rec.date || '').trim().toLowerCase();
    const rRoll = String(rec.rollNumber || rec.personId || '').trim().toLowerCase();
    const rClass = String(rec.className || '').trim().toLowerCase();
    return `${rDate}|${rRoll}|${rClass}`;
  }

  for (const rec of existingRecords) {
    recordsMap.set(makeRecordKey(rec), rec);
  }

  for (const rec of dataset.records || []) {
    recordsMap.set(makeRecordKey(rec), rec);
  }

  const allRecords = Array.from(recordsMap.values());

  // 3. Resolve student roster (preserving configured order)
  const rosterMap = new Map();
  const orderedStudents = [];

  for (const p of dataset.roster || []) {
    const roll = p.rollNumber ? String(p.rollNumber).trim() : '';
    const cleanRoll = roll.startsWith('p_') ? '' : roll;
    const student = {
      id: p.id,
      name: p.name,
      rollNumber: cleanRoll || roll,
    };
    rosterMap.set(p.id.toLowerCase(), student);
    if (cleanRoll) rosterMap.set(cleanRoll.toLowerCase(), student);
    orderedStudents.push(student);
  }

  for (const rec of allRecords) {
    const pId = String(rec.personId || '').toLowerCase();
    const roll = String(rec.rollNumber || '').toLowerCase();
    if (!rosterMap.has(pId) && (!roll || !rosterMap.has(roll))) {
      const cleanRoll = rec.rollNumber && !String(rec.rollNumber).startsWith('p_') ? String(rec.rollNumber) : '';
      const fallbackStudent = {
        id: rec.personId || `p_${orderedStudents.length + 1}`,
        name: rec.personName || 'Unnamed Student',
        rollNumber: cleanRoll,
      };
      if (pId) rosterMap.set(pId, fallbackStudent);
      if (cleanRoll) rosterMap.set(cleanRoll.toLowerCase(), fallbackStudent);
      orderedStudents.push(fallbackStudent);
    }
  }

  // 4. Resolve dates and timetable subjects for this month
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const timetable = dataset.metadata?.weeklyTimetable || {
    Monday: [{ id: '1', name: 'DBMS' }, { id: '2', name: 'Java' }],
    Tuesday: [{ id: '3', name: 'PP' }, { id: '4', name: 'DCCN' }],
    Wednesday: [{ id: '5', name: 'Java' }, { id: '6', name: 'OS' }, { id: '7', name: 'DCCN' }],
    Thursday: [{ id: '8', name: 'DBMS' }, { id: '9', name: 'PP' }],
    Friday: [{ id: '10', name: 'Java' }, { id: '11', name: 'OS' }],
    Saturday: [{ id: '12', name: 'Lab' }],
    Sunday: [],
  };

  // Group records by date for fast matrix lookup
  // dateStr -> roll/id -> class -> status
  const recordsByDateStudentClass = new Map();
  for (const rec of allRecords) {
    const d = rec.date;
    if (!recordsByDateStudentClass.has(d)) {
      recordsByDateStudentClass.set(d, new Map());
    }
    const dateMap = recordsByDateStudentClass.get(d);
    const sKey = (rec.rollNumber && !String(rec.rollNumber).startsWith('p_') ? rec.rollNumber : rec.personId).toLowerCase();
    if (!dateMap.has(sKey)) {
      dateMap.set(sKey, new Map());
    }
    dateMap.get(sKey).set(String(rec.className).trim().toLowerCase(), rec.status);
  }

  const scheduledDates = [];
  const monthShort = MONTH_SHORT[monthIndex] || 'Sep';
  const onlyRecordedDates = Boolean(dataset.metadata?.onlyRecordedDates);

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const weekday = getWeekdayForDate(dateStr);
    const dayTimetableSubjects = timetable[weekday] ? timetable[weekday].map(s => s.name.trim()) : [];

    // Check if any records exist for this date with additional subjects
    const dateRecordsMap = recordsByDateStudentClass.get(dateStr);
    const recordSubjects = new Set();
    if (dateRecordsMap) {
      for (const classMap of dateRecordsMap.values()) {
        for (const clsName of classMap.keys()) {
          recordSubjects.add(clsName);
        }
      }
    }

    const mergedSubjects = [...dayTimetableSubjects];
    for (const rSub of recordSubjects) {
      if (!mergedSubjects.some(s => s.toLowerCase() === rSub.toLowerCase())) {
        // Find proper casing
        const properRec = allRecords.find(r => r.date === dateStr && r.className.toLowerCase() === rSub.toLowerCase());
        mergedSubjects.push(properRec ? properRec.className : rSub);
      }
    }

    const hasRecords = Boolean(dateRecordsMap && dateRecordsMap.size > 0);
    const isScheduled = mergedSubjects.length > 0;

    if (onlyRecordedDates) {
      if (hasRecords) {
        scheduledDates.push({
          dateStr,
          dayNum: d,
          dateLabel: `${d}-${monthShort}`,
          weekdayLabel: weekday,
          weekdayShort: weekday.slice(0, 3),
          subjects: mergedSubjects,
        });
      }
    } else {
      if (isScheduled || hasRecords) {
        scheduledDates.push({
          dateStr,
          dayNum: d,
          dateLabel: `${d}-${monthShort}`,
          weekdayLabel: weekday,
          weekdayShort: weekday.slice(0, 3),
          subjects: mergedSubjects,
        });
      }
    }
  }

  // If no dates resolved, at least include dataset.date
  if (scheduledDates.length === 0) {
    const dStr = dataset.date;
    const parts = dStr.split('-').map(Number);
    const d = parts[2] || 1;
    const weekday = getWeekdayForDate(dStr);
    const subjects = dataset.classes ? dataset.classes.map(c => c.name) : ['General'];
    scheduledDates.push({
      dateStr: dStr,
      dayNum: d,
      dateLabel: `${d}-${monthShort}`,
      weekdayLabel: weekday,
      weekdayShort: weekday.slice(0, 3),
      subjects,
    });
  }

  // Calculate total subject columns across all dates
  let totalSubjectCols = 0;
  for (const sd of scheduledDates) {
    totalSubjectCols += sd.subjects.length;
  }

  // Fixed student columns:
  // Col 0: S.No.
  // Col 1: Name
  // Col 2: Roll No
  // Subject cols start at index 3 (Column D)
  // Totals cols at the end: Total Presents, Total Absents, Total Classes, Percentage
  const colIndexTotalPresents = 3 + totalSubjectCols;
  const colIndexTotalAbsents = colIndexTotalPresents + 1;
  const colIndexTotalClasses = colIndexTotalAbsents + 1;
  const colIndexPercentage = colIndexTotalClasses + 1;
  const totalColumns = colIndexPercentage + 1;

  // -------------------------------------------------------------
  // BUILD SHEET 1: Attendance [Month]
  // -------------------------------------------------------------
  const monthlyRows = [];
  const merges = [];

  // Row 0 (Excel Row 1): Title Banner
  const titleRow = new Array(totalColumns).fill('');
  titleRow[0] = `${monthName} ${year}`;
  monthlyRows.push(titleRow);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalColumns - 1 } });

  // Row 1 (Excel Row 2): Date Header
  const dateHeaderRow = new Array(totalColumns).fill('');
  dateHeaderRow[0] = 'S.No.';
  dateHeaderRow[1] = 'Name';
  dateHeaderRow[2] = 'Roll No.';

  // Row 2 (Excel Row 3): Weekday Header
  const weekdayHeaderRow = new Array(totalColumns).fill('');

  // Row 3 (Excel Row 4): Subject Header
  const subjectHeaderRow = new Array(totalColumns).fill('');

  let currentCol = 3;
  for (const sd of scheduledDates) {
    const startCol = currentCol;
    const endCol = startCol + sd.subjects.length - 1;

    dateHeaderRow[startCol] = sd.dateLabel;
    weekdayHeaderRow[startCol] = sd.weekdayLabel;

    if (endCol > startCol) {
      merges.push({ s: { r: 1, c: startCol }, e: { r: 1, c: endCol } });
      merges.push({ s: { r: 2, c: startCol }, e: { r: 2, c: endCol } });
    }

    for (let sIdx = 0; sIdx < sd.subjects.length; sIdx++) {
      subjectHeaderRow[startCol + sIdx] = sd.subjects[sIdx];
    }

    currentCol += sd.subjects.length;
  }

  // S.No, Name, Roll No vertical merges across Rows 1 to 3 (Excel Rows 2-4)
  merges.push({ s: { r: 1, c: 0 }, e: { r: 3, c: 0 } });
  merges.push({ s: { r: 1, c: 1 }, e: { r: 3, c: 1 } });
  merges.push({ s: { r: 1, c: 2 }, e: { r: 3, c: 2 } });

  // Totals column headers
  dateHeaderRow[colIndexTotalPresents] = 'Total Presents';
  dateHeaderRow[colIndexTotalAbsents] = 'Total Absents';
  dateHeaderRow[colIndexTotalClasses] = 'Total Classes';
  dateHeaderRow[colIndexPercentage] = 'Percentage';

  merges.push({ s: { r: 1, c: colIndexTotalPresents }, e: { r: 3, c: colIndexTotalPresents } });
  merges.push({ s: { r: 1, c: colIndexTotalAbsents }, e: { r: 3, c: colIndexTotalAbsents } });
  merges.push({ s: { r: 1, c: colIndexTotalClasses }, e: { r: 3, c: colIndexTotalClasses } });
  merges.push({ s: { r: 1, c: colIndexPercentage }, e: { r: 3, c: colIndexPercentage } });

  monthlyRows.push(dateHeaderRow);
  monthlyRows.push(weekdayHeaderRow);
  monthlyRows.push(subjectHeaderRow);

  // Student Rows (Excel Rows 5 onward)
  const studentStatsMap = new Map();

  orderedStudents.forEach((student, idx) => {
    const sNo = idx + 1;
    const row = new Array(totalColumns).fill('');
    row[0] = sNo;
    row[1] = student.name;
    row[2] = student.rollNumber || '';

    let colPointer = 3;
    let presentsCount = 0;
    let absentsCount = 0;

    const studentRollKey = student.rollNumber ? student.rollNumber.toLowerCase() : '';
    const studentIdKey = student.id.toLowerCase();

    for (const sd of scheduledDates) {
      const dateMap = recordsByDateStudentClass.get(sd.dateStr);

      for (const sub of sd.subjects) {
        let status = '';
        if (dateMap) {
          const studentMap = (studentRollKey && dateMap.get(studentRollKey)) || dateMap.get(studentIdKey);
          if (studentMap) {
            const stat = studentMap.get(sub.toLowerCase());
            if (stat) status = stat;
          }
        }

        if (status === 'Present') {
          row[colPointer] = 'P';
          presentsCount++;
        } else if (status === 'Absent') {
          row[colPointer] = 'A';
          absentsCount++;
        } else {
          row[colPointer] = ''; // Blank/unscheduled
        }

        colPointer++;
      }
    }

    const totalClasses = presentsCount + absentsCount;
    const percentage = totalClasses > 0
      ? ((presentsCount / totalClasses) * 100).toFixed(2) + '%'
      : '0.00%';

    row[colIndexTotalPresents] = presentsCount;
    row[colIndexTotalAbsents] = absentsCount;
    row[colIndexTotalClasses] = totalClasses;
    row[colIndexPercentage] = percentage;

    studentStatsMap.set(student.id, {
      student,
      presents: presentsCount,
      absents: absentsCount,
      total: totalClasses,
      percentage,
    });

    monthlyRows.push(row);
  });

  const wsMonthly = XLSX.utils.aoa_to_sheet(monthlyRows);
  wsMonthly['!merges'] = merges;

  // Column widths
  const cols = new Array(totalColumns).fill({ wch: 8 });
  cols[0] = { wch: 6 };  // S.No
  cols[1] = { wch: 22 }; // Name
  cols[2] = { wch: 10 }; // Roll No
  cols[colIndexTotalPresents] = { wch: 14 };
  cols[colIndexTotalAbsents] = { wch: 14 };
  cols[colIndexTotalClasses] = { wch: 14 };
  cols[colIndexPercentage] = { wch: 14 };
  wsMonthly['!cols'] = cols;

  // Frozen panes (Freeze S.No, Name, Roll No and top 4 header rows)
  wsMonthly['!freeze'] = { xSplit: 3, ySplit: 4 };
  wsMonthly['!views'] = [{
    state: 'frozen',
    xSplit: 3,
    ySplit: 4,
    topLeftCell: 'D5',
    activePane: 'bottomRight',
  }];

  // -------------------------------------------------------------
  // BUILD SHEET 2: Search Sheet
  // -------------------------------------------------------------
  // Layout:
  // Row 0: Title Banner
  // Row 2: Search Student (Roll No): [defaultRoll]
  // Row 4: Selected Student Summary
  // Row 5: Name | Roll No
  // Row 6: Total Presents | Total Absents
  // Row 7: Total Classes | Percentage
  // Row 9: Subject-Wise Attendance Breakdown
  // Row 10: Subject | Presents | Absents | Total | Percentage
  // Rows 11+: Subject rows
  // Row N: All Students Monthly Summary
  // Row N+1: S.No. | Name | Roll No | Presents | Absents | Total | Percentage
  // Rows N+2+: Master student list
  const defaultStudent = orderedStudents[0] || { id: '1', name: 'N/A', rollNumber: '1' };
  const defaultStats = studentStatsMap.get(defaultStudent.id) || { presents: 0, absents: 0, total: 0, percentage: '0.00%' };

  // Calculate subject-wise breakdown for default student
  const subjectMap = new Map();
  for (const sd of scheduledDates) {
    for (const sub of sd.subjects) {
      if (!subjectMap.has(sub)) {
        subjectMap.set(sub, { present: 0, absent: 0, total: 0 });
      }
    }
  }

  const defaultStudentRollKey = defaultStudent.rollNumber ? defaultStudent.rollNumber.toLowerCase() : '';
  const defaultStudentIdKey = defaultStudent.id.toLowerCase();

  for (const sd of scheduledDates) {
    const dateMap = recordsByDateStudentClass.get(sd.dateStr);
    if (!dateMap) continue;
    const studentMap = (defaultStudentRollKey && dateMap.get(defaultStudentRollKey)) || dateMap.get(defaultStudentIdKey);
    if (!studentMap) continue;

    for (const sub of sd.subjects) {
      const stat = studentMap.get(sub.toLowerCase());
      const counts = subjectMap.get(sub) || { present: 0, absent: 0, total: 0 };
      if (stat === 'Present') {
        counts.present++;
        counts.total++;
      } else if (stat === 'Absent') {
        counts.absent++;
        counts.total++;
      }
      subjectMap.set(sub, counts);
    }
  }

  const searchRows = [
    ['Student Attendance Summary & Search', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['Search Student by Roll No:', defaultStudent.rollNumber || '1', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['Student Monthly Summary', '', '', '', '', '', ''],
    ['Name:', defaultStudent.name, '', 'Roll No:', defaultStudent.rollNumber || '1', '', ''],
    ['Total Presents:', defaultStats.presents, '', 'Total Absents:', defaultStats.absents, '', ''],
    ['Total Classes:', defaultStats.total, '', 'Percentage:', defaultStats.percentage, '', ''],
    ['', '', '', '', '', '', ''],
    ['Subject-Wise Attendance Breakdown', '', '', '', '', '', ''],
    ['Subject', 'Presents', 'Absents', 'Total', 'Percentage'],
  ];

  for (const [sub, counts] of subjectMap.entries()) {
    const pct = counts.total > 0 ? ((counts.present / counts.total) * 100).toFixed(2) + '%' : '0.00%';
    searchRows.push([sub, counts.present, counts.absent, counts.total, pct]);
  }

  searchRows.push(['', '', '', '', '', '', '']);
  searchRows.push(['All Students Monthly Summary', '', '', '', '', '', '']);
  searchRows.push(['S.No.', 'Name', 'Roll No', 'Presents', 'Absents', 'Total', 'Percentage']);

  orderedStudents.forEach((st, idx) => {
    const stats = studentStatsMap.get(st.id) || { presents: 0, absents: 0, total: 0, percentage: '0.00%' };
    searchRows.push([
      idx + 1,
      st.name,
      st.rollNumber || '',
      stats.presents,
      stats.absents,
      stats.total,
      stats.percentage,
    ]);
  });

  const wsSearch = XLSX.utils.aoa_to_sheet(searchRows);
  wsSearch['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 6 } },
    { s: { r: 9, c: 0 }, e: { r: 9, c: 4 } },
  ];
  wsSearch['!cols'] = [
    { wch: 18 },
    { wch: 24 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ];

  // -------------------------------------------------------------
  // BUILD SHEET 3: _AttendanceData (Hidden Normalized Storage Sheet)
  // -------------------------------------------------------------
  const rawHeaders = ['Date', 'Roll No', 'Name', 'Class', 'Status', 'Person ID', 'Marked At'];
  const rawDataRows = [rawHeaders];

  // Sort raw records for deterministic stability: Date asc, Roll asc, Class asc
  allRecords.sort((a, b) => {
    const dCmp = String(a.date || '').localeCompare(String(b.date || ''));
    if (dCmp !== 0) return dCmp;
    const rCmp = String(a.rollNumber || '').localeCompare(String(b.rollNumber || ''), undefined, { numeric: true, sensitivity: 'base' });
    if (rCmp !== 0) return rCmp;
    return String(a.className || '').localeCompare(String(b.className || ''));
  });

  for (const r of allRecords) {
    const student = rosterMap.get(String(r.personId).toLowerCase()) || rosterMap.get(String(r.rollNumber).toLowerCase());
    const roll = r.rollNumber && !String(r.rollNumber).startsWith('p_')
      ? r.rollNumber
      : (student?.rollNumber && !String(student.rollNumber).startsWith('p_') ? student.rollNumber : '');
    rawDataRows.push([
      r.date,
      roll,
      r.personName,
      r.className,
      r.status,
      r.personId,
      r.markedAt || new Date().toISOString(),
    ]);
  }

  const wsRawData = XLSX.utils.aoa_to_sheet(rawDataRows);
  wsRawData['!cols'] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 24 },
    { wch: 18 },
    { wch: 12 },
    { wch: 24 },
    { wch: 24 },
  ];

  // -------------------------------------------------------------
  // ASSEMBLE WORKBOOK
  // -------------------------------------------------------------
  let workbook;
  const otherSheets = [];

  if (fs.existsSync(filePath)) {
    const existingBuf = fs.readFileSync(filePath);
    workbook = XLSX.read(existingBuf, { type: 'buffer' });
    for (const name of workbook.SheetNames || []) {
      if (name !== monthlySheetName && name !== searchSheetName && name !== rawDataSheetName && name !== 'Attendance') {
        otherSheets.push({ name, ws: workbook.Sheets[name] });
      }
    }
  }

  const newWb = XLSX.utils.book_new();

  // 1. Monthly Attendance sheet
  XLSX.utils.book_append_sheet(newWb, wsMonthly, monthlySheetName);

  // 2. Search sheet
  XLSX.utils.book_append_sheet(newWb, wsSearch, searchSheetName);

  // 3. Other preserved sheets
  for (const os of otherSheets) {
    XLSX.utils.book_append_sheet(newWb, os.ws, os.name);
  }

  // 4. Raw Data sheet (Hidden)
  XLSX.utils.book_append_sheet(newWb, wsRawData, rawDataSheetName);

  // Set Sheet 4 to Hidden
  if (!newWb.Workbook) newWb.Workbook = { Sheets: [] };
  if (!newWb.Workbook.Sheets) newWb.Workbook.Sheets = [];

  const rawSheetIndex = newWb.SheetNames.indexOf(rawDataSheetName);
  if (rawSheetIndex >= 0) {
    newWb.Workbook.Sheets[rawSheetIndex] = { Hidden: 1 };
  }

  const outBuffer = XLSX.write(newWb, { type: 'buffer', bookType: 'xlsx', cellStyles: true });
  fs.writeFileSync(filePath, outBuffer);

  return {
    monthlySheetName,
    searchSheetName,
    rawDataSheetName,
    scheduledDates,
    orderedStudents,
    totalRecords: allRecords.length,
    bufferSize: outBuffer.length,
  };
}

// -------------------------------------------------------------
// EXECUTE TEST SCENARIO
// -------------------------------------------------------------
console.log('--- Step 1: Initialize Students & Timetable ---');
const student1 = { id: 'p_1790594986116_', name: 'Hitesh', rollNumber: '1' };
const student2 = { id: 'p_1790594986117_', name: 'Mohan', rollNumber: '2' };
const roster = [student1, student2];

const timetable = {
  Monday: [{ id: '1', name: 'DBMS' }, { id: '2', name: 'Java' }],
  Tuesday: [{ id: '3', name: 'PP' }, { id: '4', name: 'DCCN' }],
  Wednesday: [{ id: '5', name: 'Java' }, { id: '6', name: 'OS' }, { id: '7', name: 'DCCN' }],
  Thursday: [{ id: '8', name: 'DBMS' }, { id: '9', name: 'PP' }],
  Friday: [{ id: '10', name: 'Java' }, { id: '11', name: 'OS' }],
  Saturday: [{ id: '12', name: 'Lab' }],
  Sunday: [],
};

console.log('--- Step 2: Save Session 1 (Sept 1 - Tuesday: PP, DCCN) ---');
buildStructuredWorkbook({
  filePath: testFilePath,
  dataset: {
    date: '2026-09-01',
    roster,
    metadata: {
      selectedMonth: 'September 2026',
      weeklyTimetable: timetable,
      onlyRecordedDates: true,
    },
    records: [
      { id: 'r1', date: '2026-09-01', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'PP', status: 'Present' },
      { id: 'r2', date: '2026-09-01', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'DCCN', status: 'Present' },
      { id: 'r3', date: '2026-09-01', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'PP', status: 'Present' },
      { id: 'r4', date: '2026-09-01', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'DCCN', status: 'Present' },
    ],
  },
});

console.log('--- Step 3: Save Session 2 (Sept 2 - Wednesday: Java, OS, DCCN) ---');
// Read existing records from _AttendanceData
function readRawRecords(fPath) {
  if (!fs.existsSync(fPath)) return [];
  const wb = XLSX.readFile(fPath);
  if (wb.Sheets['_AttendanceData']) {
    const rawRows = XLSX.utils.sheet_to_json(wb.Sheets['_AttendanceData'], { header: 1 });
    const records = [];
    for (let i = 1; i < rawRows.length; i++) {
      const r = rawRows[i];
      if (!r || r.length < 5) continue;
      records.push({
        date: String(r[0]),
        rollNumber: String(r[1]),
        personName: String(r[2]),
        className: String(r[3]),
        status: String(r[4]),
        personId: String(r[5] || r[1]),
        markedAt: String(r[6] || ''),
      });
    }
    return records;
  }
  return [];
}

const existingAfterS1 = readRawRecords(testFilePath);
console.log(`Read ${existingAfterS1.length} records after Session 1`);

buildStructuredWorkbook({
  filePath: testFilePath,
  existingRecords: existingAfterS1,
  dataset: {
    date: '2026-09-02',
    roster,
    metadata: {
      selectedMonth: 'September 2026',
      weeklyTimetable: timetable,
      onlyRecordedDates: true,
    },
    records: [
      { id: 'r5', date: '2026-09-02', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'Java', status: 'Present' },
      { id: 'r6', date: '2026-09-02', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'OS', status: 'Present' },
      { id: 'r7', date: '2026-09-02', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'DCCN', status: 'Absent' },
      { id: 'r8', date: '2026-09-02', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'Java', status: 'Present' },
      { id: 'r9', date: '2026-09-02', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'OS', status: 'Present' },
      { id: 'r10', date: '2026-09-02', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'DCCN', status: 'Present' },
    ],
  },
});

console.log('--- Step 4: Save Session 3 (Sept 3 - Thursday: DBMS, PP) ---');
const existingAfterS2 = readRawRecords(testFilePath);
console.log(`Read ${existingAfterS2.length} records after Session 2`);

buildStructuredWorkbook({
  filePath: testFilePath,
  existingRecords: existingAfterS2,
  dataset: {
    date: '2026-09-03',
    roster,
    metadata: {
      selectedMonth: 'September 2026',
      weeklyTimetable: timetable,
      onlyRecordedDates: true,
    },
    records: [
      { id: 'r11', date: '2026-09-03', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'DBMS', status: 'Present' },
      { id: 'r12', date: '2026-09-03', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'PP', status: 'Present' },
      { id: 'r13', date: '2026-09-03', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'DBMS', status: 'Absent' },
      { id: 'r14', date: '2026-09-03', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'PP', status: 'Present' },
    ],
  },
});

console.log('--- Step 5: Read and Inspect Actual File from Disk ---');
const wbRead = XLSX.readFile(testFilePath);
console.log('Sheet names in generated workbook:', wbRead.SheetNames);

const wsAttendance = wbRead.Sheets['Attendance September'];
const attendanceRows = XLSX.utils.sheet_to_json(wsAttendance, { header: 1 });

console.log('\n================ ATTENDANCE SEPTEMBER MATRIX ================');
attendanceRows.forEach((r, idx) => {
  console.log(`Row ${idx}:`, JSON.stringify(r));
});

console.log('\nMerges in Attendance September:');
console.log(wsAttendance['!merges']);

const wsSearch = wbRead.Sheets['Search'];
const searchRowsRead = XLSX.utils.sheet_to_json(wsSearch, { header: 1 });

console.log('\n================ SEARCH SHEET ================');
searchRowsRead.forEach((r, idx) => {
  console.log(`Row ${idx}:`, JSON.stringify(r));
});

console.log('\n--- Step 6: Test In-Place Edit (Sept 1 Hitesh PP: Present -> Absent) ---');
const existingAfterS3 = readRawRecords(testFilePath);
buildStructuredWorkbook({
  filePath: testFilePath,
  existingRecords: existingAfterS3,
  dataset: {
    date: '2026-09-01',
    roster,
    metadata: {
      selectedMonth: 'September 2026',
      weeklyTimetable: timetable,
      onlyRecordedDates: true,
    },
    records: [
      { id: 'r1_mod', date: '2026-09-01', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'PP', status: 'Absent' }, // MODIFIED
      { id: 'r2', date: '2026-09-01', personId: student1.id, personName: student1.name, rollNumber: student1.rollNumber, className: 'DCCN', status: 'Present' },
      { id: 'r3', date: '2026-09-01', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'PP', status: 'Present' },
      { id: 'r4', date: '2026-09-01', personId: student2.id, personName: student2.name, rollNumber: student2.rollNumber, className: 'DCCN', status: 'Present' },
    ],
  },
});

const wbUpdated = XLSX.readFile(testFilePath);
const updatedRows = XLSX.utils.sheet_to_json(wbUpdated.Sheets['Attendance September'], { header: 1 });

console.log('\n================ UPDATED ATTENDANCE MATRIX (AFTER IN-PLACE EDIT) ================');
updatedRows.forEach((r, idx) => {
  console.log(`Row ${idx}:`, JSON.stringify(r));
});

const recordsAfterUpdate = readRawRecords(testFilePath);
console.log(`Total raw records after edit: ${recordsAfterUpdate.length} (Expected 14, NO duplicates!)`);
if (recordsAfterUpdate.length !== 14) {
  throw new Error(`Deduplication failed! Expected 14 records, got ${recordsAfterUpdate.length}`);
}

console.log('\n✓ PROTOTYPE VERIFICATION SUCCESSFUL!');
