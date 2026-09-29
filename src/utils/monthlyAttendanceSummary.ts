import type { Person, WeeklyTimetable, DailyAttendanceMap, AttendanceRecord, Weekday } from '../types';
import { MONTH_NAMES, getDaysInMonth, getSubjectsForDate } from './calendar';

export interface MonthSummarySubject {
  subjectName: string;
  totalClasses: number; // Scheduled conducted classes in that month
}

export interface MonthSummaryColumnGroup {
  year: number;
  monthIndex: number;
  monthName: string;
  totalClasses: number; // Sum of totalClasses of all subjects in this month
  subjects: MonthSummarySubject[];
}

export interface StudentMonthAttendance {
  year: number;
  monthIndex: number;
  subjectAttended: Record<string, number>; // subjectName -> attended classes count
  monthTotalAttended: number; // Sum of attended classes across all subjects in this month
}

export interface StudentMonthlySummaryRow {
  student: Person;
  monthlyData: StudentMonthAttendance[]; // Ordered matching monthGroups
  overallPresent: number;
  overallAbsent: number;
  overallTotal: number;
  overallPercentage: number;
  // Backward compatibility aliases
  overallAttended: number;
  overallConducted: number;
}

export interface MonthlyAttendanceMatrix {
  academicYear: string;
  selectedYear: number;
  monthRangeLabel: string;
  monthGroups: MonthSummaryColumnGroup[];
  allSubjects: string[];
  students: StudentMonthlySummaryRow[];
  overallStats: {
    totalStudents: number;
    totalConductedClasses: number;
    totalAttendedClasses: number;
    averageAttendancePct: number;
    totalPresent?: number;
    totalAbsent?: number;
    totalRecords?: number;
  };
}

export interface ComputeMonthlyAttendanceParams {
  people: Person[];
  weeklyTimetable?: WeeklyTimetable;
  dateScheduleOverrides?: Record<string, string[]>;
  noClassDates?: string[];
  savedDailyAttendance?: DailyAttendanceMap;
  attendanceRecords?: AttendanceRecord[];
  year: number;
  academicYear?: string;
  startMonthIndex?: number; // 0 to 11
  endMonthIndex?: number; // 0 to 11
  subjectFilter?: string[]; // If non-empty, only include these subjects
}

/**
 * Extracts all unique subject names from timetable and attendance records.
 */
export function extractUniqueSubjectNames(
  weeklyTimetable?: WeeklyTimetable,
  attendanceRecords?: AttendanceRecord[],
  year?: number,
  dateScheduleOverrides?: Record<string, (string | { id?: string; name: string })[]>
): string[] {
  const subjectSet = new Set<string>();

  // 1. From timetable
  if (weeklyTimetable) {
    const days: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const d of days) {
      const subs = weeklyTimetable[d] || [];
      for (const s of subs) {
        if (s && s.name && s.name.trim()) {
          subjectSet.add(s.name.trim());
        }
      }
    }
  }

  // 2. From date-specific schedule overrides
  if (dateScheduleOverrides) {
    const prefix = year ? `${year}-` : '';
    for (const [dateStr, subs] of Object.entries(dateScheduleOverrides)) {
      if ((!prefix || dateStr.startsWith(prefix)) && Array.isArray(subs)) {
        for (const s of subs) {
          const name = typeof s === 'string' ? s : s?.name;
          if (name && name.trim()) {
            subjectSet.add(name.trim());
          }
        }
      }
    }
  }

  // 3. From attendance records (matching year if specified)
  if (attendanceRecords && attendanceRecords.length > 0) {
    const prefix = year ? `${year}-` : '';
    for (const r of attendanceRecords) {
      if ((!prefix || r.date.startsWith(prefix)) && r.className && r.className.trim()) {
        subjectSet.add(r.className.trim());
      }
    }
  }

  return Array.from(subjectSet);
}

/**
 * Computes scheduled conducted classes for each subject in a given month.
 * Strictly respects:
 * - timetable schedule
 * - holidays & no-class days (noClassDates)
 * - non-scheduled days (e.g. Sunday or days with no classes)
 */
export function computeMonthConductedClasses(params: {
  year: number;
  monthIndex: number;
  subjects: string[];
  weeklyTimetable?: WeeklyTimetable;
  dateScheduleOverrides?: Record<string, string[]>;
  noClassDates?: string[];
}): {
  conductedBySubject: Record<string, number>;
  totalConducted: number;
} {
  const { year, monthIndex, subjects, weeklyTimetable, dateScheduleOverrides, noClassDates = [] } = params;
  const holidays = new Set(noClassDates);
  const daysInMonth = getDaysInMonth(year, monthIndex);

  const conductedBySubject: Record<string, number> = {};
  for (const s of subjects) {
    conductedBySubject[s] = 0;
  }

  let totalConducted = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (holidays.has(dateStr)) {
      // Holiday / No-Class: Skip! Must not count towards conducted classes
      continue;
    }

    const scheduled = getSubjectsForDate(dateStr, weeklyTimetable, dateScheduleOverrides);
    for (const sub of scheduled) {
      const subName = sub.name ? sub.name.trim() : '';
      if (subName && conductedBySubject[subName] !== undefined) {
        conductedBySubject[subName] += 1;
        totalConducted += 1;
      }
    }
  }

  return { conductedBySubject, totalConducted };
}

/**
 * Computes the complete month-wise attendance matrix across all students and months.
 */
export function computeMonthlyAttendanceMatrix(params: ComputeMonthlyAttendanceParams): MonthlyAttendanceMatrix {
  const {
    people,
    weeklyTimetable,
    dateScheduleOverrides,
    noClassDates = [],
    savedDailyAttendance = {},
    attendanceRecords = [],
    year,
    academicYear = String(year),
    startMonthIndex = 0,
    endMonthIndex = 11,
    subjectFilter,
  } = params;

  const validStartMonth = Math.max(0, Math.min(11, startMonthIndex));
  const validEndMonth = Math.max(validStartMonth, Math.min(11, endMonthIndex));

  // Determine subjects
  const allAvailableSubjects = extractUniqueSubjectNames(weeklyTimetable, attendanceRecords, year, dateScheduleOverrides);
  let activeSubjects = allAvailableSubjects;
  if (subjectFilter && subjectFilter.length > 0) {
    activeSubjects = subjectFilter.map((s) => s.trim()).filter(Boolean);
  }

  const holidays = new Set(noClassDates);

  // Pre-calculate month column groups and conducted counts
  const monthGroups: MonthSummaryColumnGroup[] = [];

  for (let m = validStartMonth; m <= validEndMonth; m++) {
    const { conductedBySubject, totalConducted } = computeMonthConductedClasses({
      year,
      monthIndex: m,
      subjects: activeSubjects,
      weeklyTimetable,
      dateScheduleOverrides,
      noClassDates,
    });

    const monthSubjects: MonthSummarySubject[] = activeSubjects.map((s) => ({
      subjectName: s,
      totalClasses: conductedBySubject[s] || 0,
    }));

    monthGroups.push({
      year,
      monthIndex: m,
      monthName: MONTH_NAMES[m],
      totalClasses: totalConducted,
      subjects: monthSubjects,
    });
  }

  const activeSubjectsLowerSet = new Set(activeSubjects.map((s) => s.toLowerCase()));

  // Pre-index attendance records for fast lookup: `${date}_${personId}_${classNameLower}`
  const rollLookup = new Map<string, string>(); // rollNumber -> personId
  for (const p of people) {
    if (p.rollNumber && p.rollNumber.trim()) {
      rollLookup.set(p.rollNumber.trim().toLowerCase(), p.id);
    }
  }

  // Calculate student rows
  const studentRows: StudentMonthlySummaryRow[] = [];
  let aggregateTotalPresent = 0;
  let aggregateTotalAbsent = 0;
  let aggregateTotalRecords = 0;

  for (const student of people) {
    const studentRollLower = (student.rollNumber || '').trim().toLowerCase();

    // Track actual attendance records for this student across ALL selected months and ALL active subjects
    // Key: `${dateStr}_${subNameLower}` -> 'Present' | 'Absent'
    const studentAttendanceMap = new Map<string, 'Present' | 'Absent'>();

    // 1. Populate from attendanceRecords (matching student and within selected months & active subjects)
    if (attendanceRecords && attendanceRecords.length > 0) {
      for (const r of attendanceRecords) {
        if (!r.status || !r.className || !r.date) continue;
        const matchesStudent =
          (r.personId && r.personId === student.id) ||
          (r.rollNumber && studentRollLower && r.rollNumber.trim().toLowerCase() === studentRollLower);
        if (!matchesStudent) continue;

        if (holidays.has(r.date)) continue;

        const [ry, rm] = r.date.split('-').map(Number);
        const mIdx = rm - 1;
        if (ry !== year || mIdx < validStartMonth || mIdx > validEndMonth) continue;

        const subName = r.className.trim();
        if (!activeSubjectsLowerSet.has(subName.toLowerCase())) continue;

        const status: 'Present' | 'Absent' = r.status === 'Present' ? 'Present' : 'Absent';
        studentAttendanceMap.set(`${r.date}_${subName.toLowerCase()}`, status);
      }
    }

    // 2. Populate from savedDailyAttendance for all dates in selected months
    for (let m = validStartMonth; m <= validEndMonth; m++) {
      const daysInMonth = getDaysInMonth(year, m);
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (holidays.has(dateStr)) continue;

        const daySaved = savedDailyAttendance[dateStr]?.[student.id];
        if (!daySaved) continue;

        const scheduled = getSubjectsForDate(dateStr, weeklyTimetable, dateScheduleOverrides);
        for (const sub of scheduled) {
          const subName = sub.name ? sub.name.trim() : '';
          if (!subName || !activeSubjectsLowerSet.has(subName.toLowerCase())) continue;

          const mark = daySaved[sub.id] ?? daySaved[sub.name];
          if (mark !== undefined) {
            studentAttendanceMap.set(`${dateStr}_${subName.toLowerCase()}`, mark ? 'Present' : 'Absent');
          }
        }

        // Also check any subjects saved directly in daySaved
        for (const [keyOrName, markVal] of Object.entries(daySaved)) {
          if (markVal === undefined) continue;
          const matchedSubject = activeSubjects.find(
            (s) => s.toLowerCase() === keyOrName.toLowerCase()
          );
          if (matchedSubject) {
            studentAttendanceMap.set(`${dateStr}_${matchedSubject.toLowerCase()}`, markVal ? 'Present' : 'Absent');
          }
        }
      }
    }

    // 3. Compute Monthly Data for the matrix view (Subject columns + Month Total)
    const monthlyData: StudentMonthAttendance[] = [];

    for (let gIdx = 0; gIdx < monthGroups.length; gIdx++) {
      const group = monthGroups[gIdx];
      const m = group.monthIndex;
      const daysInMonth = getDaysInMonth(year, m);

      const attendedBySubject: Record<string, number> = {};
      for (const s of activeSubjects) {
        attendedBySubject[s] = 0;
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (holidays.has(dateStr)) continue;

        const scheduled = getSubjectsForDate(dateStr, weeklyTimetable, dateScheduleOverrides);
        for (const sub of scheduled) {
          const subName = sub.name ? sub.name.trim() : '';
          if (!subName || attendedBySubject[subName] === undefined) continue;

          const key = `${dateStr}_${subName.toLowerCase()}`;
          if (studentAttendanceMap.get(key) === 'Present') {
            attendedBySubject[subName] = (attendedBySubject[subName] || 0) + 1;
          }
        }
      }

      // Enforce: attendance value cannot exceed conducted classes.
      // If subject has 0 conducted classes, attendance must be 0.
      let monthTotalAttended = 0;
      for (const subInfo of group.subjects) {
        const sName = subInfo.subjectName;
        const maxConducted = subInfo.totalClasses;
        if (maxConducted === 0) {
          attendedBySubject[sName] = 0;
        } else {
          attendedBySubject[sName] = Math.min(attendedBySubject[sName] || 0, maxConducted);
        }
        monthTotalAttended += attendedBySubject[sName];
      }

      monthlyData.push({
        year,
        monthIndex: m,
        subjectAttended: attendedBySubject,
        monthTotalAttended,
      });
    }

    // 4. Calculate Overall Summary from actual attendance records:
    // Present = total Present records
    // Absent = total Absent records
    // Total = Present + Absent
    // Attendance % = Present / Total * 100
    let studentOverallPresent = 0;
    let studentOverallAbsent = 0;

    for (const status of studentAttendanceMap.values()) {
      if (status === 'Present') {
        studentOverallPresent++;
      } else if (status === 'Absent') {
        studentOverallAbsent++;
      }
    }

    const studentOverallTotal = studentOverallPresent + studentOverallAbsent;
    const studentOverallPercentage =
      studentOverallTotal > 0
        ? Math.round((studentOverallPresent / studentOverallTotal) * 1000) / 10
        : 0;

    studentRows.push({
      student,
      monthlyData,
      overallPresent: studentOverallPresent,
      overallAbsent: studentOverallAbsent,
      overallTotal: studentOverallTotal,
      overallPercentage: studentOverallPercentage,
      overallAttended: studentOverallPresent,
      overallConducted: studentOverallTotal,
    });

    aggregateTotalPresent += studentOverallPresent;
    aggregateTotalAbsent += studentOverallAbsent;
    aggregateTotalRecords += studentOverallTotal;
  }

  // Month range label
  const startMonthName = MONTH_NAMES[validStartMonth];
  const endMonthName = MONTH_NAMES[validEndMonth];
  const monthRangeLabel =
    validStartMonth === validEndMonth
      ? `${startMonthName} ${year}`
      : `${startMonthName} – ${endMonthName} ${year}`;

  const totalPossibleAllStudents =
    monthGroups.reduce((acc, g) => acc + g.totalClasses, 0) * people.length;

  const averageAttendancePct =
    aggregateTotalRecords > 0
      ? Math.round((aggregateTotalPresent / aggregateTotalRecords) * 1000) / 10
      : (totalPossibleAllStudents > 0
        ? Math.round((aggregateTotalPresent / totalPossibleAllStudents) * 1000) / 10
        : 0);

  return {
    academicYear,
    selectedYear: year,
    monthRangeLabel,
    monthGroups,
    allSubjects: activeSubjects,
    students: studentRows,
    overallStats: {
      totalStudents: people.length,
      totalConductedClasses: monthGroups.reduce((acc, g) => acc + g.totalClasses, 0),
      totalAttendedClasses: aggregateTotalPresent,
      averageAttendancePct,
      totalPresent: aggregateTotalPresent,
      totalAbsent: aggregateTotalAbsent,
      totalRecords: aggregateTotalRecords,
    },
  };
}
