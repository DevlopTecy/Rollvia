import React, { useState } from 'react';
import {
  Check,
  FileSpreadsheet,
  FolderOpen,
  PlusCircle,
  AlertCircle,
  HardDrive,
  Users,
  Calendar,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  X,
  ClipboardList,
} from 'lucide-react';
import { useFlow, useTheme } from '../../context';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ui/ThemeToggle';
import { StudentImportModal, type ImportTabMode } from '../ui/StudentImportModal';
import attendlyLogo from '../../assets/attendly-logo.png';
import attendlyLogoDark from '../../assets/attendly-icon-dark.png';
import attendlyLogoLight from '../../assets/attendly-icon-light.png';
import type { Weekday } from '../../types';
import {
  MONTH_NAMES,
  DAY_NAMES,
  getMonthCalendarData,
  formatFullDisplayDate,
  getWeekdayForDate,
  getSupportedYears,
  getMinSupportedYear,
  getMaxSupportedYear,
  getDaysInMonth,
} from '../../utils/calendar';

type SetupTab = 'storage' | 'students' | 'date' | 'timetable';
const SETUP_TABS: { id: SetupTab; label: string; icon: React.ReactNode }[] = [
  { id: 'storage', label: 'Storage', icon: <FileSpreadsheet size={14} /> },
  { id: 'students', label: 'Students', icon: <Users size={14} /> },
  { id: 'date', label: 'Month', icon: <Calendar size={14} /> },
  { id: 'timetable', label: 'Timetable', icon: <LayoutGrid size={14} /> },
];

const WEEKDAYS_LIST: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const SetupWizard: React.FC = () => {
  const { theme } = useTheme();
  const currentIcon = theme === 'light' ? attendlyLogoLight : (attendlyLogoDark || attendlyLogo);

  const {
    sessionState,
    enterWorkspace,
    selectExistingExcelWorkbook,
    createNewExcelWorkbook,
    updatePerson,
    addPerson,
    deletePerson,
    importStudents,
    setDateSetup,
    weeklyTimetable,
    addTimetableSubject,
    updateTimetableSubject,
    deleteTimetableSubject,
  } = useFlow();

  const [activeTab, setActiveTab] = useState<SetupTab>('storage');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importModalMode, setImportModalMode] = useState<ImportTabMode>('file');

  // ─── Storage State (Excel only) ──────────────────────────────────────────────
  const [excelFeedback, setExcelFeedback] = useState<string | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);

  // ─── Date State ──────────────────────────────────────────────────────────────
  const localToday = new Date();
  const [year, setYear] = useState(sessionState.selectedYear);
  const [monthIndex, setMonthIndex] = useState(sessionState.selectedMonthIndex);
  const [selectedDay, setSelectedDay] = useState(sessionState.startDayNumber);
  const calendarData = getMonthCalendarData(year, monthIndex, localToday);
  const validDay = Math.min(selectedDay, calendarData.totalDays);
  const selectedDateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
  const weekdayName = getWeekdayForDate(selectedDateStr);

  const supportedYears = React.useMemo(() => getSupportedYears(), []);

  const handlePrevMonth = () => {
    if (monthIndex === 0) {
      const nextY = year - 1;
      const minYear = getMinSupportedYear();
      if (nextY >= minYear) {
        setYear(nextY);
        setMonthIndex(11);
        const maxD = getDaysInMonth(nextY, 11);
        const newD = Math.min(selectedDay, maxD);
        setSelectedDay(newD);
        setDateSetup(nextY, 11, newD);
      }
    } else {
      const nextM = monthIndex - 1;
      setMonthIndex(nextM);
      const maxD = getDaysInMonth(year, nextM);
      const newD = Math.min(selectedDay, maxD);
      setSelectedDay(newD);
      setDateSetup(year, nextM, newD);
    }
  };
  const handleNextMonth = () => {
    if (monthIndex === 11) {
      const nextY = year + 1;
      const maxYear = getMaxSupportedYear();
      if (nextY <= maxYear) {
        setYear(nextY);
        setMonthIndex(0);
        const maxD = getDaysInMonth(nextY, 0);
        const newD = Math.min(selectedDay, maxD);
        setSelectedDay(newD);
        setDateSetup(nextY, 0, newD);
      }
    } else {
      const nextM = monthIndex + 1;
      setMonthIndex(nextM);
      const maxD = getDaysInMonth(year, nextM);
      const newD = Math.min(selectedDay, maxD);
      setSelectedDay(newD);
      setDateSetup(year, nextM, newD);
    }
  };
  const handleSelectDay = (day: number) => {
    setSelectedDay(day);
    setDateSetup(year, monthIndex, day);
  };

  // ─── Timetable State ─────────────────────────────────────────────────────────
  const [ttInputs, setTtInputs] = useState<Record<string, string>>({});
  const [ttErrors, setTtErrors] = useState<Record<string, string>>({});
  const [editingItem, setEditingItem] = useState<{ day: Weekday; id: string; name: string } | null>(null);
  const [editError, setEditError] = useState('');

  // ─── Validation ──────────────────────────────────────────────────────────────
  const isStorageValid = Boolean(sessionState.excelFilePath);

  // At least one student with valid name AND rollNumber is required.
  // Blank draft rows (from clicking "Add Student" without filling in) are ignored.
  const isPeopleValid =
    sessionState.people.some((p) => p.name.trim() && p.rollNumber.trim());

  const totalSubjects = Object.values(weeklyTimetable).reduce((acc, list) => acc + list.length, 0);
  const isTimetableValid = totalSubjects > 0;

  const canCreateWorkspace = isStorageValid && isPeopleValid && isTimetableValid;

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleSelectExcel = async () => {
    setExcelFeedback(null);
    setExcelError(null);
    const res = await selectExistingExcelWorkbook();
    if (!res.canceled) {
      if (res.filePath && !res.error) {
        setExcelFeedback(`Loaded: ${res.filePath.split(/[/\\]/).pop()} (${res.recordsCount ?? 0} existing records)`);
      } else if (res.error) {
        setExcelError(res.error);
      }
    }
  };

  const handleCreateExcel = async () => {
    setExcelFeedback(null);
    setExcelError(null);
    const res = await createNewExcelWorkbook();
    if (!res.canceled) {
      if (res.filePath && !res.error) {
        setExcelFeedback('✓ Workbook Created');
      } else if (res.error) {
        setExcelError(res.error);
      }
    }
  };

  const handleTtAdd = (day: Weekday) => {
    const val = (ttInputs[day] || '').trim();
    const res = addTimetableSubject(day, val);
    if (!res.success) setTtErrors((p) => ({ ...p, [day]: res.error || 'Error' }));
    else { setTtInputs((p) => ({ ...p, [day]: '' })); setTtErrors((p) => ({ ...p, [day]: '' })); }
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const res = updateTimetableSubject(editingItem.day, editingItem.id, editingItem.name);
    if (!res.success) setEditError(res.error || 'Error');
    else { setEditingItem(null); setEditError(''); }
  };

  const handleCreateWorkspace = () => {
    setDateSetup(year, monthIndex, validDay);
    enterWorkspace();
  };

  // ─── Render Tab Content ───────────────────────────────────────────────────────

  const renderStorage = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Excel Storage Card */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem',
          backgroundColor: 'var(--bg-surface)',
          border: '1.5px solid var(--primary-500)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-xs)',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                backgroundColor: 'var(--success-50)',
                color: 'var(--success-600)',
                padding: '0.5rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
              }}
            >
              <HardDrive size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                Excel (.xlsx)
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Local attendance workbook file
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--primary-700)',
              backgroundColor: 'var(--primary-50)',
              padding: '0.25rem 0.6rem',
              borderRadius: 'var(--radius-full)',
            }}
          >
            <Check size={12} strokeWidth={3} /> Active Storage
          </div>
        </div>

        {/* Workbook Selection / Creation Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '0.875rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Workbook File</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
              {sessionState.excelFilePath ? sessionState.excelFilePath : 'Select an existing .xlsx file or create a new workbook'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" size="sm" onClick={handleSelectExcel} icon={<FolderOpen size={13} />}>
              Select
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCreateExcel} icon={<PlusCircle size={13} />}>
              Create New
            </Button>
          </div>
        </div>

        {sessionState.excelFilePath && (
          <div style={feedbackStyle('success')}>
            <Check size={13} /> Active: {sessionState.excelFileName} ({sessionState.excelExistingRecordsCount ?? 0} existing records)
          </div>
        )}
        {excelFeedback && (
          <div style={feedbackStyle('success')}>
            <Check size={13} /> {excelFeedback}
          </div>
        )}
        {excelError && (
          <div style={feedbackStyle('danger')}>
            <AlertCircle size={13} /> {excelError}
          </div>
        )}
      </div>

      {isStorageValid && (
        <div style={feedbackStyle('success')}>
          <Check size={13} /> Storage configured. Proceed to Students →
        </div>
      )}
    </div>
  );

  const renderStudents = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Button variant="primary" size="sm" onClick={addPerson} icon={<Plus size={13} />}>
          + Add Student
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setImportModalMode('file');
            setImportModalOpen(true);
          }}
          icon={<FileSpreadsheet size={13} />}
        >
          Import Excel/CSV
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setImportModalMode('paste');
            setImportModalOpen(true);
          }}
          icon={<ClipboardList size={13} />}
        >
          Paste List
        </Button>
      </div>

      {sessionState.people.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No students yet. Click "Add Student".
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sessionState.people.map((p, idx) => {
            const isValid = Boolean(p.name.trim() && p.rollNumber.trim());
            return (
              <div
                key={p.id}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: isValid ? '1px solid var(--border-subtle)' : '1px solid var(--danger-200)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 1rem',
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr 1fr 1fr 1fr auto',
                  gap: '0.5rem',
                  alignItems: 'center',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', textAlign: 'center' }}>#{idx + 1}</span>
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updatePerson(idx, { name: e.target.value })}
                  placeholder="Full Name *"
                  style={{ ...inputStyle, borderColor: !p.name.trim() ? 'var(--danger-400)' : undefined }}
                />
                <input
                  type="text"
                  value={p.rollNumber}
                  onChange={(e) => updatePerson(idx, { rollNumber: e.target.value })}
                  placeholder="Roll No *"
                  style={{ ...inputStyle, borderColor: !p.rollNumber.trim() ? 'var(--danger-400)' : undefined }}
                />
                <input
                  type="text"
                  value={p.phone || ''}
                  onChange={(e) => updatePerson(idx, { phone: e.target.value })}
                  placeholder="Phone"
                  style={inputStyle}
                />
                <input
                  type="email"
                  value={p.email || ''}
                  onChange={(e) => updatePerson(idx, { email: e.target.value })}
                  placeholder="Email"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => deletePerson(idx)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--danger-500)', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isPeopleValid && (
        <div style={feedbackStyle('success')}>
          <Check size={13} /> {sessionState.people.length} students ready.
        </div>
      )}
    </div>
  );

  const renderDate = () => {
    const formattedDate = formatFullDisplayDate(year, monthIndex, validDay);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '480px' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Select the month and starting attendance date.
        </p>

        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
          {/* Month Nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', paddingBottom: '0.625rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <select
                value={monthIndex}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setMonthIndex(m);
                  const maxD = getDaysInMonth(year, m);
                  const newD = Math.min(selectedDay, maxD);
                  setSelectedDay(newD);
                  setDateSetup(year, m, newD);
                }}
                aria-label="Select Month"
                style={{
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '0.2rem 0.4rem',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={year}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setYear(y);
                  const maxD = getDaysInMonth(y, monthIndex);
                  const newD = Math.min(selectedDay, maxD);
                  setSelectedDay(newD);
                  setDateSetup(y, monthIndex, newD);
                }}
                aria-label="Select Year"
                style={{
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '0.2rem 0.4rem',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {supportedYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={year <= getMinSupportedYear() && monthIndex === 0}
                style={{
                  ...navBtnSt,
                  opacity: year <= getMinSupportedYear() && monthIndex === 0 ? 0.4 : 1,
                  cursor: year <= getMinSupportedYear() && monthIndex === 0 ? 'not-allowed' : 'pointer',
                }}
                title="Previous Month"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                disabled={year >= getMaxSupportedYear() && monthIndex === 11}
                style={{
                  ...navBtnSt,
                  opacity: year >= getMaxSupportedYear() && monthIndex === 11 ? 0.4 : 1,
                  cursor: year >= getMaxSupportedYear() && monthIndex === 11 ? 'not-allowed' : 'pointer',
                }}
                title="Next Month"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Day Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem', marginBottom: '0.35rem' }}>
            {DAY_NAMES.map((n, i) => (
              <div key={n} style={{ textAlign: 'center', fontSize: '0.68rem', fontWeight: 700, color: i >= 5 ? 'var(--text-subtle)' : 'var(--text-muted)', textTransform: 'uppercase' }}>{n}</div>
            ))}
          </div>

          {/* Days */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem' }}>
            {calendarData.allCells.map((cell, i) => {
              if (!cell.isCurrentMonth) {
                return <div key={`out_${i}`} style={{ height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)', fontSize: '0.8rem' }}>{cell.day}</div>;
              }
              const isSelected = cell.day === validDay;
              const isToday = cell.isToday;
              return (
                <button
                  key={`d_${cell.day}`}
                  type="button"
                  onClick={() => handleSelectDay(cell.day)}
                  style={{
                    height: '34px',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected ? '2px solid var(--primary-600)' : isToday ? '1.5px solid var(--primary-300)' : '1px solid transparent',
                    backgroundColor: isSelected ? 'var(--primary-600)' : isToday ? 'var(--primary-50)' : 'var(--bg-canvas)',
                    color: isSelected ? '#fff' : isToday ? 'var(--primary-700)' : 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontWeight: isSelected || isToday ? 700 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Selected display */}
          <div style={{ marginTop: '0.875rem', padding: '0.6rem 0.875rem', backgroundColor: 'var(--primary-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--primary-600)', textTransform: 'uppercase', fontWeight: 700 }}>Starting Date</div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--primary-700)' }}>{formattedDate}</div>
            </div>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-default)' }}>
              {weekdayName}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderTimetable = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        Add subjects for each weekday. You can edit this later in the workspace.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {WEEKDAYS_LIST.map((day) => {
          const subjects = weeklyTimetable[day] || [];
          const inputVal = ttInputs[day] || '';
          const errMsg = ttErrors[day] || '';
          return (
            <div key={day} style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{day}</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>{subjects.length}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minHeight: '40px' }}>
                {subjects.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>None</span>}
                {subjects.map((sub) => {
                  const isEdit = editingItem?.day === day && editingItem?.id === sub.id;
                  if (isEdit) {
                    return (
                      <div key={sub.id} style={{ display: 'flex', gap: '0.25rem' }}>
                        <input type="text" value={editingItem.name} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') { setEditingItem(null); setEditError(''); } }} autoFocus style={{ ...inputStyle, flex: 1 }} />
                        <button type="button" onClick={handleSaveEdit} style={microActionBtnSt('success')}><Check size={12} /></button>
                        <button type="button" onClick={() => { setEditingItem(null); setEditError(''); }} style={microActionBtnSt('neutral')}><X size={12} /></button>
                      </div>
                    );
                  }
                  return (
                    <div key={sub.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>{sub.name}</span>
                      <div style={{ display: 'flex', gap: '0.15rem' }}>
                        <button type="button" onClick={() => { setEditingItem({ day, id: sub.id, name: sub.name }); setEditError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.1rem', display: 'flex' }}><Edit2 size={11} /></button>
                        <button type="button" onClick={() => deleteTimetableSubject(day, sub.id)} style={{ background: 'none', border: 'none', color: 'var(--danger-500)', cursor: 'pointer', padding: '0.1rem', display: 'flex' }}><Trash2 size={11} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <input type="text" value={inputVal} onChange={(e) => { setTtInputs((p) => ({ ...p, [day]: e.target.value })); setTtErrors((p) => ({ ...p, [day]: '' })); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleTtAdd(day); } }} placeholder="Add…" style={{ ...inputStyle, flex: 1, borderColor: errMsg ? 'var(--danger-500)' : undefined }} />
                <button type="button" onClick={() => handleTtAdd(day)} style={{ backgroundColor: 'var(--primary-600)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  <Plus size={12} /> Add
                </button>
              </div>
              {errMsg && <span style={{ fontSize: '0.7rem', color: 'var(--danger-500)' }}>{errMsg}</span>}
              {editError && editingItem?.day === day && <span style={{ fontSize: '0.7rem', color: 'var(--danger-500)' }}>{editError}</span>}
            </div>
          );
        })}
      </div>
      {isTimetableValid && (
        <div style={feedbackStyle('success')}>
          <Check size={13} /> {totalSubjects} subjects across {Object.values(weeklyTimetable).filter((l) => l.length > 0).length} days.
        </div>
      )}
    </div>
  );

  // ─── Layout ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--bg-app)' }}>
      {/* Setup Header */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '1rem 1.5rem 0', flexShrink: 0 }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <button
                type="button"
                onClick={() => {
                  if (canCreateWorkspace) {
                    handleCreateWorkspace();
                  }
                }}
                disabled={!canCreateWorkspace}
                title={canCreateWorkspace ? 'Open Attendance Workspace' : 'Complete required setup steps to open workspace'}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  cursor: canCreateWorkspace ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '10px',
                  transition: 'transform 0.15s ease, opacity 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (canCreateWorkspace) {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <img
                  src={currentIcon}
                  alt="Rollvia Logo"
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    objectFit: 'contain',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'block',
                  }}
                />
              </button>
              <div>
                <h1 style={{ margin: 0, fontWeight: 800, fontSize: '1.35rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  <span style={{ color: 'var(--primary-600)' }}>Rollvia</span> Setup
                </h1>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Configure once. Mark attendance daily.
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          {/* Tab Bar */}
          <div style={{ display: 'flex', gap: '0.15rem' }}>
            {SETUP_TABS.map((tab, i) => {
              const isActive = activeTab === tab.id;
              const isDone = (tab.id === 'storage' && isStorageValid) ||
                (tab.id === 'students' && isPeopleValid) ||
                (tab.id === 'timetable' && isTimetableValid);
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.45rem 0.875rem',
                    borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                    border: 'none',
                    borderBottom: isActive ? '2px solid var(--primary-600)' : '2px solid transparent',
                    backgroundColor: isActive ? 'var(--primary-50)' : 'transparent',
                    color: isActive ? 'var(--primary-700)' : 'var(--text-muted)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-subtle)' }}>
                    {i + 1}.
                  </span>
                  {tab.icon}
                  {tab.label}
                  {isDone && <Check size={12} style={{ color: 'var(--success-500)' }} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem 1.5rem' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          {activeTab === 'storage' && renderStorage()}
          {activeTab === 'students' && renderStudents()}
          {activeTab === 'date' && renderDate()}
          {activeTab === 'timetable' && renderTimetable()}
        </div>
      </div>

      {/* Footer with Create Workspace button */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', padding: '0.875rem 1.5rem', flexShrink: 0 }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Status summary */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Storage', ok: isStorageValid },
              { label: 'Students', ok: isPeopleValid },
              { label: 'Timetable', ok: isTimetableValid },
            ].map(({ label, ok }) => (
              <span
                key={label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.75rem',
                  color: ok ? 'var(--success-600)' : 'var(--text-muted)',
                  fontWeight: ok ? 600 : 400,
                }}
              >
                {ok ? <Check size={12} /> : <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid var(--border-strong)', display: 'inline-block' }} />}
                {label}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCreateWorkspace}
            disabled={!canCreateWorkspace}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: canCreateWorkspace ? 'var(--primary-600)' : 'var(--border-strong)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              padding: '0.6rem 1.5rem',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: canCreateWorkspace ? 'pointer' : 'not-allowed',
              boxShadow: canCreateWorkspace ? 'var(--shadow-md)' : 'none',
            }}
          >
            Open →
          </button>
        </div>
      </div>

      <StudentImportModal
        isOpen={importModalOpen}
        initialMode={importModalMode}
        existingPeople={sessionState.people}
        onClose={() => setImportModalOpen(false)}
        onImport={importStudents}
      />
    </div>
  );
};

// ─── Shared Micro Styles ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  padding: '0.4rem 0.6rem',
  fontSize: '0.82rem',
  backgroundColor: 'var(--bg-canvas)',
  color: 'var(--text-primary)',
  outline: 'none',
};

const navBtnSt: React.CSSProperties = {
  backgroundColor: 'var(--bg-canvas)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  padding: '0.25rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};

function feedbackStyle(variant: 'success' | 'danger'): React.CSSProperties {
  const isSuccess = variant === 'success';
  return {
    backgroundColor: isSuccess ? 'var(--success-50)' : 'var(--danger-50)',
    border: `1px solid ${isSuccess ? 'var(--success-100)' : 'var(--danger-100)'}`,
    color: isSuccess ? 'var(--success-text)' : 'var(--danger-text)',
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.78rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  };
}

function microActionBtnSt(variant: 'success' | 'neutral'): React.CSSProperties {
  return {
    backgroundColor: variant === 'success' ? 'var(--success-50)' : 'var(--bg-canvas)',
    border: `1px solid ${variant === 'success' ? 'var(--success-500)' : 'var(--border-default)'}`,
    borderRadius: 'var(--radius-xs)',
    color: variant === 'success' ? 'var(--success-600)' : 'var(--text-secondary)',
    padding: '0.2rem 0.35rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
  };
}
