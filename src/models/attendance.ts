import type { Person, ClassSession, StorageMode } from '../types';

/**
 * Valid attendance status values.
 * Standardized across both Google Sheets and Excel.
 */
export type AttendanceStatusValue = 'Present' | 'Absent';

/**
 * Normalized single attendance record.
 * Contains all mandatory fields required across both Google Sheets and Excel tabular models:
 * - date
 * - person ID
 * - person name
 * - roll number / ID number
 * - class/subject
 * - status: Present or Absent
 */
export interface AttendanceRecord {
  /** Unique composite key (e.g. `rec_2026-09-28_p1_c1`) */
  id: string;
  /** Attendance date in standard ISO format (e.g., '2026-09-28') */
  date: string;
  /** Unique identifier of the person/student */
  personId: string;
  /** Full name of the person */
  personName: string;
  /** Roll number or identification code */
  rollNumber: string;
  /** Subject or class name (e.g., "Java", "DBMS") */
  className: string;
  /** Optional subject identifier */
  classId?: string;
  /** Status: strictly 'Present' or 'Absent' */
  status: AttendanceStatusValue;
  /** ISO timestamp when attendance was recorded */
  markedAt?: string;
}

/**
 * Summary metrics computed from a collection of attendance records.
 */
export interface AttendanceSummary {
  /** Total number of person-class instances evaluated */
  totalRecords: number;
  /** Total count of 'Present' statuses */
  totalPresent: number;
  /** Total count of 'Absent' statuses */
  totalAbsent: number;
  /** Percentage of presence (0.0 to 100.0) */
  attendancePercentage: number;
  /** Number of distinct individuals in this dataset */
  uniquePeopleCount: number;
  /** Number of distinct subjects/classes in this dataset */
  uniqueClassesCount: number;
}

/**
 * Session metadata providing context for the export destination.
 */
export interface AttendanceMetadata {
  institutionName?: string;
  departmentName?: string;
  academicYear?: string;
  sessionNotes?: string;
  recordedAt: string;
  sourceType?: string;
  filePath?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  weeklyTimetable?: Record<string, { id: string; name: string }[]>;
  dateScheduleOverrides?: Record<string, string[]>;
  selectedMonth?: string;
  selectedYear?: number;
  selectedMonthIndex?: number;
  onlyRecordedDates?: boolean;
}

/**
 * Complete normalized attendance dataset for an attendance session.
 * This is the canonical data structure passed to storage adapters.
 */
export interface AttendanceDataset {
  /** Storage destination mode ('google_sheets' | 'excel') */
  storageMode: StorageMode;
  /** Standard ISO date string (YYYY-MM-DD) */
  date: string;
  /** Formatted human-readable date (e.g. "28 September 2026") */
  formattedDate: string;
  /** Flat list of normalized attendance records */
  records: AttendanceRecord[];
  /** Calculated statistical summary */
  summary: AttendanceSummary;
  /** Snapshot of the roster */
  roster: Person[];
  /** Snapshot of classes/subjects */
  classes: ClassSession[];
  /** Contextual metadata */
  metadata: AttendanceMetadata;
}

/**
 * Calculates summary metrics from a list of AttendanceRecords.
 */
export function calculateAttendanceSummary(records: AttendanceRecord[]): AttendanceSummary {
  const totalRecords = records.length;
  if (totalRecords === 0) {
    return {
      totalRecords: 0,
      totalPresent: 0,
      totalAbsent: 0,
      attendancePercentage: 0,
      uniquePeopleCount: 0,
      uniqueClassesCount: 0,
    };
  }

  let totalPresent = 0;
  const uniquePeople = new Set<string>();
  const uniqueClasses = new Set<string>();

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

/**
 * Converts the application's roster, class setup, and UI checkbox matrix into
 * a normalized list of AttendanceRecord items.
 */
export function buildAttendanceRecords(params: {
  date: string;
  people: Person[];
  classes: ClassSession[];
  personAttendance: Record<string, Record<string, boolean>>;
  markedAt?: string;
}): AttendanceRecord[] {
  const { date, people, classes, personAttendance, markedAt } = params;
  const timestamp = markedAt || new Date().toISOString();
  const records: AttendanceRecord[] = [];

  for (const person of people) {
    const personId = person.id;
    const personMarks = personAttendance[personId] || {};

    for (const cls of classes) {
      const isPresent = Boolean(personMarks[cls.id] ?? personMarks[cls.name]);
      const status: AttendanceStatusValue = isPresent ? 'Present' : 'Absent';
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

/**
 * Builds a complete AttendanceDataset from session state components.
 */
export function buildAttendanceDataset(params: {
  storageMode: StorageMode;
  date: string;
  formattedDate: string;
  people: Person[];
  classes: ClassSession[];
  personAttendance: Record<string, Record<string, boolean>>;
  metadata?: Partial<AttendanceMetadata>;
}): AttendanceDataset {
  const { storageMode, date, formattedDate, people, classes, personAttendance, metadata } = params;

  const records = buildAttendanceRecords({
    date,
    people,
    classes,
    personAttendance,
  });

  const summary = calculateAttendanceSummary(records);

  const fullMetadata: AttendanceMetadata = {
    institutionName: metadata?.institutionName || 'Apex Institute of Science & Technology',
    departmentName: metadata?.departmentName || 'Department of Computer Science & Engineering',
    academicYear: metadata?.academicYear || `${(date ? date.split('-')[0] : '') || new Date().getFullYear()} – Academic Term`,
    recordedAt: metadata?.recordedAt || new Date().toISOString(),
    sourceType: metadata?.sourceType || (storageMode === 'google_sheets' ? 'Google Sheets' : 'Excel'),
    ...metadata,
  };

  return {
    storageMode,
    date,
    formattedDate,
    records,
    summary,
    roster: people,
    classes,
    metadata: fullMetadata,
  };
}

/**
 * Standard headers required for tabular exports (Google Sheets and Excel).
 */
export const ATTENDANCE_TABULAR_HEADERS = [
  'Date',
  'Person ID',
  'Person Name',
  'Roll Number / ID',
  'Class / Subject',
  'Status',
] as const;

/**
 * Converts normalized AttendanceRecord items into 2D tabular rows.
 * This is the shared representation ingested by both Google Sheets and Excel.
 */
export function attendanceRecordsToTabularRows(records: AttendanceRecord[]): {
  headers: string[];
  rows: (string | number)[][];
} {
  const headers = [...ATTENDANCE_TABULAR_HEADERS];
  const rows = records.map((r) => [
    r.date,
    r.personId,
    r.personName,
    r.rollNumber,
    r.className,
    r.status,
  ]);

  return { headers, rows };
}

/**
 * Subject-wise attendance calculation breakdown.
 */
export interface SubjectAttendanceStat {
  subject: string;
  present: number;
  absent: number;
  total: number;
  percentage: string;
}

/**
 * Complete student profile data with personal information and calculated attendance.
 */
export interface StudentAttendanceProfile {
  student: Person;
  totalClasses: number;
  presentClasses: number;
  absentClasses: number;
  overallPercentage: string;
  subjectStats: SubjectAttendanceStat[];
}

/**
 * Calculates real attendance statistics for a specific student from actual attendance records.
 * Handles zero-class cases safely. Never hardcodes statistics.
 */
export function calculateStudentAttendanceProfile(
  student: Person,
  records: AttendanceRecord[]
): StudentAttendanceProfile {
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

  const subjectMap = new Map<string, { present: number; absent: number; total: number }>();
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

  const subjectStats: SubjectAttendanceStat[] = Array.from(subjectMap.entries()).map(
    ([subject, counts]) => ({
      subject,
      present: counts.present,
      absent: counts.absent,
      total: counts.total,
      percentage:
        counts.total > 0
          ? (Math.round((counts.present / counts.total) * 1000) / 10).toFixed(1) + '%'
          : '0.0%',
    })
  );

  return {
    student,
    totalClasses,
    presentClasses,
    absentClasses,
    overallPercentage,
    subjectStats,
  };
}
