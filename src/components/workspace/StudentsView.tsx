import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronRight,
  FileSpreadsheet,
  ClipboardList,
  Search,
  Download,
  Phone,
  Mail,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useFlow } from '../../context';
import { calculateStudentAttendanceProfile } from '../../models/attendance';
import type { StudentAttendanceProfile } from '../../types';
import { StudentImportModal, type ImportTabMode } from '../ui/StudentImportModal';
import { MonthlyAttendanceSummaryModal } from './MonthlyAttendanceSummaryModal';
import { getAttendanceColor, parsePercentage } from '../../utils/thresholds';

type FilterThreshold = 'all' | 'below75' | 'below65';
type SortField = 'index' | 'name' | 'rollNumber' | 'total' | 'present' | 'absent' | 'percentage';



function exportStudentAttendanceCsv(profile: StudentAttendanceProfile, monthStr: string) {
  const p = profile.student;
  const lines: string[] = [
    `"Student Attendance Summary - ${monthStr}"`,
    `"Name","${(p.name || '').replace(/"/g, '""')}"`,
    `"Roll No","${(p.rollNumber || '').replace(/"/g, '""')}"`,
    `"Phone","${(p.phone || '').replace(/"/g, '""')}"`,
    `"Email","${(p.email || '').replace(/"/g, '""')}"`,
    `"Total Classes","${profile.totalClasses}"`,
    `"Present Classes","${profile.presentClasses}"`,
    `"Absent Classes","${profile.absentClasses}"`,
    `"Overall Percentage","${profile.overallPercentage}"`,
    '',
    `"Subject-wise Breakdown"`,
    `"Subject","Present","Absent","Total","Percentage"`,
  ];

  for (const st of profile.subjectStats) {
    lines.push(
      `"${st.subject.replace(/"/g, '""')}","${st.present}","${st.absent}","${st.total}","${st.percentage}"`
    );
  }

  const csvContent = lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const safeName = (p.name || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('download', `Rollvia_Attendance_${safeName}_${monthStr.replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const StudentsView: React.FC = () => {
  const { sessionState, updatePerson, addPerson, deletePerson, importStudents, getMonthAttendanceRecords } = useFlow();

  const { people, selectedYear, selectedMonthIndex, selectedMonth } = sessionState;

  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{ name: string; rollNumber: string; phone: string; email: string }>({
    name: '',
    rollNumber: '',
    phone: '',
    email: '',
  });
  const [editError, setEditError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

  // Search & Filter & Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterThreshold, setFilterThreshold] = useState<FilterThreshold>('all');
  const [sortField, setSortField] = useState<SortField>('index');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importModalMode, setImportModalMode] = useState<ImportTabMode>('file');
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

  const monthRecords = useMemo(
    () => getMonthAttendanceRecords(selectedYear, selectedMonthIndex),
    [getMonthAttendanceRecords, selectedYear, selectedMonthIndex]
  );

  // Precompute student profiles for current month
  const studentProfiles = useMemo(() => {
    const map = new Map<string, StudentAttendanceProfile>();
    for (const p of people) {
      map.set(p.id, calculateStudentAttendanceProfile(p, monthRecords));
    }
    return map;
  }, [people, monthRecords]);

  // Threshold counts for filter chips
  const thresholdCounts = useMemo(() => {
    let below75 = 0;
    let below65 = 0;
    for (const [, prof] of studentProfiles.entries()) {
      const pct = parsePercentage(prof.overallPercentage);
      if (pct < 75) below75++;
      if (pct < 65) below65++;
    }
    return { all: people.length, below75, below65 };
  }, [people.length, studentProfiles]);

  // Filtered and sorted students
  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return people
      .map((person, originalIndex) => ({
        person,
        originalIndex,
        profile: studentProfiles.get(person.id) || calculateStudentAttendanceProfile(person, monthRecords),
      }))
      .filter(({ person, profile }) => {
        // Search filter
        if (query) {
          const matchName = (person.name || '').toLowerCase().includes(query);
          const matchRoll = (person.rollNumber || '').toLowerCase().includes(query);
          const matchPhone = (person.phone || '').toLowerCase().includes(query);
          const matchEmail = (person.email || '').toLowerCase().includes(query);
          if (!matchName && !matchRoll && !matchPhone && !matchEmail) return false;
        }

        // Threshold filter
        const pct = parsePercentage(profile.overallPercentage);
        if (filterThreshold === 'below75' && pct >= 75) return false;
        if (filterThreshold === 'below65' && pct >= 65) return false;

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'index') {
          cmp = a.originalIndex - b.originalIndex;
        } else if (sortField === 'name') {
          cmp = (a.person.name || '').localeCompare(b.person.name || '');
        } else if (sortField === 'rollNumber') {
          cmp = (a.person.rollNumber || '').localeCompare(b.person.rollNumber || '', undefined, { numeric: true });
        } else if (sortField === 'total') {
          cmp = a.profile.totalClasses - b.profile.totalClasses;
        } else if (sortField === 'present') {
          cmp = a.profile.presentClasses - b.profile.presentClasses;
        } else if (sortField === 'absent') {
          cmp = a.profile.absentClasses - b.profile.absentClasses;
        } else if (sortField === 'percentage') {
          cmp = parsePercentage(a.profile.overallPercentage) - parsePercentage(b.profile.overallPercentage);
        }
        return sortDirection === 'asc' ? cmp : -cmp;
      });
  }, [people, studentProfiles, searchQuery, filterThreshold, sortField, sortDirection, monthRecords]);

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleStartEdit = (idx: number) => {
    const p = people[idx];
    setEditDraft({ name: p.name, rollNumber: p.rollNumber, phone: p.phone || '', email: p.email || '' });
    setEditingIdx(idx);
    setEditError('');
  };

  const handleSaveEdit = (idx: number) => {
    if (!editDraft.name.trim()) { setEditError('Name is required.'); return; }
    if (!editDraft.rollNumber.trim()) { setEditError('Roll No is required.'); return; }
    const dup = people.some((p, i) => i !== idx && p.rollNumber.trim().toLowerCase() === editDraft.rollNumber.trim().toLowerCase());
    if (dup) { setEditError('Duplicate Roll No.'); return; }
    updatePerson(idx, {
      name: editDraft.name.trim(),
      rollNumber: editDraft.rollNumber.trim(),
      phone: editDraft.phone.trim(),
      email: editDraft.email.trim(),
    });
    setEditingIdx(null);
    setEditError('');
  };

  const handleAddStudent = () => {
    const nextIdx = people.length;
    addPerson();
    setEditDraft({ name: '', rollNumber: '', phone: '', email: '' });
    setEditingIdx(nextIdx);
    setEditError('');
  };

  return (
    <div
      style={{
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
        backgroundColor: 'var(--bg-app)',
        padding: '1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
      }}
    >
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.6rem',
        }}
      >
        {/* Title + subtitle */}
        <div>
          <h2
            style={{
              margin: 0,
              fontWeight: 700,
              fontSize: '1.05rem',
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
            }}
          >
            Students
          </h2>
          <p
            style={{
              margin: '0.1rem 0 0',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontWeight: 400,
              lineHeight: 1.4,
            }}
          >
            {people.length} enrolled · {selectedMonth} statistics
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          {/* Add Student — primary blue */}
          <button
            type="button"
            onClick={handleAddStudent}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              backgroundColor: 'var(--primary-600)',
              border: '1px solid var(--primary-600)',
              borderRadius: 'var(--radius-sm)',
              color: '#fff',
              padding: '0.32rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s',
              height: '30px',
              whiteSpace: 'nowrap',
            }}
          >
            <Plus size={13} />
            Add Student
          </button>

          {/* Import */}
          <button
            type="button"
            onClick={() => {
              setImportModalMode('file');
              setImportModalOpen(true);
            }}
            title="Import students from CSV or Excel file"
            style={actionBtnStyle}
          >
            <FileSpreadsheet size={13} /> Import
          </button>

          {/* Monthly Attendance Summary */}
          <button
            type="button"
            onClick={() => setSummaryModalOpen(true)}
            title="Open Month-wise Attendance Summary Matrix"
            style={{
              ...actionBtnStyle,
              backgroundColor: 'var(--primary-50)',
              borderColor: 'var(--primary-200)',
              color: 'var(--primary-700)',
              fontWeight: 600,
            }}
          >
            <FileSpreadsheet size={13} /> Monthly Summary
          </button>

          {/* Paste List */}
          <button
            type="button"
            onClick={() => {
              setImportModalMode('paste');
              setImportModalOpen(true);
            }}
            title="Paste student list copied from spreadsheet"
            style={actionBtnStyle}
          >
            <ClipboardList size={13} /> Paste List
          </button>
        </div>
      </div>

      {/* ── Search & Filter Bar ──────────────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.65rem',
          flexWrap: 'wrap',
          backgroundColor: 'var(--bg-surface)',
          padding: '0.4rem 0.7rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xs)',
            padding: '0.22rem 0.55rem',
            minWidth: '200px',
            flex: '1 1 220px',
            maxWidth: '340px',
            height: '28px',
          }}
        >
          <Search size={13} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, roll no, phone, email..."
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '0.78rem',
              color: 'var(--text-primary)',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-subtle)',
                padding: 0,
                display: 'flex',
                flexShrink: 0,
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginRight: '0.15rem',
              whiteSpace: 'nowrap',
            }}
          >
            Filter:
          </span>

          <button
            type="button"
            onClick={() => setFilterThreshold('all')}
            style={filterChipStyle(filterThreshold === 'all', 'neutral')}
          >
            All ({thresholdCounts.all})
          </button>

          <button
            type="button"
            onClick={() => setFilterThreshold('below75')}
            style={filterChipStyle(filterThreshold === 'below75', 'warning')}
          >
            Below 75% ({thresholdCounts.below75})
          </button>

          <button
            type="button"
            onClick={() => setFilterThreshold('below65')}
            style={filterChipStyle(filterThreshold === 'below65', 'danger')}
          >
            Below 65% ({thresholdCounts.below65})
          </button>
        </div>
      </div>

      {/* ── Students Table ────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'auto',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        {people.length === 0 ? (
          <div
            style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.82rem',
            }}
          >
            No students yet. Click &ldquo;Add Student&rdquo; or &ldquo;Import&rdquo; to begin.
          </div>
        ) : filteredStudents.length === 0 ? (
          <div
            style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.82rem',
            }}
          >
            No students matching your filter or search query.
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.8rem',
              tableLayout: 'fixed',
            }}
          >
            <thead>
              <tr>
                {/* # */}
                <th
                  onClick={() => handleSortToggle('index')}
                  style={{ ...thSortStyle, width: '44px', textAlign: 'center' }}
                  title="Sort by index"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    # {renderSortIcon('index', sortField, sortDirection)}
                  </span>
                </th>

                {/* Name */}
                <th
                  onClick={() => handleSortToggle('name')}
                  style={{ ...thSortStyle, textAlign: 'left' }}
                  title="Sort by name"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    Name {renderSortIcon('name', sortField, sortDirection)}
                  </span>
                </th>

                {/* Roll No */}
                <th
                  onClick={() => handleSortToggle('rollNumber')}
                  style={{ ...thSortStyle, textAlign: 'left', width: '100px' }}
                  title="Sort by roll number"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    Roll No {renderSortIcon('rollNumber', sortField, sortDirection)}
                  </span>
                </th>

                {/* Classes */}
                <th
                  onClick={() => handleSortToggle('total')}
                  style={{ ...thSortStyle, textAlign: 'center', width: '80px' }}
                  title="Sort by total classes"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    Classes {renderSortIcon('total', sortField, sortDirection)}
                  </span>
                </th>

                {/* Present */}
                <th
                  onClick={() => handleSortToggle('present')}
                  style={{ ...thSortStyle, textAlign: 'center', width: '80px' }}
                  title="Sort by present count"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    Present {renderSortIcon('present', sortField, sortDirection)}
                  </span>
                </th>

                {/* Absent */}
                <th
                  onClick={() => handleSortToggle('absent')}
                  style={{ ...thSortStyle, textAlign: 'center', width: '80px' }}
                  title="Sort by absent count"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    Absent {renderSortIcon('absent', sortField, sortDirection)}
                  </span>
                </th>

                {/* % */}
                <th
                  onClick={() => handleSortToggle('percentage')}
                  style={{ ...thSortStyle, textAlign: 'center', width: '76px' }}
                  title="Sort by attendance percentage"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    % {renderSortIcon('percentage', sortField, sortDirection)}
                  </span>
                </th>

                {/* Actions */}
                <th style={{ ...thStaticStyle, width: '72px', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(({ person, originalIndex: idx, profile }) => {
                const isEditing = editingIdx === idx;
                const isExpanded = expandedId === person.id;
                const attendanceColor = getAttendanceColor(profile.overallPercentage);

                return (
                  <React.Fragment key={person.id}>
                    <tr
                      style={{
                        backgroundColor: isExpanded
                          ? 'var(--primary-50)'
                          : idx % 2 === 0
                          ? 'var(--bg-surface)'
                          : 'var(--bg-surface-subtle)',
                        borderBottom: isExpanded ? 'none' : '1px solid var(--border-subtle)',
                        transition: 'background-color 0.1s',
                      }}
                    >
                      {/* # */}
                      <td
                        style={{
                          ...tdSt,
                          textAlign: 'center',
                          color: 'var(--text-subtle)',
                          fontSize: '0.72rem',
                          width: '44px',
                        }}
                      >
                        {idx + 1}
                      </td>

                      {/* Name */}
                      <td style={tdSt}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDraft.name}
                            onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))}
                            autoFocus
                            style={inpSt}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : person.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: 0,
                              width: '100%',
                            }}
                          >
                            <ChevronRight
                              size={12}
                              style={{
                                transform: isExpanded ? 'rotate(90deg)' : 'none',
                                transition: 'transform 0.15s',
                                color: 'var(--text-subtle)',
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ color: isExpanded ? 'var(--primary-700)' : 'var(--text-primary)' }}>
                              {person.name || (
                                <span style={{ color: 'var(--danger-500)', fontStyle: 'italic' }}>Unnamed</span>
                              )}
                            </span>
                          </button>
                        )}
                      </td>

                      {/* Roll No */}
                      <td style={{ ...tdSt, width: '100px' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDraft.rollNumber}
                            onChange={(e) => setEditDraft((p) => ({ ...p, rollNumber: e.target.value }))}
                            style={inpSt}
                          />
                        ) : (
                          <span
                            style={{
                              fontWeight: 500,
                              color: 'var(--primary-600)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {person.rollNumber || '—'}
                          </span>
                        )}
                      </td>

                      {/* Classes */}
                      <td
                        style={{
                          ...tdSt,
                          textAlign: 'center',
                          color: 'var(--text-secondary)',
                          fontVariantNumeric: 'tabular-nums',
                          width: '80px',
                        }}
                      >
                        {profile.totalClasses}
                      </td>

                      {/* Present */}
                      <td
                        style={{
                          ...tdSt,
                          textAlign: 'center',
                          color: 'var(--success-600)',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          width: '80px',
                        }}
                      >
                        {profile.presentClasses}
                      </td>

                      {/* Absent */}
                      <td
                        style={{
                          ...tdSt,
                          textAlign: 'center',
                          color: profile.absentClasses > 0 ? 'var(--danger-600)' : 'var(--text-subtle)',
                          fontWeight: profile.absentClasses > 0 ? 600 : 400,
                          fontVariantNumeric: 'tabular-nums',
                          width: '80px',
                        }}
                      >
                        {profile.absentClasses}
                      </td>

                      {/* % */}
                      <td
                        style={{
                          ...tdSt,
                          textAlign: 'center',
                          fontWeight: 700,
                          color: attendanceColor.color,
                          fontVariantNumeric: 'tabular-nums',
                          width: '76px',
                        }}
                      >
                        {profile.overallPercentage}
                      </td>

                      {/* Actions */}
                      <td style={{ ...tdSt, textAlign: 'right', width: '72px' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(idx)}
                              style={iconBtnSt('success')}
                              title="Save"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingIdx(null);
                                setEditError('');
                              }}
                              style={iconBtnSt('neutral')}
                              title="Cancel"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(idx)}
                              style={iconBtnSt('neutral')}
                              title="Edit Student"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteIdx(idx)}
                              style={iconBtnSt('danger')}
                              title="Delete Student"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Inline edit error */}
                    {isEditing && editError && (
                      <tr style={{ backgroundColor: 'var(--danger-50)' }}>
                        <td
                          colSpan={8}
                          style={{
                            padding: '0.25rem 0.75rem',
                            fontSize: '0.73rem',
                            color: 'var(--danger-600)',
                            borderBottom: '1px solid var(--danger-100)',
                          }}
                        >
                          {editError}
                        </td>
                      </tr>
                    )}

                    {/* Delete confirmation inline */}
                    {confirmDeleteIdx === idx && (
                      <tr
                        style={{
                          backgroundColor: 'var(--danger-50)',
                          borderBottom: '1px solid var(--border-subtle)',
                        }}
                      >
                        <td colSpan={8} style={{ padding: '0.45rem 0.75rem' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.65rem',
                              fontSize: '0.78rem',
                            }}
                          >
                            <span style={{ color: 'var(--danger-700)', fontWeight: 600 }}>
                              Delete {person.name}? This will remove the student from the roster.
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                deletePerson(idx);
                                setConfirmDeleteIdx(null);
                              }}
                              style={{
                                backgroundColor: 'var(--danger-600)',
                                border: 'none',
                                borderRadius: 'var(--radius-xs)',
                                color: '#fff',
                                padding: '0.2rem 0.6rem',
                                fontWeight: 700,
                                fontSize: '0.73rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteIdx(null)}
                              style={{
                                background: 'transparent',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-xs)',
                                color: 'var(--text-secondary)',
                                padding: '0.2rem 0.6rem',
                                fontSize: '0.73rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* ── Student Detail Expanded Card ──────────────────────── */}
                    {isExpanded && !isEditing && (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            padding: '0.65rem 1rem 0.85rem 2rem',
                            backgroundColor: 'var(--bg-canvas)',
                            borderBottom: '1px solid var(--border-default)',
                          }}
                        >
                          <div
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.85rem 1rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.75rem',
                            }}
                          >
                            {/* Card top: student info + card actions */}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                flexWrap: 'wrap',
                                gap: '0.65rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                {/* Avatar initial */}
                                <div
                                  style={{
                                    width: '34px',
                                    height: '34px',
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--primary-100)',
                                    color: 'var(--primary-700)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '0.88rem',
                                    flexShrink: 0,
                                  }}
                                >
                                  {(person.name || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span
                                      style={{
                                        fontWeight: 700,
                                        fontSize: '0.9rem',
                                        color: 'var(--text-primary)',
                                      }}
                                    >
                                      {person.name}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '0.73rem',
                                        color: 'var(--primary-600)',
                                        fontWeight: 600,
                                        backgroundColor: 'var(--primary-50)',
                                        border: '1px solid var(--primary-200)',
                                        borderRadius: 'var(--radius-xs)',
                                        padding: '0.1rem 0.4rem',
                                      }}
                                    >
                                      Roll No: {person.rollNumber || 'N/A'}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      gap: '0.85rem',
                                      fontSize: '0.73rem',
                                      color: 'var(--text-muted)',
                                      marginTop: '0.2rem',
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    {person.phone && (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                        <Phone size={10} /> {person.phone}
                                      </span>
                                    )}
                                    {person.email && (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                        <Mail size={10} /> {person.email}
                                      </span>
                                    )}
                                    {!person.phone && !person.email && (
                                      <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic' }}>
                                        No phone or email listed
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Card actions */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(idx)}
                                  style={cardActionBtnStyle}
                                >
                                  <Edit2 size={12} /> Edit Student
                                </button>
                                <button
                                  type="button"
                                  onClick={() => exportStudentAttendanceCsv(profile, selectedMonth)}
                                  style={cardActionBtnStyle}
                                >
                                  <Download size={12} /> Export Student Attendance
                                </button>
                              </div>
                            </div>

                            {/* Metrics strip */}
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, auto)',
                                gap: '0',
                                backgroundColor: 'var(--bg-canvas)',
                                borderRadius: 'var(--radius-xs)',
                                border: '1px solid var(--border-subtle)',
                                overflow: 'hidden',
                              }}
                            >
                              {[
                                {
                                  label: 'Total Classes',
                                  value: profile.totalClasses,
                                  color: 'var(--text-primary)',
                                },
                                {
                                  label: 'Present',
                                  value: profile.presentClasses,
                                  color: 'var(--success-600)',
                                },
                                {
                                  label: 'Absent',
                                  value: profile.absentClasses,
                                  color: 'var(--danger-600)',
                                },
                                {
                                  label: 'Attendance %',
                                  value: profile.overallPercentage,
                                  color: attendanceColor.color,
                                },
                              ].map((metric, i) => (
                                <div
                                  key={metric.label}
                                  style={{
                                    padding: '0.45rem 0.75rem',
                                    borderRight: i < 3 ? '1px solid var(--border-subtle)' : 'none',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.1rem',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: '0.67rem',
                                      color: 'var(--text-muted)',
                                      fontWeight: 500,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.04em',
                                    }}
                                  >
                                    {metric.label}
                                  </span>
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      fontSize: '0.95rem',
                                      color: metric.color,
                                      lineHeight: 1.2,
                                    }}
                                  >
                                    {metric.value}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Subject-wise breakdown */}
                            <div>
                              <div
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  color: 'var(--text-muted)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                  marginBottom: '0.3rem',
                                }}
                              >
                                Subject-Wise Attendance Breakdown ({selectedMonth})
                              </div>
                              {profile.subjectStats.length === 0 ? (
                                <div
                                  style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)',
                                    fontStyle: 'italic',
                                  }}
                                >
                                  No recorded attendance classes for this student yet this month.
                                </div>
                              ) : (
                                <table
                                  style={{
                                    width: '100%',
                                    fontSize: '0.75rem',
                                    borderCollapse: 'collapse',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-xs)',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <thead>
                                    <tr
                                      style={{
                                        backgroundColor: 'var(--bg-canvas)',
                                        borderBottom: '1px solid var(--border-default)',
                                      }}
                                    >
                                      {['Subject', 'Present', 'Absent', 'Total', 'Percentage'].map((h, i) => (
                                        <th
                                          key={h}
                                          style={{
                                            padding: '0.28rem 0.55rem',
                                            textAlign: i === 0 ? 'left' : 'center',
                                            fontWeight: 600,
                                            fontSize: '0.68rem',
                                            color: 'var(--text-secondary)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.03em',
                                          }}
                                        >
                                          {h}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {profile.subjectStats.map((st, stIdx) => {
                                      const stColor = getAttendanceColor(st.percentage);
                                      return (
                                        <tr
                                          key={st.subject}
                                          style={{
                                            borderBottom: '1px solid var(--border-subtle)',
                                            backgroundColor:
                                              stIdx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)',
                                          }}
                                        >
                                          <td
                                            style={{
                                              padding: '0.3rem 0.55rem',
                                              fontWeight: 600,
                                              color: 'var(--text-primary)',
                                            }}
                                          >
                                            {st.subject}
                                          </td>
                                          <td
                                            style={{
                                              padding: '0.3rem 0.55rem',
                                              textAlign: 'center',
                                              color: 'var(--success-600)',
                                              fontWeight: 600,
                                            }}
                                          >
                                            {st.present}
                                          </td>
                                          <td
                                            style={{
                                              padding: '0.3rem 0.55rem',
                                              textAlign: 'center',
                                              color: st.absent > 0 ? 'var(--danger-600)' : 'var(--text-subtle)',
                                              fontWeight: st.absent > 0 ? 600 : 400,
                                            }}
                                          >
                                            {st.absent}
                                          </td>
                                          <td
                                            style={{
                                              padding: '0.3rem 0.55rem',
                                              textAlign: 'center',
                                              color: 'var(--text-secondary)',
                                            }}
                                          >
                                            {st.total}
                                          </td>
                                          <td
                                            style={{
                                              padding: '0.3rem 0.55rem',
                                              textAlign: 'center',
                                              fontWeight: 700,
                                              color: stColor.color,
                                            }}
                                          >
                                            {st.percentage}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <StudentImportModal
        isOpen={importModalOpen}
        initialMode={importModalMode}
        existingPeople={people}
        onClose={() => setImportModalOpen(false)}
        onImport={importStudents}
      />

      <MonthlyAttendanceSummaryModal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
      />
    </div>
  );
};

// ─── Style Helpers ───────────────────────────────────────────────────────────

const tdSt: React.CSSProperties = {
  padding: '0.42rem 0.65rem',
  color: 'var(--text-primary)',
  verticalAlign: 'middle',
};

const thSortStyle: React.CSSProperties = {
  padding: '0.45rem 0.65rem',
  fontWeight: 600,
  fontSize: '0.68rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-secondary)',
  backgroundColor: 'var(--bg-canvas)',
  borderBottom: '1px solid var(--border-default)',
  cursor: 'pointer',
  userSelect: 'none',
  position: 'sticky',
  top: 0,
  zIndex: 10,
  whiteSpace: 'nowrap',
};

const thStaticStyle: React.CSSProperties = {
  padding: '0.45rem 0.65rem',
  fontWeight: 600,
  fontSize: '0.68rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-secondary)',
  backgroundColor: 'var(--bg-canvas)',
  borderBottom: '1px solid var(--border-default)',
  position: 'sticky',
  top: 0,
  zIndex: 10,
  whiteSpace: 'nowrap',
};

const inpSt: React.CSSProperties = {
  border: '1.5px solid var(--primary-500)',
  borderRadius: 'var(--radius-xs)',
  padding: '0.22rem 0.45rem',
  fontSize: '0.8rem',
  color: 'var(--text-primary)',
  backgroundColor: 'var(--bg-canvas)',
  outline: 'none',
  width: '100%',
};

const actionBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-secondary)',
  padding: '0.32rem 0.7rem',
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s',
  height: '30px',
  whiteSpace: 'nowrap',
};

const cardActionBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  backgroundColor: 'var(--bg-canvas)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-xs)',
  color: 'var(--text-secondary)',
  padding: '0.22rem 0.55rem',
  fontSize: '0.73rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.1s',
  whiteSpace: 'nowrap',
};

function filterChipStyle(active: boolean, variant: 'neutral' | 'warning' | 'danger'): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 'var(--radius-xs)',
    padding: '0.2rem 0.5rem',
    fontSize: '0.73rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.1s',
    lineHeight: 1.3,
  };

  if (active) {
    if (variant === 'warning') {
      return {
        ...base,
        backgroundColor: 'var(--warning-50)',
        border: '1px solid var(--warning-500)',
        color: 'var(--warning-600)',
        fontWeight: 600,
      };
    }
    if (variant === 'danger') {
      return {
        ...base,
        backgroundColor: 'var(--danger-50)',
        border: '1px solid var(--danger-500)',
        color: 'var(--danger-600)',
        fontWeight: 600,
      };
    }
    return {
      ...base,
      backgroundColor: 'var(--primary-600)',
      border: '1px solid var(--primary-600)',
      color: '#fff',
      fontWeight: 600,
    };
  }

  return {
    ...base,
    backgroundColor: 'transparent',
    border: '1px solid var(--border-default)',
    color: 'var(--text-secondary)',
    fontWeight: 400,
  };
}

function renderSortIcon(field: SortField, currentField: SortField, direction: 'asc' | 'desc') {
  if (field !== currentField) {
    return <ArrowUpDown size={10} style={{ opacity: 0.35 }} />;
  }
  return direction === 'asc' ? (
    <ArrowUp size={10} style={{ color: 'var(--primary-600)' }} />
  ) : (
    <ArrowDown size={10} style={{ color: 'var(--primary-600)' }} />
  );
}

function iconBtnSt(variant: 'success' | 'neutral' | 'danger'): React.CSSProperties {
  const colors = {
    success: {
      bg: 'var(--success-50)',
      border: 'var(--success-500)',
      color: 'var(--success-600)',
    },
    neutral: {
      bg: 'var(--bg-canvas)',
      border: 'var(--border-default)',
      color: 'var(--text-secondary)',
    },
    danger: {
      bg: 'var(--danger-50)',
      border: 'var(--danger-200)',
      color: 'var(--danger-600)',
    },
  }[variant];

  return {
    backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: 'var(--radius-xs)',
    color: colors.color,
    padding: '0.2rem 0.28rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.1s',
  };
}
