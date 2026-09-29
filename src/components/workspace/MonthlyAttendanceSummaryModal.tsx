import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  FileText,
  Printer,
  Calendar,
  Search,
  BookOpen,
  Users,
  TrendingUp,
  BarChart2,
  Info,
} from 'lucide-react';
import { useFlow } from '../../context';
import { MONTH_NAMES, getSupportedYears } from '../../utils/calendar';
import {
  computeMonthlyAttendanceMatrix,
  extractUniqueSubjectNames,
  type MonthlyAttendanceMatrix,
} from '../../utils/monthlyAttendanceSummary';
import { downloadMonthlySummaryExcel } from '../../utils/monthlySummaryExcelExport';
import { downloadMonthlySummaryPdf } from '../../utils/monthlySummaryPdfExport';

interface MonthlyAttendanceSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type RangePreset = 'full_year' | 'sem1' | 'sem2' | 'current' | 'custom';

export const MonthlyAttendanceSummaryModal: React.FC<MonthlyAttendanceSummaryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { sessionState } = useFlow();
  const {
    people,
    weeklyTimetable,
    dateScheduleOverrides,
    noClassDates,
    savedDailyAttendance,
    attendanceRecords,
    selectedYear: contextYear,
    selectedMonthIndex: contextMonthIndex,
    institutionName,
    departmentName,
    academicYear,
  } = sessionState;

  // Filter States
  const [selectedYear, setSelectedYear] = useState<number>(() => contextYear || new Date().getFullYear());
  const [rangePreset, setRangePreset] = useState<RangePreset>('full_year');
  const [startMonthIndex, setStartMonthIndex] = useState<number>(0);
  const [endMonthIndex, setEndMonthIndex] = useState<number>(11);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportNotice, setExportNotice] = useState<{ message: string; isError: boolean } | null>(null);

  const supportedYears = useMemo(() => getSupportedYears(), []);

  // Sync preset changes to start/end months
  const handlePresetChange = (preset: RangePreset) => {
    setRangePreset(preset);
    if (preset === 'full_year') {
      setStartMonthIndex(0);
      setEndMonthIndex(11);
    } else if (preset === 'sem1') {
      setStartMonthIndex(0);
      setEndMonthIndex(3); // Jan - Apr
    } else if (preset === 'sem2') {
      setStartMonthIndex(6);
      setEndMonthIndex(11); // Jul - Dec
    } else if (preset === 'current') {
      const cur = typeof contextMonthIndex === 'number' ? contextMonthIndex : new Date().getMonth();
      setStartMonthIndex(cur);
      setEndMonthIndex(cur);
    }
  };

  // Extract all available subjects
  const availableSubjects = useMemo(() => {
    return extractUniqueSubjectNames(weeklyTimetable, attendanceRecords, selectedYear, dateScheduleOverrides);
  }, [weeklyTimetable, attendanceRecords, selectedYear, dateScheduleOverrides]);

  // Compute the full monthly matrix
  const matrix: MonthlyAttendanceMatrix = useMemo(() => {
    return computeMonthlyAttendanceMatrix({
      people,
      weeklyTimetable,
      dateScheduleOverrides,
      noClassDates,
      savedDailyAttendance,
      attendanceRecords,
      year: selectedYear,
      academicYear: academicYear || String(selectedYear),
      startMonthIndex,
      endMonthIndex,
      subjectFilter: selectedSubjects.length > 0 ? selectedSubjects : undefined,
    });
  }, [
    people,
    weeklyTimetable,
    dateScheduleOverrides,
    noClassDates,
    savedDailyAttendance,
    attendanceRecords,
    selectedYear,
    academicYear,
    startMonthIndex,
    endMonthIndex,
    selectedSubjects,
  ]);

  // Filter students by search query
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matrix.students;
    return matrix.students.filter(
      (s) =>
        s.student.name.toLowerCase().includes(q) ||
        (s.student.rollNumber && s.student.rollNumber.toLowerCase().includes(q))
    );
  }, [matrix.students, searchQuery]);

  // Excel Export Handler
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      setExportNotice(null);
      const res = await downloadMonthlySummaryExcel(matrix);
      if (res.success) {
        setExportNotice({ message: 'Excel summary exported successfully', isError: false });
        setTimeout(() => setExportNotice(null), 3500);
      } else {
        setExportNotice({ message: res.error || 'Failed to export Excel report.', isError: true });
      }
    } catch {
      setExportNotice({ message: 'Error generating Excel report.', isError: true });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // PDF Export Handler
  const handleExportPdf = () => {
    try {
      setIsExportingPdf(true);
      setExportNotice(null);
      downloadMonthlySummaryPdf(matrix, {
        institutionName,
        departmentName,
        academicYear: academicYear || String(selectedYear),
      });
      setExportNotice({ message: 'PDF report generated and downloaded.', isError: false });
      setTimeout(() => setExportNotice(null), 3500);
    } catch {
      setExportNotice({ message: 'Failed to generate PDF export.', isError: true });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Browser Print Handler
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Monthly Attendance Summary"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="mas-modal-window"
        style={{
          background: 'var(--mas-bg)',
          color: 'var(--text-primary)',
          width: '100%',
          maxWidth: '1480px',
          height: '92vh',
          borderRadius: '8px',
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--mas-border-default)',
          overflow: 'hidden',
        }}
      >
        {/* ─── Top Header Bar ────────────────────────────────────────── */}
        <div
          style={{
            padding: '0.65rem 1.15rem',
            borderBottom: '1px solid var(--mas-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--mas-header-bg)',
            gap: '1rem',
            flexShrink: 0,
          }}
        >
          {/* Left: Professional Icon + Title + Subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '6px',
                background: 'var(--mas-icon-bg, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              <BarChart2 size={18} color="#ffffff" />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
                  color: 'var(--text-primary)',
                  lineHeight: 1.25,
                }}
              >
                Monthly Attendance Summary
              </h2>
              <p
                style={{
                  margin: '0.15rem 0 0',
                  fontSize: '0.74rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.2,
                }}
              >
                View subject-wise monthly attendance and overall student attendance for the selected period
              </p>
            </div>
          </div>

          {/* Right: Compact Professional Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {exportNotice && (
              <span
                style={{
                  fontSize: '0.73rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  background: exportNotice.isError ? 'var(--danger-50)' : 'var(--success-50)',
                  color: exportNotice.isError ? 'var(--danger-600)' : 'var(--success-600)',
                  border: `1px solid ${exportNotice.isError ? 'var(--danger-200)' : 'var(--success-200)'}`,
                  fontWeight: 500,
                }}
              >
                {exportNotice.message}
              </span>
            )}

            {/* Export Excel */}
            <button
              type="button"
              className="mas-btn-excel"
              onClick={handleExportExcel}
              disabled={isExportingExcel || people.length === 0}
              title="Export this matrix report as an Excel spreadsheet (.xlsx)"
            >
              <Download size={13} />
              {isExportingExcel ? 'Exporting...' : 'Export Excel'}
            </button>

            {/* Export PDF */}
            <button
              type="button"
              className="mas-btn-pdf"
              onClick={handleExportPdf}
              disabled={isExportingPdf || people.length === 0}
              title="Export this matrix report as landscape paginated PDF"
            >
              <FileText size={13} />
              {isExportingPdf ? 'Exporting...' : 'Export PDF'}
            </button>

            {/* Print */}
            <button
              type="button"
              className="mas-btn-print"
              onClick={handlePrint}
              title="Print attendance summary"
            >
              <Printer size={13} />
              Print
            </button>

            {/* Close Button */}
            <button
              type="button"
              className="mas-btn-close"
              onClick={onClose}
              title="Close Summary (Esc)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ─── Filter Bar (Toolbar) ──────────────────────────────────── */}
        <div
          style={{
            padding: '0.55rem 1.15rem',
            borderBottom: '1px solid var(--mas-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            background: 'var(--mas-toolbar-bg)',
            flexShrink: 0,
          }}
        >
          {/* Left: Aligned Filters Strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            {/* Year Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="mas-filter-label">Year</span>
              <select
                className="mas-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {supportedYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Range Presets Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="mas-filter-label">Range</span>
              <select
                className="mas-select"
                value={rangePreset}
                onChange={(e) => handlePresetChange(e.target.value as RangePreset)}
              >
                <option value="full_year">Full Year</option>
                <option value="sem1">Jan – Apr (Sem 1)</option>
                <option value="sem2">Jul – Dec (Sem 2)</option>
                <option value="current">Active Month</option>
                {rangePreset === 'custom' && <option value="custom">Custom Range</option>}
              </select>
            </div>

            {/* From Month Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="mas-filter-label">From</span>
              <select
                className="mas-select"
                value={startMonthIndex}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setStartMonthIndex(val);
                  if (val > endMonthIndex) setEndMonthIndex(val);
                  setRangePreset('custom');
                }}
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>
                    {idx === 0 ? `${m} (Sem 1)` : idx === 6 ? `${m} (Sem 2)` : m}
                  </option>
                ))}
              </select>
            </div>

            {/* To Month Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="mas-filter-label">To</span>
              <select
                className="mas-select"
                value={endMonthIndex}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setEndMonthIndex(val);
                  if (val < startMonthIndex) setStartMonthIndex(val);
                  setRangePreset('custom');
                }}
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject Dropdown Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="mas-filter-label">Subject</span>
              <select
                className="mas-select"
                value={selectedSubjects.length === 1 ? selectedSubjects[0] : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSubjects(val ? [val] : []);
                }}
              >
                <option value="">All Subjects ({availableSubjects.length})</option>
                {availableSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Compact Search Input */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: '8px',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search by name or roll number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.28rem 0.55rem 0.28rem 1.7rem',
                fontSize: '0.75rem',
                borderRadius: '5px',
                border: '1px solid var(--mas-border-subtle)',
                background: 'var(--mas-bg)',
                color: 'var(--text-primary)',
                width: '210px',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '6px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* ─── Summary Info Bar ──────────────────────────────────────── */}
        <div
          style={{
            padding: '0.5rem 1.15rem',
            background: 'var(--mas-info-bg)',
            borderBottom: '1px solid var(--mas-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.74rem',
            flexShrink: 0,
          }}
        >
          {/* Left Metrics with Subtle Separators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Users size={14} style={{ color: 'var(--primary-600, #2563eb)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Total Students</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {filteredStudents.length}
                {filteredStudents.length !== people.length ? ` of ${people.length}` : ''}
              </strong>
            </div>
            <div className="mas-divider" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={14} style={{ color: 'var(--primary-600, #2563eb)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Selected Range</span>
              <strong style={{ color: 'var(--text-primary)' }}>{matrix.monthRangeLabel}</strong>
            </div>
            <div className="mas-divider" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <BookOpen size={14} style={{ color: 'var(--warning-600, #d97706)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Total Classes Conducted</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {matrix.overallStats.totalConductedClasses}
              </strong>
            </div>
            <div className="mas-divider" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <TrendingUp size={14} style={{ color: 'var(--success-600, #059669)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Average Attendance</span>
              <strong
                style={{
                  color:
                    matrix.overallStats.averageAttendancePct >= 75
                      ? 'var(--success-600, #059669)'
                      : matrix.overallStats.averageAttendancePct >= 60
                      ? 'var(--warning-600, #d97706)'
                      : 'var(--danger-600, #dc2626)',
                }}
              >
                {matrix.overallStats.averageAttendancePct.toFixed(1)}%
              </strong>
            </div>
          </div>

          {/* Right: Inline Attendance Legend */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              fontSize: '0.71rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <span className="mas-dot mas-dot-green" />
              &ge; 75%
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <span className="mas-dot mas-dot-orange" />
              60 – 74%
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <span className="mas-dot mas-dot-red" />
              &lt; 60%
            </span>
          </div>
        </div>

        {/* ─── Main Spreadsheet Data Table Area ──────────────────────── */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            background: 'var(--mas-table-bg)',
            position: 'relative',
          }}
        >
          {people.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '3rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>No Students Available</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '420px', color: 'var(--text-muted)' }}>
                Please add or import students into Rollvia to view the Monthly Attendance Summary.
              </p>
            </div>
          ) : matrix.monthGroups.length === 0 || matrix.allSubjects.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '3rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <BookOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>No Timetable Subjects Configured</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '420px', color: 'var(--text-muted)' }}>
                Configure subjects in the Weekly Timetable tab to calculate scheduled class counts and monthly attendance.
              </p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '3rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <Search size={42} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>No Students Match Search</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Try adjusting or clearing your search filter "{searchQuery}".
              </p>
            </div>
          ) : (
            <table
              style={{
                borderCollapse: 'separate',
                borderSpacing: 0,
                width: 'max-content',
                minWidth: '100%',
                fontSize: '0.73rem',
                background: 'var(--mas-table-bg)',
              }}
            >
              {/* Table Header */}
              <thead>
                {/* ─── Row 0: Grouped Month Header & Overall Header ──────── */}
                <tr style={{ height: '28px' }}>
                  {/* Sticky Corner: Roll No & Name */}
                  <th
                    rowSpan={2}
                    style={{
                      position: 'sticky',
                      top: 0,
                      left: 0,
                      zIndex: 35,
                      background: 'var(--mas-info-bg)',
                      borderRight: '1px solid var(--mas-border-subtle)',
                      borderBottom: '1px solid var(--mas-border-default)',
                      padding: '0 0.65rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      fontSize: '0.73rem',
                      color: 'var(--text-primary)',
                      width: '65px',
                      minWidth: '65px',
                      verticalAlign: 'middle',
                    }}
                  >
                    Roll No
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      position: 'sticky',
                      top: 0,
                      left: '65px',
                      zIndex: 35,
                      background: 'var(--mas-info-bg)',
                      borderRight: '1px solid var(--mas-border-default)',
                      borderBottom: '1px solid var(--mas-border-default)',
                      padding: '0 0.85rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      fontSize: '0.73rem',
                      color: 'var(--text-primary)',
                      width: '180px',
                      minWidth: '180px',
                      verticalAlign: 'middle',
                    }}
                  >
                    Student Name
                  </th>

                  {/* Grouped Month Headers */}
                  {matrix.monthGroups.map((group) => {
                    const colSpan = group.subjects.length + 1; // Subjects + Month Total
                    return (
                      <th
                        key={`month-hdr-${group.monthIndex}`}
                        colSpan={colSpan}
                        style={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 20,
                          background: 'var(--mas-month-header-bg)',
                          borderRight: '1px solid var(--mas-border-default)',
                          borderBottom: '1px solid var(--mas-border-subtle)',
                          padding: '0.35rem 0.5rem',
                          textAlign: 'center',
                          fontSize: '0.73rem',
                          verticalAlign: 'middle',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: 'var(--mas-month-header-text)', letterSpacing: '0.02em' }}>
                          {group.monthName.toUpperCase()}
                        </span>
                        {' '}
                        <span style={{ fontWeight: 500, color: 'var(--mas-month-header-sub)', fontSize: '0.71rem' }}>
                          ({group.totalClasses} Classes)
                        </span>
                      </th>
                    );
                  })}

                  {/* Overall Section Grouped Header */}
                  <th
                    colSpan={4}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      background: 'var(--mas-overall-header-bg)',
                      borderRight: '1px solid var(--mas-border-default)',
                      borderBottom: '1px solid var(--mas-border-subtle)',
                      padding: '0.35rem 0.5rem',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: '0.73rem',
                      color: 'var(--mas-overall-header-text)',
                      letterSpacing: '0.02em',
                      verticalAlign: 'middle',
                    }}
                  >
                    OVERALL FOR STUDENT
                  </th>
                </tr>

                {/* ─── Row 1: Subheaders ─────────────────────────────────── */}
                <tr style={{ height: '28px' }}>
                  {/* Month Subjects + Month Total */}
                  {matrix.monthGroups.map((group) => (
                    <React.Fragment key={`sub-hdrs-${group.monthIndex}`}>
                      {group.subjects.map((sub) => (
                        <th
                          key={`sub-hdr-${group.monthIndex}-${sub.subjectName}`}
                          style={{
                            position: 'sticky',
                            top: '28px',
                            zIndex: 20,
                            background: 'var(--mas-table-bg)',
                            borderRight: '1px solid var(--mas-border-subtle)',
                            borderBottom: '1px solid var(--mas-border-default)',
                            padding: '0.2rem 0.4rem',
                            textAlign: 'center',
                            minWidth: '50px',
                            color: sub.totalClasses === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                            verticalAlign: 'middle',
                          }}
                        >
                          <div style={{ lineHeight: 1.25 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.71rem' }}>{sub.subjectName}</div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                              ({sub.totalClasses})
                            </div>
                          </div>
                        </th>
                      ))}

                      {/* Month Total Subheader */}
                      <th
                        style={{
                          position: 'sticky',
                          top: '28px',
                          zIndex: 20,
                          background: 'var(--mas-month-total-bg)',
                          borderRight: '1px solid var(--mas-border-default)',
                          borderBottom: '1px solid var(--mas-border-default)',
                          padding: '0.2rem 0.45rem',
                          textAlign: 'center',
                          minWidth: '48px',
                          verticalAlign: 'middle',
                        }}
                      >
                        <div style={{ lineHeight: 1.25 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.71rem', color: 'var(--mas-month-total-text)' }}>
                            Total
                          </div>
                          <div style={{ fontSize: '0.66rem', color: 'var(--mas-month-header-sub)', fontWeight: 600 }}>
                            ({group.totalClasses})
                          </div>
                        </div>
                      </th>
                    </React.Fragment>
                  ))}

                  {/* Overall Summary Subheaders: Present, Absent, Total, Attendance % */}
                  <th
                    style={{
                      position: 'sticky',
                      top: '28px',
                      zIndex: 20,
                      background: 'var(--mas-overall-header-bg)',
                      borderRight: '1px solid var(--mas-border-subtle)',
                      borderBottom: '1px solid var(--mas-border-default)',
                      padding: '0.25rem 0.5rem',
                      textAlign: 'center',
                      minWidth: '54px',
                      fontWeight: 600,
                      fontSize: '0.72rem',
                      color: 'var(--text-primary)',
                      verticalAlign: 'middle',
                    }}
                  >
                    Present
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: '28px',
                      zIndex: 20,
                      background: 'var(--mas-overall-header-bg)',
                      borderRight: '1px solid var(--mas-border-subtle)',
                      borderBottom: '1px solid var(--mas-border-default)',
                      padding: '0.25rem 0.5rem',
                      textAlign: 'center',
                      minWidth: '54px',
                      fontWeight: 600,
                      fontSize: '0.72rem',
                      color: 'var(--text-primary)',
                      verticalAlign: 'middle',
                    }}
                  >
                    Absent
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: '28px',
                      zIndex: 20,
                      background: 'var(--mas-overall-header-bg)',
                      borderRight: '1px solid var(--mas-border-subtle)',
                      borderBottom: '1px solid var(--mas-border-default)',
                      padding: '0.25rem 0.5rem',
                      textAlign: 'center',
                      minWidth: '54px',
                      fontWeight: 600,
                      fontSize: '0.72rem',
                      color: 'var(--text-primary)',
                      verticalAlign: 'middle',
                    }}
                  >
                    Total
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: '28px',
                      zIndex: 20,
                      background: 'var(--mas-overall-header-bg)',
                      borderRight: '1px solid var(--mas-border-default)',
                      borderBottom: '1px solid var(--mas-border-default)',
                      padding: '0.25rem 0.6rem',
                      textAlign: 'center',
                      minWidth: '82px',
                      fontWeight: 600,
                      fontSize: '0.72rem',
                      color: 'var(--text-primary)',
                      verticalAlign: 'middle',
                    }}
                  >
                    Attendance %
                  </th>
                </tr>
              </thead>

              {/* Table Body: Student Rows */}
              <tbody>
                {filteredStudents.map((sRow, idx) => {
                  const isEven = idx % 2 === 0;
                  const rowBg = isEven ? 'var(--mas-table-bg)' : 'var(--mas-row-alt-bg)';
                  const badgeClass =
                    sRow.overallPercentage >= 75
                      ? 'mas-badge-green'
                      : sRow.overallPercentage >= 60
                      ? 'mas-badge-orange'
                      : 'mas-badge-red';

                  return (
                    <tr
                      key={sRow.student.id}
                      style={{
                        height: '29px',
                        background: rowBg,
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--mas-row-hover-bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = rowBg;
                      }}
                    >
                      {/* Fixed Col 1: Roll No */}
                      <td
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 10,
                          background: 'inherit',
                          borderRight: '1px solid var(--mas-border-subtle)',
                          borderBottom: '1px solid var(--mas-border-subtle)',
                          padding: '0 0.65rem',
                          fontSize: '0.73rem',
                          color: 'var(--mas-roll-color)',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          verticalAlign: 'middle',
                        }}
                      >
                        {sRow.student.rollNumber || '—'}
                      </td>

                      {/* Fixed Col 2: Student Name */}
                      <td
                        style={{
                          position: 'sticky',
                          left: '65px',
                          zIndex: 10,
                          background: 'inherit',
                          borderRight: '1px solid var(--mas-border-default)',
                          borderBottom: '1px solid var(--mas-border-subtle)',
                          padding: '0 0.85rem',
                          fontWeight: 600,
                          fontSize: '0.73rem',
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          maxWidth: '220px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          verticalAlign: 'middle',
                        }}
                        title={sRow.student.name}
                      >
                        {sRow.student.name.toUpperCase() || 'UNNAMED PERSON'}
                      </td>

                      {/* Monthly Data Cells */}
                      {matrix.monthGroups.map((group, gIdx) => {
                        const mData = sRow.monthlyData[gIdx];
                        const mTotal = mData?.monthTotalAttended ?? 0;

                        return (
                          <React.Fragment key={`cells-${sRow.student.id}-${group.monthIndex}`}>
                            {group.subjects.map((sub) => {
                              const attended = mData?.subjectAttended[sub.subjectName] ?? 0;
                              const isZero = sub.totalClasses === 0;

                              return (
                                <td
                                  key={`cell-${sRow.student.id}-${group.monthIndex}-${sub.subjectName}`}
                                  style={{
                                    borderRight: '1px solid var(--mas-border-subtle)',
                                    borderBottom: '1px solid var(--mas-border-subtle)',
                                    padding: '0 0.4rem',
                                    textAlign: 'center',
                                    fontSize: '0.73rem',
                                    fontWeight: attended > 0 ? 500 : 400,
                                    color: isZero
                                      ? 'var(--text-muted)'
                                      : attended === 0
                                      ? 'var(--text-secondary)'
                                      : 'var(--text-primary)',
                                    verticalAlign: 'middle',
                                  }}
                                >
                                  {attended}
                                </td>
                              );
                            })}

                            {/* Month Total Cell */}
                            <td
                              style={{
                                borderRight: '1px solid var(--mas-border-default)',
                                borderBottom: '1px solid var(--mas-border-subtle)',
                                padding: '0 0.45rem',
                                textAlign: 'center',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                background: 'var(--mas-month-total-col-bg)',
                                color: 'var(--mas-month-total-text)',
                                verticalAlign: 'middle',
                              }}
                            >
                              {mTotal}
                            </td>
                          </React.Fragment>
                        );
                      })}

                      {/* Overall Summary Cells: Present, Absent, Total, Attendance % */}
                      <td
                        style={{
                          borderRight: '1px solid var(--mas-border-subtle)',
                          borderBottom: '1px solid var(--mas-border-subtle)',
                          padding: '0 0.5rem',
                          textAlign: 'center',
                          fontSize: '0.73rem',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          verticalAlign: 'middle',
                        }}
                      >
                        {sRow.overallPresent}
                      </td>

                      <td
                        style={{
                          borderRight: '1px solid var(--mas-border-subtle)',
                          borderBottom: '1px solid var(--mas-border-subtle)',
                          padding: '0 0.5rem',
                          textAlign: 'center',
                          fontSize: '0.73rem',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          verticalAlign: 'middle',
                        }}
                      >
                        {sRow.overallAbsent}
                      </td>

                      <td
                        style={{
                          borderRight: '1px solid var(--mas-border-subtle)',
                          borderBottom: '1px solid var(--mas-border-subtle)',
                          padding: '0 0.5rem',
                          textAlign: 'center',
                          fontSize: '0.73rem',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          verticalAlign: 'middle',
                        }}
                      >
                        {sRow.overallTotal}
                      </td>

                      {/* Percentage Badge */}
                      <td
                        style={{
                          borderRight: '1px solid var(--mas-border-default)',
                          borderBottom: '1px solid var(--mas-border-subtle)',
                          padding: '0 0.5rem',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                        }}
                      >
                        <span className={`mas-badge ${badgeClass}`}>
                          {sRow.overallPercentage.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ─── Footer Status Bar ─────────────────────────────────────── */}
        <div
          style={{
            padding: '0.45rem 1.15rem',
            borderTop: '1px solid var(--mas-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--mas-info-bg)',
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>
              Showing <strong>{filteredStudents.length}</strong> of <strong>{people.length}</strong> students
            </span>
            <span style={{ color: 'var(--mas-border-default)' }}>|</span>
            <span>
              <strong>{matrix.monthGroups.length}</strong> {matrix.monthGroups.length === 1 ? 'month' : 'months'} selected
            </span>
            <span style={{ color: 'var(--mas-border-default)' }}>|</span>
            <span>
              <strong>{matrix.allSubjects.length}</strong> subjects
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}>
            <span>Last updated from Rollvia attendance records</span>
            <Info size={13} style={{ opacity: 0.8 }} />
          </div>
        </div>
      </div>
    </div>
  );
};
