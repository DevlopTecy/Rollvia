import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { useFlow } from '../../context';
import { Button } from '../ui/Button';
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

export const DateSetupScreen: React.FC = () => {
  const { sessionState, setDateSetup, prevStep, nextStep } = useFlow();

  const localToday = new Date();
  const defaultYear = sessionState.selectedYear || localToday.getFullYear();
  const defaultMonthIndex =
    sessionState.selectedMonthIndex !== undefined
      ? sessionState.selectedMonthIndex
      : localToday.getMonth();
  const defaultDay = sessionState.startDayNumber || localToday.getDate();

  const [year, setYear] = useState<number>(defaultYear);
  const [monthIndex, setMonthIndex] = useState<number>(defaultMonthIndex);
  const [selectedDay, setSelectedDay] = useState<number>(defaultDay);

  const calendarData = getMonthCalendarData(year, monthIndex, localToday);
  const validDay = Math.min(selectedDay, calendarData.totalDays);

  const handleSelectMonth = (newMonthIdx: number) => {
    setMonthIndex(newMonthIdx);
    const newTotalDays = getMonthCalendarData(year, newMonthIdx, localToday).totalDays;
    const clampedDay = Math.min(selectedDay, newTotalDays);
    setSelectedDay(clampedDay);
    setDateSetup(year, newMonthIdx, clampedDay);
  };

  const supportedYears = React.useMemo(() => getSupportedYears(), []);

  const handlePrevMonth = () => {
    if (monthIndex === 0) {
      const newYear = year - 1;
      const minYear = getMinSupportedYear();
      if (newYear >= minYear) {
        setYear(newYear);
        handleSelectMonth(11);
        setDateSetup(newYear, 11, Math.min(selectedDay, getDaysInMonth(newYear, 11)));
      }
    } else {
      handleSelectMonth(monthIndex - 1);
    }
  };

  const handleNextMonth = () => {
    if (monthIndex === 11) {
      const newYear = year + 1;
      const maxYear = getMaxSupportedYear();
      if (newYear <= maxYear) {
        setYear(newYear);
        handleSelectMonth(0);
        setDateSetup(newYear, 0, Math.min(selectedDay, getDaysInMonth(newYear, 0)));
      }
    } else {
      handleSelectMonth(monthIndex + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    setSelectedDay(day);
    setDateSetup(year, monthIndex, day);
  };

  const handleJumpToToday = () => {
    const todayY = localToday.getFullYear();
    const todayM = localToday.getMonth();
    const todayD = localToday.getDate();
    setYear(todayY);
    setMonthIndex(todayM);
    setSelectedDay(todayD);
    setDateSetup(todayY, todayM, todayD);
  };

  const handleContinue = () => {
    setDateSetup(year, monthIndex, validDay);
    nextStep();
  };

  const formattedSelectedDate = formatFullDisplayDate(year, monthIndex, validDay);
  const selectedDateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
  const weekdayName = getWeekdayForDate(selectedDateStr);

  return (
    <div className="stage-workspace animate-fade-in">
      <div className="stage-container" style={{ maxWidth: '780px' }}>
        {/* Header */}
        <div className="stage-header">
          <div className="stage-header-main">
            <span className="stage-eyebrow">Step 3 of 4</span>
            <h1 className="stage-title">Date Setup</h1>
            <p className="stage-subtitle">Select the attendance start date.</p>
          </div>
        </div>

        {/* Calendar Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Month Navigation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <select
                value={monthIndex}
                onChange={(e) => handleSelectMonth(Number(e.target.value))}
                aria-label="Select Month"
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '0.2rem 0.45rem',
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
                  const newY = Number(e.target.value);
                  setYear(newY);
                  const maxD = getDaysInMonth(newY, monthIndex);
                  const clamped = Math.min(selectedDay, maxD);
                  setSelectedDay(clamped);
                  setDateSetup(newY, monthIndex, clamped);
                }}
                aria-label="Select Year"
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '0.2rem 0.45rem',
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
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleJumpToToday}
                style={{
                  backgroundColor: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                  padding: '0.3rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Today
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                style={{
                  backgroundColor: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  padding: '0.35rem',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                style={{
                  backgroundColor: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  padding: '0.35rem',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Day Headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '0.25rem',
              textAlign: 'center',
              marginBottom: '0.5rem',
            }}
          >
            {DAY_NAMES.map((name, i) => (
              <div
                key={name}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: i >= 5 ? 'var(--text-subtle)' : 'var(--text-muted)',
                  textTransform: 'uppercase',
                  padding: '0.25rem 0',
                  letterSpacing: '0.02em',
                }}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '0.25rem',
            }}
          >
            {calendarData.allCells.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return (
                  <div
                    key={`inactive_${cell.dateStr}_${idx}`}
                    style={{
                      height: '38px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-subtle)',
                      fontSize: '0.82rem',
                    }}
                  >
                    {cell.day}
                  </div>
                );
              }

              const isSelected = cell.day === validDay;
              const isToday = cell.isToday;

              return (
                <button
                  key={`day_${cell.day}`}
                  type="button"
                  onClick={() => handleSelectDay(cell.day)}
                  style={{
                    height: '38px',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected
                      ? '2px solid var(--primary-600)'
                      : isToday
                      ? '1.5px solid var(--primary-300)'
                      : '1px solid transparent',
                    backgroundColor: isSelected
                      ? 'var(--primary-600)'
                      : isToday
                      ? 'var(--primary-50)'
                      : 'var(--bg-canvas)',
                    color: isSelected ? '#ffffff' : isToday ? 'var(--primary-700)' : 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: isSelected || isToday ? 700 : 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.1s ease',
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Selected Date Summary */}
          <div
            style={{
              marginTop: '1.25rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--primary-50)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--primary-200)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--primary-600)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontWeight: 600,
                }}
              >
                Selected Date
              </span>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-700)' }}>
                {formattedSelectedDate}
              </div>
            </div>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '0.25rem 0.6rem',
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
              }}
            >
              {weekdayName}
            </span>
          </div>
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
            Back to Students
          </Button>
          <Button variant="primary" size="lg" onClick={handleContinue} style={{ minWidth: '150px' }}>
            Continue to Timetable
          </Button>
        </div>
      </div>
    </div>
  );
};
