import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Save,
  AlertCircle,
  Loader2,
  Undo2,
  Redo2,
  CalendarOff,
  CheckCircle2,
  RotateCcw,
  Edit3,
  FileText,
  X,
  Zap,
} from 'lucide-react';
import { useFlow } from '../../context';
import { getMonthCalendarData, getSubjectsForDate, getWeekdayForDate, MONTH_NAMES } from '../../utils/calendar';
import type { TimetableSubject, StudentAttendanceProfile } from '../../types';
import { getAttendanceColor } from '../../utils/thresholds';
import { calculateStudentAttendanceProfile } from '../../models/attendance';
import { downloadMonthlyAttendancePdf } from '../../utils/pdfExport';
import { SimpleQuickPanel } from './SimpleQuickPanel';

const HOLIDAY_PRESETS = ['College Holiday', 'Festival', 'Exam', 'No Classes'];

export const AttendanceGrid: React.FC = () => {
  const {
    sessionState,
    activeDate,
    setActiveDate,
    weeklyTimetable,
    getDailyAttendance,
    isDateSaved,
    isNoClassDate,
    getHolidayReason,
    markDateAsHoliday,
    removeDateHoliday,
    getMonthAttendanceRecords,
    saveDateToStorage,
    setWorkspaceMonth,
  } = useFlow();

  const { people, selectedYear, selectedMonthIndex } = sessionState;
  const today = useMemo(() => new Date(), []);
  const calData = useMemo(
    () => getMonthCalendarData(selectedYear, selectedMonthIndex, today),
    [selectedYear, selectedMonthIndex, today]
  );

  const todayStr = useMemo(
    () => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    [today]
  );

  const [saveStatus, setSaveStatus] = useState<{ msg: string; isError: boolean } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editedData, setEditedData] = useState<Record<string, Record<string, Record<string, boolean>>>>({});

  // View vs Edit Mode for completed dates
  const [isEditingActiveDate, setIsEditingActiveDate] = useState(false);

  // Simple Quick Panel
  const [showSimpleQuick, setShowSimpleQuick] = useState(false);
  const focusSimpleQuickRef = useRef<(() => void) | null>(null);

  // Holiday reason modal state
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayReasonInput, setHolidayReasonInput] = useState('College Holiday');

  // Undo / Redo history stacks
  const [undoStack, setUndoStack] = useState<Record<string, Record<string, boolean>>[]>([]);
  const [redoStack, setRedoStack] = useState<Record<string, Record<string, boolean>>[]>([]);

  // Recovery draft status tracked without useEffect setState
  const [dismissedRecoveryDates, setDismissedRecoveryDates] = useState<Record<string, boolean>>({});

  // Parse currently selected date
  const activeYear = selectedYear;
  const activeMonthIndex = selectedMonthIndex;

  // Subjects for the active date from timetable
  const activeDateSubjects: TimetableSubject[] = useMemo(() => {
    return getSubjectsForDate(activeDate, weeklyTimetable);
  }, [activeDate, weeklyTimetable]);

  const activeWeekday = useMemo(() => getWeekdayForDate(activeDate), [activeDate]);

  // Current attendance grid state: merge saved + in-progress edits
  const savedAttendance: Record<string, Record<string, boolean>> = getDailyAttendance(activeDate);
  const currentAttendance: Record<string, Record<string, boolean>> = editedData[activeDate] ?? savedAttendance;

  const isCurrentDateHoliday = isNoClassDate(activeDate);
  const currentHolidayReason = getHolidayReason(activeDate) || 'Holiday / No Classes';
  const isCurrentDateSaved = isDateSaved(activeDate);
  const hasUnsavedChanges = Boolean(editedData[activeDate]);

  const preserveUndoForDateRef = useRef<{ date: string; undoState: Record<string, Record<string, boolean>> } | null>(null);

  // When activeDate changes, reset stacks and set appropriate initial mode
  useEffect(() => {
    if (preserveUndoForDateRef.current && preserveUndoForDateRef.current.date === activeDate) {
      setUndoStack([preserveUndoForDateRef.current.undoState]);
      setRedoStack([]);
      setIsEditingActiveDate(true);
      preserveUndoForDateRef.current = null;
    } else {
      setUndoStack([]);
      setRedoStack([]);
      // Normal completed day opens in View mode; uncompleted day opens ready for attendance
      setIsEditingActiveDate(!isDateSaved(activeDate));
    }
    setSaveStatus(null);
  }, [activeDate, isDateSaved]);

  // Determine if a recoverable draft exists for active date
  const hasRecoveryDraft = useMemo(() => {
    if (dismissedRecoveryDates[activeDate]) return false;
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
      const rawDraft = localStorage.getItem(`attendly_recovery_${activeDate}`);
      if (!rawDraft) return false;
      const parsed = JSON.parse(rawDraft);
      if (!parsed || typeof parsed !== 'object') return false;
      return JSON.stringify(parsed) !== JSON.stringify(savedAttendance);
    } catch {
      return false;
    }
  }, [activeDate, dismissedRecoveryDates, savedAttendance]);

  const saveRecoveryDraft = (date: string, data: Record<string, Record<string, boolean>>) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(`attendly_recovery_${date}`, JSON.stringify(data));
      } catch {
        // ignore
      }
    }
  };

  const clearRecoveryDraft = (date: string) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(`attendly_recovery_${date}`);
      } catch {
        // ignore
      }
    }
  };

  const handleRecoverDraft = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const rawDraft = localStorage.getItem(`attendly_recovery_${activeDate}`);
        if (rawDraft) {
          const parsed = JSON.parse(rawDraft);
          if (parsed && typeof parsed === 'object') {
            const current = editedData[activeDate] ?? savedAttendance;
            setUndoStack((prev) => [...prev, current]);
            setEditedData((prev) => ({ ...prev, [activeDate]: parsed }));
            setIsEditingActiveDate(true);
            setDismissedRecoveryDates((p) => ({ ...p, [activeDate]: true }));
          }
        }
      } catch {
        // ignore
      }
    }
  };

  const handleDiscardDraft = () => {
    clearRecoveryDraft(activeDate);
    setDismissedRecoveryDates((p) => ({ ...p, [activeDate]: true }));
  };

  const pushUndo = (stateBeforeChange: Record<string, Record<string, boolean>>) => {
    setUndoStack((prev) => [...prev.slice(-30), stateBeforeChange]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    const current = editedData[activeDate] ?? savedAttendance;
    setRedoStack((prev) => [...prev, current]);
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setEditedData((prev) => ({ ...prev, [activeDate]: previous }));
    setIsEditingActiveDate(true);
    saveRecoveryDraft(activeDate, previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const current = editedData[activeDate] ?? savedAttendance;
    setUndoStack((prev) => [...prev, current]);
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setEditedData((prev) => ({ ...prev, [activeDate]: next }));
    setIsEditingActiveDate(true);
    saveRecoveryDraft(activeDate, next);
  };

  // Keyboard shortcut listener for Ctrl+Z, Ctrl+Y, Ctrl+S, Ctrl+Q, and Escape
  const handleSaveRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          if (inInput) return; // Allow native text undo while typing in inputs
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          return;
        }
        if (e.key.toLowerCase() === 'y') {
          if (inInput) return; // Allow native text redo while typing in inputs
          e.preventDefault();
          handleRedo();
          return;
        }
        if (e.key.toLowerCase() === 's') {
          // Ctrl+S: Save
          e.preventDefault();
          if (handleSaveRef.current) handleSaveRef.current();
          return;
        }
        if (e.key.toLowerCase() === 'q') {
          if (inInput) return; // Do not intercept Ctrl+Q while typing in inputs
          // Ctrl+Q: Open/focus Simple Quick
          e.preventDefault();
          if (!showSimpleQuick) {
            setShowSimpleQuick(true);
            // Focus will be registered on next render via onRegisterFocus
            setTimeout(() => focusSimpleQuickRef.current?.(), 80);
          } else {
            focusSimpleQuickRef.current?.();
          }
          return;
        }
      }

      // Escape: close Simple Quick if open (not in a dialog/input context)
      if (e.key === 'Escape' && showSimpleQuick && !inInput) {
        setShowSimpleQuick(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const setCellStatus = (personId: string, subjectId: string, subjectName: string, present: boolean) => {
    setIsEditingActiveDate(true);
    const current = editedData[activeDate] ?? savedAttendance;
    pushUndo(current);
    setEditedData((prev) => {
      const prevDay: Record<string, Record<string, boolean>> = prev[activeDate] ?? { ...savedAttendance };
      const prevPerson: Record<string, boolean> = prevDay[personId] ?? {};
      const newPerson: Record<string, boolean> = {
        ...prevPerson,
        [subjectId]: present,
        [subjectName]: present,
      };
      const newDay: Record<string, Record<string, boolean>> = { ...prevDay, [personId]: newPerson };
      saveRecoveryDraft(activeDate, newDay);
      return { ...prev, [activeDate]: newDay };
    });
  };

  // Subject selection for Attendance Tools
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const currentSelectedSubjectId = useMemo(() => {
    if (activeDateSubjects.length === 0) return '';
    const exists = activeDateSubjects.some((s) => s.id === selectedSubjectId);
    return exists ? selectedSubjectId : activeDateSubjects[0].id;
  }, [activeDateSubjects, selectedSubjectId]);

  const currentSubjectName = useMemo(() => {
    return activeDateSubjects.find((s) => s.id === currentSelectedSubjectId)?.name || 'Class';
  }, [activeDateSubjects, currentSelectedSubjectId]);

  // Bulk action confirmation dialog state
  const [bulkConfirmModal, setBulkConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const applySubjectBulk = (subjectId: string, present: boolean) => {
    const sub = activeDateSubjects.find((s) => s.id === subjectId) || activeDateSubjects[0];
    if (!sub) return;
    setIsEditingActiveDate(true);
    const current = editedData[activeDate] ?? savedAttendance;
    pushUndo(current);
    setEditedData((prev) => {
      const prevDay: Record<string, Record<string, boolean>> = prev[activeDate] ?? { ...savedAttendance };
      const updated: Record<string, Record<string, boolean>> = {};
      people.forEach((p) => {
        const prevPerson: Record<string, boolean> = prevDay[p.id] ?? {};
        updated[p.id] = {
          ...prevPerson,
          [sub.id]: present,
          [sub.name]: present,
        };
      });
      saveRecoveryDraft(activeDate, updated);
      return { ...prev, [activeDate]: updated };
    });
  };

  const applyAllClassesBulk = (present: boolean) => {
    if (activeDateSubjects.length === 0) return;
    setIsEditingActiveDate(true);
    const current = editedData[activeDate] ?? savedAttendance;
    pushUndo(current);
    setEditedData((prev) => {
      const updated: Record<string, Record<string, boolean>> = {};
      people.forEach((p) => {
        const personMap: Record<string, boolean> = {};
        activeDateSubjects.forEach((s) => {
          personMap[s.id] = present;
          personMap[s.name] = present;
        });
        updated[p.id] = personMap;
      });
      saveRecoveryDraft(activeDate, updated);
      return { ...prev, [activeDate]: updated };
    });
  };

  const promptSubjectBulk = (subjectId: string, present: boolean) => {
    const sub = activeDateSubjects.find((s) => s.id === subjectId) || activeDateSubjects[0];
    if (!sub) return;
    const actionWord = present ? 'Present' : 'Absent';
    setBulkConfirmModal({
      isOpen: true,
      title: `Mark all students ${actionWord} for ${sub.name}?`,
      message: `This will mark all ${people.length} students ${actionWord} for "${sub.name}" on ${formattedActiveDate}. Other subjects will not be changed.`,
      onConfirm: () => {
        applySubjectBulk(sub.id, present);
        setBulkConfirmModal(null);
      },
    });
  };

  const promptAllClassesBulk = (present: boolean) => {
    if (activeDateSubjects.length === 0) return;
    const actionWord = present ? 'Present' : 'Absent';
    setBulkConfirmModal({
      isOpen: true,
      title: `Mark all classes ${actionWord} for ${formattedActiveDate}?`,
      message: `This will mark all ${people.length} students ${actionWord} across all ${activeDateSubjects.length} classes on ${formattedActiveDate}.`,
      onConfirm: () => {
        applyAllClassesBulk(present);
        setBulkConfirmModal(null);
      },
    });
  };

  const handleSave = async () => {
    if (!sessionState.excelFilePath) {
      setSaveStatus({ msg: 'Save failed: No Excel workbook configured.', isError: true });
      return;
    }

    const dataToSave = editedData[activeDate] ?? savedAttendance;

    setIsSaving(true);
    setSaveStatus(null);
    try {
      const result = await saveDateToStorage(activeDate, dataToSave);
      if (result.success) {
        setSaveStatus({ msg: 'Saved', isError: false });
        clearRecoveryDraft(activeDate);
        setDismissedRecoveryDates((p) => ({ ...p, [activeDate]: true }));
        setUndoStack([]);
        setRedoStack([]);
        setIsEditingActiveDate(false); // Return to View Mode with updated data
        setEditedData((prev) => {
          const next = { ...prev };
          delete next[activeDate];
          return next;
        });
      } else {
        const errMsg = result.error || result.message || 'Save failed.';
        setSaveStatus({ msg: `Save failed: ${errMsg}`, isError: true });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Save failed.';
      setSaveStatus({ msg: `Save failed: ${errMsg}`, isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  // Wire handleSaveRef so Ctrl+S keyboard shortcut can call handleSave
  useEffect(() => {
    handleSaveRef.current = handleSave;
  });

  // ─── Simple Quick: Apply attendance from panel ──────────────────────────────
  const handleApplyQuickAttendance = useCallback((
    targetDate: string,
    subject: TimetableSubject,
    rollNumbers: string[],
    isPresent: boolean
  ): { success: boolean; message: string; count: number } => {
    try {
      setIsEditingActiveDate(true);

      const dateSavedAttendance = getDailyAttendance(targetDate);
      const prevDayState = editedData[targetDate] ?? dateSavedAttendance;

      // Push current state to undo stack for the target date
      if (targetDate !== activeDate) {
        preserveUndoForDateRef.current = { date: targetDate, undoState: prevDayState };
      } else {
        setUndoStack((prev) => [...prev.slice(-30), prevDayState]);
        setRedoStack([]);
      }

      setEditedData((prev) => {
        const prevDay: Record<string, Record<string, boolean>> = prev[targetDate] ?? { ...dateSavedAttendance };
        const updated: Record<string, Record<string, boolean>> = { ...prevDay };

        for (const rollNum of rollNumbers) {
          // Find person by rollNumber
          const person = people.find((p) => String(p.rollNumber || '').trim() === rollNum);
          if (!person) continue;

          const prevPerson: Record<string, boolean> = prevDay[person.id] ?? {};
          updated[person.id] = {
            ...prevPerson,
            [subject.id]: isPresent,
            [subject.name]: isPresent,
          };
        }

        // Save recovery draft
        try {
          localStorage.setItem(`attendly_recovery_${targetDate}`, JSON.stringify(updated));
        } catch {
          // ignore
        }

        return { ...prev, [targetDate]: updated };
      });

      // Navigate to the target date so user sees the changes
      if (targetDate !== activeDate) {
        setActiveDate(targetDate);
      }

      return {
        success: true,
        message: `${rollNumbers.length} students marked ${isPresent ? 'Present' : 'Absent'} for ${subject.name}`,
        count: rollNumbers.length,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error',
        count: 0,
      };
    }
  }, [people, editedData, getDailyAttendance, activeDate, setActiveDate]);

  // Export Monthly PDF
  const handleExportMonthlyPdf = () => {
    const monthRecs = getMonthAttendanceRecords(activeYear, activeMonthIndex);
    const profilesMap = new Map<string, StudentAttendanceProfile>();
    for (const p of people) {
      profilesMap.set(p.id, calculateStudentAttendanceProfile(p, monthRecs));
    }

    downloadMonthlyAttendancePdf({
      institutionName: sessionState.institutionName,
      departmentName: sessionState.departmentName,
      academicYear: sessionState.academicYear || String(activeYear),
      monthStr: `${MONTH_NAMES[activeMonthIndex]} ${activeYear}`,
      roster: people,
      profiles: profilesMap,
      savedDatesCount: (sessionState.savedDates || []).length,
      holidaysCount: (sessionState.noClassDates || []).length,
    });
  };

  // Navigation helpers
  const handlePrevDay = () => {
    const parts = activeDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2] - 1);
    setActiveDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const handleNextDay = () => {
    const parts = activeDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2] + 1);
    setActiveDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  // Format the active date for display
  const activeDateObj = (() => {
    const [y, m, d] = activeDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  })();
  const formattedActiveDate = activeDateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-app)',
      }}
    >
      {/* ── Date Strip (Calendar / Heatmap) ─────────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0.5rem 1.25rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          flexShrink: 0,
        }}
      >
        {/* Month label */}
        <div style={{ flexShrink: 0, paddingTop: '0.15rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {MONTH_NAMES[activeMonthIndex]} {activeYear}
          </span>
        </div>

        {/* Date chips */}
        <div
          style={{
            display: 'flex',
            gap: '0.25rem',
            overflowX: 'auto',
            flex: 1,
            paddingBottom: '2px',
          }}
        >
          {calData.currentDays.map((cell) => {
            const dateStr = cell.dateStr;
            const isActive = dateStr === activeDate;
            const isToday = dateStr === todayStr;
            const saved = isDateSaved(dateStr);
            const isHoliday = isNoClassDate(dateStr);
            const holidayReason = getHolidayReason(dateStr);
            const subjects = getSubjectsForDate(dateStr, weeklyTimetable);
            const hasSubjects = subjects.length > 0;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => {
                  setActiveDate(dateStr);
                }}
                title={
                  isHoliday
                    ? `${cell.dayName}, ${cell.day} - Holiday: ${holidayReason || 'No Classes'} (Click to View/Remove)`
                    : saved
                    ? `${cell.dayName}, ${cell.day} - Completed (Click to View/Edit Attendance)`
                    : `${cell.dayName}, ${cell.day} - Uncompleted (Click to Start Attendance)`
                }
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.3rem 0.4rem',
                  minWidth: '48px',
                  borderRadius: 'var(--radius-sm)',
                  border: isActive
                    ? '1.5px solid var(--primary-600)'
                    : isToday
                    ? '1px solid var(--primary-300)'
                    : '1px solid var(--border-subtle)',
                  backgroundColor: isActive
                    ? 'var(--primary-600)'
                    : isHoliday
                    ? 'var(--warning-50)'
                    : isToday
                    ? 'var(--primary-50)'
                    : 'var(--bg-canvas)',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 500,
                    color: isActive ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                    lineHeight: 1,
                  }}
                >
                  {cell.dayName}
                </span>
                <span
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    color: isActive ? '#fff' : isToday ? 'var(--primary-700)' : 'var(--text-primary)',
                    lineHeight: 1.2,
                  }}
                >
                  {cell.day}
                </span>

                {/* Subject tags or short holiday note */}
                {!isHoliday && hasSubjects ? (
                  <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '2px' }}>
                    {subjects.slice(0, 2).map((s) => (
                      <span
                        key={s.id}
                        style={{
                          fontSize: '0.6rem',
                          lineHeight: 1,
                          backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'var(--primary-100)',
                          color: isActive ? '#fff' : 'var(--primary-700)',
                          borderRadius: '3px',
                          padding: '1px 3px',
                          fontWeight: 600,
                        }}
                      >
                        {s.name.length > 4 ? s.name.slice(0, 4) : s.name}
                      </span>
                    ))}
                    {subjects.length > 2 && (
                      <span style={{ fontSize: '0.6rem', color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--text-subtle)' }}>
                        +{subjects.length - 2}
                      </span>
                    )}
                  </div>
                ) : !isHoliday ? (
                  <span style={{ fontSize: '0.6rem', color: isActive ? 'rgba(255,255,255,0.5)' : 'var(--text-subtle)', marginTop: '2px' }}>—</span>
                ) : null}

                {/* ── Strict Calendar Behavior Indicator ──
                    Completed: ✓
                    Uncompleted: ○
                    Holiday: — Holiday
                */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
                  {isHoliday ? (
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        color: isActive ? '#fff' : 'var(--warning-700)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      — Holiday
                    </span>
                  ) : saved ? (
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: isActive ? '#fff' : 'var(--success-600)',
                        lineHeight: 1,
                      }}
                    >
                      ✓
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
                        lineHeight: 1,
                      }}
                    >
                      ○
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Autosave Recovery Banner ─────────────────────────────────────────── */}
      {hasRecoveryDraft && (
        <div
          style={{
            backgroundColor: 'var(--warning-50)',
            borderBottom: '1px solid var(--warning-200)',
            padding: '0.45rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning-800)' }}>
            <AlertCircle size={14} style={{ color: 'var(--warning-600)', flexShrink: 0 }} />
            <span>
              <strong>Recoverable unsaved attendance found</strong> for {formattedActiveDate}.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={handleRecoverDraft}
              style={{
                backgroundColor: 'var(--warning-600)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-xs)',
                padding: '0.2rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <RotateCcw size={11} /> Recover
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xs)',
                padding: '0.2rem 0.55rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ── Active Date Header ──────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0.6rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={handlePrevDay} style={navBtnStyle} title="Previous Day">
            <ChevronLeft size={14} />
          </button>
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {formattedActiveDate}
            </span>
            {isCurrentDateHoliday ? (
              <span style={{ marginLeft: '0.6rem', fontSize: '0.78rem', color: 'var(--warning-700)', fontWeight: 600 }}>
                — Holiday ({currentHolidayReason})
              </span>
            ) : activeDateSubjects.length > 0 ? (
              <span style={{ marginLeft: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {activeDateSubjects.map((s) => s.name).join(' • ')}
              </span>
            ) : (
              <span style={{ marginLeft: '0.75rem', fontSize: '0.78rem', color: 'var(--warning-600)' }}>
                No subjects scheduled ({activeWeekday})
              </span>
            )}
          </div>
          <button type="button" onClick={handleNextDay} style={navBtnStyle} title="Next Day">
            <ChevronRight size={14} />
          </button>

          {/* Contextual Day State Badge */}
          {isCurrentDateHoliday ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.72rem',
                padding: '0.15rem 0.5rem',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'var(--warning-50)',
                color: 'var(--warning-700)',
                border: '1px solid var(--warning-200)',
                fontWeight: 600,
              }}
            >
              <CalendarOff size={11} /> Holiday / No Classes
            </span>
          ) : !isCurrentDateSaved || isEditingActiveDate || hasUnsavedChanges ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.72rem',
                padding: '0.15rem 0.5rem',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: hasUnsavedChanges ? 'var(--warning-50)' : 'var(--primary-50)',
                color: hasUnsavedChanges ? 'var(--warning-700)' : 'var(--primary-700)',
                border: hasUnsavedChanges ? '1px solid var(--warning-200)' : '1px solid var(--primary-200)',
                fontWeight: 600,
              }}
            >
              <Edit3 size={11} /> {hasUnsavedChanges ? 'Editing Attendance (Unsaved)' : 'Ready for Attendance'}
            </span>
          ) : null}

          {/* Contextual Action on Date: Remove Holiday OR Mark Holiday */}
          {isCurrentDateHoliday ? (
            <button
              type="button"
              onClick={() => removeDateHoliday(activeDate)}
              title="Remove holiday status and restore normal weekday timetable"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                backgroundColor: 'var(--warning-100)',
                border: '1px solid var(--warning-300)',
                borderRadius: 'var(--radius-xs)',
                padding: '0.2rem 0.6rem',
                fontSize: '0.72rem',
                color: 'var(--warning-800)',
                cursor: 'pointer',
                fontWeight: 600,
                marginLeft: '0.25rem',
              }}
            >
              <Check size={11} /> Remove Holiday
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowHolidayModal(true)}
              title="Mark this date as Holiday / No Classes (No Class / Holiday)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: 'transparent',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xs)',
                padding: '0.2rem 0.55rem',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 500,
                marginLeft: '0.25rem',
              }}
            >
              <CalendarOff size={11} /> Mark Holiday / No Classes
            </button>
          )}

          {/* Export Monthly PDF button */}
          <button
            type="button"
            onClick={handleExportMonthlyPdf}
            title="Export official monthly attendance report as PDF"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              background: 'transparent',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xs)',
              padding: '0.2rem 0.55rem',
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            <FileText size={11} /> Export Monthly PDF
          </button>

          {/* Simple Quick toggle button */}
          <button
            type="button"
            onClick={() => {
              setShowSimpleQuick((prev) => {
                if (!prev) {
                  // Opening: focus command input after render
                  setTimeout(() => focusSimpleQuickRef.current?.(), 80);
                }
                return !prev;
              });
            }}
            title={showSimpleQuick ? 'Close Simple Quick (Ctrl+Q)' : 'Open Simple Quick panel (Ctrl+Q)'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              background: showSimpleQuick ? 'var(--primary-600)' : 'transparent',
              border: showSimpleQuick ? 'none' : '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xs)',
              padding: '0.2rem 0.55rem',
              fontSize: '0.72rem',
              color: showSimpleQuick ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: showSimpleQuick ? 700 : 500,
            }}
          >
            <Zap size={11} /> Simple Quick
          </button>
        </div>

        {/* ── Contextual Actions: [Edit Attendance] / [All Present] [All Absent] [Undo] [Redo] [Save] ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {saveStatus && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: saveStatus.isError ? 'var(--danger-600)' : 'var(--success-600)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                marginRight: '0.25rem',
              }}
            >
              {saveStatus.isError ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
              {saveStatus.msg}
            </span>
          )}

          {/* If Date is completed and in View Mode, show prominent "Edit Attendance" button */}
          {!isCurrentDateHoliday && isCurrentDateSaved && !isEditingActiveDate && !hasUnsavedChanges ? (
            <button
              type="button"
              onClick={() => setIsEditingActiveDate(true)}
              title="Edit saved attendance marks for this day"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'var(--primary-600)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: '#fff',
                padding: '0.35rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              <Edit3 size={13} /> Edit Attendance
            </button>
          ) : !isCurrentDateHoliday ? (
            <>
              {/* ── Attendance Tools Area ── */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.2rem 0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                {/* A) Subject Actions: Apply to selected class */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                    }}
                    title="Apply to selected class"
                  >
                    Class:
                  </span>
                  <select
                    value={currentSelectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    disabled={activeDateSubjects.length === 0}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.4rem',
                      borderRadius: 'var(--radius-xs)',
                      border: '1px solid var(--border-default)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                    title="Select class for class-specific attendance actions"
                  >
                    {activeDateSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => promptSubjectBulk(currentSelectedSubjectId, true)}
                    disabled={activeDateSubjects.length === 0}
                    title={`Mark all students Present for ${currentSubjectName} only`}
                    style={quickFillBtnStyle('success')}
                  >
                    All Present
                  </button>

                  <button
                    type="button"
                    onClick={() => promptSubjectBulk(currentSelectedSubjectId, false)}
                    disabled={activeDateSubjects.length === 0}
                    title={`Mark all students Absent for ${currentSubjectName} only`}
                    style={quickFillBtnStyle('danger')}
                  >
                    All Absent
                  </button>
                </div>

                {/* Divider */}
                <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-default)', margin: '0 2px' }} />

                {/* B) Day Actions: Apply to all classes today */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                    }}
                    title="Apply to all classes today"
                  >
                    All Classes:
                  </span>
                  <button
                    type="button"
                    onClick={() => promptAllClassesBulk(true)}
                    disabled={activeDateSubjects.length === 0}
                    title="Mark all students Present for all classes today"
                    style={quickFillBtnStyle('success')}
                  >
                    Present All
                  </button>

                  <button
                    type="button"
                    onClick={() => promptAllClassesBulk(false)}
                    disabled={activeDateSubjects.length === 0}
                    title="Mark all students Absent for all classes today"
                    style={quickFillBtnStyle('danger')}
                  >
                    Absent All
                  </button>
                </div>
              </div>

              {/* Undo */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                title="Undo attendance change (Ctrl+Z)"
                style={actionPillBtnStyle(undoStack.length > 0)}
              >
                <Undo2 size={12} />
                <span>Undo</span>
              </button>

              {/* Redo */}
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                title="Redo attendance change (Ctrl+Y)"
                style={actionPillBtnStyle(redoStack.length > 0)}
              >
                <Redo2 size={12} />
                <span>Redo</span>
              </button>

              {/* Save */}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || activeDateSubjects.length === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: isSaving ? 'var(--border-strong)' : 'var(--primary-600)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: isSaving || activeDateSubjects.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Attendance Grid Content ─────────────────────────────────────────────── */}
      {isCurrentDateHoliday ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '0.6rem',
            color: 'var(--text-muted)',
            padding: '2rem',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: 'var(--warning-50)',
              color: 'var(--warning-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CalendarOff size={24} />
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Holiday / No Classes
          </div>
          <div
            style={{
              fontSize: '0.82rem',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.4rem 0.85rem',
              color: 'var(--warning-700)',
              fontWeight: 600,
            }}
          >
            Reason: {currentHolidayReason}
          </div>
          <div style={{ fontSize: '0.8rem', maxWidth: '380px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No attendance records are created for this day. It does not count towards total classes and does not reduce attendance percentage.
          </div>
          <button
            type="button"
            onClick={() => removeDateHoliday(activeDate)}
            style={{
              marginTop: '0.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: 'var(--primary-600)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '0.4rem 0.9rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Check size={13} /> Remove Holiday & Resume Weekday Timetable
          </button>
        </div>
      ) : activeDateSubjects.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '0.5rem',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            No subjects on {activeWeekday}
          </div>
          <div style={{ fontSize: '0.82rem' }}>
            Add subjects in the Timetable tab to track attendance on this day.
          </div>
        </div>
      ) : people.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            No students enrolled
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Add or import students in the Students tab.
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.83rem',
              tableLayout: 'fixed',
            }}
          >
            {/* Table Head */}
            <thead
              style={{
                backgroundColor: 'var(--bg-canvas)',
                position: 'sticky',
                top: 0,
                zIndex: 5,
              }}
            >
              <tr>
                <th
                  style={{
                    ...thStyle,
                    width: '40px',
                    borderRight: '1px solid var(--border-subtle)',
                  }}
                >
                  #
                </th>
                <th
                  style={{
                    ...thStyle,
                    textAlign: 'left',
                    width: '200px',
                    borderRight: '1px solid var(--border-subtle)',
                  }}
                >
                  Student
                </th>
                <th
                  style={{
                    ...thStyle,
                    textAlign: 'left',
                    width: '100px',
                    borderRight: '1px solid var(--border-subtle)',
                  }}
                >
                  Roll No
                </th>
                {activeDateSubjects.map((sub) => (
                  <th
                    key={sub.id}
                    style={{
                      ...thStyle,
                      width: '120px',
                      textAlign: 'center',
                      borderRight: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      {sub.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {people.map((person, idx) => {
                const personData: Record<string, boolean> = (currentAttendance[person.id] ?? {}) as Record<string, boolean>;
                const rowBg = idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)';

                return (
                  <tr
                    key={person.id}
                    style={{ backgroundColor: rowBg, borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    {/* # */}
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: 'center',
                        color: 'var(--text-subtle)',
                        fontSize: '0.75rem',
                        borderRight: '1px solid var(--border-subtle)',
                      }}
                    >
                      {idx + 1}
                    </td>

                    {/* Name */}
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        borderRight: '1px solid var(--border-subtle)',
                      }}
                    >
                      {person.name}
                    </td>

                    {/* Roll No */}
                    <td
                      style={{
                        ...tdStyle,
                        color: 'var(--primary-600)',
                        fontWeight: 500,
                        fontSize: '0.78rem',
                        borderRight: '1px solid var(--border-subtle)',
                      }}
                    >
                      {person.rollNumber}
                    </td>

                    {/* Subject Cells with explicit P and A buttons */}
                    {activeDateSubjects.map((sub) => {
                      const isPresent = Boolean(personData[sub.id] ?? personData[sub.name]);
                      return (
                        <td
                          key={sub.id}
                          style={{
                            ...tdStyle,
                            textAlign: 'center',
                            padding: '4px 6px',
                            borderRight: '1px solid var(--border-subtle)',
                            backgroundColor: isPresent
                              ? 'rgba(16, 185, 129, 0.04)'
                              : 'rgba(239, 68, 68, 0.03)',
                          }}
                        >
                          <div
                            style={{
                              display: 'inline-flex',
                              gap: '4px',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setCellStatus(person.id, sub.id, sub.name, true)}
                              style={{
                                padding: '2px 7px',
                                fontSize: '0.75rem',
                                fontWeight: isPresent ? 700 : 500,
                                borderRadius: 'var(--radius-xs)',
                                cursor: 'pointer',
                                border: isPresent
                                  ? '1px solid var(--success-600)'
                                  : '1px solid var(--border-default)',
                                backgroundColor: isPresent
                                  ? 'var(--success-600)'
                                  : 'var(--bg-surface)',
                                color: isPresent ? '#ffffff' : 'var(--text-muted)',
                                transition: 'all 0.1s ease',
                                minWidth: '24px',
                                lineHeight: '1.2',
                              }}
                              title={`Mark ${person.name} Present for ${sub.name}`}
                            >
                              P
                            </button>
                            <button
                              type="button"
                              onClick={() => setCellStatus(person.id, sub.id, sub.name, false)}
                              style={{
                                padding: '2px 7px',
                                fontSize: '0.75rem',
                                fontWeight: !isPresent ? 700 : 500,
                                borderRadius: 'var(--radius-xs)',
                                cursor: 'pointer',
                                border: !isPresent
                                  ? '1px solid var(--danger-600)'
                                  : '1px solid var(--border-default)',
                                backgroundColor: !isPresent
                                  ? 'var(--danger-600)'
                                  : 'var(--bg-surface)',
                                color: !isPresent ? '#ffffff' : 'var(--text-muted)',
                                transition: 'all 0.1s ease',
                                minWidth: '24px',
                                lineHeight: '1.2',
                              }}
                              title={`Mark ${person.name} Absent for ${sub.name}`}
                            >
                              A
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            {/* Footer Summary Row with Attendance Thresholds */}
            <tfoot
              style={{
                backgroundColor: 'var(--bg-canvas)',
                position: 'sticky',
                bottom: 0,
                zIndex: 5,
              }}
            >
              <tr style={{ borderTop: '2px solid var(--border-default)' }}>
                <td colSpan={3} style={{ ...tdStyle, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span>Total Present</span>
                    {people.length > 0 && activeDateSubjects.length > 0 && (() => {
                      let totalSlots = 0;
                      let presentSlots = 0;
                      for (const p of people) {
                        const pd: Record<string, boolean> = (currentAttendance[p.id] ?? {}) as Record<string, boolean>;
                        for (const s of activeDateSubjects) {
                          totalSlots++;
                          if (pd[s.id] ?? pd[s.name]) presentSlots++;
                        }
                      }
                      const overallDayPct = totalSlots > 0 ? Math.round((presentSlots / totalSlots) * 100) : 0;
                      const dayColor = getAttendanceColor(overallDayPct);
                      return (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: dayColor.bgColor,
                            color: dayColor.color,
                            border: `1px solid ${dayColor.borderColor}`,
                            fontWeight: 600,
                          }}
                        >
                          Day Avg: {overallDayPct}%
                        </span>
                      );
                    })()}
                  </div>
                </td>
                {activeDateSubjects.map((sub) => {
                  const count = people.filter((p) => {
                    const pd: Record<string, boolean> = (currentAttendance[p.id] ?? {}) as Record<string, boolean>;
                    return Boolean(pd[sub.id] ?? pd[sub.name]);
                  }).length;
                  const pct = people.length > 0 ? Math.round((count / people.length) * 100) : 0;
                  const subColor = getAttendanceColor(pct);

                  return (
                    <td
                      key={sub.id}
                      style={{
                        ...tdStyle,
                        textAlign: 'center',
                        borderRight: '1px solid var(--border-subtle)',
                        padding: '4px 6px',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: subColor.color }}>
                        {count}/{people.length}
                        <span style={{ fontSize: '0.7rem', marginLeft: '3px' }}>({pct}%)</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Mark as Holiday Modal ────────────────────────────────────────────── */}
      {showHolidayModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-dialog)',
              width: '100%',
              maxWidth: '420px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--warning-700)' }}>
                <CalendarOff size={16} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Mark Holiday / No Classes
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHolidayModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Mark <strong>{formattedActiveDate}</strong> as a holiday. No attendance records will be created, and it will not affect class totals or percentages.
            </p>

            {/* Presets */}
            <div>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Select Common Reason:
              </label>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {HOLIDAY_PRESETS.map((preset) => {
                  const isSelected = holidayReasonInput === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setHolidayReasonInput(preset)}
                      style={{
                        backgroundColor: isSelected ? 'var(--warning-100)' : 'var(--bg-canvas)',
                        border: isSelected ? '1.5px solid var(--warning-500)' : '1px solid var(--border-default)',
                        color: isSelected ? 'var(--warning-800)' : 'var(--text-secondary)',
                        borderRadius: 'var(--radius-xs)',
                        padding: '0.25rem 0.55rem',
                        fontSize: '0.75rem',
                        fontWeight: isSelected ? 600 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input */}
            <div>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Holiday Reason / Note:
              </label>
              <input
                type="text"
                value={holidayReasonInput}
                onChange={(e) => setHolidayReasonInput(e.target.value)}
                placeholder="e.g. College Holiday, Festival, Exam..."
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-canvas)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setShowHolidayModal(false)}
                style={{
                  padding: '0.35rem 0.8rem',
                  fontSize: '0.8rem',
                  background: 'transparent',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  markDateAsHoliday(activeDate, holidayReasonInput);
                  setShowHolidayModal(false);
                }}
                style={{
                  padding: '0.35rem 0.9rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--warning-600)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Confirm Holiday
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Action Confirmation Modal ── */}
      {bulkConfirmModal?.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(2, 6, 23, 0.72)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setBulkConfirmModal(null);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '430px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-dialog)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--warning-50)',
                  color: 'var(--warning-700)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertCircle size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {bulkConfirmModal.title}
              </h3>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {bulkConfirmModal.message}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.4rem' }}>
              <button
                type="button"
                onClick={() => setBulkConfirmModal(null)}
                style={{
                  padding: '0.38rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={bulkConfirmModal.onConfirm}
                style={{
                  padding: '0.38rem 0.95rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--primary-600)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Simple Quick Panel ─────────────────────────────────────────────── */}
      <SimpleQuickPanel
        isOpen={showSimpleQuick}
        onClose={() => setShowSimpleQuick(false)}
        people={people}
        weeklyTimetable={weeklyTimetable}
        currentActiveDate={activeDate}
        onApplyQuickAttendance={handleApplyQuickAttendance}
        onRegisterFocus={(fn) => { focusSimpleQuickRef.current = fn; }}
        onMonthChange={(year, monthIndex) => {
          setWorkspaceMonth(year, monthIndex);
        }}
      />
    </div>
  );
};

// ─── Micro Style Helpers ────────────────────────────────────────────────────

const navBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-xs)',
  color: 'var(--text-secondary)',
  padding: '0.2rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.6rem',
  fontWeight: 700,
  fontSize: '0.75rem',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  borderBottom: '2px solid var(--border-default)',
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '0.45rem 0.6rem',
  color: 'var(--text-primary)',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

function quickFillBtnStyle(variant: 'success' | 'danger'): React.CSSProperties {
  const isSuccess = variant === 'success';
  return {
    backgroundColor: isSuccess ? 'var(--success-50)' : 'var(--danger-50)',
    border: `1px solid ${isSuccess ? 'var(--success-500)' : 'var(--danger-500)'}`,
    color: isSuccess ? 'var(--success-text)' : 'var(--danger-text)',
    borderRadius: 'var(--radius-xs)',
    padding: '0.28rem 0.6rem',
    fontSize: '0.73rem',
    fontWeight: 600,
    cursor: 'pointer',
  };
}

function actionPillBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    backgroundColor: 'var(--bg-canvas)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-xs)',
    color: active ? 'var(--text-primary)' : 'var(--text-subtle)',
    padding: '0.28rem 0.55rem',
    fontSize: '0.73rem',
    fontWeight: 500,
    cursor: active ? 'pointer' : 'not-allowed',
    opacity: active ? 1 : 0.5,
  };
}
