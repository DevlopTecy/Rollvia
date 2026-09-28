import React, { useState, useRef } from 'react';
import { CalendarDays, Users, LayoutGrid, ChevronDown, ChevronLeft, ChevronRight, Download, Upload, AlertTriangle, Check, X } from 'lucide-react';
import { useFlow, useTheme } from '../../context';
import type { WorkspaceTab } from '../../types';
import { MONTH_NAMES, getSupportedYears, getMinSupportedYear, getMaxSupportedYear } from '../../utils/calendar';
import { ThemeToggle } from '../ui/ThemeToggle';
import attendlyLogo from '../../assets/attendly-logo.png';
import attendlyLogoDark from '../../assets/attendly-icon-dark.png';
import attendlyLogoLight from '../../assets/attendly-icon-light.png';

interface WorkspaceHeaderProps {
  onReset?: () => void;
}

interface BackupSummary {
  peopleCount: number;
  datesCount: number;
  hasTimetable: boolean;
  exportedAt?: string;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = () => {
  const { theme } = useTheme();
  const currentIcon = theme === 'light' ? attendlyLogoLight : (attendlyLogoDark || attendlyLogo);

  const {
    sessionState,
    activeTab,
    setActiveTab,
    setWorkspaceMonth,
    updateSessionState,
    restoreWorkspaceBackup,
  } = useFlow();

  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backup & Restore state
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{
    data: unknown;
    summary: BackupSummary;
  } | null>(null);

  const tabs: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
    { id: 'attendance', label: 'Attendance', icon: <CalendarDays size={14} /> },
    { id: 'students', label: 'Students', icon: <Users size={14} /> },
    { id: 'timetable', label: 'Timetable', icon: <LayoutGrid size={14} /> },
  ];

  const supportedYears = React.useMemo(() => getSupportedYears(), []);
  const minSupportedYear = React.useMemo(() => getMinSupportedYear(), []);
  const maxSupportedYear = React.useMemo(() => getMaxSupportedYear(), []);

  const handlePrevYear = () => {
    const yr = sessionState.selectedYear;
    const mi = sessionState.selectedMonthIndex;
    if (yr > minSupportedYear) {
      setWorkspaceMonth(yr - 1, mi);
    }
  };

  const handleNextYear = () => {
    const yr = sessionState.selectedYear;
    const mi = sessionState.selectedMonthIndex;
    if (yr < maxSupportedYear) {
      setWorkspaceMonth(yr + 1, mi);
    }
  };

  const handlePrevMonth = () => {
    const mi = sessionState.selectedMonthIndex;
    const yr = sessionState.selectedYear;
    if (mi === 0) {
      if (yr > minSupportedYear) {
        setWorkspaceMonth(yr - 1, 11);
      }
    } else {
      setWorkspaceMonth(yr, mi - 1);
    }
    setShowMonthPicker(false);
  };

  const handleNextMonth = () => {
    const mi = sessionState.selectedMonthIndex;
    const yr = sessionState.selectedYear;
    if (mi === 11) {
      if (yr < maxSupportedYear) {
        setWorkspaceMonth(yr + 1, 0);
      }
    } else {
      setWorkspaceMonth(yr, mi + 1);
    }
    setShowMonthPicker(false);
  };

  // ─── Backup Action ──────────────────────────────────────────────────────────
  const handleBackup = () => {
    try {
      const backupPayload = {
        rollviaBackupVersion: 1,
        attendlyBackupVersion: 1, // Retained for backward compatibility
        exportedAt: new Date().toISOString(),
        institutionName: sessionState.institutionName,
        departmentName: sessionState.departmentName,
        academicYear: sessionState.academicYear,
        selectedMonth: sessionState.selectedMonth,
        selectedYear: sessionState.selectedYear,
        selectedMonthIndex: sessionState.selectedMonthIndex,
        startDate: sessionState.startDate,
        storageMode: sessionState.storageMode,
        excelFilePath: sessionState.excelFilePath,
        excelFileName: sessionState.excelFileName,
        people: sessionState.people,
        weeklyTimetable: sessionState.weeklyTimetable,
        classes: sessionState.classes,
        savedDailyAttendance: sessionState.savedDailyAttendance,
        savedDates: sessionState.savedDates,
        noClassDates: sessionState.noClassDates,
        attendanceRecords: sessionState.attendanceRecords,
      };

      const jsonString = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `Rollvia_Backup_${dateStr}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatusMsg({ text: 'Backup downloaded', isError: false });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch {
      setStatusMsg({ text: 'Backup failed', isError: true });
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  // ─── Restore Trigger & Validation ──────────────────────────────────────────
  const handleTriggerRestore = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object') {
          setStatusMsg({ text: 'Invalid JSON file', isError: true });
          setTimeout(() => setStatusMsg(null), 4000);
          return;
        }

        const dataObj = parsed as Record<string, unknown>;
        const peopleList = Array.isArray(dataObj.people) ? dataObj.people : [];
        const savedAtt = (dataObj.savedDailyAttendance as Record<string, unknown>) || {};
        const recordedDates = Object.keys(savedAtt);
        const hasTimetable = Boolean(dataObj.weeklyTimetable && typeof dataObj.weeklyTimetable === 'object');

        if (peopleList.length === 0 && recordedDates.length === 0 && !hasTimetable) {
          setStatusMsg({ text: 'Backup contains no usable data', isError: true });
          setTimeout(() => setStatusMsg(null), 4000);
          return;
        }

        setPendingRestore({
          data: parsed,
          summary: {
            peopleCount: peopleList.length,
            datesCount: recordedDates.length,
            hasTimetable,
            exportedAt: typeof dataObj.exportedAt === 'string' ? dataObj.exportedAt : undefined,
          },
        });
      } catch {
        setStatusMsg({ text: 'Failed to read backup file', isError: true });
        setTimeout(() => setStatusMsg(null), 4000);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!pendingRestore) return;
    const res = restoreWorkspaceBackup(pendingRestore.data);
    if (res.success) {
      setPendingRestore(null);
      setStatusMsg({ text: 'Workspace restored successfully', isError: false });
      setTimeout(() => setStatusMsg(null), 4000);
    } else {
      setStatusMsg({ text: res.error || 'Restore failed', isError: true });
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  return (
    <header
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        height: '48px',
        flexShrink: 0,
        gap: '1rem',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Hidden File Input for Restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChosen}
        accept=".json,application/json"
        style={{ display: 'none' }}
      />

      {/* Left: Brand + Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* Brand with Clickable Logo */}
        <button
          type="button"
          onClick={() => updateSessionState({ appPhase: 'setup' })}
          title="Return to Setup screen"
          aria-label="Rollvia Logo - Back to Setup"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: 'none',
            border: 'none',
            padding: '0.2rem 0.4rem',
            margin: '-0.2rem -0.4rem',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease, transform 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-surface-subtle)';
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <img
            src={currentIcon}
            alt="Rollvia Logo"
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '5px',
              objectFit: 'contain',
              display: 'block',
              boxShadow: 'var(--shadow-xs)',
            }}
          />
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.92rem',
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Rollvia
          </span>
        </button>

        {/* Tab Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: isActive ? 'var(--primary-50)' : 'transparent',
                  color: isActive ? 'var(--primary-700)' : 'var(--text-muted)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right: Month Selector + Storage Status + Backup/Restore + Student Count + Theme Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        {/* Status notification toast */}
        {statusMsg && (
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: statusMsg.isError ? 'var(--danger-600)' : 'var(--success-600)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            {statusMsg.isError ? <AlertTriangle size={11} /> : <Check size={11} />}
            {statusMsg.text}
          </span>
        )}

        {/* Month Selector with Prev/Next steppers */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
          <button
            type="button"
            onClick={handlePrevMonth}
            disabled={sessionState.selectedYear <= minSupportedYear && sessionState.selectedMonthIndex === 0}
            aria-label="Previous Month"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-canvas)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              padding: '0.35rem 0.35rem',
              cursor: sessionState.selectedYear <= minSupportedYear && sessionState.selectedMonthIndex === 0 ? 'not-allowed' : 'pointer',
              opacity: sessionState.selectedYear <= minSupportedYear && sessionState.selectedMonthIndex === 0 ? 0.4 : 1,
            }}
            title="Previous Month"
          >
            <ChevronLeft size={13} />
          </button>

          <button
            type="button"
            onClick={() => setShowMonthPicker((p) => !p)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: 'var(--bg-canvas)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              padding: '0.3rem 0.65rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <CalendarDays size={13} style={{ color: 'var(--text-muted)' }} />
            {MONTH_NAMES[sessionState.selectedMonthIndex]} {sessionState.selectedYear}
            <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
          </button>

          <button
            type="button"
            onClick={handleNextMonth}
            disabled={sessionState.selectedYear >= maxSupportedYear && sessionState.selectedMonthIndex === 11}
            aria-label="Next Month"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-canvas)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              padding: '0.35rem 0.35rem',
              cursor: sessionState.selectedYear >= maxSupportedYear && sessionState.selectedMonthIndex === 11 ? 'not-allowed' : 'pointer',
              opacity: sessionState.selectedYear >= maxSupportedYear && sessionState.selectedMonthIndex === 11 ? 0.4 : 1,
            }}
            title="Next Month"
          >
            <ChevronRight size={13} />
          </button>

          {showMonthPicker && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-dialog)',
                padding: '0.5rem',
                zIndex: 200,
                minWidth: '220px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.25rem 0.5rem 0.5rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: '0.35rem',
                }}
              >
                <button
                  type="button"
                  onClick={handlePrevYear}
                  disabled={sessionState.selectedYear <= minSupportedYear}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '0.2rem 0.5rem',
                    cursor: sessionState.selectedYear <= minSupportedYear ? 'not-allowed' : 'pointer',
                    color: sessionState.selectedYear <= minSupportedYear ? 'var(--text-subtle)' : 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    opacity: sessionState.selectedYear <= minSupportedYear ? 0.4 : 1,
                  }}
                  title="Previous Year"
                >
                  ‹ Prev
                </button>
                <select
                  value={sessionState.selectedYear}
                  onChange={(e) => {
                    const chosenYear = Number(e.target.value);
                    setWorkspaceMonth(chosenYear, sessionState.selectedMonthIndex);
                  }}
                  aria-label="Select Year"
                  style={{
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-canvas)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '0.18rem 0.45rem',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {supportedYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleNextYear}
                  disabled={sessionState.selectedYear >= maxSupportedYear}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '0.2rem 0.5rem',
                    cursor: sessionState.selectedYear >= maxSupportedYear ? 'not-allowed' : 'pointer',
                    color: sessionState.selectedYear >= maxSupportedYear ? 'var(--text-subtle)' : 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    opacity: sessionState.selectedYear >= maxSupportedYear ? 0.4 : 1,
                  }}
                  title="Next Year"
                >
                  Next ›
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.25rem' }}>
                {MONTH_NAMES.map((m, i) => {
                  const isSelected = i === sessionState.selectedMonthIndex;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setWorkspaceMonth(sessionState.selectedYear, i);
                        setShowMonthPicker(false);
                      }}
                      style={{
                        backgroundColor: isSelected ? 'var(--primary-600)' : 'transparent',
                        color: isSelected ? '#fff' : 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: 'var(--radius-xs)',
                        padding: '0.35rem 0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: isSelected ? 700 : 400,
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      {m.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Storage Status ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            padding: '0.25rem 0.6rem',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {sessionState.excelFilePath ? (
            <>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--success-500)', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                {sessionState.excelFileName || 'Excel'}
              </span>
            </>
          ) : (
            <>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--warning-500)', flexShrink: 0 }} />
              <span>No storage</span>
            </>
          )}
        </div>

        {/* ── Backup & Restore Actions (Directly Near Storage Indicator) ─────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button
            type="button"
            onClick={handleBackup}
            title="Download full workspace backup (JSON)"
            style={storageActionBtnStyle}
          >
            <Download size={11} /> Backup
          </button>
          <button
            type="button"
            onClick={handleTriggerRestore}
            title="Restore workspace from a Rollvia backup file"
            style={storageActionBtnStyle}
          >
            <Upload size={11} /> Restore
          </button>
        </div>

        {/* Student Count */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <Users size={12} />
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{sessionState.people.length}</span>
          <span>students</span>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />
      </div>

      {/* Close month picker when clicking outside */}
      {showMonthPicker && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 199 }}
          onClick={() => setShowMonthPicker(false)}
        />
      )}

      {/* ── Destructive Restore Confirmation Dialog ───────────────────────────── */}
      {pendingRestore && (
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
              maxWidth: '460px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--warning-600)' }}>
                <AlertTriangle size={18} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Restore Workspace Backup
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                backgroundColor: 'var(--warning-50)',
                border: '1px solid var(--warning-200)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                fontSize: '0.8rem',
                color: 'var(--warning-800)',
              }}
            >
              <strong>Warning:</strong> Restoring this backup will replace current students, timetable, and attendance records with the contents of the backup file.
            </div>

            {/* Backup Contents Summary */}
            <div
              style={{
                backgroundColor: 'var(--bg-canvas)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xs)',
                padding: '0.75rem',
                fontSize: '0.78rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                Backup Contents:
              </div>
              <div>• Students in roster: <strong>{pendingRestore.summary.peopleCount}</strong></div>
              <div>• Recorded attendance dates: <strong>{pendingRestore.summary.datesCount}</strong></div>
              <div>• Weekly timetable included: <strong>{pendingRestore.summary.hasTimetable ? 'Yes' : 'No'}</strong></div>
              {pendingRestore.summary.exportedAt && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Exported: {new Date(pendingRestore.summary.exportedAt).toLocaleString()}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
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
                onClick={handleConfirmRestore}
                style={{
                  padding: '0.35rem 0.9rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--danger-600)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Confirm & Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

const storageActionBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.22rem 0.5rem',
  fontSize: '0.72rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  backgroundColor: 'var(--bg-canvas)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  transition: 'all 0.1s ease',
};
