import React, { useState, useRef, useMemo } from 'react';
import {
  FileSpreadsheet,
  ClipboardList,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  FileCheck,
} from 'lucide-react';
import type { Person } from '../../types';
import {
  parsePastedStudentList,
  parseUploadedStudentFile,
  type ParseStudentsResult,
} from '../../utils/studentImportParser';
import type { ImportStudentsOptions, ImportStudentsResult } from '../../context/FlowContextDefinition';

export type ImportTabMode = 'file' | 'paste';

interface StudentImportModalProps {
  isOpen: boolean;
  initialMode?: ImportTabMode;
  existingPeople: Person[];
  onClose: () => void;
  onImport: (
    students: Array<{ name: string; rollNumber: string; phone?: string; email?: string }>,
    options?: ImportStudentsOptions
  ) => ImportStudentsResult;
}

export const StudentImportModal: React.FC<StudentImportModalProps> = ({
  isOpen,
  initialMode = 'file',
  existingPeople,
  onClose,
  onImport,
}) => {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [userSelectedTab, setUserSelectedTab] = useState<ImportTabMode | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileParseResult, setFileParseResult] = useState<ParseStudentsResult | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset tab selection & feedback when modal opens
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setUserSelectedTab(null);
      setImportSummary(null);
    }
  }

  const activeTab: ImportTabMode = userSelectedTab ?? initialMode;
  const setActiveTab = (tab: ImportTabMode) => setUserSelectedTab(tab);

  // Compute live parse result for Paste mode
  const pasteParseResult = useMemo(() => {
    if (!pastedText.trim()) return null;
    return parsePastedStudentList(pastedText, existingPeople);
  }, [pastedText, existingPeople]);

  // Active parse result based on current tab
  const currentResult: ParseStudentsResult | null =
    activeTab === 'file' ? fileParseResult : pasteParseResult;

  // File upload handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setFileError(null);
    setImportSummary(null);

    try {
      const buffer = await file.arrayBuffer();
      const res = parseUploadedStudentFile(buffer, existingPeople);
      setFileParseResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to read file.';
      setFileError(msg);
      setFileParseResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setFileError(null);
    setImportSummary(null);

    try {
      const buffer = await file.arrayBuffer();
      const res = parseUploadedStudentFile(buffer, existingPeople);
      setFileParseResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to read file.';
      setFileError(msg);
      setFileParseResult(null);
    }
  };

  const handleResetFile = () => {
    setUploadedFile(null);
    setFileParseResult(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Determine eligible students to import
  const eligibleRows = useMemo(() => {
    if (!currentResult) return [];
    return currentResult.rows.filter((r) => {
      if (r.status === 'missing_required') return false;
      if (r.status === 'duplicate_in_input') return false;
      if (r.status === 'duplicate_existing') {
        return updateExisting; // only eligible if user chose to update existing
      }
      return true; // 'valid'
    });
  }, [currentResult, updateExisting]);

  const handleConfirmImport = () => {
    if (eligibleRows.length === 0) return;

    const payload = eligibleRows.map((r) => ({
      name: r.name,
      rollNumber: r.rollNumber,
      phone: r.phone,
      email: r.email,
    }));

    const result = onImport(payload, { updateExisting });
    setImportSummary(
      `✓ Successfully imported ${result.addedCount} new student${result.addedCount === 1 ? '' : 's'}${
        result.updatedCount > 0 ? ` and updated ${result.updatedCount} existing student${result.updatedCount === 1 ? '' : 's'}` : ''
      }.`
    );

    setTimeout(() => {
      onClose();
      // Reset state
      setPastedText('');
      setUploadedFile(null);
      setFileParseResult(null);
      setImportSummary(null);
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.72)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '820px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-dialog)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              Import Students to Roster
            </h3>
            <p
              style={{
                margin: '0.15rem 0 0',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
              }}
            >
              Batch import students using Excel, CSV, or by pasting spreadsheet rows.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.3rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-subtle)',
            padding: '0.35rem 1.25rem 0',
            gap: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('file');
              setImportSummary(null);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.9rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: activeTab === 'file' ? 'var(--primary-700)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'file' ? '2px solid var(--primary-600)' : '2px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              marginBottom: '-1px',
            }}
          >
            <FileSpreadsheet size={15} /> Import Excel / CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('paste');
              setImportSummary(null);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.9rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: activeTab === 'paste' ? 'var(--primary-700)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'paste' ? '2px solid var(--primary-600)' : '2px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              marginBottom: '-1px',
            }}
          >
            <ClipboardList size={15} /> Paste List
          </button>
        </div>

        {/* Body (Scrollable) */}
        <div
          style={{
            padding: '1.25rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            flex: 1,
          }}
        >
          {/* Format Instruction Bar */}
          <div
            style={{
              backgroundColor: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.65rem 0.85rem',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.82rem', marginBottom: '0.2rem' }}>
                Required: Name and Roll No / ID
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.74rem' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  Name — <span style={{ color: 'var(--danger-600)' }}>Required</span>
                </span>
                <span style={{ color: 'var(--border-default)' }}>•</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  Roll No / ID — <span style={{ color: 'var(--danger-600)' }}>Required</span>
                </span>
                <span style={{ color: 'var(--border-default)' }}>•</span>
                <span style={{ color: 'var(--text-muted)' }}>Phone — Optional</span>
                <span style={{ color: 'var(--border-default)' }}>•</span>
                <span style={{ color: 'var(--text-muted)' }}>Email — Optional</span>
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
              Current Roster: {existingPeople.length} student{existingPeople.length === 1 ? '' : 's'}
            </div>
          </div>

          {/* TAB 1: File Upload */}
          {activeTab === 'file' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {!uploadedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '2rem 1.5rem',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background-color 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--primary-50)',
                      color: 'var(--primary-600)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Upload size={20} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    Click or drag & drop attendance workbook or CSV
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Supports Excel (.xlsx, .xls) and CSV (.csv) spreadsheets
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <FileCheck size={22} color="var(--success-600)" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {uploadedFile.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {(uploadedFile.size / 1024).toFixed(1)} KB ·{' '}
                        {fileParseResult ? `${fileParseResult.totalRows} student rows detected` : 'Reading...'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetFile}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--danger-500)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '0.25rem 0.5rem',
                    }}
                  >
                    Remove / Choose another
                  </button>
                </div>
              )}

              {fileError && (
                <div
                  style={{
                    backgroundColor: 'var(--danger-50)',
                    border: '1px solid var(--danger-200)',
                    color: 'var(--danger-700)',
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <AlertCircle size={15} /> {fileError}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Paste List */}
          {activeTab === 'paste' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Copy student rows directly from your spreadsheet and paste them below:
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--primary-700)', fontWeight: 600 }}>
                  Name and Roll No / ID are required
                </div>
              </div>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={`John Doe\t101\t9876543210\tjohn@example.com\nJake Smith\t102\t9876543211\tjake@example.com`}
                rows={5}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  backgroundColor: 'var(--bg-canvas)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                  Supports Tab-separated (Excel copy), CSV, or semicolon-separated rows.
                </span>
                {pastedText && (
                  <button
                    type="button"
                    onClick={() => setPastedText('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Clear text
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Duplicate Roll No Options */}
          {currentResult && currentResult.totalRows > 0 && (
            <div
              style={{
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                Duplicate Roll Number Handling:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input
                    type="radio"
                    name="dupHandle"
                    checked={!updateExisting}
                    onChange={() => setUpdateExisting(false)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>
                    <strong>Skip duplicates</strong> (Recommended: keep existing students in Rollvia unchanged)
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input
                    type="radio"
                    name="dupHandle"
                    checked={updateExisting}
                    onChange={() => setUpdateExisting(true)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>
                    <strong>Update existing</strong> (Update Name, Phone & Email for matching Roll Nos; preserves past attendance)
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Live Summary Badges */}
          {currentResult && currentResult.totalRows > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.74rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-canvas)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                Total: {currentResult.totalRows}
              </span>
              <span
                style={{
                  fontSize: '0.74rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--success-50)',
                  color: 'var(--success-700)',
                  fontWeight: 600,
                  border: '1px solid var(--success-200)',
                }}
              >
                New / Ready: {currentResult.validCount}
              </span>
              {currentResult.duplicateExistingCount > 0 && (
                <span
                  style={{
                    fontSize: '0.74rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: updateExisting ? 'var(--primary-50)' : 'var(--warning-50)',
                    color: updateExisting ? 'var(--primary-700)' : 'var(--warning-700)',
                    fontWeight: 600,
                    border: updateExisting ? '1px solid var(--primary-200)' : '1px solid var(--warning-200)',
                  }}
                >
                  Already in Roster: {currentResult.duplicateExistingCount} ({updateExisting ? 'will update' : 'will skip'})
                </span>
              )}
              {currentResult.duplicateInInputCount > 0 && (
                <span
                  style={{
                    fontSize: '0.74rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--warning-50)',
                    color: 'var(--warning-700)',
                    fontWeight: 600,
                    border: '1px solid var(--warning-200)',
                  }}
                >
                  Duplicate in Batch: {currentResult.duplicateInInputCount} (will skip)
                </span>
              )}
              {currentResult.missingRequiredCount > 0 && (
                <span
                  style={{
                    fontSize: '0.74rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--danger-50)',
                    color: 'var(--danger-700)',
                    fontWeight: 600,
                    border: '1px solid var(--danger-200)',
                  }}
                >
                  Missing Required: {currentResult.missingRequiredCount} (will skip)
                </span>
              )}
            </div>
          )}

          {/* Preview Table */}
          {currentResult && currentResult.totalRows > 0 && (
            <div
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-surface)',
                maxHeight: '260px',
                overflowY: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-canvas)', zIndex: 1 }}>
                  <tr>
                    {['#', 'Status', 'Name (Required)', 'Roll No / ID (Required)', 'Phone (Optional)', 'Email (Optional)'].map((h, idx) => (
                      <th
                        key={idx}
                        style={{
                          padding: '0.45rem 0.65rem',
                          textAlign: idx === 0 ? 'center' : 'left',
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                          color: 'var(--text-secondary)',
                          borderBottom: '2px solid var(--border-default)',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentResult.rows.map((r) => {
                    const isEligible =
                      r.status === 'valid' || (r.status === 'duplicate_existing' && updateExisting);
                    const rowBg = !isEligible ? 'var(--bg-surface-subtle)' : 'var(--bg-surface)';

                    return (
                      <tr
                        key={r.displayIndex}
                        style={{
                          backgroundColor: rowBg,
                          borderBottom: '1px solid var(--border-subtle)',
                          opacity: isEligible ? 1 : 0.72,
                        }}
                      >
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: 'var(--text-subtle)', width: '32px' }}>
                          {r.displayIndex}
                        </td>
                        <td style={{ padding: '0.4rem 0.65rem', width: '170px' }}>
                          {r.status === 'valid' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                color: 'var(--success-700)',
                                backgroundColor: 'var(--success-50)',
                                border: '1px solid var(--success-200)',
                                padding: '0.15rem 0.45rem',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                              }}
                            >
                              <CheckCircle2 size={11} /> Valid
                            </span>
                          )}
                          {r.status === 'duplicate_existing' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                color: updateExisting ? 'var(--primary-700)' : 'var(--warning-700)',
                                backgroundColor: updateExisting ? 'var(--primary-50)' : 'var(--warning-50)',
                                border: updateExisting ? '1px solid var(--primary-200)' : '1px solid var(--warning-200)',
                                padding: '0.15rem 0.45rem',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                              }}
                              title={r.errors.join('; ')}
                            >
                              <AlertTriangle size={11} /> {updateExisting ? 'Will Update' : 'Existing (Skip)'}
                            </span>
                          )}
                          {r.status === 'duplicate_in_input' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                color: 'var(--warning-700)',
                                backgroundColor: 'var(--warning-50)',
                                border: '1px solid var(--warning-200)',
                                padding: '0.15rem 0.45rem',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                              }}
                              title={r.errors.join('; ')}
                            >
                              <AlertTriangle size={11} /> Batch Duplicate
                            </span>
                          )}
                          {r.status === 'missing_required' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                color: 'var(--danger-700)',
                                backgroundColor: 'var(--danger-50)',
                                border: '1px solid var(--danger-200)',
                                padding: '0.15rem 0.45rem',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                              }}
                              title={r.errors.join('; ')}
                            >
                              <AlertCircle size={11} /> {r.errors.length > 0 ? r.errors.join(' & ') : 'Missing Required'}
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: '0.4rem 0.65rem',
                            fontWeight: 600,
                            color: r.name ? 'var(--text-primary)' : 'var(--danger-600)',
                          }}
                        >
                          {r.name || <span style={{ fontStyle: 'italic', color: 'var(--danger-600)' }}>Missing Name</span>}
                        </td>
                        <td
                          style={{
                            padding: '0.4rem 0.65rem',
                            color: r.rollNumber ? 'var(--text-secondary)' : 'var(--danger-600)',
                            fontFamily: 'var(--font-mono, monospace)',
                          }}
                        >
                          {r.rollNumber || <span style={{ fontStyle: 'italic', color: 'var(--danger-600)' }}>Missing Roll No / ID</span>}
                        </td>
                        <td style={{ padding: '0.4rem 0.65rem', color: 'var(--text-muted)' }}>
                          {r.phone || '—'}
                        </td>
                        <td style={{ padding: '0.4rem 0.65rem', color: 'var(--text-muted)' }}>
                          {r.email || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Feedback/Confirmation Banner */}
          {importSummary && (
            <div
              style={{
                backgroundColor: 'var(--success-50)',
                border: '1px solid var(--success-200)',
                color: 'var(--success-700)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <CheckCircle2 size={16} /> {importSummary}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Existing students and their historical attendance will never be deleted.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={eligibleRows.length === 0}
              onClick={handleConfirmImport}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.95rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#fff',
                backgroundColor: eligibleRows.length === 0 ? 'var(--text-subtle)' : 'var(--primary-600)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: eligibleRows.length === 0 ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              <CheckCircle2 size={14} />
              {eligibleRows.length > 0
                ? `Import ${eligibleRows.length} Student${eligibleRows.length === 1 ? '' : 's'}`
                : 'Import Students'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
