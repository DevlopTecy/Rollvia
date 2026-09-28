import React from 'react';
import { Calendar as CalendarIcon, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useFlow } from '../../context';
import { Badge } from '../ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '../ui/Card';
import { Select } from '../ui/Select';

import { MONTH_NAMES, getDaysInMonth, getSupportedYears } from '../../utils/calendar';

export const MonthScreen: React.FC = () => {
  const { sessionState, updateSessionState } = useFlow();

  const currentYear = sessionState.selectedYear || new Date().getFullYear();
  const currentSelectedMonthName = sessionState.selectedMonth ? sessionState.selectedMonth.split(' ')[0] : 'September';
  const supportedYears = getSupportedYears();

  const monthsData = MONTH_NAMES.map((name, idx) => {
    const days = getDaysInMonth(currentYear, idx);
    // Estimated working days (approx 70-72% of month)
    const working = Math.round(days * (22 / 31));
    return { name, days, working };
  });

  const handleSelectMonth = (monthName: string) => {
    updateSessionState({ selectedMonth: `${monthName} ${currentYear}` });
  };

  const handleSelectYear = (yr: number) => {
    updateSessionState({
      selectedYear: yr,
      selectedMonth: `${currentSelectedMonthName} ${yr}`,
    });
  };

  return (
    <div className="stage-workspace animate-fade-in">
      <div className="stage-container">
        {/* Stage Header */}
        <div className="stage-header">
          <div className="stage-header-main">
            <span className="stage-eyebrow">Step 3 of 7 • Academic Cycle</span>
            <h1 className="stage-title">Select Month & Parameters</h1>
            <p className="stage-subtitle">
              Designate the active tracking month and establish mandatory attendance threshold criteria.
            </p>
          </div>
        </div>

        {/* 12 Months Grid */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div>
                <CardTitle>Academic Calendar Year {currentYear}</CardTitle>
                <CardDescription>Select target monthly tracking timeframe</CardDescription>
              </div>
              <select
                value={currentYear}
                onChange={(e) => handleSelectYear(Number(e.target.value))}
                aria-label="Select Academic Year"
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '0.2rem 0.5rem',
                  cursor: 'pointer',
                  marginLeft: '0.5rem',
                }}
              >
                {supportedYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1-5)' }}>
              <CalendarIcon size={14} color="var(--primary-600)" />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Active: {sessionState.selectedMonth}
              </span>
            </div>
          </CardHeader>
          <CardBody>
            <div className="months-grid">
              {monthsData.map((m) => {
                const isSelected = m.name === currentSelectedMonthName;
                return (
                  <button
                    key={m.name}
                    type="button"
                    className={`month-pill-btn ${isSelected ? 'is-active' : ''}`}
                    onClick={() => handleSelectMonth(m.name)}
                  >
                    <span className="month-name">{m.name}</span>
                    <span className="month-subtext">
                      {m.working} Workdays • {m.days} Days
                    </span>
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Selected Month Breakdown & Policy */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-3)' }}>
          {/* Breakdown Card */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{sessionState.selectedMonth} Allocation</CardTitle>
                <CardDescription>Calculated teaching days and schedule distribution</CardDescription>
              </div>
              <Badge variant="success">Standard 5-Day Week</Badge>
            </CardHeader>
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Calendar Days:</span>
                  <strong>30 Days</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Instruction Working Days:</span>
                  <strong style={{ color: 'var(--success-600)' }}>{sessionState.workingDaysCount} Days</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Weekends (Sat & Sun):</span>
                  <strong>8 Days</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Observed Holidays:</span>
                  <span className="badge badge-info">2 Days (Labor Day, Equinox)</span>
                </div>

                {/* Visual Ratio Bar */}
                <div style={{ marginTop: 'var(--space-1)' }}>
                  <div
                    style={{
                      height: 6,
                      width: '100%',
                      backgroundColor: 'var(--bg-canvas)',
                      borderRadius: 'var(--radius-full)',
                      overflow: 'hidden',
                      display: 'flex',
                    }}
                  >
                    <div style={{ width: '73%', backgroundColor: 'var(--success-500)' }} title="Working Days (73%)" />
                    <div style={{ width: '20%', backgroundColor: 'var(--border-strong)' }} title="Weekends (20%)" />
                    <div style={{ width: '7%', backgroundColor: 'var(--info-500)' }} title="Holidays (7%)" />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      marginTop: 3,
                    }}
                  >
                    <span>Instruction (73%)</span>
                    <span>Weekend (20%)</span>
                    <span>Holiday (7%)</span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Policy & Compliance Card */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Compliance Policy</CardTitle>
                <CardDescription>Academic attendance criteria</CardDescription>
              </div>
              <ShieldCheck size={16} color="var(--primary-600)" />
            </CardHeader>
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <Select
                  label="Weekly Working Structure"
                  value="5"
                  options={[
                    { value: '5', label: '5-Day Week (Monday to Friday)' },
                    { value: '6', label: '6-Day Week (Monday to Saturday)' },
                  ]}
                />

                <Select
                  label="Minimum Compliance Threshold"
                  value={String(sessionState.minimumAttendanceThreshold)}
                  onChange={(e) =>
                    updateSessionState({ minimumAttendanceThreshold: Number(e.target.value) })
                  }
                  options={[
                    { value: '70', label: '70% Minimum (Permissive)' },
                    { value: '75', label: '75% Minimum (Standard Higher Ed)' },
                    { value: '80', label: '80% Minimum (Strict Compliance)' },
                    { value: '85', label: '85% Minimum (Honors Requirement)' },
                  ]}
                />

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: '11px',
                    color: 'var(--warning-text)',
                    backgroundColor: 'var(--warning-50)',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--warning-100)',
                  }}
                >
                  <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                  <span>
                    Students below {sessionState.minimumAttendanceThreshold}% will be flagged automatically in the summary audit.
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
