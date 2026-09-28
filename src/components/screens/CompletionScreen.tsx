import React, { useState } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  FolderOpen,
  AlertCircle,
  Eye,
  Check,
} from 'lucide-react';
import { useFlow } from '../../context';
import { Button } from '../ui/Button';
import { StudentProfileModal } from '../ui/StudentProfileModal';
import type { Person } from '../../types';

export const CompletionScreen: React.FC = () => {
  const {
    sessionState,
    prevStep,
    resetFlow,
    getAttendanceDataset,
    saveToStorage,
  } = useFlow();

  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [verifiedSavedPath, setVerifiedSavedPath] = useState<string | null>(null);
  const [inspectStudent, setInspectStudent] = useState<Person | null>(null);

  const dataset = getAttendanceDataset();
  const { summary } = dataset;

  const handleSaveToStorage = async () => {
    setIsSaving(true);
    setSaveError(null);
    setDownloadFeedback(null);

    try {
      const result = await saveToStorage();
      if (result.success) {
        setDownloadFeedback(result.message);
        setVerifiedSavedPath(result.destination);
      } else {
        setSaveError(result.error || result.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Storage operation failed';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenFolder = () => {
    if (verifiedSavedPath && window.electronAPI?.showItemInFolder) {
      window.electronAPI.showItemInFolder(verifiedSavedPath);
    }
  };

  const statCards = [
    { label: 'Total Records', value: summary.totalRecords, color: 'var(--text-primary)', border: 'var(--border-subtle)' },
    { label: 'Present', value: summary.totalPresent, color: 'var(--success-600)', border: 'var(--success-500)' },
    { label: 'Absent', value: summary.totalAbsent, color: 'var(--danger-600)', border: 'var(--danger-500)' },
    { label: 'Rate', value: `${summary.attendancePercentage}%`, color: 'var(--primary-600)', border: 'var(--primary-500)' },
  ];

  return (
    <div className="stage-workspace animate-fade-in">
      <div className="stage-container" style={{ maxWidth: '820px' }}>
        {/* Header */}
        <div className="stage-header">
          <div className="stage-header-main">
            <span className="stage-eyebrow">Session Complete</span>
            <h1 className="stage-title">Attendance Complete</h1>
            <p className="stage-subtitle">Review the summary and save records to storage.</p>
          </div>
        </div>

        {/* Summary Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.75rem',
          }}
        >
          {statCards.map(({ label, value, color, border }) => (
            <div
              key={label}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: `1px solid ${border}`,
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                textAlign: 'center',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                {label}
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Storage Commit */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Save to Excel Workbook
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {sessionState.excelFileName || sessionState.excelFilePath || 'Local Excel Workbook (.xlsx)'}
              </div>
            </div>
            <Button variant="primary" size="lg" onClick={handleSaveToStorage} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Records'}
            </Button>
          </div>

          {saveError && (
            <div
              style={{
                marginTop: '1rem',
                backgroundColor: 'var(--danger-50)',
                border: '1px solid var(--danger-100)',
                color: 'var(--danger-text)',
                padding: '0.625rem 0.875rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{saveError}</span>
            </div>
          )}

          {downloadFeedback && (
            <div
              style={{
                marginTop: '1rem',
                backgroundColor: 'var(--success-50)',
                border: '1px solid var(--success-100)',
                color: 'var(--success-text)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Check size={15} style={{ flexShrink: 0 }} />
                <span>{downloadFeedback}</span>
              </div>
              {verifiedSavedPath && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleOpenFolder}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--success-500)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--success-text)',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <FolderOpen size={12} /> Show File
                  </button>
                </div>
              )}
            </div>
          )}
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-surface-subtle)',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Student Profiles
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Click Profile for subject-wise breakdown
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '0.45rem 0.75rem', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '0.45rem 0.75rem', fontWeight: 600 }}>Roll No / ID</th>
                <th style={{ padding: '0.45rem 0.75rem', fontWeight: 600, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(sessionState.people || []).map((p, idx) => (
                <tr
                  key={p.id || idx}
                  style={{
                    borderBottom:
                      idx < (sessionState.people?.length || 0) - 1
                        ? '1px solid var(--border-subtle)'
                        : 'none',
                  }}
                >
                  <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {p.name || `Person ${idx + 1}`}
                  </td>
                  <td style={{ padding: '0.45rem 0.75rem', color: 'var(--primary-600)', fontWeight: 500 }}>
                    {p.rollNumber || '—'}
                  </td>
                  <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right' }}>
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
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <Eye size={12} /> View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
            Back to Attendance
          </Button>
          <Button variant="secondary" size="md" onClick={() => resetFlow()} icon={<RotateCcw size={14} />}>
            Start New Session
          </Button>
        </div>
      </div>

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
