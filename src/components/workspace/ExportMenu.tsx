import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  TableProperties,
  Printer,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useFlow } from '../../context';
import { MONTH_NAMES } from '../../utils/calendar';
import { calculateStudentAttendanceProfile } from '../../models/attendance';
import type { StudentAttendanceProfile } from '../../types';
import { downloadMonthlyAttendancePdf } from '../../utils/pdfExport';
import { downloadAttendanceExcel } from '../../utils/attendanceExcelExport';
import {
  computeMonthlyAttendanceMatrix,
  extractUniqueSubjectNames,
} from '../../utils/monthlyAttendanceSummary';
import { downloadMonthlySummaryExcel } from '../../utils/monthlySummaryExcelExport';
import { downloadMonthlySummaryPdf } from '../../utils/monthlySummaryPdfExport';

interface ExportMenuProps {
  onOpenMonthlySummary?: () => void;
  style?: React.CSSProperties;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({ onOpenMonthlySummary, style }) => {
  const { sessionState, getMonthAttendanceRecords, getAttendanceDataset } = useFlow();
  const {
    people,
    weeklyTimetable,
    dateScheduleOverrides,
    noClassDates,
    savedDailyAttendance,
    attendanceRecords,
    selectedYear,
    selectedMonthIndex,
    institutionName,
    departmentName,
    academicYear,
    excelFilePath,
  } = sessionState;

  const [isOpen, setIsOpen] = useState(false);
  const [activeExport, setActiveExport] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const showFeedback = (message: string, isError = false) => {
    setFeedback({ message, isError });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const activeYr = selectedYear || new Date().getFullYear();
  const activeMo = typeof selectedMonthIndex === 'number' ? selectedMonthIndex : new Date().getMonth();

  // ─── 1. Attendance Excel Export ───────────────────────────────────────────
  const handleExportAttendanceExcel = async () => {
    if (people.length === 0) {
      showFeedback('Cannot export: No students enrolled in Rollvia.', true);
      return;
    }

    try {
      setActiveExport('att-excel');
      setIsOpen(false);
      const dataset = getAttendanceDataset();
      const res = await downloadAttendanceExcel({
        dataset,
        existingRecords: attendanceRecords,
        filePath: excelFilePath,
      });

      if (res.success) {
        showFeedback('Attendance Excel exported successfully', false);
      } else {
        showFeedback(res.error || 'Failed to export Attendance Excel.', true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error exporting Attendance Excel.';
      showFeedback(msg, true);
    } finally {
      setActiveExport(null);
    }
  };

  // ─── 2. Attendance PDF Export ─────────────────────────────────────────────
  const handleExportAttendancePdf = () => {
    if (people.length === 0) {
      showFeedback('Cannot export: No students enrolled in Rollvia.', true);
      return;
    }

    try {
      setActiveExport('att-pdf');
      setIsOpen(false);

      const monthRecs = getMonthAttendanceRecords(activeYr, activeMo);
      const profilesMap = new Map<string, StudentAttendanceProfile>();
      for (const p of people) {
        profilesMap.set(p.id, calculateStudentAttendanceProfile(p, monthRecs));
      }

      downloadMonthlyAttendancePdf({
        institutionName,
        departmentName,
        academicYear: academicYear || String(activeYr),
        monthStr: `${MONTH_NAMES[activeMo]} ${activeYr}`,
        roster: people,
        profiles: profilesMap,
        savedDatesCount: (sessionState.savedDates || []).length,
        holidaysCount: (noClassDates || []).length,
      });

      showFeedback('Attendance PDF exported successfully', false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error exporting Attendance PDF.';
      showFeedback(msg, true);
    } finally {
      setActiveExport(null);
    }
  };

  // ─── 3. Monthly Attendance Summary Excel Export ────────────────────────────
  const handleExportMonthlySummaryExcel = async () => {
    if (people.length === 0) {
      showFeedback('Cannot export: No students enrolled in Rollvia.', true);
      return;
    }

    const availableSubs = extractUniqueSubjectNames(weeklyTimetable, attendanceRecords, activeYr, dateScheduleOverrides);
    if (availableSubs.length === 0) {
      showFeedback('Cannot export: No subjects configured in weekly timetable.', true);
      return;
    }

    try {
      setActiveExport('summary-excel');
      setIsOpen(false);

      const matrix = computeMonthlyAttendanceMatrix({
        people,
        weeklyTimetable,
        dateScheduleOverrides,
        noClassDates,
        savedDailyAttendance,
        attendanceRecords,
        year: activeYr,
        academicYear: academicYear || String(activeYr),
        startMonthIndex: 0,
        endMonthIndex: 11,
      });

      const res = await downloadMonthlySummaryExcel(matrix);
      if (res.success) {
        showFeedback('Monthly Summary Excel exported successfully', false);
      } else {
        showFeedback(res.error || 'Failed to export Monthly Summary Excel.', true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error exporting Monthly Summary Excel.';
      showFeedback(msg, true);
    } finally {
      setActiveExport(null);
    }
  };

  // ─── 4. Monthly Attendance Summary PDF Export ──────────────────────────────
  const handleExportMonthlySummaryPdf = () => {
    if (people.length === 0) {
      showFeedback('Cannot export: No students enrolled in Rollvia.', true);
      return;
    }

    const availableSubs = extractUniqueSubjectNames(weeklyTimetable, attendanceRecords, activeYr, dateScheduleOverrides);
    if (availableSubs.length === 0) {
      showFeedback('Cannot export: No subjects configured in weekly timetable.', true);
      return;
    }

    try {
      setActiveExport('summary-pdf');
      setIsOpen(false);

      const matrix = computeMonthlyAttendanceMatrix({
        people,
        weeklyTimetable,
        dateScheduleOverrides,
        noClassDates,
        savedDailyAttendance,
        attendanceRecords,
        year: activeYr,
        academicYear: academicYear || String(activeYr),
        startMonthIndex: 0,
        endMonthIndex: 11,
      });

      downloadMonthlySummaryPdf(matrix, {
        institutionName,
        departmentName,
        academicYear: academicYear || String(activeYr),
      });

      showFeedback('Monthly Summary PDF exported successfully', false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error exporting Monthly Summary PDF.';
      showFeedback(msg, true);
    } finally {
      setActiveExport(null);
    }
  };

  // ─── 5. Print Monthly Summary ──────────────────────────────────────────────
  const handlePrintMonthlySummary = () => {
    setIsOpen(false);
    if (onOpenMonthlySummary) {
      onOpenMonthlySummary();
      setTimeout(() => {
        window.print();
      }, 500);
    } else {
      window.print();
    }
  };

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', ...style }}>
      {/* Feedback Toast */}
      {feedback && (
        <div
          role="status"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            right: 0,
            whiteSpace: 'nowrap',
            fontSize: '0.72rem',
            padding: '0.25rem 0.6rem',
            borderRadius: 'var(--radius-xs, 4px)',
            background: feedback.isError ? 'var(--danger-50, #fef2f2)' : 'var(--success-50, #ecfdf5)',
            color: feedback.isError ? 'var(--danger-600, #dc2626)' : 'var(--success-600, #059669)',
            border: `1px solid ${feedback.isError ? 'var(--danger-200, #fecaca)' : 'var(--success-200, #a7f3d0)'}`,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.1))',
            zIndex: 1001,
          }}
        >
          {feedback.isError ? <AlertCircle size={12} /> : <Check size={12} />}
          {feedback.message}
        </div>
      )}

      {/* Main "Export" Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title="Open Export menu"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          backgroundColor: isOpen ? 'var(--primary-50, #eff6ff)' : 'var(--bg-canvas, #f1f5f9)',
          border: isOpen ? '1px solid var(--primary-500, #3b82f6)' : '1px solid var(--border-default, #cbd5e1)',
          borderRadius: 'var(--radius-sm, 6px)',
          color: isOpen ? 'var(--primary-700, #1d4ed8)' : 'var(--text-primary, #0f172a)',
          padding: '0.3rem 0.65rem',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover, #f8fafc)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = 'var(--bg-canvas, #f1f5f9)';
        }}
      >
        {activeExport ? (
          <Loader2 size={13} className="animate-spin" style={{ color: 'var(--primary-600)' }} />
        ) : (
          <Download size={13} style={{ color: isOpen ? 'var(--primary-600)' : 'var(--text-secondary)' }} />
        )}
        <span>Export</span>
        <ChevronDown
          size={12}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            color: 'var(--text-muted)',
          }}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            right: 0,
            zIndex: 1000,
            backgroundColor: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-default, #cbd5e1)',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: 'var(--shadow-dialog, 0 10px 25px -5px rgba(0, 0, 0, 0.25))',
            padding: '0.4rem 0',
            minWidth: '275px',
            maxWidth: '320px',
            animation: 'fadeIn 0.12s ease-out',
          }}
        >
          {/* Menu Title */}
          <div
            style={{
              padding: '0.35rem 0.85rem 0.3rem',
              fontSize: '0.67rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'var(--text-muted, #64748b)',
              textTransform: 'uppercase',
            }}
          >
            Export
          </div>

          <div style={{ height: '1px', backgroundColor: 'var(--border-subtle, #e2e8f0)', margin: '0.2rem 0 0.35rem' }} />

          {/* SECTION 1: Standard Attendance */}
          <button
            type="button"
            role="menuitem"
            onClick={handleExportAttendanceExcel}
            style={menuItemStyle}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover, #f8fafc)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ ...iconContainerStyle, color: 'var(--success-600, #059669)', background: 'var(--success-50, #ecfdf5)' }}>
              <FileSpreadsheet size={15} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                Attendance Excel
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)' }}>
                Monthly workbook with search & raw data (.xlsx)
              </div>
            </div>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={handleExportAttendancePdf}
            style={menuItemStyle}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover, #f8fafc)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ ...iconContainerStyle, color: 'var(--primary-600, #2563eb)', background: 'var(--primary-50, #eff6ff)' }}>
              <FileText size={15} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                Attendance PDF
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)' }}>
                Official monthly student report (.pdf)
              </div>
            </div>
          </button>

          <div style={{ height: '1px', backgroundColor: 'var(--border-subtle, #e2e8f0)', margin: '0.35rem 0' }} />

          {/* SECTION 2: Monthly Summary Matrix */}
          <button
            type="button"
            role="menuitem"
            onClick={handleExportMonthlySummaryExcel}
            style={menuItemStyle}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover, #f8fafc)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ ...iconContainerStyle, color: 'var(--success-600, #059669)', background: 'var(--success-50, #ecfdf5)' }}>
              <TableProperties size={15} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                Monthly Attendance Summary Excel
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)' }}>
                Full month-by-month subject matrix (.xlsx)
              </div>
            </div>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={handleExportMonthlySummaryPdf}
            style={menuItemStyle}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover, #f8fafc)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ ...iconContainerStyle, color: 'var(--danger-600, #dc2626)', background: 'var(--danger-50, #fef2f2)' }}>
              <FileText size={15} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                Monthly Attendance Summary PDF
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)' }}>
                Landscape multi-page paginated matrix (.pdf)
              </div>
            </div>
          </button>

          <div style={{ height: '1px', backgroundColor: 'var(--border-subtle, #e2e8f0)', margin: '0.35rem 0' }} />

          {/* SECTION 3: Print Action */}
          <button
            type="button"
            role="menuitem"
            onClick={handlePrintMonthlySummary}
            style={menuItemStyle}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover, #f8fafc)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ ...iconContainerStyle, color: 'var(--text-secondary, #475569)', background: 'var(--bg-surface-muted, #f1f5f9)' }}>
              <Printer size={15} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                Print Monthly Summary
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)' }}>
                Open matrix preview & trigger print
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

const menuItemStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '0.65rem',
  padding: '0.45rem 0.85rem',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background-color 0.1s ease',
  outline: 'none',
};

const iconContainerStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
