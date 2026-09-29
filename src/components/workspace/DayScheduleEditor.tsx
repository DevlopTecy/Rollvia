import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, RotateCcw, Calendar, Check, AlertCircle } from 'lucide-react';
import type { TimetableSubject, WeeklyTimetable } from '../../types';
import {
  getDefaultSubjectsForDate,
  getSubjectsForDate,
  getWeekdayForDate,
  hasDateScheduleOverride,
} from '../../utils/calendar';

export interface DayScheduleEditorProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string; // "YYYY-MM-DD"
  weeklyTimetable: WeeklyTimetable;
  dateScheduleOverrides?: Record<string, string[]>;
  allKnownSubjects?: string[];
  onSaveOverride: (dateStr: string, subjects: string[]) => void;
  onResetToDefault: (dateStr: string) => void;
}

export const DayScheduleEditor: React.FC<DayScheduleEditorProps> = ({
  isOpen,
  onClose,
  dateStr,
  weeklyTimetable,
  dateScheduleOverrides,
  allKnownSubjects = [],
  onSaveOverride,
  onResetToDefault,
}) => {
  // Parse date and weekday
  const weekday = useMemo(() => getWeekdayForDate(dateStr), [dateStr]);

  const formattedDate = useMemo(() => {
    if (!dateStr) return '';
    const parts = dateStr.split('-').map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
      return dateStr;
    }
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [dateStr]);

  // Default subjects from weekly timetable
  const defaultSubjects: TimetableSubject[] = useMemo(() => {
    return getDefaultSubjectsForDate(dateStr, weeklyTimetable);
  }, [dateStr, weeklyTimetable]);

  const defaultNames = useMemo(() => defaultSubjects.map((s) => s.name), [defaultSubjects]);

  // Check if an override is currently active for this date
  const isCurrentlyOverridden = useMemo(
    () => hasDateScheduleOverride(dateStr, dateScheduleOverrides),
    [dateStr, dateScheduleOverrides]
  );

  // Local state for today's classes being edited
  const [todayClasses, setTodayClasses] = useState<string[]>([]);
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Synchronize initial state when modal opens or dateStr changes
  useEffect(() => {
    if (!isOpen) {
      setStatusMessage(null);
      setNewSubjectInput('');
      return;
    }

    if (hasDateScheduleOverride(dateStr, dateScheduleOverrides)) {
      const currentOverride = dateScheduleOverrides?.[dateStr] || [];
      setTodayClasses([...currentOverride]);
    } else {
      const currentEffective = getSubjectsForDate(dateStr, weeklyTimetable);
      setTodayClasses(currentEffective.map((s) => s.name));
    }
    setStatusMessage(null);
    setNewSubjectInput('');
  }, [isOpen, dateStr, weeklyTimetable, dateScheduleOverrides]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Pool of suggested subjects to quickly add
  const suggestedSubjects = useMemo(() => {
    const pool = new Set<string>();
    // From all days in weekly timetable
    if (weeklyTimetable) {
      for (const list of Object.values(weeklyTimetable)) {
        if (Array.isArray(list)) {
          for (const s of list) {
            if (s.name && s.name.trim()) pool.add(s.name.trim());
          }
        }
      }
    }
    // From all known subjects
    for (const s of allKnownSubjects) {
      if (s && s.trim()) pool.add(s.trim());
    }
    // Filter out already added in todayClasses (case-insensitive)
    const currentLower = new Set(todayClasses.map((c) => c.toLowerCase()));
    return Array.from(pool).filter((name) => !currentLower.has(name.toLowerCase()));
  }, [weeklyTimetable, allKnownSubjects, todayClasses]);

  // Check if todayClasses matches default
  const matchesDefault = useMemo(() => {
    if (todayClasses.length !== defaultNames.length) return false;
    return todayClasses.every((cls, i) => cls.toLowerCase() === defaultNames[i]?.toLowerCase());
  }, [todayClasses, defaultNames]);

  // Remove a class from today's schedule
  const handleRemoveClass = (index: number) => {
    setTodayClasses((prev) => prev.filter((_, i) => i !== index));
    setStatusMessage(null);
  };

  // Add a class to today's schedule
  const handleAddClass = (nameToAdd?: string) => {
    const name = (nameToAdd || newSubjectInput).trim();
    if (!name) return;

    if (todayClasses.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setStatusMessage({ text: `"${name}" is already in today's classes.`, isError: true });
      return;
    }

    setTodayClasses((prev) => [...prev, name]);
    setNewSubjectInput('');
    setStatusMessage(null);
  };

  // Reset to weekly timetable
  const handleReset = () => {
    onResetToDefault(dateStr);
    setTodayClasses([...defaultNames]);
    setStatusMessage({ text: 'Restored to default weekly timetable.' });
    setTimeout(() => {
      onClose();
    }, 400);
  };

  // Save changes
  const handleSave = () => {
    // If user edited back to match the exact weekly schedule and had an override, clear it
    if (matchesDefault && isCurrentlyOverridden) {
      onResetToDefault(dateStr);
    } else {
      onSaveOverride(dateStr, todayClasses);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="day-schedule-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-default, #e2e8f0)',
          borderRadius: 'var(--radius-sm, 6px)',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '0.85rem 1.1rem',
            borderBottom: '1px solid var(--border-default, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface, #ffffff)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2
                id="day-schedule-title"
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: 'var(--text-primary, #0f172a)',
                }}
              >
                Customize Day Schedule
              </h2>
              {isCurrentlyOverridden && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    padding: '0.1rem 0.45rem',
                    borderRadius: 'var(--radius-xs, 4px)',
                    backgroundColor: 'var(--primary-50, #eff6ff)',
                    color: 'var(--primary-700, #1d4ed8)',
                    border: '1px solid var(--primary-200, #bfdbfe)',
                  }}
                >
                  Custom Active
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-secondary, #475569)',
                marginTop: '0.2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Calendar size={12} style={{ color: 'var(--primary-600, #2563eb)' }} />
              <span style={{ fontWeight: 600 }}>{formattedDate}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #94a3b8)',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-xs, 4px)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '1.1rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* Status Message */}
          {statusMessage && (
            <div
              style={{
                fontSize: '0.76rem',
                padding: '0.4rem 0.65rem',
                borderRadius: 'var(--radius-xs, 4px)',
                backgroundColor: statusMessage.isError ? 'var(--danger-50, #fef2f2)' : 'var(--success-50, #f0fdf4)',
                color: statusMessage.isError ? 'var(--danger-700, #b91c1c)' : 'var(--success-700, #15803d)',
                border: statusMessage.isError ? '1px solid var(--danger-200, #fecaca)' : '1px solid var(--success-200, #bbf7d0)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              {statusMessage.isError ? <AlertCircle size={13} /> : <Check size={13} />}
              {statusMessage.text}
            </div>
          )}

          {/* Section 1: Default Schedule (Reference) */}
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--bg-canvas, #f8fafc)',
              border: '1px solid var(--border-default, #e2e8f0)',
              borderRadius: 'var(--radius-xs, 4px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.45rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted, #64748b)',
                }}
              >
                Default Weekly Schedule ({weekday})
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>
                Weekly timetable remains unchanged
              </span>
            </div>

            {defaultNames.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {defaultNames.map((name, idx) => (
                  <span
                    key={`${name}-${idx}`}
                    style={{
                      fontSize: '0.76rem',
                      fontWeight: 500,
                      backgroundColor: 'var(--bg-surface, #ffffff)',
                      color: 'var(--text-primary, #1e293b)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-xs, 4px)',
                      border: '1px solid var(--border-default, #cbd5e1)',
                    }}
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic' }}>
                No subjects scheduled for {weekday} in weekly timetable.
              </div>
            )}
          </div>

          {/* Section 2: Today's Actual Schedule */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-primary, #0f172a)',
                  }}
                >
                  Today&apos;s Classes ({todayClasses.length})
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>
                  — applies to this date only
                </span>
              </div>
            </div>

            {todayClasses.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  borderRadius: 'var(--radius-xs, 4px)',
                  padding: '0.45rem',
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                }}
              >
                {todayClasses.map((className, idx) => {
                  const isExtra = !defaultNames.some((d) => d.toLowerCase() === className.toLowerCase());
                  return (
                    <div
                      key={`${className}-${idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.35rem 0.6rem',
                        backgroundColor: isExtra ? 'var(--primary-50, #eff6ff)' : 'var(--bg-canvas, #f8fafc)',
                        border: isExtra ? '1px solid var(--primary-200, #bfdbfe)' : '1px solid var(--border-default, #e2e8f0)',
                        borderRadius: 'var(--radius-xs, 4px)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'var(--text-muted, #94a3b8)',
                            minWidth: '1.2rem',
                          }}
                        >
                          #{idx + 1}
                        </span>
                        <span
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: isExtra ? 'var(--primary-800, #1e40af)' : 'var(--text-primary, #0f172a)',
                          }}
                        >
                          {className}
                        </span>
                        {isExtra && (
                          <span
                            style={{
                              fontSize: '0.66rem',
                              fontWeight: 600,
                              color: 'var(--primary-700, #1d4ed8)',
                              backgroundColor: 'var(--primary-100, #dbeafe)',
                              padding: '0.05rem 0.35rem',
                              borderRadius: 'var(--radius-xs, 4px)',
                            }}
                          >
                            + Extra Class
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveClass(idx)}
                        title={`Remove ${className} for this date only`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--danger-600, #dc2626)',
                          cursor: 'pointer',
                          padding: '0.2rem 0.35rem',
                          borderRadius: 'var(--radius-xs, 4px)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.72rem',
                          fontWeight: 500,
                        }}
                      >
                        <X size={13} />
                        <span>Remove</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  padding: '1rem',
                  border: '1px dashed var(--border-default, #cbd5e1)',
                  borderRadius: 'var(--radius-xs, 4px)',
                  textAlign: 'center',
                  color: 'var(--text-muted, #64748b)',
                  fontSize: '0.78rem',
                  backgroundColor: 'var(--bg-canvas, #f8fafc)',
                }}
              >
                No classes scheduled for today. Add a class below or reset to the weekly timetable.
              </div>
            )}
          </div>

          {/* Section 3: Add Class Control */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              paddingTop: '0.25rem',
            }}
          >
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                color: 'var(--text-secondary, #334155)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              + Add Class for Today
            </span>

            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                type="text"
                value={newSubjectInput}
                onChange={(e) => {
                  setNewSubjectInput(e.target.value);
                  setStatusMessage(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddClass();
                  }
                }}
                placeholder="Enter subject name (e.g. DBMS, PP, Lab)"
                style={{
                  flex: 1,
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.8rem',
                  borderRadius: 'var(--radius-xs, 4px)',
                  border: '1px solid var(--border-default, #cbd5e1)',
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  color: 'var(--text-primary, #0f172a)',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => handleAddClass()}
                disabled={!newSubjectInput.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  backgroundColor: newSubjectInput.trim() ? 'var(--primary-600, #2563eb)' : 'var(--bg-canvas, #f1f5f9)',
                  color: newSubjectInput.trim() ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                  border: '1px solid transparent',
                  borderRadius: 'var(--radius-xs, 4px)',
                  cursor: newSubjectInput.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                <Plus size={13} />
                Add
              </button>
            </div>

            {/* Quick add suggested subjects */}
            {suggestedSubjects.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>Quick add:</span>
                {suggestedSubjects.slice(0, 8).map((subName) => (
                  <button
                    key={subName}
                    type="button"
                    onClick={() => handleAddClass(subName)}
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      padding: '0.15rem 0.45rem',
                      borderRadius: 'var(--radius-xs, 4px)',
                      backgroundColor: 'var(--bg-canvas, #f8fafc)',
                      border: '1px solid var(--border-default, #cbd5e1)',
                      color: 'var(--text-secondary, #475569)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}
                  >
                    <Plus size={10} />
                    {subName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.8rem 1.1rem',
            borderTop: '1px solid var(--border-default, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface, #ffffff)',
          }}
        >
          {/* Reset to Weekly Timetable */}
          <button
            type="button"
            onClick={handleReset}
            disabled={!isCurrentlyOverridden && matchesDefault}
            title="Restore this date to the default weekly timetable"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.35rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              backgroundColor: 'transparent',
              border: '1px solid var(--border-default, #cbd5e1)',
              borderRadius: 'var(--radius-xs, 4px)',
              color: isCurrentlyOverridden || !matchesDefault ? 'var(--text-secondary, #475569)' : 'var(--text-muted, #cbd5e1)',
              cursor: isCurrentlyOverridden || !matchesDefault ? 'pointer' : 'default',
              opacity: isCurrentlyOverridden || !matchesDefault ? 1 : 0.6,
            }}
          >
            <RotateCcw size={12} />
            Reset to Weekly Timetable
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.76rem',
                fontWeight: 500,
                backgroundColor: 'transparent',
                border: '1px solid var(--border-default, #cbd5e1)',
                borderRadius: 'var(--radius-xs, 4px)',
                color: 'var(--text-secondary, #475569)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.35rem 0.85rem',
                fontSize: '0.76rem',
                fontWeight: 600,
                backgroundColor: 'var(--primary-600, #2563eb)',
                color: '#ffffff',
                border: '1px solid var(--primary-700, #1d4ed8)',
                borderRadius: 'var(--radius-xs, 4px)',
                cursor: 'pointer',
              }}
            >
              <Check size={12} />
              Save Day Classes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
