import React, { useState } from 'react';
import {
  Check,
  FolderOpen,
  PlusCircle,
  AlertCircle,
  HardDrive,
} from 'lucide-react';
import { useFlow } from '../../context';
import { Button } from '../ui/Button';

export const ConnectionScreen: React.FC = () => {
  const {
    sessionState,
    nextStep,
    selectExistingExcelWorkbook,
    createNewExcelWorkbook,
  } = useFlow();

  const [excelFeedback, setExcelFeedback] = useState<string | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);

  const handleSelectExcel = async () => {
    setExcelFeedback(null);
    setExcelError(null);
    const res = await selectExistingExcelWorkbook();
    if (!res.canceled) {
      if (res.filePath && !res.error) {
        setExcelFeedback(`Loaded workbook with ${res.recordsCount ?? 0} existing records.`);
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

  const canContinue = Boolean(sessionState.excelFilePath || sessionState.excelFileName);

  return (
    <div className="stage-workspace animate-fade-in">
      <div className="stage-container" style={{ maxWidth: '820px' }}>
        {/* Header */}
        <div className="stage-header">
          <div className="stage-header-main">
            <span className="stage-eyebrow">Step 1 of 4</span>
            <h1 className="stage-title">Storage Setup</h1>
            <p className="stage-subtitle">Attendance records will be saved to an Excel workbook (.xlsx).</p>
          </div>
        </div>

        {/* Excel Storage Container */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1.5px solid var(--primary-500)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: 'var(--shadow-xs)',
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
                  Local attendance spreadsheet file
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
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>Workbook File</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                {sessionState.excelFilePath
                  ? `Active: ${sessionState.excelFileName || sessionState.excelFilePath}`
                  : 'Select an existing .xlsx file or create a new workbook.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="secondary" size="sm" onClick={handleSelectExcel} icon={<FolderOpen size={14} />}>
                Select Workbook
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCreateExcel} icon={<PlusCircle size={14} />}>
                Create New
              </Button>
            </div>
          </div>

          {sessionState.excelFilePath && (
            <div
              style={{
                backgroundColor: 'var(--success-50)',
                border: '1px solid var(--success-100)',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: 'var(--success-text)',
              }}
            >
              <Check size={14} style={{ color: 'var(--success-500)', flexShrink: 0 }} />
              <span>
                <strong>{sessionState.excelFileName}</strong> ({sessionState.excelExistingRecordsCount ?? 0} existing records)
              </span>
            </div>
          )}

          {excelFeedback && (
            <div
              style={{
                backgroundColor: 'var(--success-50)',
                border: '1px solid var(--success-100)',
                color: 'var(--success-text)',
                padding: '0.625rem 0.875rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Check size={14} />
              <span>{excelFeedback}</span>
            </div>
          )}

          {excelError && (
            <div
              style={{
                backgroundColor: 'var(--danger-50)',
                border: '1px solid var(--danger-100)',
                color: 'var(--danger-600)',
                padding: '0.625rem 0.875rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={14} />
              <span>{excelError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <Button
            variant="primary"
            size="lg"
            onClick={nextStep}
            disabled={!canContinue}
            style={{ minWidth: '140px' }}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};
