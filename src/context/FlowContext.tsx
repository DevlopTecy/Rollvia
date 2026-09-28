import React, { useState, useEffect, useCallback } from 'react';
import type {
  StepId,
  AppSessionState,
  StorageMode,
  Person,
  Student,
  ClassSession,
  Weekday,
  WeeklyTimetable,
  WorkspaceTab,
  DailyAttendanceMap,
} from '../types';
import { STEPS, INITIAL_WEEKLY_TIMETABLE } from '../constants/steps';
import { FlowContext } from './FlowContextDefinition';
import type { GoogleStatus, ImportStudentsOptions, ImportStudentsResult } from './FlowContextDefinition';
import {
  buildAttendanceRecords,
  buildAttendanceDataset,
} from '../models/attendance';
import type { AttendanceDataset, AttendanceRecord } from '../models/attendance';
import { getWeekdayForDate, getSubjectsForDate } from '../utils/calendar';
import { storageManager } from '../storage';
import type { StorageSaveResult } from '../storage';
import { loadPersistedRoster, savePersistedRoster } from '../utils/rosterStorage';

const syncPeopleToMembers = (people: Person[]): Student[] => {
  return people.map((p, index) => ({
    id: p.id || `person_${index + 1}`,
    rollNo: p.rollNumber || `ID-${index + 1}`,
    name: p.name || `Person ${index + 1}`,
    email: p.email || '',
    group: 'General',
    isActive: true,
  }));
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const now = new Date();
const currentYear = now.getFullYear();
const currentMonthIdx = now.getMonth();
const currentDay = now.getDate();
const initialMonthStr = `${MONTH_NAMES[currentMonthIdx]} ${currentYear}`;
const initialStartDateStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

const initialPersistedRoster = loadPersistedRoster();

const loadPersistedNoClassDates = (): string[] => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem('attendly_no_class_dates');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const savePersistedNoClassDates = (dates: string[]) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem('attendly_no_class_dates', JSON.stringify(dates));
  } catch {
    // ignore
  }
};

const loadPersistedHolidayReasons = (): Record<string, string> => {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem('attendly_holiday_reasons');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const savePersistedHolidayReasons = (reasons: Record<string, string>) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem('attendly_holiday_reasons', JSON.stringify(reasons));
  } catch {
    // ignore
  }
};

const initialPersistedNoClassDates = loadPersistedNoClassDates();
const initialPersistedHolidayReasons = loadPersistedHolidayReasons();

const INITIAL_STATE: AppSessionState = {
  appPhase: 'setup',
  activeTab: 'attendance',
  activeDate: initialStartDateStr,
  storageMode: 'excel',
  peopleCount: initialPersistedRoster.length > 0 ? initialPersistedRoster.length : null,
  people: initialPersistedRoster,
  sourceName: 'Rollvia Attendance',
  sourceType: 'local',
  institutionName: '',
  departmentName: '',
  academicYear: `${currentYear}`,
  selectedMonth: initialMonthStr,
  selectedYear: currentYear,
  selectedMonthIndex: currentMonthIdx,
  startDate: initialStartDateStr,
  startDayNumber: currentDay,
  workingDaysCount: 22,
  minimumAttendanceThreshold: 75,
  weeklyTimetable: INITIAL_WEEKLY_TIMETABLE,
  classes: [],
  savedDailyAttendance: {},
  savedDates: [],
  noClassDates: initialPersistedNoClassDates,
  holidayReasons: initialPersistedHolidayReasons,
  attendanceRecords: [],
  personAttendance: {},
  excelFilePath: undefined,
  excelFileName: 'Rollvia_Attendance.xlsx',
  googleSpreadsheetId: undefined,
  googleSpreadsheetUrl: undefined,
  googleSpreadsheetTitle: undefined,
  googleUserEmail: undefined,
  googleIsAuthenticated: false,
  members: syncPeopleToMembers(initialPersistedRoster),
  attendance: {},
};

export const FlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [sessionState, setSessionState] = useState<AppSessionState>(INITIAL_STATE);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({
    isAuthenticated: false,
    authType: null,
    userEmail: null,
    spreadsheetId: null,
    spreadsheetUrl: null,
    spreadsheetTitle: null,
    hasClientCredentials: false,
  });

  // ─── Google Status ───────────────────────────────────────────────────────────

  const refreshGoogleStatus = useCallback(async (): Promise<GoogleStatus> => {
    if (typeof window !== 'undefined' && window.electronAPI?.googleSheetsGetStatus) {
      try {
        const status = await window.electronAPI.googleSheetsGetStatus();
        setGoogleStatus(status);
        setSessionState((prev) => ({
          ...prev,
          googleSpreadsheetId: status.spreadsheetId || undefined,
          googleSpreadsheetUrl: status.spreadsheetUrl || undefined,
          googleSpreadsheetTitle: status.spreadsheetTitle || undefined,
          googleUserEmail: status.userEmail || undefined,
          googleIsAuthenticated: status.isAuthenticated,
        }));
        return status;
      } catch {
        // ignore
      }
    }
    return {
      isAuthenticated: false,
      authType: null,
      userEmail: null,
      spreadsheetId: null,
      spreadsheetUrl: null,
      spreadsheetTitle: null,
      hasClientCredentials: false,
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initStatus = async () => {
      if (typeof window !== 'undefined' && window.electronAPI?.googleSheetsGetStatus) {
        try {
          const status = await window.electronAPI.googleSheetsGetStatus();
          if (!isMounted) return;
          setGoogleStatus(status);
          setSessionState((prev) => ({
            ...prev,
            googleSpreadsheetId: status.spreadsheetId || undefined,
            googleSpreadsheetUrl: status.spreadsheetUrl || undefined,
            googleSpreadsheetTitle: status.spreadsheetTitle || undefined,
            googleUserEmail: status.userEmail || undefined,
            googleIsAuthenticated: status.isAuthenticated,
          }));
        } catch {
          // ignore
        }
      }
    };
    void initStatus();
    return () => { isMounted = false; };
  }, []);

  // ─── Google Auth ──────────────────────────────────────────────────────────────

  const connectGoogleOAuth = async (clientId?: string, clientSecret?: string) => {
    if (typeof window !== 'undefined' && window.electronAPI?.googleSheetsStartOAuth) {
      const res = await window.electronAPI.googleSheetsStartOAuth(clientId, clientSecret);
      await refreshGoogleStatus();
      return res;
    }
    return { success: false, error: 'Google OAuth not available in browser' };
  };

  const cancelGoogleOAuth = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.googleSheetsCancelOAuth) {
      await window.electronAPI.googleSheetsCancelOAuth();
      await refreshGoogleStatus();
    }
  };

  const connectGoogleToken = async (token: string) => {
    if (typeof window !== 'undefined' && window.electronAPI?.googleSheetsSetToken) {
      const res = await window.electronAPI.googleSheetsSetToken(token);
      await refreshGoogleStatus();
      return res;
    }
    return { success: false, error: 'Google integration not available in browser' };
  };

  const connectGoogleServiceAccount = async (jsonContent: string) => {
    if (typeof window !== 'undefined' && window.electronAPI?.googleSheetsSetServiceAccount) {
      const res = await window.electronAPI.googleSheetsSetServiceAccount(jsonContent);
      await refreshGoogleStatus();
      return res;
    }
    return { success: false, error: 'Google integration not available in browser' };
  };

  const disconnectGoogle = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.googleSheetsDisconnect) {
      await window.electronAPI.googleSheetsDisconnect();
      await refreshGoogleStatus();
    }
  };

  const setGoogleSpreadsheet = async (idOrUrl: string) => {
    if (typeof window !== 'undefined' && window.electronAPI?.googleSheetsSetSpreadsheet) {
      const res = await window.electronAPI.googleSheetsSetSpreadsheet(idOrUrl);
      if (res.success) {
        setSessionState((prev) => ({
          ...prev,
          googleSpreadsheetId: res.spreadsheetId,
          googleSpreadsheetTitle: res.title,
          googleSpreadsheetUrl: res.spreadsheetUrl,
          sourceName: `Google Sheet: ${res.title}`,
        }));
        await refreshGoogleStatus();
      }
      return res;
    }
    return { success: false, error: 'Google integration not available in browser' };
  };

  const createGoogleSpreadsheet = async (title?: string) => {
    if (typeof window !== 'undefined' && window.electronAPI?.googleSheetsCreateSpreadsheet) {
      const res = await window.electronAPI.googleSheetsCreateSpreadsheet(title);
      if (res.success) {
        setSessionState((prev) => ({
          ...prev,
          googleSpreadsheetId: res.spreadsheetId,
          googleSpreadsheetTitle: res.title,
          googleSpreadsheetUrl: res.spreadsheetUrl,
          sourceName: `Google Sheet: ${res.title}`,
        }));
        await refreshGoogleStatus();
      }
      return res;
    }
    return { success: false, error: 'Google integration not available in browser' };
  };

  // ─── Session State ────────────────────────────────────────────────────────────

  const updateSessionState = (updater: Partial<AppSessionState>) => {
    setSessionState((prev) => ({ ...prev, ...updater }));
  };

  // ─── Workspace Phase ──────────────────────────────────────────────────────────

  const enterWorkspace = () => {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();

    setSessionState((prev) => {
      let initialDate = prev.startDate;
      if (!initialDate) {
        if (prev.selectedYear === todayYear && prev.selectedMonthIndex === todayMonth) {
          initialDate = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;
        } else {
          const day = prev.startDayNumber || 1;
          initialDate = `${prev.selectedYear}-${String(prev.selectedMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }

      return {
        ...prev,
        appPhase: 'workspace',
        activeDate: initialDate,
        activeTab: 'attendance',
      };
    });
  };

  const setActiveTab = (tab: WorkspaceTab) => {
    setSessionState((prev) => ({ ...prev, activeTab: tab }));
  };

  const setActiveDate = (date: string) => {
    const parts = date.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const year = parts[0];
      const monthIndex = parts[1] - 1;
      const monthName = MONTH_NAMES[monthIndex] || '';
      setSessionState((prev) => ({
        ...prev,
        activeDate: date,
        selectedYear: year,
        selectedMonthIndex: monthIndex,
        selectedMonth: `${monthName} ${year}`,
      }));
    } else {
      setSessionState((prev) => ({ ...prev, activeDate: date }));
    }
  };

  const setWorkspaceMonth = (year: number, monthIndex: number) => {
    const monthName = MONTH_NAMES[monthIndex] || '';
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
    const day = isCurrentMonth ? today.getDate() : 1;
    const newActiveDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    setSessionState((prev) => ({
      ...prev,
      selectedYear: year,
      selectedMonthIndex: monthIndex,
      selectedMonth: `${monthName} ${year}`,
      activeDate: newActiveDate,
    }));
  };

  // ─── Storage Mode ─────────────────────────────────────────────────────────────

  const setStorageMode = (mode: StorageMode) => {
    setSessionState((prev) => ({
      ...prev,
      storageMode: mode,
      sourceName: mode === 'google_sheets'
        ? (prev.googleSpreadsheetTitle ? `Google Sheet: ${prev.googleSpreadsheetTitle}` : 'Google Sheets')
        : (prev.excelFileName ? `Excel: ${prev.excelFileName}` : 'Excel Workbook'),
    }));
  };

  // ─── People ───────────────────────────────────────────────────────────────────

  const setPeopleCount = (count: number) => {
    setSessionState((prev) => {
      const currentPeople = prev.people || [];
      const newPeople: Person[] = [];
      for (let i = 0; i < count; i++) {
        if (i < currentPeople.length) {
          newPeople.push(currentPeople[i]);
        } else {
          newPeople.push({
            id: `p_${Date.now()}_${i + 1}`,
            name: '',
            rollNumber: '',
            phone: '',
            email: '',
          });
        }
      }
      savePersistedRoster(newPeople);
      return {
        ...prev,
        peopleCount: count,
        people: newPeople,
        members: syncPeopleToMembers(newPeople),
      };
    });
  };

  const setPeople = (people: Person[]) => {
    savePersistedRoster(people);
    setSessionState((prev) => ({
      ...prev,
      people,
      peopleCount: people.length,
      members: syncPeopleToMembers(people),
    }));
  };

  const updatePerson = (index: number, personData: Partial<Person>) => {
    setSessionState((prev) => {
      const updated = [...prev.people];
      if (index >= 0 && index < updated.length) {
        const oldPerson = updated[index];
        const updatedPerson = { ...oldPerson, ...personData };
        updated[index] = updatedPerson;

        // Maintain attendance records sync so edited names and roll numbers do not lose or desync historical attendance
        let updatedRecords = prev.attendanceRecords;
        if (personData.name !== undefined || personData.rollNumber !== undefined) {
          const newName = updatedPerson.name;
          const newRoll = updatedPerson.rollNumber;
          updatedRecords = (prev.attendanceRecords || []).map((r) => {
            if (r.personId === oldPerson.id) {
              return {
                ...r,
                personName: newName,
                rollNumber: newRoll,
              };
            }
            return r;
          });
        }

        savePersistedRoster(updated);

        return {
          ...prev,
          people: updated,
          members: syncPeopleToMembers(updated),
          attendanceRecords: updatedRecords,
        };
      }
      return prev;
    });
  };

  const addPerson = () => {
    setSessionState((prev) => {
      const newPerson: Person = {
        id: `p_${Date.now()}_${prev.people.length + 1}`,
        name: '',
        rollNumber: '',
        phone: '',
        email: '',
      };
      const updated = [...prev.people, newPerson];
      // Only persist students that have valid name + rollNumber; blank draft rows are not saved
      const validForPersistence = updated.filter((p) => p.name.trim() && p.rollNumber.trim());
      savePersistedRoster(validForPersistence);
      return {
        ...prev,
        people: updated,
        peopleCount: updated.length,
        members: syncPeopleToMembers(updated),
      };
    });
  };

  const deletePerson = (index: number) => {
    setSessionState((prev) => {
      const updated = prev.people.filter((_, i) => i !== index);
      savePersistedRoster(updated);
      return {
        ...prev,
        people: updated,
        peopleCount: updated.length,
        members: syncPeopleToMembers(updated),
      };
    });
  };

  const importStudents = (
    newStudents: Array<{ name: string; rollNumber: string; phone?: string; email?: string }>,
    options: ImportStudentsOptions = {}
  ): ImportStudentsResult => {
    const updateExisting = Boolean(options.updateExisting);
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    setSessionState((prev) => {
      const existingList = [...(prev.people || [])];
      const rollMap = new Map<string, number>();
      existingList.forEach((p, idx) => {
        if (p.rollNumber) {
          rollMap.set(p.rollNumber.trim().toLowerCase(), idx);
        }
      });

      const updatedPeople = [...existingList];
      let updatedRecords = prev.attendanceRecords ? [...prev.attendanceRecords] : [];
      let recordsModified = false;

      for (const student of newStudents) {
        const name = String(student.name || '').trim();
        const roll = String(student.rollNumber || '').trim();
        const phone = student.phone ? String(student.phone).trim() : '';
        const email = student.email ? String(student.email).trim() : '';

        if (!name || !roll) {
          skippedCount++;
          continue;
        }

        const rollKey = roll.toLowerCase();
        if (rollMap.has(rollKey)) {
          if (updateExisting) {
            const idx = rollMap.get(rollKey)!;
            const oldPerson = updatedPeople[idx];
            const updatedPerson: Person = {
              ...oldPerson,
              name,
              rollNumber: roll,
              phone: phone || oldPerson.phone || '',
              email: email || oldPerson.email || '',
            };
            updatedPeople[idx] = updatedPerson;
            updatedCount++;

            // Keep attendance records in sync with new name/roll without losing marks
            for (let rIdx = 0; rIdx < updatedRecords.length; rIdx++) {
              if (updatedRecords[rIdx].personId === oldPerson.id) {
                updatedRecords[rIdx] = {
                  ...updatedRecords[rIdx],
                  personName: name,
                  rollNumber: roll,
                };
                recordsModified = true;
              }
            }
          } else {
            skippedCount++;
          }
        } else {
          const newPerson: Person = {
            id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${updatedPeople.length + 1}`,
            name,
            rollNumber: roll,
            phone,
            email,
          };
          rollMap.set(rollKey, updatedPeople.length);
          updatedPeople.push(newPerson);
          addedCount++;
        }
      }

      savePersistedRoster(updatedPeople);

      return {
        ...prev,
        people: updatedPeople,
        peopleCount: updatedPeople.length,
        members: syncPeopleToMembers(updatedPeople),
        attendanceRecords: recordsModified ? updatedRecords : prev.attendanceRecords,
      };
    });

    return { addedCount, updatedCount, skippedCount };
  };

  // ─── Date Setup ───────────────────────────────────────────────────────────────

  const setDateSetup = (year: number, monthIndex: number, dayNumber: number) => {
    const monthName = MONTH_NAMES[monthIndex];
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    setSessionState((prev) => ({
      ...prev,
      selectedYear: year,
      selectedMonthIndex: monthIndex,
      selectedMonth: `${monthName} ${year}`,
      startDate: dateStr,
      startDayNumber: dayNumber,
    }));
  };

  // ─── Timetable ────────────────────────────────────────────────────────────────

  const addTimetableSubject = (day: Weekday, name: string): { success: boolean; error?: string } => {
    const trimmed = name.trim();
    if (!trimmed) return { success: false, error: 'Subject name cannot be empty.' };
    const currentTable = sessionState.weeklyTimetable || INITIAL_WEEKLY_TIMETABLE;
    const existingOnDay = currentTable[day] || [];
    if (existingOnDay.some((s) => s.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, error: `"${trimmed}" already exists for ${day}.` };
    }
    const newSubject = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
    };
    setSessionState((prev) => ({
      ...prev,
      weeklyTimetable: {
        ...(prev.weeklyTimetable || INITIAL_WEEKLY_TIMETABLE),
        [day]: [...existingOnDay, newSubject],
      },
    }));
    return { success: true };
  };

  const updateTimetableSubject = (day: Weekday, id: string, name: string): { success: boolean; error?: string } => {
    const trimmed = name.trim();
    if (!trimmed) return { success: false, error: 'Subject name cannot be empty.' };
    const currentTable = sessionState.weeklyTimetable || INITIAL_WEEKLY_TIMETABLE;
    const existingOnDay = currentTable[day] || [];
    if (existingOnDay.some((s) => s.id !== id && s.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, error: `"${trimmed}" already exists for ${day}.` };
    }
    setSessionState((prev) => ({
      ...prev,
      weeklyTimetable: {
        ...(prev.weeklyTimetable || INITIAL_WEEKLY_TIMETABLE),
        [day]: existingOnDay.map((s) => (s.id === id ? { ...s, name: trimmed } : s)),
      },
    }));
    return { success: true };
  };

  const deleteTimetableSubject = (day: Weekday, id: string) => {
    const currentTable = sessionState.weeklyTimetable || INITIAL_WEEKLY_TIMETABLE;
    const existingOnDay = currentTable[day] || [];
    setSessionState((prev) => ({
      ...prev,
      weeklyTimetable: {
        ...(prev.weeklyTimetable || INITIAL_WEEKLY_TIMETABLE),
        [day]: existingOnDay.filter((s) => s.id !== id),
      },
    }));
  };

  // ─── Legacy class methods ─────────────────────────────────────────────────────

  const addClass = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase();
    const currentClasses = sessionState.classes || [];
    if (currentClasses.some((c) => c.name.trim().toLowerCase() === normalized)) return;
    const newClass: ClassSession = {
      id: `cls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      code: trimmed.toUpperCase().replace(/\s+/g, '-').slice(0, 8),
      instructor: '',
      timeSlot: '',
      room: '',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      totalEnrolled: sessionState.people.length || 0,
    };
    setSessionState((prev) => ({ ...prev, classes: [...(prev.classes || []), newClass] }));
  };

  const updateClass = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSessionState((prev) => ({
      ...prev,
      classes: (prev.classes || []).map((c) =>
        c.id === id ? { ...c, name: trimmed, code: trimmed.toUpperCase().replace(/\s+/g, '-').slice(0, 8) } : c
      ),
    }));
  };

  const deleteClass = (id: string) => {
    setSessionState((prev) => ({ ...prev, classes: (prev.classes || []).filter((c) => c.id !== id) }));
  };

  const setClasses = (classes: ClassSession[]) => {
    setSessionState((prev) => ({ ...prev, classes }));
  };

  // ─── Helper: resolve subjects for a date as ClassSession[] ───────────────────

  const getScheduledClassesForDate = useCallback(
    (dateStr: string, timetable?: WeeklyTimetable, fallbackClasses: ClassSession[] = []): ClassSession[] => {
      const tb = timetable || INITIAL_WEEKLY_TIMETABLE;
      const scheduled = getSubjectsForDate(dateStr, tb);
      if (scheduled.length > 0) {
        const weekday = getWeekdayForDate(dateStr);
        return scheduled.map((sub) => ({
          id: sub.id,
          code: sub.name.toUpperCase().replace(/\s+/g, '-').slice(0, 8),
          name: sub.name,
          instructor: '',
          timeSlot: '',
          room: '',
          days: [weekday],
          totalEnrolled: sessionState.people.length || 0,
        }));
      }
      return fallbackClasses;
    },
    [sessionState.people.length]
  );

  // ─── Workspace: Multi-date attendance ────────────────────────────────────────

  const saveDailyAttendance = (dateStr: string, personAttendanceMap: Record<string, Record<string, boolean>>) => {
    setSessionState((prev) => {
      const updatedMap = {
        ...(prev.savedDailyAttendance || {}),
        [dateStr]: personAttendanceMap,
      };

      // Build flat AttendanceRecord[] from this date's data
      const activeClasses = getScheduledClassesForDate(dateStr, prev.weeklyTimetable, prev.classes || []);
      const newRecords = buildAttendanceRecords({
        date: dateStr,
        people: prev.people,
        classes: activeClasses,
        personAttendance: personAttendanceMap,
      });

      // Merge with existing records (remove old ones for this date, add new)
      const existingOtherRecords = (prev.attendanceRecords || []).filter((r) => r.date !== dateStr);
      const mergedRecords = [...existingOtherRecords, ...newRecords];

      return {
        ...prev,
        savedDailyAttendance: updatedMap,
        attendanceRecords: mergedRecords,
        // Also update the legacy compat field for the current date
        personAttendance: personAttendanceMap,
        startDate: dateStr,
      };
    });
  };

  const getDailyAttendance = (dateStr: string): Record<string, Record<string, boolean>> => {
    return sessionState.savedDailyAttendance?.[dateStr] || {};
  };

  const isDateSaved = (dateStr: string): boolean => {
    return Boolean(sessionState.savedDates && sessionState.savedDates.includes(dateStr));
  };

  const isNoClassDate = (dateStr: string): boolean => {
    return Boolean(sessionState.noClassDates && sessionState.noClassDates.includes(dateStr));
  };

  const getHolidayReason = (dateStr: string): string | undefined => {
    return sessionState.holidayReasons?.[dateStr];
  };

  const markDateAsHoliday = (dateStr: string, reason?: string) => {
    setSessionState((prev) => {
      const currentDates = prev.noClassDates || [];
      const updatedDates = currentDates.includes(dateStr) ? currentDates : [...currentDates, dateStr];
      const holidayLabel = reason?.trim() || 'Holiday / No Classes';
      const updatedReasons = {
        ...(prev.holidayReasons || {}),
        [dateStr]: holidayLabel,
      };

      // A holiday must NOT create attendance records or increase total classes or reduce percentage.
      // Purge any attendance records and saved daily marks for this date
      const updatedRecords = (prev.attendanceRecords || []).filter((r) => r.date !== dateStr);
      const updatedSavedDates = (prev.savedDates || []).filter((d) => d !== dateStr);
      const updatedDailyMap = { ...(prev.savedDailyAttendance || {}) };
      delete updatedDailyMap[dateStr];

      savePersistedNoClassDates(updatedDates);
      savePersistedHolidayReasons(updatedReasons);

      return {
        ...prev,
        noClassDates: updatedDates,
        holidayReasons: updatedReasons,
        attendanceRecords: updatedRecords,
        savedDates: updatedSavedDates,
        savedDailyAttendance: updatedDailyMap,
      };
    });
  };

  const removeDateHoliday = (dateStr: string) => {
    setSessionState((prev) => {
      const currentDates = prev.noClassDates || [];
      const updatedDates = currentDates.filter((d) => d !== dateStr);
      const updatedReasons = { ...(prev.holidayReasons || {}) };
      delete updatedReasons[dateStr];

      savePersistedNoClassDates(updatedDates);
      savePersistedHolidayReasons(updatedReasons);

      return {
        ...prev,
        noClassDates: updatedDates,
        holidayReasons: updatedReasons,
      };
    });
  };

  const toggleNoClassDate = (dateStr: string, reason?: string) => {
    if (isNoClassDate(dateStr)) {
      removeDateHoliday(dateStr);
    } else {
      markDateAsHoliday(dateStr, reason);
    }
  };

  const restoreWorkspaceBackup = (backupData: unknown): { success: boolean; error?: string } => {
    if (!backupData || typeof backupData !== 'object') {
      return { success: false, error: 'Invalid backup file format: not a valid JSON object.' };
    }
    const data = backupData as Record<string, unknown>;

    // Validate that it has at least students, timetable, or attendance
    const hasPeople = Array.isArray(data.people);
    const hasTimetable = data.weeklyTimetable && typeof data.weeklyTimetable === 'object';
    const hasAttendance = data.savedDailyAttendance && typeof data.savedDailyAttendance === 'object';

    if (!hasPeople && !hasTimetable && !hasAttendance) {
      return {
        success: false,
        error: 'Backup validation failed: missing students, timetable, and attendance records.',
      };
    }

    if (hasPeople) {
      const invalidPerson = (data.people as unknown[]).some(
        (p) => !p || typeof p !== 'object' || typeof (p as Record<string, unknown>).name !== 'string'
      );
      if (invalidPerson) {
        return { success: false, error: 'Backup validation failed: student records are corrupted.' };
      }
    }

    try {
      setSessionState((prev) => {
        const newPeople: Person[] = hasPeople ? (data.people as Person[]) : prev.people;
        const newTimetable: WeeklyTimetable = hasTimetable
          ? (data.weeklyTimetable as WeeklyTimetable)
          : (prev.weeklyTimetable || INITIAL_WEEKLY_TIMETABLE);
        const newDailyAttendance: DailyAttendanceMap = hasAttendance
          ? (data.savedDailyAttendance as DailyAttendanceMap)
          : (prev.savedDailyAttendance || {});
        const newSavedDates: string[] = Array.isArray(data.savedDates)
          ? (data.savedDates as string[])
          : prev.savedDates;
        const newNoClassDates: string[] = Array.isArray(data.noClassDates)
          ? (data.noClassDates as string[])
          : (prev.noClassDates || []);
        const newHolidayReasons: Record<string, string> =
          data.holidayReasons && typeof data.holidayReasons === 'object' && !Array.isArray(data.holidayReasons)
            ? (data.holidayReasons as Record<string, string>)
            : (prev.holidayReasons || {});
        const newRecords: AttendanceRecord[] = Array.isArray(data.attendanceRecords)
          ? (data.attendanceRecords as AttendanceRecord[])
          : (prev.attendanceRecords || []);
        const newClasses: ClassSession[] = Array.isArray(data.classes)
          ? (data.classes as ClassSession[])
          : prev.classes;

        // Persist critical roster & holidays
        savePersistedRoster(newPeople);
        savePersistedNoClassDates(newNoClassDates);
        savePersistedHolidayReasons(newHolidayReasons);

        return {
          ...prev,
          people: newPeople,
          peopleCount: newPeople.length,
          members: syncPeopleToMembers(newPeople),
          weeklyTimetable: newTimetable,
          savedDailyAttendance: newDailyAttendance,
          savedDates: newSavedDates,
          noClassDates: newNoClassDates,
          holidayReasons: newHolidayReasons,
          attendanceRecords: newRecords,
          classes: newClasses,
          ...(typeof data.institutionName === 'string' ? { institutionName: data.institutionName } : {}),
          ...(typeof data.departmentName === 'string' ? { departmentName: data.departmentName } : {}),
          ...(typeof data.academicYear === 'string' ? { academicYear: data.academicYear } : {}),
          ...(typeof data.selectedMonth === 'string' ? { selectedMonth: data.selectedMonth } : {}),
          ...(typeof data.selectedYear === 'number' ? { selectedYear: data.selectedYear } : {}),
          ...(typeof data.selectedMonthIndex === 'number' ? { selectedMonthIndex: data.selectedMonthIndex } : {}),
          ...(typeof data.startDate === 'string' ? { startDate: data.startDate, activeDate: data.startDate } : {}),
        };
      });
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to apply backup.';
      return { success: false, error: msg };
    }
  };

  const getMonthAttendanceRecords = (year: number, monthIndex: number): AttendanceRecord[] => {
    const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
    const holidays = new Set(sessionState.noClassDates || []);
    return (sessionState.attendanceRecords || []).filter(
      (r) => r.date.startsWith(prefix) && !holidays.has(r.date)
    );
  };

  // ─── Legacy: single-date attendance ──────────────────────────────────────────

  const savePersonAttendance = (personId: string, classAttendance: Record<string, boolean>) => {
    setSessionState((prev) => {
      const activeDate = prev.activeDate || prev.startDate;
      const existingDayData = prev.savedDailyAttendance?.[activeDate] || {};
      const updatedDayData = { ...existingDayData, [personId]: classAttendance };
      const updatedMap = { ...(prev.savedDailyAttendance || {}), [activeDate]: updatedDayData };

      const activeClasses = getScheduledClassesForDate(activeDate, prev.weeklyTimetable, prev.classes || []);
      const newRecords = buildAttendanceRecords({
        date: activeDate,
        people: prev.people,
        classes: activeClasses,
        personAttendance: updatedDayData,
      });
      const existingOtherRecords = (prev.attendanceRecords || []).filter((r) => r.date !== activeDate);
      const mergedRecords = [...existingOtherRecords, ...newRecords];

      const allValues = Object.values(classAttendance);
      const isAllPresent = allValues.length > 0 && allValues.every(Boolean);
      const isAnyPresent = allValues.some(Boolean);

      return {
        ...prev,
        savedDailyAttendance: updatedMap,
        personAttendance: { ...(prev.personAttendance || {}), [personId]: classAttendance },
        attendanceRecords: mergedRecords,
        attendance: {
          ...(prev.attendance || {}),
          [personId]: {
            studentId: personId,
            status: isAllPresent ? 'present' : isAnyPresent ? 'late' : 'absent',
          },
        },
      };
    });
  };

  const getAttendanceDataset = (): AttendanceDataset => {
    const mode = sessionState.storageMode || 'excel';
    const activeDate = sessionState.activeDate || sessionState.startDate;
    const formattedDate = activeDate;

    const activeClasses = getScheduledClassesForDate(
      activeDate,
      sessionState.weeklyTimetable,
      sessionState.classes || []
    );

    const personAttendanceForDate = sessionState.savedDailyAttendance?.[activeDate] || sessionState.personAttendance || {};

    const dateParts = activeDate.split('-').map(Number);
    const dateYear = !isNaN(dateParts[0]) ? dateParts[0] : sessionState.selectedYear;
    const dateMonthIdx = !isNaN(dateParts[1]) ? dateParts[1] - 1 : sessionState.selectedMonthIndex;
    const dateMonthStr = `${MONTH_NAMES[dateMonthIdx] || 'September'} ${dateYear}`;

    return buildAttendanceDataset({
      storageMode: mode,
      date: activeDate,
      formattedDate,
      people: sessionState.people,
      classes: activeClasses,
      personAttendance: personAttendanceForDate,
      metadata: {
        institutionName: sessionState.institutionName,
        departmentName: sessionState.departmentName,
        academicYear: sessionState.academicYear || String(dateYear),
        sourceType: sessionState.sourceName,
        filePath: sessionState.excelFilePath,
        weeklyTimetable: sessionState.weeklyTimetable,
        selectedMonth: dateMonthStr,
        selectedYear: dateYear,
        selectedMonthIndex: dateMonthIdx,
      },
    });
  };

  // ─── Storage Save ─────────────────────────────────────────────────────────────

  const saveToStorage = async (customFilePath?: string): Promise<StorageSaveResult> => {
    const dataset = getAttendanceDataset();
    const targetPath = customFilePath || sessionState.excelFilePath;
    const result = await storageManager.saveAttendance(dataset, targetPath);
    if (result.success && result.destination && sessionState.storageMode === 'excel') {
      setSessionState((prev) => ({
        ...prev,
        excelFilePath: result.destination,
        excelFileName: result.destination?.split(/[/\\]/).pop(),
      }));
    }
    return result;
  };

  const saveDateToStorage = async (
    dateStr: string,
    attendanceData?: Record<string, Record<string, boolean>>
  ): Promise<StorageSaveResult> => {
    const mode = sessionState.storageMode || 'excel';
    const activeClasses = getScheduledClassesForDate(dateStr, sessionState.weeklyTimetable, sessionState.classes || []);
    const personAttendanceForDate = attendanceData ?? sessionState.savedDailyAttendance?.[dateStr] ?? {};

    const dateParts = dateStr.split('-').map(Number);
    const dateYear = !isNaN(dateParts[0]) ? dateParts[0] : sessionState.selectedYear;
    const dateMonthIdx = !isNaN(dateParts[1]) ? dateParts[1] - 1 : sessionState.selectedMonthIndex;
    const dateMonthStr = `${MONTH_NAMES[dateMonthIdx] || 'September'} ${dateYear}`;

    const dataset = buildAttendanceDataset({
      storageMode: mode,
      date: dateStr,
      formattedDate: dateStr,
      people: sessionState.people,
      classes: activeClasses,
      personAttendance: personAttendanceForDate,
      metadata: {
        institutionName: sessionState.institutionName,
        departmentName: sessionState.departmentName,
        academicYear: sessionState.academicYear || String(dateYear),
        filePath: sessionState.excelFilePath,
        weeklyTimetable: sessionState.weeklyTimetable,
        selectedMonth: dateMonthStr,
        selectedYear: dateYear,
        selectedMonthIndex: dateMonthIdx,
      },
    });

    const result = await storageManager.saveAttendance(dataset, sessionState.excelFilePath);
    if (result.success) {
      setSessionState((prev) => {
        const updatedMap = {
          ...(prev.savedDailyAttendance || {}),
          [dateStr]: personAttendanceForDate,
        };

        const newRecords = buildAttendanceRecords({
          date: dateStr,
          people: prev.people,
          classes: activeClasses,
          personAttendance: personAttendanceForDate,
        });
        const existingOtherRecords = (prev.attendanceRecords || []).filter((r) => r.date !== dateStr);
        const mergedRecords = [...existingOtherRecords, ...newRecords];

        return {
          ...prev,
          savedDailyAttendance: updatedMap,
          attendanceRecords: mergedRecords,
          savedDates: Array.from(new Set([...(prev.savedDates || []), dateStr])),
          ...(result.destination && mode === 'excel' ? {
            excelFilePath: result.destination,
            excelFileName: result.destination.split(/[/\\]/).pop(),
          } : {}),
        };
      });
    }
    return result;
  };

  // ─── Excel ────────────────────────────────────────────────────────────────────

  const setExcelFilePath = (filePath: string) => {
    const fileName = filePath.split(/[/\\]/).pop() || 'Attendance.xlsx';
    setSessionState((prev) => ({ ...prev, excelFilePath: filePath, excelFileName: fileName }));
  };

  const selectExistingExcelWorkbook = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.selectExcelFile) {
      const res = await window.electronAPI.selectExcelFile();
      if (res.canceled || !res.filePath) return { canceled: true };
      const filePath = res.filePath;
      const fileName = filePath.split(/[/\\]/).pop() || 'Attendance.xlsx';
      const readRes = await storageManager.readExistingWorkbook(filePath);
      if (!readRes.success) {
        return { canceled: false, error: readRes.error || readRes.message };
      }

      // Reconstruct people, saved dates, and savedDailyAttendance from records
      const uniqueDates = Array.from(new Set(readRes.records.map((r) => r.date))).sort();

      setSessionState((prev) => {
        // Map from existing roster to preserve internal IDs when possible
        const prevByRoll = new Map<string, Person>();
        const prevByName = new Map<string, Person>();
        for (const p of prev.people || []) {
          if (p.rollNumber) prevByRoll.set(p.rollNumber.trim().toLowerCase(), p);
          if (p.name) prevByName.set(p.name.trim().toLowerCase(), p);
        }

        const peopleMap = new Map<string, Person>();
        for (const p of prev.people || []) {
          peopleMap.set(p.id, p);
        }

        const loadedDailyAttendance: Record<string, Record<string, Record<string, boolean>>> = {};

        for (const rec of readRes.records) {
          const matched =
            (rec.rollNumber && prevByRoll.get(rec.rollNumber.trim().toLowerCase())) ||
            (rec.personName && prevByName.get(rec.personName.trim().toLowerCase()));

          const studentId = matched ? matched.id : rec.personId;
          const studentRoll = matched ? matched.rollNumber : (rec.rollNumber || rec.personId);
          const studentName = matched ? matched.name : rec.personName;

          if (!peopleMap.has(studentId)) {
            peopleMap.set(studentId, {
              id: studentId,
              name: studentName,
              rollNumber: studentRoll,
            });
          }

          if (!loadedDailyAttendance[rec.date]) {
            loadedDailyAttendance[rec.date] = {};
          }
          if (!loadedDailyAttendance[rec.date][studentId]) {
            loadedDailyAttendance[rec.date][studentId] = {};
          }
          const isPresent = rec.status === 'Present';
          loadedDailyAttendance[rec.date][studentId][rec.className] = isPresent;
        }

        const loadedPeople = Array.from(peopleMap.values());
        const mergedDaily: Record<string, Record<string, Record<string, boolean>>> = {
          ...(prev.savedDailyAttendance || {}),
        };

        const tb = prev.weeklyTimetable || INITIAL_WEEKLY_TIMETABLE;
        for (const dateStr of uniqueDates) {
          mergedDaily[dateStr] = { ...(mergedDaily[dateStr] || {}), ...(loadedDailyAttendance[dateStr] || {}) };
          const scheduledSubs = getSubjectsForDate(dateStr, tb);
          for (const p of loadedPeople) {
            const pDay = mergedDaily[dateStr]?.[p.id];
            if (pDay) {
              for (const sub of scheduledSubs) {
                if (pDay[sub.name] !== undefined) {
                  pDay[sub.id] = pDay[sub.name];
                }
              }
            }
          }
        }

        if (readRes.roster && readRes.roster.length > 0) {
          for (const ros of readRes.roster) {
            const existing = peopleMap.get(ros.id);
            if (existing) {
              peopleMap.set(ros.id, {
                ...existing,
                name: ros.name || existing.name,
                rollNumber: ros.rollNumber || existing.rollNumber,
                phone: ros.phone || existing.phone,
                email: ros.email || existing.email,
              });
            } else {
              peopleMap.set(ros.id, ros);
            }
          }
        }

        const updatedPeople = loadedPeople.length > 0 ? loadedPeople : prev.people;
        savePersistedRoster(updatedPeople);
        const mergedDates = Array.from(new Set([...(prev.savedDates || []), ...uniqueDates]));

        return {
          ...prev,
          storageMode: 'excel',
          excelFilePath: filePath,
          excelFileName: fileName,
          excelExistingRecordsCount: readRes.records.length,
          excelWorkbookSheets: readRes.sheetNames,
          people: updatedPeople,
          peopleCount: updatedPeople.length,
          members: syncPeopleToMembers(updatedPeople),
          savedDates: mergedDates,
          savedDailyAttendance: mergedDaily,
          attendanceRecords: readRes.records,
        };
      });

      return { canceled: false, filePath, recordsCount: readRes.records.length };
    }
    return { canceled: true, error: 'File dialog not available' };
  };

  const createNewExcelWorkbook = async (defaultName?: string) => {
    if (typeof window !== 'undefined' && window.electronAPI?.saveExcelDialog) {
      const suggested = defaultName || `Rollvia_Attendance_${sessionState.selectedYear}_${String(sessionState.selectedMonthIndex + 1).padStart(2, '0')}.xlsx`;
      const res = await window.electronAPI.saveExcelDialog(suggested);
      if (res.canceled || !res.filePath) return { canceled: true };
      const filePath = res.filePath;

      // Physically create workbook immediately and verify!
      const createRes = await storageManager.createNewWorkbook(filePath);
      if (!createRes.success) {
        return { canceled: false, error: createRes.error || 'Failed to create Excel workbook on disk.' };
      }

      const fileName = filePath.split(/[/\\]/).pop() || 'Attendance.xlsx';
      setSessionState((prev) => ({
        ...prev,
        storageMode: 'excel',
        excelFilePath: filePath,
        excelFileName: fileName,
        excelExistingRecordsCount: 0,
        excelWorkbookSheets: ['Attendance'],
      }));
      return { canceled: false, filePath };
    }
    return { canceled: true, error: 'Save dialog not available' };
  };

  // ─── Setup Flow Navigation ────────────────────────────────────────────────────

  // A student roster is valid when there is at least one student with both name and rollNumber filled.
  // Blank draft rows added by addPerson (empty name/rollNumber) are ignored for validity.
  const validPeopleCount = sessionState.people.filter(
    (p) => p.name.trim().length > 0 && p.rollNumber.trim().length > 0
  ).length;
  const isPeopleStepValid = validPeopleCount > 0;

  const isDateStepValid = Boolean(sessionState.startDate);
  const currentTimetable = sessionState.weeklyTimetable || INITIAL_WEEKLY_TIMETABLE;
  const totalScheduledCount = Object.values(currentTimetable).reduce((acc, list) => acc + list.length, 0);
  const isClassesStepValid = Boolean(totalScheduledCount > 0 || (sessionState.classes && sessionState.classes.length > 0));

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      const next = (currentStep + 1) as StepId;
      setCompletedSteps((prev) => Array.from(new Set([...prev, currentStep])));
      setCurrentStep(next);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as StepId);
    }
  };

  const goToStep = (step: StepId) => {
    if (step === 1) { setCurrentStep(step); return; }
    if (sessionState.storageMode === null) return;
    if (step > 2 && !isPeopleStepValid) return;
    if (step > 3 && !isDateStepValid) return;
    if (step > 4 && !isClassesStepValid) return;
    const maxCompleted = Math.max(0, ...completedSteps);
    if (step <= maxCompleted + 1) setCurrentStep(step);
  };

  const resetFlow = (clearRosterOrEvent?: boolean | unknown) => {
    const clearRoster = clearRosterOrEvent === true;
    setCurrentStep(1);
    setCompletedSteps([]);
    const currentRoster = clearRoster ? [] : (sessionState.people.length > 0 ? sessionState.people : loadPersistedRoster());
    if (clearRoster) savePersistedRoster([]);
    setSessionState((prev) => ({
      ...INITIAL_STATE,
      people: currentRoster,
      peopleCount: currentRoster.length > 0 ? currentRoster.length : null,
      members: syncPeopleToMembers(currentRoster),
      weeklyTimetable: prev.weeklyTimetable || INITIAL_WEEKLY_TIMETABLE,
      excelFilePath: prev.excelFilePath,
      excelFileName: prev.excelFileName,
      googleSpreadsheetId: prev.googleSpreadsheetId,
      googleSpreadsheetUrl: prev.googleSpreadsheetUrl,
      googleSpreadsheetTitle: prev.googleSpreadsheetTitle,
    }));
  };

  const canGoNext = Boolean(
    currentStep < STEPS.length &&
    (currentStep !== 1 || sessionState.storageMode !== null) &&
    (currentStep !== 2 || isPeopleStepValid) &&
    (currentStep !== 3 || isDateStepValid) &&
    (currentStep !== 4 || isClassesStepValid)
  );

  const currentStepMeta = STEPS.find((s) => s.id === currentStep) || STEPS[0];

  return (
    <FlowContext.Provider
      value={{
        // Setup flow
        currentStep,
        completedSteps,
        canGoNext,
        canGoPrev: currentStep > 1,
        nextStep,
        prevStep,
        goToStep,
        resetFlow,

        // Workspace
        enterWorkspace,
        activeTab: sessionState.activeTab,
        setActiveTab,
        activeDate: sessionState.activeDate,
        setActiveDate,
        setWorkspaceMonth,

        // Session
        sessionState,
        updateSessionState,

        // Storage
        setStorageMode,

        // People
        setPeopleCount,
        setPeople,
        updatePerson,
        addPerson,
        deletePerson,
        importStudents,

        // Date
        setDateSetup,

        // Timetable
        weeklyTimetable: currentTimetable,
        addTimetableSubject,
        updateTimetableSubject,
        deleteTimetableSubject,

        // Legacy classes
        addClass,
        updateClass,
        deleteClass,
        setClasses,

        // Workspace attendance
        saveDailyAttendance,
        getDailyAttendance,
        isDateSaved,
        isNoClassDate,
        getHolidayReason,
        markDateAsHoliday,
        removeDateHoliday,
        toggleNoClassDate,
        restoreWorkspaceBackup,
        getMonthAttendanceRecords,

        // Legacy attendance
        savePersonAttendance,
        getAttendanceDataset,
        saveToStorage,
        saveDateToStorage,

        // Excel
        selectExistingExcelWorkbook,
        createNewExcelWorkbook,
        setExcelFilePath,

        // Google Sheets
        googleStatus,
        refreshGoogleStatus,
        connectGoogleOAuth,
        cancelGoogleOAuth,
        connectGoogleToken,
        connectGoogleServiceAccount,
        disconnectGoogle,
        setGoogleSpreadsheet,
        createGoogleSpreadsheet,

        currentStepMeta,
      }}
    >
      {children}
    </FlowContext.Provider>
  );
};
