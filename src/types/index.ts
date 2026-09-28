import type {
  AttendanceRecord,
  AttendanceStatusValue,
  AttendanceDataset,
  AttendanceSummary,
  SubjectAttendanceStat,
  StudentAttendanceProfile,
} from '../models/attendance';

export type StepId = 1 | 2 | 3 | 4 | 5 | 6;

export type StorageMode = 'google_sheets' | 'excel';

/** Application phase: setup wizard or main workspace */
export type AppPhase = 'setup' | 'workspace';

/** Main workspace tabs */
export type WorkspaceTab = 'attendance' | 'students' | 'timetable';

export interface StepMeta {
  id: StepId;
  key: string;
  title: string;
  subtitle: string;
  shortLabel: string;
  description: string;
}

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  email: string;
  group: string;
  isActive: boolean;
  avatarBg?: string;
}

export interface Person {
  id: string;
  name: string;
  rollNumber: string;
  phone?: string;
  email?: string;
}

export interface ClassSession {
  id: string;
  code: string;
  name: string;
  instructor: string;
  timeSlot: string;
  room: string;
  days: string[];
  totalEnrolled: number;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface LegacyAttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
  notes?: string;
  timeMarked?: string;
}

export type Weekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface TimetableSubject {
  id: string;
  name: string;
}

export type WeeklyTimetable = Record<Weekday, TimetableSubject[]>;

// Re-export unified attendance data model types
export type {
  AttendanceRecord,
  AttendanceStatusValue,
  AttendanceDataset,
  AttendanceSummary,
  SubjectAttendanceStat,
  StudentAttendanceProfile,
};

export interface CalendarDayInfo {
  date: number;
  dayName: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayTitle?: string;
  type: 'class' | 'weekend' | 'holiday' | 'event';
}

/**
 * Per-date saved attendance state.
 * savedDailyAttendance[dateStr][personId][classId] = true (Present) | false (Absent)
 */
export type DailyAttendanceMap = Record<string, Record<string, Record<string, boolean>>>;

export interface AppSessionState {
  // === APP PHASE ===
  appPhase: AppPhase;
  activeTab: WorkspaceTab;
  /** Currently selected date in the workspace (YYYY-MM-DD) */
  activeDate: string;

  // === STORAGE ===
  storageMode: StorageMode | null;
  sourceName: string;
  sourceType: 'local' | 'spreadsheet' | 'sample';

  // === STUDENTS ===
  peopleCount: number | null;
  people: Person[];

  // === MONTH / DATE ===
  selectedMonth: string;
  selectedYear: number;
  selectedMonthIndex: number;
  startDate: string;
  startDayNumber: number;
  workingDaysCount: number;
  minimumAttendanceThreshold: number;

  // === TIMETABLE ===
  weeklyTimetable?: WeeklyTimetable;
  classes: ClassSession[];

  // === ATTENDANCE RECORDS ===
  /**
   * Multi-date attendance map: dateStr → personId → classId → boolean
   * This is the primary attendance store in workspace mode.
   */
  savedDailyAttendance: DailyAttendanceMap;
  /** Dates that have been explicitly saved to storage */
  savedDates: string[];
  /** Dates marked as holiday or no class */
  noClassDates?: string[];
  /** Optional reasons for holiday dates (e.g. 'College Holiday', 'Festival', 'Exam') */
  holidayReasons?: Record<string, string>;
  /** Unified normalized attendance records (built on save) */
  attendanceRecords?: AttendanceRecord[];

  // === STORAGE TARGETS ===
  excelFilePath?: string;
  excelFileName?: string;
  excelExistingRecordsCount?: number;
  excelWorkbookSheets?: string[];
  googleSpreadsheetId?: string;
  googleSpreadsheetUrl?: string;
  googleSpreadsheetTitle?: string;
  googleUserEmail?: string;
  googleIsAuthenticated?: boolean;

  // === LEGACY / COMPAT ===
  institutionName: string;
  departmentName: string;
  academicYear: string;
  /** @deprecated use savedDailyAttendance */
  personAttendance: Record<string, Record<string, boolean>>;
  /** @deprecated Retained for backwards compatibility */
  members?: Student[];
  /** @deprecated Retained for backwards compatibility */
  attendance?: Record<string, LegacyAttendanceRecord>;
}

// Window Electron API interface declaration
declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximizeChange: (callback: (isMax: boolean) => void) => () => void;
      setTheme?: (theme: 'light' | 'dark') => void;
      isElectron?: boolean;
      // Excel file system operations
      selectExcelFile?: () => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
      saveExcelDialog?: (defaultName?: string) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
      readExcelBuffer?: (filePath: string) => Promise<{ success: boolean; data?: Uint8Array; error?: string }>;
      writeExcelBuffer?: (filePath: string, buffer: Uint8Array) => Promise<{ success: boolean; error?: string; bytesWritten?: number }>;
      verifyExcelFile?: (filePath: string) => Promise<{ exists: boolean; size?: number; mtime?: string; error?: string }>;
      getDefaultExcelPath?: (fileName?: string) => Promise<string>;
      showItemInFolder?: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      openExternal?: (url: string) => Promise<{ success: boolean; error?: string }>;
      // Google Sheets integration operations
      googleSheetsGetStatus?: () => Promise<{
        isAuthenticated: boolean;
        authType: string | null;
        userEmail: string | null;
        spreadsheetId: string | null;
        spreadsheetUrl: string | null;
        spreadsheetTitle: string | null;
        hasClientCredentials?: boolean;
      }>;
      googleSheetsStartOAuth?: (clientId?: string, clientSecret?: string) => Promise<{ success: boolean; userEmail?: string; error?: string }>;
      googleSheetsCancelOAuth?: () => Promise<{ success: boolean }>;
      googleSheetsSetToken?: (token: string) => Promise<{ success: boolean; userEmail?: string; error?: string }>;
      googleSheetsSetServiceAccount?: (jsonContent: string) => Promise<{ success: boolean; userEmail?: string; error?: string }>;
      googleSheetsSetClientCredentials?: (clientId: string, clientSecret: string) => Promise<{ success: boolean }>;
      googleSheetsDisconnect?: () => Promise<{ success: boolean }>;
      googleSheetsSetSpreadsheet?: (idOrUrl: string) => Promise<{
        success: boolean;
        spreadsheetId: string;
        title: string;
        spreadsheetUrl: string;
        sheetNames: string[];
        hasAttendanceSheet: boolean;
        error?: string;
      }>;
      googleSheetsCreateSpreadsheet?: (title?: string) => Promise<{
        success: boolean;
        spreadsheetId: string;
        title: string;
        spreadsheetUrl: string;
        error?: string;
      }>;
      googleSheetsAppendRecords?: (dataset: unknown) => Promise<{
        success: boolean;
        recordsCount: number;
        updatedRows: number;
        updatedRange?: string;
        spreadsheetId: string;
        spreadsheetUrl: string;
        spreadsheetTitle?: string;
        error?: string;
      }>;
    };
  }
}
