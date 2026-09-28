import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Copy, AlertTriangle } from 'lucide-react';
import { useFlow } from '../../context';
import type { Weekday, WeeklyTimetable } from '../../types';

const WEEKDAYS: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TimetableView: React.FC = () => {
  const { weeklyTimetable, addTimetableSubject, updateTimetableSubject, deleteTimetableSubject, updateSessionState } = useFlow();

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingItem, setEditingItem] = useState<{ day: Weekday; id: string; name: string } | null>(null);
  const [editError, setEditError] = useState('');

  // Copy timetable modal state
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [sourceDay, setSourceDay] = useState<Weekday>('Monday');
  const [targetDays, setTargetDays] = useState<Weekday[]>([]);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [copySuccessMsg, setCopySuccessMsg] = useState('');

  const handleAdd = (day: Weekday) => {
    const val = (inputs[day] || '').trim();
    const res = addTimetableSubject(day, val);
    if (!res.success) {
      setErrors((p) => ({ ...p, [day]: res.error || 'Error' }));
    } else {
      setInputs((p) => ({ ...p, [day]: '' }));
      setErrors((p) => ({ ...p, [day]: '' }));
    }
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const res = updateTimetableSubject(editingItem.day, editingItem.id, editingItem.name);
    if (!res.success) {
      setEditError(res.error || 'Error');
    } else {
      setEditingItem(null);
      setEditError('');
    }
  };

  // Check if any target days have existing subjects
  const sourceSubjects = weeklyTimetable[sourceDay] || [];
  const targetDaysWithSubjects = targetDays.filter((d) => (weeklyTimetable[d] || []).length > 0);
  const hasOverwriteRisk = targetDaysWithSubjects.length > 0;

  const handleOpenCopyModal = () => {
    // Default source to Monday (or first day with subjects)
    const firstWithSubjects = WEEKDAYS.find((d) => (weeklyTimetable[d] || []).length > 0) || 'Monday';
    setSourceDay(firstWithSubjects);
    setTargetDays([]);
    setConfirmOverwrite(false);
    setCopySuccessMsg('');
    setShowCopyModal(true);
  };

  const toggleTargetDay = (day: Weekday) => {
    setTargetDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSelectAllTargets = () => {
    const available = WEEKDAYS.filter((d) => d !== sourceDay);
    if (targetDays.length === available.length) {
      setTargetDays([]);
    } else {
      setTargetDays(available);
    }
  };

  const handleExecuteCopy = () => {
    if (targetDays.length === 0) return;
    if (hasOverwriteRisk && !confirmOverwrite) return;

    const updatedTable: WeeklyTimetable = { ...weeklyTimetable };

    for (const target of targetDays) {
      updatedTable[target] = sourceSubjects.map((s) => ({
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: s.name,
      }));
    }

    updateSessionState({ weeklyTimetable: updatedTable });
    setShowCopyModal(false);
    setCopySuccessMsg(`Copied ${sourceDay}'s schedule to ${targetDays.join(', ')}.`);
    setTimeout(() => setCopySuccessMsg(''), 4000);
  };

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: 'var(--bg-app)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* ── Header with "Copy Timetable" Action ───────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
            Weekly Timetable
          </h2>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Subjects scheduled per weekday. The attendance grid uses this automatically.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {copySuccessMsg && (
            <span style={{ fontSize: '0.78rem', color: 'var(--success-600)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <Check size={13} /> {copySuccessMsg}
            </span>
          )}
          <button
            type="button"
            onClick={handleOpenCopyModal}
            title="Duplicate an existing timetable configuration to other days"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              padding: '0.4rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <Copy size={13} /> Copy Timetable
          </button>
        </div>
      </div>

      {/* Note about historical integrity */}
      <div
        style={{
          backgroundColor: 'var(--primary-50)',
          border: '1px solid var(--primary-200)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.6rem 0.875rem',
          fontSize: '0.78rem',
          color: 'var(--primary-700)',
        }}
      >
        ℹ Editing or copying the timetable applies to future attendance tracking. Historical records are preserved.
      </div>

      {/* Day Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem' }}>
        {WEEKDAYS.map((day) => {
          const subjects = weeklyTimetable[day] || [];
          const inputVal = inputs[day] || '';
          const errorMsg = errors[day] || '';

          return (
            <div
              key={day}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              {/* Day header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{day}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                  {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Subject list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minHeight: '48px' }}>
                {subjects.length === 0 ? (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>
                    No subjects scheduled
                  </span>
                ) : (
                  subjects.map((sub) => {
                    const isEdit = editingItem?.day === day && editingItem?.id === sub.id;

                    if (isEdit) {
                      return (
                        <div key={sub.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
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
                                border: '1.5px solid var(--primary-500)',
                                borderRadius: 'var(--radius-xs)',
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.8rem',
                                outline: 'none',
                                backgroundColor: 'var(--bg-canvas)',
                                color: 'var(--text-primary)',
                              }}
                            />
                            <button type="button" onClick={handleSaveEdit} style={actionBtnStyle('success')}>
                              <Check size={13} />
                            </button>
                            <button type="button" onClick={() => { setEditingItem(null); setEditError(''); }} style={actionBtnStyle('neutral')}>
                              <X size={13} />
                            </button>
                          </div>
                          {editError && <span style={{ fontSize: '0.72rem', color: 'var(--danger-500)' }}>{editError}</span>}
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
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.3rem 0.6rem',
                        }}
                      >
                        <span style={{ fontWeight: 500, fontSize: '0.83rem', color: 'var(--text-primary)' }}>
                          {sub.name}
                        </span>
                        <div style={{ display: 'flex', gap: '0.2rem' }}>
                          <button
                            type="button"
                            onClick={() => { setEditingItem({ day, id: sub.id, name: sub.name }); setEditError(''); }}
                            style={iconMicroBtn('neutral')}
                            title="Edit"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTimetableSubject(day, sub.id)}
                            style={iconMicroBtn('danger')}
                            title="Delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Subject Input */}
              <div>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => { setInputs((p) => ({ ...p, [day]: e.target.value })); setErrors((p) => ({ ...p, [day]: '' })); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(day); } }}
                    placeholder="Add subject…"
                    style={{
                      flex: 1,
                      border: errorMsg ? '1px solid var(--danger-500)' : '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.38rem 0.6rem',
                      fontSize: '0.8rem',
                      backgroundColor: 'var(--bg-canvas)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAdd(day)}
                    style={{
                      backgroundColor: 'var(--primary-600)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fff',
                      padding: '0.38rem 0.6rem',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
                {errorMsg && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--danger-500)', marginTop: '0.2rem', display: 'block' }}>
                    {errorMsg}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Copy Timetable Dialog ──────────────────────────────────────────────── */}
      {showCopyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
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
              maxWidth: '480px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Copy size={16} style={{ color: 'var(--primary-600)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Copy Timetable
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Duplicate subjects from one weekday to other days in your weekly schedule.
            </p>

            {/* Source Day Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Copy From (Source Day)
              </label>
              <select
                value={sourceDay}
                onChange={(e) => {
                  const newSource = e.target.value as Weekday;
                  setSourceDay(newSource);
                  setTargetDays((p) => p.filter((d) => d !== newSource));
                }}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-canvas)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              >
                {WEEKDAYS.map((d) => (
                  <option key={d} value={d}>
                    {d} ({(weeklyTimetable[d] || []).length} subjects)
                  </option>
                ))}
              </select>

              {/* Source Subjects Preview */}
              <div style={{ marginTop: '0.35rem', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                {sourceSubjects.length > 0 ? (
                  <span>Subjects: {sourceSubjects.map((s) => s.name).join(', ')}</span>
                ) : (
                  <span style={{ color: 'var(--warning-600)' }}>⚠️ Source day has no subjects to copy.</span>
                )}
              </div>
            </div>

            {/* Target Days Selection */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Copy To (Target Days)
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllTargets}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-600)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {targetDays.length === WEEKDAYS.filter((d) => d !== sourceDay).length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
                {WEEKDAYS.filter((d) => d !== sourceDay).map((day) => {
                  const isChecked = targetDays.includes(day);
                  const existingCount = (weeklyTimetable[day] || []).length;

                  return (
                    <label
                      key={day}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        padding: '0.35rem 0.5rem',
                        borderRadius: 'var(--radius-xs)',
                        border: isChecked ? '1px solid var(--primary-500)' : '1px solid var(--border-subtle)',
                        backgroundColor: isChecked ? 'var(--primary-50)' : 'var(--bg-canvas)',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleTargetDay(day)}
                        style={{ accentColor: 'var(--primary-600)', cursor: 'pointer' }}
                      />
                      <span>{day}</span>
                      {existingCount > 0 && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          ({existingCount})
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Overwrite Confirmation Warning */}
            {hasOverwriteRisk && (
              <div
                style={{
                  backgroundColor: 'var(--warning-50)',
                  border: '1px solid var(--warning-200)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '0.6rem 0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--warning-700)', fontWeight: 600, fontSize: '0.78rem' }}>
                  <AlertTriangle size={13} />
                  <span>Existing Subjects Will Be Replaced</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--warning-800)' }}>
                  The following day(s) already have subjects that will be overwritten:
                  <div style={{ fontWeight: 600, marginTop: '2px' }}>
                    {targetDaysWithSubjects.map((d) => `${d} (${(weeklyTimetable[d] || []).length})`).join(', ')}
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--warning-800)', cursor: 'pointer', marginTop: '0.2rem' }}>
                  <input
                    type="checkbox"
                    checked={confirmOverwrite}
                    onChange={(e) => setConfirmOverwrite(e.target.checked)}
                    style={{ accentColor: 'var(--warning-600)', cursor: 'pointer' }}
                  />
                  <span>I confirm overwriting subjects on selected days.</span>
                </label>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
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
                onClick={handleExecuteCopy}
                disabled={targetDays.length === 0 || sourceSubjects.length === 0 || (hasOverwriteRisk && !confirmOverwrite)}
                style={{
                  padding: '0.35rem 0.9rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  backgroundColor:
                    targetDays.length === 0 || sourceSubjects.length === 0 || (hasOverwriteRisk && !confirmOverwrite)
                      ? 'var(--border-strong)'
                      : 'var(--primary-600)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  cursor:
                    targetDays.length === 0 || sourceSubjects.length === 0 || (hasOverwriteRisk && !confirmOverwrite)
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                Copy Timetable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function actionBtnStyle(variant: 'success' | 'neutral'): React.CSSProperties {
  return {
    backgroundColor: variant === 'success' ? 'var(--success-50)' : 'var(--bg-canvas)',
    border: `1px solid ${variant === 'success' ? 'var(--success-500)' : 'var(--border-default)'}`,
    borderRadius: 'var(--radius-xs)',
    color: variant === 'success' ? 'var(--success-600)' : 'var(--text-secondary)',
    padding: '0.25rem 0.4rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
  };
}

function iconMicroBtn(variant: 'neutral' | 'danger'): React.CSSProperties {
  return {
    background: 'transparent',
    border: 'none',
    color: variant === 'danger' ? 'var(--danger-500)' : 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.15rem',
    display: 'inline-flex',
    alignItems: 'center',
  };
}
