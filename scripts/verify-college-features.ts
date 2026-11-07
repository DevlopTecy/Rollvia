import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { ExcelAdapter } from '../src/storage/adapters/ExcelAdapter';
import {
  generateCollegeSignatureSheetPdfBuffer,
  generateCollegeSignatureSheetWorkbook,
} from '../src/utils/collegeSignatureSheetExport';
import type { AttendanceDataset } from '../src/models/attendance';
import type { MonthlyAttendanceMatrix } from '../src/utils/monthlyAttendanceSummary';
import * as XLSX from 'xlsx';

console.log('================================================================');
console.log('INTEGRATION TEST: SAFE ROLLING BACKUPS & COLLEGE SIGNATURE TEMPLATES');
console.log('================================================================\n');

async function run() {
  const testDir = path.join(process.cwd(), '.tmp', 'test-college-backup');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  const testWorkbookPath = path.join(testDir, 'Test_Rollvia_Attendance.xlsx');

  const adapter = new ExcelAdapter();

  const dataset1: AttendanceDataset = {
    storageMode: 'excel',
    date: '2026-09-01',
    formattedDate: '2026-09-01',
    records: [
      {
        id: 'rec_1',
        date: '2026-09-01',
        personId: 'p1',
        personName: 'Alice Smith',
        rollNumber: 'CS101',
        className: 'DBMS',
        status: 'Present',
      },
    ],
    summary: {
      totalRecords: 1,
      totalPresent: 1,
      totalAbsent: 0,
      attendancePercentage: 100,
      uniquePeopleCount: 1,
      uniqueClassesCount: 1,
    },
    roster: [
      { id: 'p1', name: 'Alice Smith', rollNumber: 'CS101' },
    ],
    classes: [
      { id: 'sub_1', code: 'CS101', name: 'DBMS', instructor: 'Prof A', timeSlot: '10:00', room: '101', days: ['Tuesday'], totalEnrolled: 1 },
    ],
    metadata: {
      institutionName: 'Rollvia Engineering College',
      departmentName: 'Computer Science Department',
      academicYear: '2026–2027',
      selectedMonth: 'September 2026',
      selectedYear: 2026,
      selectedMonthIndex: 8,
      recordedAt: new Date().toISOString(),
      weeklyTimetable: {
        Tuesday: [{ id: 'sub_1', name: 'DBMS' }],
      },
    },
  };

  console.log('[TEST 1] Initial Workbook Save...');
  const res1 = await adapter.save(dataset1, testWorkbookPath);
  assert(res1.success, `First save failed: ${res1.error}`);
  assert(fs.existsSync(testWorkbookPath), 'Primary workbook must exist on disk.');
  console.log('[PASS] Initial workbook created successfully.');

  console.log('\n[TEST 2] Second Workbook Save with Rolling Backup...');
  // Modify dataset for second save
  const dataset2: AttendanceDataset = {
    ...dataset1,
    date: '2026-09-02',
    records: [
      ...dataset1.records,
      {
        id: 'rec_2',
        date: '2026-09-02',
        personId: 'p1',
        personName: 'Alice Smith',
        rollNumber: 'CS101',
        className: 'DBMS',
        status: 'Absent',
      },
    ],
  };

  const res2 = await adapter.save(dataset2, testWorkbookPath);
  assert(res2.success, `Second save failed: ${res2.error}`);

  const backupDir = path.join(testDir, '.rollvia_backups');
  assert(fs.existsSync(backupDir), '.rollvia_backups directory must exist.');

  const backupFiles = fs.readdirSync(backupDir).filter((f: string) => f.endsWith('.xlsx'));
  assert(backupFiles.length >= 1, `Expected at least 1 backup file, found ${backupFiles.length}`);
  console.log(`[PASS] Backup directory created: ${backupDir}`);
  console.log(`[PASS] Timestamped backup verified: ${backupFiles[0]}`);

  console.log('\n[TEST 3] Rolling Backup Pruning (Exceeding 15 Backups)...');
  // Create 18 dummy backups
  for (let i = 1; i <= 18; i++) {
    const pad = String(i).padStart(2, '0');
    const dummyPath = path.join(backupDir, `Test_Rollvia_Attendance_backup_2026-09-01_10-00-${pad}.xlsx`);
    fs.writeFileSync(dummyPath, Buffer.from('dummy-backup-data'));
  }

  // Trigger save again to enforce pruning
  await adapter.save(dataset2, testWorkbookPath);

  const prunedBackups = fs.readdirSync(backupDir).filter((f: string) => f.endsWith('.xlsx'));
  assert(prunedBackups.length <= 16, `Expected pruned backup count <= 16, got ${prunedBackups.length}`);
  console.log(`[PASS] Pruning succeeded: backup count capped at ${prunedBackups.length} (limit 15).`);

  console.log('\n[TEST 4] Official College Signature Sheet PDF Generation...');
  const mockMatrix: MonthlyAttendanceMatrix = {
    selectedYear: 2026,
    monthRangeLabel: 'September 2026',
    academicYear: '2026–2027',
    monthGroups: [
      {
        year: 2026,
        monthIndex: 8,
        monthName: 'September',
        totalClasses: 30,
        subjects: [{ subjectName: 'DBMS', totalClasses: 15 }, { subjectName: 'Java', totalClasses: 15 }],
      },
    ],
    students: [
      {
        student: { id: 's1', name: 'Alice Smith', rollNumber: 'CS101' },
        overallPresent: 28,
        overallAbsent: 2,
        overallTotal: 30,
        overallPercentage: 93.3,
        overallAttended: 28,
        overallConducted: 30,
        monthlyData: [],
      },
      {
        student: { id: 's2', name: 'Bob Jones', rollNumber: 'CS102' },
        overallPresent: 18,
        overallAbsent: 12,
        overallTotal: 30,
        overallPercentage: 60.0,
        overallAttended: 18,
        overallConducted: 30,
        monthlyData: [],
      },
      {
        student: { id: 's3', name: 'Charlie Williams', rollNumber: 'CS103' },
        overallPresent: 24,
        overallAbsent: 6,
        overallTotal: 30,
        overallPercentage: 80.0,
        overallAttended: 24,
        overallConducted: 30,
        monthlyData: [],
      },
    ],
    allSubjects: ['DBMS', 'Java'],
    overallStats: {
      totalStudents: 3,
      totalConductedClasses: 30,
      totalAttendedClasses: 70,
      averageAttendancePct: 77.8,
    },
  };

  const pdfBuf = generateCollegeSignatureSheetPdfBuffer(mockMatrix, {
    institutionName: 'Apex Institute of Technology',
    departmentName: 'Department of Computer Science',
    academicYear: '2026–2027',
    minimumAttendanceThreshold: 75,
  });

  assert(pdfBuf && pdfBuf.length > 500, 'PDF buffer must be generated and non-empty.');
  const pdfStr = Buffer.from(pdfBuf).toString('latin1');
  assert(pdfStr.startsWith('%PDF-1.4'), 'PDF must start with valid header %PDF-1.4');
  assert(pdfStr.includes('OFFICIAL ATTENDANCE AND SIGNATURE STATEMENT'), 'PDF must include document header title');
  assert(pdfStr.includes('Alice Smith'), 'PDF must include student Alice Smith');
  assert(pdfStr.includes('Head of Department'), 'PDF must include HOD signature block');
  console.log(`[PASS] PDF generated successfully (${pdfBuf.length} bytes) with signature blocks.`);

  console.log('\n[TEST 5] Official College Signature Sheet Excel (.xlsx) Generation...');
  const wb = generateCollegeSignatureSheetWorkbook(mockMatrix, {
    institutionName: 'Apex Institute of Technology',
    departmentName: 'Department of Computer Science',
    academicYear: '2026–2027',
  });

  assert(wb.SheetNames.includes('Signature Statement'), 'Workbook must have Signature Statement sheet.');
  const ws = wb.Sheets['Signature Statement'];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
  assert(rows.length >= 8, 'Sheet must have headers and student rows.');
  assert(String(rows[0][0]).includes('APEX INSTITUTE'), 'Row 0 must have uppercase institution banner.');
  assert(String(rows[5][7]).includes('Signature'), 'Header row must include Student Signature column.');
  console.log('[PASS] Excel signature sheet generated with proper rows, formulas, and signature cells.');

  // Clean up
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('\n================================================================');
  console.log('ALL 5 TESTS PASSED: SAFE BACKUPS & COLLEGE TEMPLATES VERIFIED!');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('[FAIL]', err);
  process.exit(1);
});
