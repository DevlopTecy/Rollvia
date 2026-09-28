import React, { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Calendar,
} from 'lucide-react';
import { useFlow } from '../../context';
import { Button } from '../ui/Button';
import type { Weekday } from '../../types';
import { getWeekdayForDate } from '../../utils/calendar';

const SCHEDULED_DAYS: Weekday[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const ClassesScreen: React.FC = () => {
  const {
    sessionState,
    weeklyTimetable,
    addTimetableSubject,
    updateTimetableSubject,
    deleteTimetableSubject,
    prevStep,
    nextStep,
  } = useFlow();

  const [dayInputs, setDayInputs] = useState<Record<string, string>>({});
  const [dayErrors, setDayErrors] = useState<Record<string, string>>({});
  const [editingItem, setEditingItem] = useState<{ day: Weekday; id: string; name: string } | null>(null);
  const [editError, setEditError] = useState<string>('');

  const activeWeekday = sessionState.startDate ? getWeekdayForDate(sessionState.startDate) : 'Monday';
  const activeDateSubjects = weeklyTimetable[activeWeekday] || [];

  const handleInputChange = (day: Weekday, value: string) => {
    setDayInputs((prev) => ({ ...prev, [day]: value }));
    if (dayErrors[day]) {
      setDayErrors((prev) => ({ ...prev, [day]: '' }));
    }
  };

  const handleAddSubject = (day: Weekday) => {
    const val = dayInputs[day] || '';
    const res = addTimetableSubject(day, val);
    if (!res.success) {
      setDayErrors((prev) => ({ ...prev, [day]: res.error || 'Failed to add subject.' }));
    } else {
      setDayInputs((prev) => ({ ...prev, [day]: '' }));
      setDayErrors((prev) => ({ ...prev, [day]: '' }));
    }
  };

  const handleStartEdit = (day: Weekday, id: string, name: string) => {
    setEditingItem({ day, id, name });
    setEditError('');
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const res = updateTimetableSubject(editingItem.day, editingItem.id, editingItem.name);
    if (!res.success) {
      setEditError(res.error || 'Failed to update subject.');
    } else {
      setEditingItem(null);
      setEditError('');
    }
  };

  const totalSubjectsAcrossWeek = Object.values(weeklyTimetable).reduce(
    (acc, list) => acc + list.length,
    0
  );

  return (
    <div className="stage-workspace animate-fade-in">
      <div className="stage-container" style={{ maxWidth: '900px' }}>
        {/* Header */}
        <div className="stage-header">
          <div className="stage-header-main">
            <span className="stage-eyebrow">Step 4 of 4</span>
            <h1 className="stage-title">Weekly Timetable</h1>
            <p className="stage-subtitle">Add subjects scheduled for each weekday.</p>
          </div>
        </div>

        {/* Active Date Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--primary-50)',
            border: '1px solid var(--primary-200)',
            padding: '0.7rem 1rem',
            borderRadius: 'var(--radius-md)',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={15} style={{ color: 'var(--primary-600)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--primary-700)', fontWeight: 500 }}>
              Attendance starts on <strong>{sessionState.startDate}</strong> ({activeWeekday})
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {activeDateSubjects.length > 0 ? (
              activeDateSubjects.map((sub) => (
                <span
                  key={sub.id}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: 'var(--primary-600)',
                    color: '#fff',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {sub.name}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--danger-500)' }}>
                No subjects for {activeWeekday} yet
              </span>
            )}
          </div>
        </div>

        {/* Weekday Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1rem',
          }}
        >
          {SCHEDULED_DAYS.map((day) => {
            const subjects = weeklyTimetable[day] || [];
            const isCurrentSessionDay = day === activeWeekday;
            const inputVal = dayInputs[day] || '';
            const errorMsg = dayErrors[day] || '';

            return (
              <div
                key={day}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: isCurrentSessionDay
                    ? '1.5px solid var(--primary-500)'
                    : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: isCurrentSessionDay ? '0 0 0 3px var(--primary-100)' : 'var(--shadow-xs)',
                }}
              >
                {/* Day Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {day}
                    </span>
                    {isCurrentSessionDay && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          backgroundColor: 'var(--primary-100)',
                          color: 'var(--primary-700)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: 'var(--radius-full)',
                        }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                    {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}
                  </span>
                </div>

                {/* Subject List */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                    marginBottom: '0.75rem',
                    minHeight: '48px',
                    flex: 1,
                  }}
                >
                  {subjects.length === 0 ? (
                    <span
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-subtle)',
                        fontStyle: 'italic',
                        padding: '0.25rem 0',
                      }}
                    >
                      No subjects scheduled
                    </span>
                  ) : (
                    subjects.map((sub) => {
                      const isEditing = editingItem?.day === day && editingItem?.id === sub.id;

                      if (isEditing) {
                        return (
                          <div key={sub.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <input
                                type="text"
                                value={editingItem.name}
                                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit();
                                  if (e.key === 'Escape') { setEditingItem(null); setEditError(''); }
                                }}
                                style={{
                                  flex: 1,
                                  backgroundColor: 'var(--bg-canvas)',
                                  border: '1.5px solid var(--primary-500)',
                                  borderRadius: 'var(--radius-xs)',
                                  color: 'var(--text-primary)',
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.8rem',
                                  outline: 'none',
                                }}
                              />
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                style={{
                                  background: 'var(--success-50)',
                                  border: '1px solid var(--success-500)',
                                  borderRadius: 'var(--radius-xs)',
                                  color: 'var(--success-600)',
                                  padding: '0.25rem 0.5rem',
                                  cursor: 'pointer',
                                }}
                              >
                                <Check size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEditingItem(null); setEditError(''); }}
                                style={{
                                  background: 'var(--bg-surface-subtle)',
                                  border: '1px solid var(--border-default)',
                                  borderRadius: 'var(--radius-xs)',
                                  color: 'var(--text-muted)',
                                  padding: '0.25rem 0.5rem',
                                  cursor: 'pointer',
                                }}
                              >
                                <X size={13} />
                              </button>
                            </div>
                            {editError && (
                              <span style={{ color: 'var(--danger-500)', fontSize: '0.72rem' }}>{editError}</span>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={sub.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: 'var(--bg-surface-subtle)',
                            padding: '0.35rem 0.6rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <span style={{ fontSize: '0.83rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {sub.name}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(day, sub.id, sub.name)}
                              aria-label={`Edit ${sub.name}`}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '0.2rem',
                              }}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTimetableSubject(day, sub.id)}
                              aria-label={`Delete ${sub.name}`}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--danger-500)',
                                cursor: 'pointer',
                                padding: '0.2rem',
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add Input */}
                <div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="text"
                      value={inputVal}
                      onChange={(e) => handleInputChange(day, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleAddSubject(day); }
                      }}
                      placeholder={`Add subject…`}
                      style={{
                        flex: 1,
                        backgroundColor: 'var(--bg-canvas)',
                        border: errorMsg ? '1px solid var(--danger-500)' : '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        padding: '0.4rem 0.6rem',
                        fontSize: '0.8rem',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddSubject(day)}
                      style={{
                        backgroundColor: 'var(--primary-600)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        color: '#fff',
                        padding: '0.4rem 0.65rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <Plus size={13} /> Add
                    </button>
                  </div>
                  {errorMsg && (
                    <span
                      style={{
                        color: 'var(--danger-500)',
                        fontSize: '0.72rem',
                        marginTop: '0.25rem',
                        display: 'block',
                      }}
                    >
                      {errorMsg}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <Button variant="ghost" size="md" onClick={prevStep} icon={<ArrowLeft size={14} />}>
            Back to Date
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={nextStep}
            disabled={totalSubjectsAcrossWeek === 0}
            style={{ minWidth: '160px' }}
          >
            Start Attendance
          </Button>
        </div>
      </div>
    </div>
  );
};
