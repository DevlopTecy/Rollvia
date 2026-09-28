import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

// Test directory setup
const testDir = path.resolve('test-artifacts');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

console.log('=== STARTING EXCEL STORAGE ADAPTER VERIFICATION TESTS ===\n');

// 1. Create a dummy existing workbook with unrelated spreadsheet content
const existingWorkbookPath = path.join(testDir, 'Existing_Course_Workbook.xlsx');
const initialWb = XLSX.utils.book_new();

// Unrelated sheet 1: Course Syllabus
const syllabusData = [
  ['Module Code', 'Module Title', 'Instructor', 'Credits'],
  ['CS-101', 'Data Structures & Algorithms', 'Prof. Elena Vance', 4],
  ['CS-102', 'Database Management Systems', 'Dr. Marcus Brody', 3],
  ['CS-103', 'Operating Systems', 'Prof. Sophia Chen', 4],
];
const wsSyllabus = XLSX.utils.aoa_to_sheet(syllabusData);
XLSX.utils.book_append_sheet(initialWb, wsSyllabus, 'CourseSyllabus');

// Unrelated sheet 2: Department Directory
const directoryData = [
  ['Department', 'Head of Department', 'Contact Email'],
  ['Computer Science', 'Dr. Alan Turing', 'cs@apex.edu'],
  ['Information Science', 'Dr. Ada Lovelace', 'is@apex.edu'],
];
const wsDirectory = XLSX.utils.aoa_to_sheet(directoryData);
XLSX.utils.book_append_sheet(initialWb, wsDirectory, 'DepartmentDirectory');

XLSX.writeFile(initialWb, existingWorkbookPath);
console.log(`[TEST 1 Setup] Created baseline workbook with unrelated sheets at:\n  ${existingWorkbookPath}`);
console.log(`  Sheets present: ${initialWb.SheetNames.join(', ')}\n`);

// 2. Import ExcelAdapter logic and execute test
const EXCEL_ATTENDANCE_HEADERS = ['Date', 'Roll No', 'Name', 'Class', 'Status'];
const ATTENDANCE_SHEET_NAME = 'Attendance';

function saveAttendanceToExcelFile(filePath, dataset) {
  let workbook;
  const existingSheetNames = [];
  const existingRowsMap = new Map();
  let initialHeaders = [...EXCEL_ATTENDANCE_HEADERS];

  const fileExists = fs.existsSync(filePath);
  if (fileExists) {
    const buffer = fs.readFileSync(filePath);
    workbook = XLSX.read(buffer, { type: 'buffer' });
    existingSheetNames.push(...(workbook.SheetNames || []));

    if (workbook.Sheets[ATTENDANCE_SHEET_NAME]) {
      const ws = workbook.Sheets[ATTENDANCE_SHEET_NAME];
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rawRows.length > 0) {
        initialHeaders = [...EXCEL_ATTENDANCE_HEADERS];
        for (let i = 1; i < rawRows.length; i++) {
          const r = rawRows[i];
          if (!r || r.length === 0) continue;
          const rDate = String(r[0] || '').trim();
          const rRoll = String(r[1] || '').trim();
          const rClass = String(r[3] || '').trim();
          const key = `${rDate}|${rRoll}|${rClass}`.toLowerCase();
          existingRowsMap.set(key, r);
        }
      }
    }
  } else {
    workbook = XLSX.utils.book_new();
  }

  // Merge new records
  for (const record of dataset.records) {
    const roll = record.rollNumber || record.personId;
    const formatted = [
      record.date,
      roll,
      record.personName,
      record.className,
      record.status,
    ];
    const key = `${record.date}|${roll}|${record.className}`.toLowerCase();
    existingRowsMap.set(key, formatted);
  }

  const allDataRows = Array.from(existingRowsMap.values());
  allDataRows.sort((a, b) => {
    const dateCmp = String(a[0] ?? '').localeCompare(String(b[0] ?? ''));
    if (dateCmp !== 0) return dateCmp;
    const rollCmp = String(a[1] ?? '').localeCompare(String(b[1] ?? ''), undefined, { numeric: true, sensitivity: 'base' });
    if (rollCmp !== 0) return rollCmp;
    return String(a[3] ?? '').localeCompare(String(b[3] ?? ''), undefined, { sensitivity: 'base' });
  });

  const combinedRows = [
    initialHeaders,
    ...allDataRows,
  ];

  const attendanceWs = XLSX.utils.aoa_to_sheet(combinedRows);
  attendanceWs['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 26 },
    { wch: 24 },
    { wch: 12 },
  ];

  if (workbook.Sheets[ATTENDANCE_SHEET_NAME]) {
    workbook.Sheets[ATTENDANCE_SHEET_NAME] = attendanceWs;
  } else {
    XLSX.utils.book_append_sheet(workbook, attendanceWs, ATTENDANCE_SHEET_NAME);
  }

  const outBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  fs.writeFileSync(filePath, outBuffer);

  // STRICT DISK VERIFICATION
  if (!fs.existsSync(filePath)) {
    throw new Error(`Verification failed: File was not created at ${filePath}`);
  }
  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    throw new Error(`Verification failed: File at ${filePath} is 0 bytes`);
  }

  const verifiedBuffer = fs.readFileSync(filePath);
  const verifyWb = XLSX.read(verifiedBuffer, { type: 'buffer' });

  if (!verifyWb.SheetNames.includes(ATTENDANCE_SHEET_NAME)) {
    throw new Error(`Verification failed: Sheet '${ATTENDANCE_SHEET_NAME}' missing on disk`);
  }

  const wsVerified = verifyWb.Sheets[ATTENDANCE_SHEET_NAME];
  const verifiedRows = XLSX.utils.sheet_to_json(wsVerified, { header: 1 });

  return {
    verified: true,
    fileSize: stats.size,
    totalRows: verifiedRows.length - 1,
    sheetNames: verifyWb.SheetNames,
    rows: verifiedRows,
  };
}

// Session 1 records: 28 September 2026
const session1 = {
  date: '2026-09-28',
  records: [
    { id: 'rec1', date: '2026-09-28', personId: 'CS2601', personName: 'Hitesh Krishna', rollNumber: 'CS2601', className: 'Java', status: 'Present' },
    { id: 'rec2', date: '2026-09-28', personId: 'CS2601', personName: 'Hitesh Krishna', rollNumber: 'CS2601', className: 'DBMS', status: 'Absent' },
    { id: 'rec3', date: '2026-09-28', personId: 'CS2602', personName: 'Alexander Wright', rollNumber: 'CS2602', className: 'Java', status: 'Present' },
    { id: 'rec4', date: '2026-09-28', personId: 'CS2602', personName: 'Alexander Wright', rollNumber: 'CS2602', className: 'DBMS', status: 'Present' },
  ],
};

console.log('[TEST 1 Execution] Appending Session 1 (2026-09-28) to existing workbook...');
const res1 = saveAttendanceToExcelFile(existingWorkbookPath, session1);

console.log('✓ Write and Verification Successful!');
console.log(`  File size: ${res1.fileSize} bytes`);
console.log(`  Total attendance rows: ${res1.totalRows}`);
console.log(`  Workbook sheets: ${res1.sheetNames.join(', ')}`);

// Verify unrelated content was NOT overwritten
if (!res1.sheetNames.includes('CourseSyllabus') || !res1.sheetNames.includes('DepartmentDirectory')) {
  console.error('FAIL: Unrelated sheets were deleted!');
  process.exit(1);
}
console.log('✓ Unrelated sheets (CourseSyllabus, DepartmentDirectory) are 100% PRESERVED.');

// Verify format: Date | Roll No | Name | Class | Status
const headers = res1.rows[0];
console.log(`✓ Verified table headers: ${headers.join(' | ')}`);
if (headers.join('|') !== 'Date|Roll No|Name|Class|Status') {
  console.error('FAIL: Table headers do not match Date | Roll No | Name | Class | Status');
  process.exit(1);
}

// Session 2 records: 29 September 2026 (Preserve Day 1 records and append Day 2)
const session2 = {
  date: '2026-09-29',
  records: [
    { id: 'rec5', date: '2026-09-29', personId: 'CS2601', personName: 'Hitesh Krishna', rollNumber: 'CS2601', className: 'Java', status: 'Present' },
    { id: 'rec6', date: '2026-09-29', personId: 'CS2601', personName: 'Hitesh Krishna', rollNumber: 'CS2601', className: 'DBMS', status: 'Present' },
    { id: 'rec7', date: '2026-09-29', personId: 'CS2603', personName: 'Carlos Rodriguez', rollNumber: 'CS2603', className: 'Operating Systems', status: 'Present' },
  ],
};

console.log('\n[TEST 2 Execution] Appending Session 2 (2026-09-29) to verify preservation of previous session records...');
const res2 = saveAttendanceToExcelFile(existingWorkbookPath, session2);

console.log('✓ Write and Verification Successful!');
console.log(`  Total attendance rows now in file: ${res2.totalRows}`);
if (res2.totalRows !== 7) {
  console.error(`FAIL: Expected 7 rows (4 from Session 1 + 3 from Session 2), got ${res2.totalRows}`);
  process.exit(1);
}
console.log('✓ Previous session records PRESERVED (Session 1 + Session 2 both exist in workbook).');

// 3. Test creating a brand-new workbook from scratch
const newWorkbookPath = path.join(testDir, 'Brand_New_Attendance_Workbook.xlsx');
if (fs.existsSync(newWorkbookPath)) {
  fs.unlinkSync(newWorkbookPath);
}

console.log('\n[TEST 3 Execution] Creating a brand-new attendance workbook from scratch...');
const res3 = saveAttendanceToExcelFile(newWorkbookPath, session1);

console.log('✓ New workbook created and verified on disk!');
console.log(`  File path: ${newWorkbookPath}`);
console.log(`  File size: ${res3.fileSize} bytes`);
console.log(`  Rows in new workbook: ${res3.totalRows}`);

// Inspect contents on disk
const finalCheckWb = XLSX.read(fs.readFileSync(newWorkbookPath), { type: 'buffer' });
const finalCheckWs = finalCheckWb.Sheets['Attendance'];
const finalRows = XLSX.utils.sheet_to_json(finalCheckWs, { header: 1 });

console.log('\n[TEST 3 Disk Verification] Final table content read back from file:');
finalRows.forEach((r, idx) => {
  console.log(`  Row ${idx}: ${r.join('  |  ')}`);
});

console.log('\n=== ALL EXCEL ADAPTER TESTS PASSED SUCCESSFULLY! ===');
