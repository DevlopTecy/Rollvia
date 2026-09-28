import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GripVertical, X, CheckCircle2, Zap, Minus, ChevronDown } from 'lucide-react';
import type { Person, TimetableSubject, WeeklyTimetable } from '../../types';
import { MONTH_NAMES, getSubjectsForDate, getSupportedYears } from '../../utils/calendar';
import { validateQuickCommand } from '../../utils/quickCommandParser';

interface SimpleQuickPanelProps {
  isOpen: boolean;
  onClose: () => void;
  people: Person[];
  weeklyTimetable: WeeklyTimetable;
  currentActiveDate: string;
  onApplyQuickAttendance: (
    dateStr: string,
    subject: TimetableSubject,
    rollNumbers: string[],
    isPresent: boolean
  ) => { success: boolean; message: string; count: number };
  /** Called by parent to expose a way to focus the command input (e.g., for Ctrl+Q) */
  onRegisterFocus?: (fn: () => void) => void;
  onMonthChange?: (year: number, monthIndex: number) => void;
}

export const SimpleQuickPanel: React.FC<SimpleQuickPanelProps> = ({
  isOpen,
  onClose,
  people,
  weeklyTimetable,
  currentActiveDate,
  onApplyQuickAttendance,
  onRegisterFocus,
  onMonthChange,
}) => {
  // Parse active date for initial month and day
  const [activeY, activeM, activeD] = useMemo(() => {
    const now = new Date();
    if (currentActiveDate) {
      const parts = currentActiveDate.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return [parts[0], parts[1] - 1, parts[2]];
      }
    }
    return [now.getFullYear(), now.getMonth(), now.getDate()];
  }, [currentActiveDate]);

  const supportedYears = useMemo(() => getSupportedYears(), []);

  // Selected Month & Year
  const [selectedYear, setSelectedYear] = useState<number>(activeY);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(activeM);

  // Selected Day (1..31)
  const [selectedDay, setSelectedDay] = useState<number>(activeD);

  // Minimize state
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Sync with currentActiveDate when panel opens
  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current && currentActiveDate) {
      const parts = currentActiveDate.split('-').map(Number);
      if (parts.length === 3) {
        setSelectedYear(parts[0]);
        setSelectedMonthIndex(parts[1] - 1);
        setSelectedDay(parts[2]);
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, currentActiveDate]);

  // Calculate days in selected month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
  }, [selectedYear, selectedMonthIndex]);

  // Ensure day is valid when month changes
  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [selectedDay, daysInMonth]);

  // Target date string
  const targetDateStr = useMemo(() => {
    return `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  }, [selectedYear, selectedMonthIndex, selectedDay]);

  // Formatted date for display
  const formattedTargetDate = useMemo(() => {
    const d = new Date(selectedYear, selectedMonthIndex, selectedDay);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedYear, selectedMonthIndex, selectedDay]);

  // Available classes for target date
  const availableClasses: TimetableSubject[] = useMemo(() => {
    return getSubjectsForDate(targetDateStr, weeklyTimetable);
  }, [targetDateStr, weeklyTimetable]);

  // Selected class
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Auto-select first class when day changes or reset if not available
  useEffect(() => {
    if (availableClasses.length > 0) {
      const exists = availableClasses.some((c) => c.id === selectedClassId);
      if (!exists) {
        setSelectedClassId(availableClasses[0].id);
      }
    } else {
      setSelectedClassId('');
    }
  }, [availableClasses, selectedClassId]);

  const selectedClass = useMemo(() => {
    return availableClasses.find((c) => c.id === selectedClassId) || null;
  }, [availableClasses, selectedClassId]);

  // Command input state
  const [commandInput, setCommandInput] = useState<string>('');
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Register focus function with parent (for Ctrl+Q)
  useEffect(() => {
    if (onRegisterFocus) {
      onRegisterFocus(() => {
        commandInputRef.current?.focus();
        commandInputRef.current?.select();
      });
    }
  }, [onRegisterFocus]);

  // Feedback states
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'error';
    title: string;
    details?: string;
  } | null>(null);


  // Position state (persisted in localStorage)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('attendly_simple_quick_pos');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            return parsed;
          }
        }
      } catch {
        // ignore
      }
      return {
        x: Math.max(20, window.innerWidth - 330),
        y: 110,
      };
    }
    return { x: 800, y: 110 };
  });

  // Dragging logic
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag from header, ignore buttons/inputs
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return;
    }
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;

    const panelWidth = 300;
    const panelHeight = 360;
    const maxX = Math.max(10, window.innerWidth - panelWidth - 10);
    const maxY = Math.max(40, window.innerHeight - panelHeight - 10);

    const newX = Math.min(Math.max(10, dragStartRef.current.startX + dx), maxX);
    const newY = Math.min(Math.max(40, dragStartRef.current.startY + dy), maxY);

    setPosition({ x: newX, y: newY });
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        localStorage.setItem('attendly_simple_quick_pos', JSON.stringify(position));
      } catch {
        // ignore
      }
    }
  }, [position]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Execute Command
  const handleExecute = () => {
    setStatusFeedback(null);

    // 1. Mandatory class validation
    if (availableClasses.length === 0) {
      setStatusFeedback({
        type: 'error',
        title: 'Command not executed',
        details: 'No classes scheduled for the selected day.',
      });
      return;
    }

    if (!selectedClass) {
      setStatusFeedback({
        type: 'error',
        title: 'Command not executed',
        details: 'Select a class before executing a command.',
      });
      return;
    }

    // 2. Strict command syntax and student roster validation
    const validation = validateQuickCommand(commandInput, people);
    if (!validation.isValid || !validation.action || !validation.rollNumbers) {
      setStatusFeedback({
        type: 'error',
        title: 'Command not executed',
        details: validation.error || 'Invalid command syntax.',
      });
      return;
    }

    // 3. Apply attendance change atomically
    const isPresent = validation.action === 'P';
    const result = onApplyQuickAttendance(
      targetDateStr,
      selectedClass,
      validation.rollNumbers,
      isPresent
    );

    if (result.success) {
      setStatusFeedback({
        type: 'success',
        title: `${result.count} student${result.count === 1 ? '' : 's'} marked ${isPresent ? 'Present' : 'Absent'}`,
        details: `Class: ${selectedClass.name}\nDate: ${formattedTargetDate}`,
      });
      setCommandInput(''); // Clear input for next entry
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '300px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.45), 0 8px 10px -6px rgba(0, 0, 0, 0.35)',
        zIndex: 9990,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontSize: '0.8rem',
      }}
    >
      {/* ── Draggable Title Header ── */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.55rem 0.75rem',
          backgroundColor: 'var(--bg-canvas)',
          borderBottom: isMinimized ? 'none' : '1px solid var(--border-subtle)',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-600)' }}>
          <GripVertical size={14} style={{ color: 'var(--text-subtle)' }} />
          <Zap size={14} />
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            Simple Quick
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <button
            type="button"
            onClick={() => setIsMinimized((prev) => !prev)}
            title={isMinimized ? 'Expand Simple Quick' : 'Minimize Simple Quick'}
            style={iconBtnStyle}
          >
            {isMinimized ? <ChevronDown size={14} /> : <Minus size={14} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Simple Quick"
            style={iconBtnStyle}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Panel Body ── */}
      {!isMinimized && (
        <div style={{ padding: '0.75rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {/* 1. Month Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
              Month
            </label>
            <select
              value={`${selectedYear}-${selectedMonthIndex}`}
              onChange={(e) => {
                const [yr, mi] = e.target.value.split('-').map(Number);
                setSelectedYear(yr);
                setSelectedMonthIndex(mi);
                const maxDays = new Date(yr, mi + 1, 0).getDate();
                if (selectedDay > maxDays) {
                  setSelectedDay(maxDays);
                }
                setStatusFeedback(null);
                onMonthChange?.(yr, mi);
              }}
              style={selectStyle}
            >
              {supportedYears.flatMap((yr) =>
                MONTH_NAMES.map((mName, idx) => (
                  <option key={`${yr}-${idx}`} value={`${yr}-${idx}`}>
                    {mName} {yr}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 2. Day Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
              Day
            </label>
            <select
              value={selectedDay}
              onChange={(e) => {
                setSelectedDay(Number(e.target.value));
                setStatusFeedback(null);
              }}
              style={selectStyle}
            >
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {MONTH_NAMES[selectedMonthIndex]} {d}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Classes Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Classes
            </label>
            {availableClasses.length === 0 ? (
              <div style={{ fontSize: '0.74rem', color: 'var(--warning-600)', fontStyle: 'italic', padding: '0.15rem 0' }}>
                No classes scheduled
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {availableClasses.map((cls) => {
                  const isSelected = cls.id === selectedClassId;
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => {
                        setSelectedClassId(cls.id);
                        setStatusFeedback(null);
                      }}
                      style={{
                        padding: '0.22rem 0.55rem',
                        fontSize: '0.75rem',
                        fontWeight: isSelected ? 700 : 500,
                        borderRadius: 'var(--radius-xs)',
                        cursor: 'pointer',
                        border: isSelected ? '1.5px solid var(--primary-600)' : '1px solid var(--border-default)',
                        backgroundColor: isSelected ? 'var(--primary-600)' : 'var(--bg-canvas)',
                        color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                        transition: 'all 0.1s ease',
                      }}
                    >
                      {cls.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Command Text Box */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
              Command
            </label>
            <input
              ref={commandInputRef}
              type="text"
              value={commandInput}
              onChange={(e) => {
                setCommandInput(e.target.value);
                if (statusFeedback) setStatusFeedback(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleExecute();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onClose();
                }
              }}
              placeholder="P:113,144,102"
              style={{
                width: '100%',
                padding: '0.35rem 0.55rem',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono, monospace)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-canvas)',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Execute Button */}
          <button
            type="button"
            onClick={handleExecute}
            disabled={!selectedClass || availableClasses.length === 0}
            style={{
              backgroundColor: !selectedClass || availableClasses.length === 0 ? 'var(--border-strong)' : 'var(--primary-600)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '0.4rem 0.8rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: !selectedClass || availableClasses.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s ease',
              marginTop: '0.2rem',
            }}
          >
            Execute
          </button>

          {/* Feedback Card */}
          {statusFeedback && (
            <div
              style={{
                padding: '0.45rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.74rem',
                backgroundColor: statusFeedback.type === 'success' ? 'var(--success-50)' : 'var(--danger-50)',
                border: `1px solid ${statusFeedback.type === 'success' ? 'var(--success-200)' : 'var(--danger-200)'}`,
                color: statusFeedback.type === 'success' ? 'var(--success-800)' : 'var(--danger-800)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.15rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}>
                {statusFeedback.type === 'success' ? (
                  <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
                ) : (
                  <X size={13} style={{ flexShrink: 0, strokeWidth: 2.5 }} />
                )}
                <span>
                  {statusFeedback.type === 'success' ? '✓ ' : '✕ '}
                  {statusFeedback.title}
                </span>
              </div>
              {statusFeedback.details && (
                <div style={{ fontSize: '0.7rem', opacity: 0.95, paddingLeft: '1.1rem', whiteSpace: 'pre-line' }}>
                  {statusFeedback.details}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.32rem 0.5rem',
  fontSize: '0.78rem',
  fontWeight: 600,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-canvas)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  outline: 'none',
  boxSizing: 'border-box',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: '2px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 'var(--radius-xs)',
};
