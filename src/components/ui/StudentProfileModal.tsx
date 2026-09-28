import React from 'react';
import type { Person, AttendanceRecord } from '../../types';
import { calculateStudentAttendanceProfile } from '../../models/attendance';

interface StudentProfileModalProps {
  student: Person | null;
  records: AttendanceRecord[];
  onClose: () => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  student,
  records,
  onClose,
}) => {
  if (!student) return null;

  const profile = calculateStudentAttendanceProfile(student, records);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-profile-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-dialog)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              id="student-profile-title"
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              Student Profile
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Personal information and verified attendance records.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-default)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              padding: '0.35rem 0.65rem',
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {/* Personal Info Grid */}
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                marginBottom: '0.5rem',
              }}
            >
              Personal Information
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.75rem',
                backgroundColor: 'var(--bg-canvas)',
                borderRadius: '8px',
                padding: '0.875rem 1rem',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Name</span>
                <span style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {student.name || 'Unnamed'}
                </span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Roll No / ID</span>
                <span style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--primary-600)' }}>
                  {student.rollNumber || '—'}
                </span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phone</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {student.phone ? student.phone : 'Not provided'}
                </span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {student.email ? student.email : 'Not provided'}
                </span>
              </div>
            </div>
          </div>

          {/* Attendance Summary Cards */}
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                marginBottom: '0.5rem',
              }}
            >
              Attendance Summary
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.5rem',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '0.75rem 0.5rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {profile.totalClasses}
                </div>
              </div>
              <div
                style={{
                  backgroundColor: 'var(--success-50)',
                  border: '1px solid var(--success-100)',
                  borderRadius: '8px',
                  padding: '0.75rem 0.5rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--success-text)' }}>Present</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success-text)' }}>
                  {profile.presentClasses}
                </div>
              </div>
              <div
                style={{
                  backgroundColor: 'var(--danger-50)',
                  border: '1px solid var(--danger-100)',
                  borderRadius: '8px',
                  padding: '0.75rem 0.5rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--danger-text)' }}>Absent</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--danger-text)' }}>
                  {profile.absentClasses}
                </div>
              </div>
              <div
                style={{
                  backgroundColor: 'var(--primary-50)',
                  border: '1px solid var(--primary-100)',
                  borderRadius: '8px',
                  padding: '0.75rem 0.5rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--primary-600)' }}>Overall</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-600)' }}>
                  {profile.overallPercentage}
                </div>
              </div>
            </div>
          </div>

          {/* Subject-Wise Breakdown Table */}
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                marginBottom: '0.5rem',
              }}
            >
              Subject-wise Attendance
            </div>

            {profile.subjectStats.length === 0 ? (
              <div
                style={{
                  padding: '1.25rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-canvas)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                }}
              >
                No attendance records logged for this student yet.
              </div>
            ) : (
              <div
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-surface)',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: '0.85rem',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderBottom: '1px solid var(--border-subtle)',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                      }}
                    >
                      <th style={{ padding: '0.625rem 0.875rem' }}>Subject</th>
                      <th style={{ padding: '0.625rem 0.875rem', textAlign: 'center' }}>Present</th>
                      <th style={{ padding: '0.625rem 0.875rem', textAlign: 'center' }}>Absent</th>
                      <th style={{ padding: '0.625rem 0.875rem', textAlign: 'center' }}>Total</th>
                      <th style={{ padding: '0.625rem 0.875rem', textAlign: 'right' }}>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.subjectStats.map((stat, idx) => (
                      <tr
                        key={stat.subject || idx}
                        style={{
                          borderBottom:
                            idx < profile.subjectStats.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        }}
                      >
                        <td style={{ padding: '0.625rem 0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {stat.subject}
                        </td>
                        <td
                          style={{
                            padding: '0.625rem 0.875rem',
                            textAlign: 'center',
                            color: 'var(--success-600)',
                            fontWeight: 600,
                          }}
                        >
                          {stat.present}
                        </td>
                        <td
                          style={{
                            padding: '0.625rem 0.875rem',
                            textAlign: 'center',
                            color: 'var(--danger-600)',
                            fontWeight: 600,
                          }}
                        >
                          {stat.absent}
                        </td>
                        <td
                          style={{
                            padding: '0.625rem 0.875rem',
                            textAlign: 'center',
                            color: 'var(--text-secondary)',
                            fontWeight: 500,
                          }}
                        >
                          {stat.total}
                        </td>
                        <td
                          style={{
                            padding: '0.625rem 0.875rem',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: 'var(--primary-600)',
                          }}
                        >
                          {stat.percentage}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.875rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'var(--bg-surface-subtle)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: 'var(--primary-600)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
