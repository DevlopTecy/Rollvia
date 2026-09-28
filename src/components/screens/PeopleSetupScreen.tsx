import React, { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Minus,
  Check,
  Eye,
} from 'lucide-react';
import { useFlow } from '../../context';
import { Button } from '../ui/Button';
import { StudentProfileModal } from '../ui/StudentProfileModal';
import type { Person } from '../../types';

export const PeopleSetupScreen: React.FC = () => {
  const { sessionState, setPeopleCount, updatePerson, prevStep, nextStep } = useFlow();

  const existingPeople = sessionState.people || [];
  const initialCount = sessionState.peopleCount || (existingPeople.length > 0 ? existingPeople.length : 3);

  const [countInput, setCountInput] = useState<number>(initialCount);
  const [activePersonIndex, setActivePersonIndex] = useState<number>(0);
  const [errors, setErrors] = useState<{ name?: string; rollNumber?: string }>({});
  const [inspectStudent, setInspectStudent] = useState<Person | null>(null);

  const currentPerson: Person = existingPeople[activePersonIndex] || {
    id: `temp_${activePersonIndex}`,
    name: '',
    rollNumber: '',
    phone: '',
    email: '',
  };

  const isPersonValid = (p?: Person): boolean => {
    if (!p) return false;
    return Boolean(p.name && p.name.trim().length > 0 && p.rollNumber && p.rollNumber.trim().length > 0);
  };

  const allPeopleValid = existingPeople.length > 0 && existingPeople.every(isPersonValid);

  const handleApplyCount = (count: number) => {
    if (isNaN(count) || count < 1) return;
    setPeopleCount(count);
    if (activePersonIndex >= count) {
      setActivePersonIndex(Math.max(0, count - 1));
    }
  };

  const handleFieldChange = (field: keyof Person, value: string) => {
    updatePerson(activePersonIndex, { [field]: value });
    if (field === 'name' && value.trim()) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
    if (field === 'rollNumber' && value.trim()) {
      setErrors((prev) => ({ ...prev, rollNumber: undefined }));
    }
  };

  const validateActivePerson = (): boolean => {
    const newErrors: { name?: string; rollNumber?: string } = {};
    if (!currentPerson.name || !currentPerson.name.trim()) {
      newErrors.name = 'Name is required.';
    }
    if (!currentPerson.rollNumber || !currentPerson.rollNumber.trim()) {
      newErrors.rollNumber = 'Roll No / ID is required.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextPerson = () => {
    const isValid = validateActivePerson();
    if (!isValid) return;

    if (activePersonIndex < existingPeople.length - 1) {
      setActivePersonIndex(activePersonIndex + 1);
      setErrors({});
    } else {
      nextStep();
    }
  };

  const handlePrevPerson = () => {
    if (activePersonIndex > 0) {
      setActivePersonIndex(activePersonIndex - 1);
      setErrors({});
    }
  };

  return (
    <div className="stage-workspace animate-fade-in">
      <div className="stage-container" style={{ maxWidth: '820px' }}>
        {/* Header */}
        <div className="stage-header">
          <div className="stage-header-main">
            <span className="stage-eyebrow">Step 2 of 4</span>
            <h1 className="stage-title">Students Setup</h1>
            <p className="stage-subtitle">Enter details for each student.</p>
          </div>

          {/* Count Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--bg-surface)',
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total:</span>
            <button
              type="button"
              onClick={() => {
                const next = Math.max(1, countInput - 1);
                setCountInput(next);
                handleApplyCount(next);
              }}
              disabled={countInput <= 1}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface-subtle)',
                color: 'var(--text-primary)',
                cursor: countInput <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: countInput <= 1 ? 0.4 : 1,
              }}
            >
              <Minus size={13} />
            </button>
            <span
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'var(--primary-700)',
                minWidth: '24px',
                textAlign: 'center',
              }}
            >
              {countInput}
            </span>
            <button
              type="button"
              onClick={() => {
                const next = Math.min(100, countInput + 1);
                setCountInput(next);
                handleApplyCount(next);
              }}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface-subtle)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Student Pagination Pills */}
        <div className="person-chips-scroll">
          {existingPeople.map((p, idx) => {
            const isValid = isPersonValid(p);
            const isActive = idx === activePersonIndex;
            return (
              <button
                key={p.id || idx}
                type="button"
                onClick={() => {
                  setActivePersonIndex(idx);
                  setErrors({});
                }}
                className={`person-chip-btn ${isActive ? 'is-active' : ''} ${isValid && !isActive ? 'is-valid' : ''}`}
              >
                <span>#{idx + 1}</span>
                <span>{p.name.trim() ? p.name.trim().split(' ')[0] : `Person ${idx + 1}`}</span>
                {isValid && <Check size={11} />}
              </button>
            );
          })}
        </div>

        {/* Active Person Form */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Progress bar */}
          <div className="person-progress-bar">
            <div
              className="person-progress-fill"
              style={{ width: `${((activePersonIndex + 1) / existingPeople.length) * 100}%` }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1.25rem',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface-subtle)',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
              Person #{activePersonIndex + 1} of {existingPeople.length}
            </span>
            <button
              type="button"
              onClick={() => setInspectStudent(currentPerson)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.3rem 0.65rem',
                fontSize: '0.775rem',
                fontWeight: 500,
                color: 'var(--primary-600)',
                cursor: 'pointer',
              }}
            >
              <Eye size={13} /> View Profile
            </button>
          </div>

          {/* Inputs */}
          <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Full Name <span style={{ color: 'var(--danger-500)' }}>*</span>
              </label>
              <input
                type="text"
                value={currentPerson.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="e.g. John Doe"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-canvas)',
                  border: errors.name ? '1px solid var(--danger-500)' : '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              {errors.name && <span style={{ color: 'var(--danger-500)', fontSize: '0.75rem', marginTop: '0.2rem', display: 'block' }}>{errors.name}</span>}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Roll No / ID <span style={{ color: 'var(--danger-500)' }}>*</span>
              </label>
              <input
                type="text"
                value={currentPerson.rollNumber}
                onChange={(e) => handleFieldChange('rollNumber', e.target.value)}
                placeholder="e.g. 101"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-canvas)',
                  border: errors.rollNumber ? '1px solid var(--danger-500)' : '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              {errors.rollNumber && <span style={{ color: 'var(--danger-500)', fontSize: '0.75rem', marginTop: '0.2rem', display: 'block' }}>{errors.rollNumber}</span>}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Phone <span className="field-optional-badge">optional</span>
              </label>
              <input
                type="text"
                value={currentPerson.phone || ''}
                onChange={(e) => handleFieldChange('phone', e.target.value)}
                placeholder="e.g. +1 (555) 234-5678"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Email <span className="field-optional-badge">optional</span>
              </label>
              <input
                type="email"
                value={currentPerson.email || ''}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                placeholder="e.g. alex@school.edu"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Person Nav */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface-subtle)',
            }}
          >
            <Button variant="ghost" size="sm" onClick={handlePrevPerson} disabled={activePersonIndex === 0}>
              ← Previous
            </Button>
            <Button variant="secondary" size="sm" onClick={handleNextPerson}>
              {activePersonIndex < existingPeople.length - 1 ? 'Next →' : 'Save & Continue →'}
            </Button>
          </div>
        </div>

        {/* Roster Table */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div
            style={{
              padding: '0.65rem 1rem',
              borderBottom: '1px solid var(--border-subtle)',
              fontWeight: 600,
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-surface-subtle)',
            }}
          >
            Roster ({existingPeople.filter(isPersonValid).length}/{existingPeople.length} completed)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  color: 'var(--text-muted)',
                  textAlign: 'left',
                }}
              >
                <th style={{ padding: '0.45rem 0.75rem', fontWeight: 600 }}>#</th>
                <th style={{ padding: '0.45rem 0.75rem', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '0.45rem 0.75rem', fontWeight: 600 }}>Roll No / ID</th>
                <th style={{ padding: '0.45rem 0.75rem', fontWeight: 600 }}>Contact</th>
                <th style={{ padding: '0.45rem 0.75rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {existingPeople.map((p, idx) => {
                const valid = isPersonValid(p);
                return (
                  <tr
                    key={p.id || idx}
                    style={{
                      borderBottom: idx < existingPeople.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      backgroundColor: idx === activePersonIndex ? 'var(--primary-50)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-subtle)' }}>#{idx + 1}</td>
                    <td
                      style={{
                        padding: '0.45rem 0.75rem',
                        fontWeight: 600,
                        color: valid ? 'var(--text-primary)' : 'var(--danger-500)',
                      }}
                    >
                      {p.name.trim() || 'Missing name'}
                    </td>
                    <td style={{ padding: '0.45rem 0.75rem', color: 'var(--primary-600)', fontWeight: 500 }}>
                      {p.rollNumber.trim() || '—'}
                    </td>
                    <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-muted)' }}>
                      {p.email || p.phone || '—'}
                    </td>
                    <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setActivePersonIndex(idx);
                            setErrors({});
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-xs)',
                            color: 'var(--text-secondary)',
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectStudent(p)}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--primary-200)',
                            borderRadius: 'var(--radius-xs)',
                            color: 'var(--primary-600)',
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Profile
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Navigation */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <Button variant="ghost" size="md" onClick={prevStep} icon={<ArrowLeft size={14} />}>
            Back to Storage
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={nextStep}
            disabled={!allPeopleValid}
            style={{ minWidth: '140px' }}
          >
            Continue to Month
          </Button>
        </div>
      </div>

      {/* Student Profile Dialog */}
      {inspectStudent && (
        <StudentProfileModal
          student={inspectStudent}
          records={sessionState.attendanceRecords || []}
          onClose={() => setInspectStudent(null)}
        />
      )}
    </div>
  );
};
