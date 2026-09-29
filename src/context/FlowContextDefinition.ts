import { createContext } from 'react';
import type { StepId, StepMeta, AppSessionState, StorageMode, Person, ClassSession, Weekday, WeeklyTimetable, TimetableSubject, WorkspaceTab } from '../types';
import type { AttendanceDataset, AttendanceRecord } from '../models/attendance';
import type { StorageSaveResult } from '../storage';

export interface GoogleStatus {
  isAuthenticated: boolean;
  authType: string | null;
  userEmail: string | null;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  spreadsheetTitle: string | null;
  hasClientCredentials?: boolean;
}

export interface ImportStudentsOptions {
  updateExisting?: boolean;
}

export interface ImportStudentsResult {
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
}

export interface FlowContextType {
  // === SETUP FLOW ===
  currentStep: StepId;
  completedSteps: number[];
  canGoNext: boolean;
  canGoPrev: boolean;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: StepId) => void;
  resetFlow: (clearRosterOrEvent?: boolean | unknown) => void;

  // === WORKSPACE ===
  /** Enter the main workspace after setup */
  enterWorkspace: () => void;
  /** Active workspace tab */
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  /** The currently viewed date in workspace attendance */
  activeDate: string;
  setActiveDate: (date: string) => void;
  /** Change viewed month in workspace */
  setWorkspaceMonth: (year: number, monthIndex: number) => void;

  // === SESSION STATE ===
  sessionState: AppSessionState;
  updateSessionState: (updater: Partial<AppSessionState>) => void;

  // === STORAGE SETUP ===
  setStorageMode: (mode: StorageMode) => void;

  // === STUDENTS ===
  setPeopleCount: (count: number) => void;
  setPeople: (people: Person[]) => void;
  updatePerson: (index: number, personData: Partial<Person>) => void;
  addPerson: () => void;
  deletePerson: (index: number) => void;
  importStudents: (
    students: Array<{ name: string; rollNumber: string; phone?: string; email?: string }>,
    options?: ImportStudentsOptions
  ) => ImportStudentsResult;

  // === DATE SETUP ===
  setDateSetup: (year: number, monthIndex: number, dayNumber: number) => void;

  // === TIMETABLE ===
  weeklyTimetable: WeeklyTimetable;
  addTimetableSubject: (day: Weekday, name: string) => { success: boolean; error?: string };
  updateTimetableSubject: (day: Weekday, id: string, name: string) => { success: boolean; error?: string };
  deleteTimetableSubject: (day: Weekday, id: string) => void;

  // === DATE SCHEDULE OVERRIDES ===
  dateScheduleOverrides: Record<string, string[]>;
  setDateScheduleOverride: (dateStr: string, subjects: string[]) => void;
  removeDateScheduleOverride: (dateStr: string) => void;
  getDateScheduleOverride: (dateStr: string) => string[] | undefined;
  getEffectiveSubjectsForDate: (dateStr: string) => TimetableSubject[];

  // === LEGACY CLASS METHODS ===
  addClass: (name: string) => void;
  updateClass: (id: string, name: string) => void;
  deleteClass: (id: string) => void;
  setClasses: (classes: ClassSession[]) => void;

  // === ATTENDANCE (WORKSPACE) ===
  /**
   * Save attendance for a specific date (multi-student grid).
   * personAttendanceMap: { [personId]: { [classId]: boolean } }
   */
  saveDailyAttendance: (dateStr: string, personAttendanceMap: Record<string, Record<string, boolean>>) => void;
  /** Get saved attendance for a specific date */
  getDailyAttendance: (dateStr: string) => Record<string, Record<string, boolean>>;
  /** Check whether a date has been saved */
  isDateSaved: (dateStr: string) => boolean;
  /** Check whether a date is marked as No Class / Holiday */
  isNoClassDate: (dateStr: string) => boolean;
  /** Get optional reason for a holiday date */
  getHolidayReason: (dateStr: string) => string | undefined;
  /** Mark a date as Holiday / No Classes with an optional reason */
  markDateAsHoliday: (dateStr: string, reason?: string) => void;
  /** Remove holiday status from a date, re-enabling normal weekday timetable */
  removeDateHoliday: (dateStr: string) => void;
  /** Toggle a date between normal and No Class / Holiday */
  toggleNoClassDate: (dateStr: string, reason?: string) => void;
  /** Restore a full workspace backup with validation */
  restoreWorkspaceBackup: (backupData: unknown) => { success: boolean; error?: string };
  /** Get all saved attendance records for a month */
  getMonthAttendanceRecords: (year: number, monthIndex: number) => AttendanceRecord[];

  // === LEGACY ATTENDANCE ===
  savePersonAttendance: (personId: string, classAttendance: Record<string, boolean>) => void;
  getAttendanceDataset: () => AttendanceDataset;
  saveToStorage: (customFilePath?: string) => Promise<StorageSaveResult>;
  /** Save a specific date's attendance to storage */
  saveDateToStorage: (dateStr: string, attendanceData?: Record<string, Record<string, boolean>>) => Promise<StorageSaveResult>;

  // === EXCEL ===
  selectExistingExcelWorkbook: () => Promise<{ canceled: boolean; filePath?: string; recordsCount?: number; error?: string }>;
  createNewExcelWorkbook: (defaultName?: string) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
  setExcelFilePath: (filePath: string) => void;

  // === GOOGLE SHEETS ===
  googleStatus: GoogleStatus;
  refreshGoogleStatus: () => Promise<GoogleStatus>;
  connectGoogleOAuth: (clientId?: string, clientSecret?: string) => Promise<{ success: boolean; userEmail?: string; error?: string }>;
  cancelGoogleOAuth: () => Promise<void>;
  connectGoogleToken: (token: string) => Promise<{ success: boolean; userEmail?: string; error?: string }>;
  connectGoogleServiceAccount: (jsonContent: string) => Promise<{ success: boolean; userEmail?: string; error?: string }>;
  disconnectGoogle: () => Promise<void>;
  setGoogleSpreadsheet: (idOrUrl: string) => Promise<{ success: boolean; title?: string; spreadsheetUrl?: string; error?: string }>;
  createGoogleSpreadsheet: (title?: string) => Promise<{ success: boolean; title?: string; spreadsheetUrl?: string; error?: string }>;

  currentStepMeta: StepMeta;
}

export const FlowContext = createContext<FlowContextType | undefined>(undefined);
