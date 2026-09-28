import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  XCircle,
} from 'lucide-react';
import { useFlow } from '../../context';
import { Button } from '../ui/Button';
import type { Person, Student } from '../../types';
import { getWeekdayForDate } from '../../utils/calendar';

export const AttendanceScreen: React.FC = () => {
  const { sessionState, weeklyTimetable, savePersonAttendance, prevStep, nextStep } = useFlow();

  const people: (Person | Student)[] =
    sessionState.people && sessionState.people.length > 0
      ? sessionState.people
      : sessionState.members && sessionState.members.length > 0
      ? sessionState.members
      : [];

  const activeWeekday = sessionState.startDate ? getWeekdayForDate(sessionState.startDate) : 'Monday';
  const scheduledSubjects = weeklyTimetable[activeWeekday] || [];

  const activeClasses: { id: string; name: string }[] =
    scheduledSubjects.length > 0
      ? scheduledSubjects
      : sessionState.classes && sessionState.classes.length > 0
      ? sessionState.classes
      : [];

  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const safeIndex = people.length > 0 ? Math.min(Math.max(0, currentIndex), people.length - 1) : 0;
  const currentPerson = people[safeIndex];
  const personId = currentPerson?.id || `p_${safeIndex + 1}`;

  const currentPersonAttendance = sessionState.personAttendance?.[personId] || {};

  const displayDate = sessionState.startDate
    ? `${activeWeekday}, ${sessionState.startDate}`
    : 'Selected Date';

  const handleToggleSubject = (subjectId: string) => {
    const updated = {
      ...currentPersonAttendance,
      [subjectId]: !currentPersonAttendance[subjectId],
    };
    savePersonAttendance(personId, updated);
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, boolean> = {};
    activeClasses.forEach((c) => { updated[c.id] = true; });
    savePersonAttendance(personId, updated);
  };

  const handleMarkAllAbsent = () => {
    const updated: Record<string, boolean> = {};
    activeClasses.forEach((c) => { updated[c.id] = false; });
    savePersonAttendance(personId, updated);
  };

  const handleNext = () => {
    savePersonAttendance(personId, currentPersonAttendance);
    if (safeIndex < people.length - 1) {
      setCurrentIndex(safeIndex + 1);
    } else {
      nextStep();
    }
  };

  const handlePrev = () => {
    if (safeIndex > 0) setCurrentIndex(safeIndex - 1);
  };

  const personNumber = safeIndex + 1;
  const personName =
    'name' in currentPerson && currentPerson.name ? currentPerson.name : `Person ${personNumber}`;
  const personIdNum =
    'rollNumber' in currentPerson && currentPerson.rollNumber
      ? currentPerson.rollNumber
      : 'rollNo' in currentPerson && currentPerson.rollNo
      ? currentPerson.rollNo
      : `ID-${personNumber}`;

  const presentCount = activeClasses.filter((c) => currentPersonAttendance[c.id]).length;

  return (
    <div className="stage-workspace animate-fade-in">
      <div className="stage-container" style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div className="stage-header">
          <div className="stage-header-main">
            <span className="stage-eyebrow">Attendance Roll Call</span>
            <h1 className="stage-title">Mark Attendance</h1>
            <p className="stage-subtitle">
              {activeWeekday} subjects • {people.length} student{people.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {activeClasses.length === 0 ? (
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '2rem',
              textAlign: 'center',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              No subjects scheduled on {activeWeekday}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.25rem 0' }}>
              Add subjects to the {activeWeekday} timetable first.
            </p>
            <Button variant="primary" size="md" onClick={prevStep}>
              Edit Timetable
            </Button>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {/* Progress bar */}
              <div
                style={{
                  height: '3px',
                  backgroundColor: 'var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${(personNumber / people.length) * 100}%`,
                    backgroundColor: 'var(--primary-600)',
                    transition: 'width 250ms ease',
                  }}
                />
              </div>

              {/* Person Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem 0.875rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface-subtle)',
                }}
              >
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--primary-600)',
                      marginBottom: '0.15rem',
                    }}
                  >
                    {personNumber} of {people.length}
                  </span>
                  <h2
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: 0,
                      lineHeight: 1.2,
                    }}
                  >
                    {personName}
                  </h2>
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      marginTop: '0.25rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>
                      ID: <strong style={{ color: 'var(--text-secondary)' }}>{personIdNum}</strong>
                    </span>
                    <span>•</span>
                    <span>{displayDate}</span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={handleMarkAllPresent}
                    style={{
                      background: 'var(--success-50)',
                      border: '1px solid var(--success-500)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--success-600)',
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.73rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <CheckCheck size={13} /> All Present
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkAllAbsent}
                    style={{
                      background: 'var(--danger-50)',
                      border: '1px solid var(--danger-500)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--danger-600)',
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.73rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <XCircle size={13} /> All Absent
                  </button>
                </div>
              </div>

              {/* Subject Checkboxes */}
              <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {activeClasses.map((cls) => {
                  const isPresent = Boolean(currentPersonAttendance[cls.id]);
                  return (
                    <div
                      key={cls.id}
                      onClick={() => handleToggleSubject(cls.id)}
                      role="checkbox"
                      aria-checked={isPresent}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          handleToggleSubject(cls.id);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isPresent ? 'var(--success-50)' : 'var(--bg-canvas)',
                        border: isPresent ? '1.5px solid var(--success-500)' : '1px solid var(--border-default)',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.1s ease',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            border: isPresent ? '2px solid var(--success-500)' : '2px solid var(--border-strong)',
                            backgroundColor: isPresent ? 'var(--success-500)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            flexShrink: 0,
                          }}
                        >
                          {isPresent && <Check size={12} strokeWidth={3} />}
                        </div>
                        <span
                          style={{
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            color: isPresent ? 'var(--success-text)' : 'var(--text-primary)',
                          }}
                        >
                          {cls.name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.73rem',
                          fontWeight: 700,
                          color: isPresent ? 'var(--success-600)' : 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {isPresent ? 'Present' : 'Absent'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Summary + Nav */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1.25rem',
                  borderTop: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface-subtle)',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--success-600)' }}>{presentCount}</span>
                  /{activeClasses.length} present
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button variant="ghost" size="sm" onClick={handlePrev} disabled={safeIndex === 0}>
                    ← Prev
                  </Button>
                  <Button variant="primary" size="md" onClick={handleNext} style={{ minWidth: '130px' }}>
                    {safeIndex < people.length - 1 ? 'NEXT →' : 'SUBMIT →'}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Back */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '0.5rem' }}>
          <Button variant="ghost" size="sm" onClick={prevStep} icon={<ArrowLeft size={13} />}>
            Back to Timetable
          </Button>
        </div>
      </div>
    </div>
  );
};
