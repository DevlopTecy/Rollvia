import React, { useState } from 'react';
import { Calendar as CalendarIcon, Info, RefreshCw } from 'lucide-react';
import { useFlow } from '../../context';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../ui/Card';
import type { CalendarDayInfo } from '../../types';

// September 2026 (Starts on Tuesday, Sep 1)
const INITIAL_SEPTEMBER_DAYS: CalendarDayInfo[] = [
  { date: 1, dayName: 'Tue', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 2, dayName: 'Wed', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 3, dayName: 'Thu', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 4, dayName: 'Fri', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 5, dayName: 'Sat', isWeekend: true, isHoliday: false, type: 'weekend' },
  { date: 6, dayName: 'Sun', isWeekend: true, isHoliday: false, type: 'weekend' },
  { date: 7, dayName: 'Mon', isWeekend: false, isHoliday: true, holidayTitle: 'Labor Day', type: 'holiday' },
  { date: 8, dayName: 'Tue', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 9, dayName: 'Wed', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 10, dayName: 'Thu', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 11, dayName: 'Fri', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 12, dayName: 'Sat', isWeekend: true, isHoliday: false, type: 'weekend' },
  { date: 13, dayName: 'Sun', isWeekend: true, isHoliday: false, type: 'weekend' },
  { date: 14, dayName: 'Mon', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 15, dayName: 'Tue', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 16, dayName: 'Wed', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 17, dayName: 'Thu', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 18, dayName: 'Fri', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 19, dayName: 'Sat', isWeekend: true, isHoliday: false, type: 'weekend' },
  { date: 20, dayName: 'Sun', isWeekend: true, isHoliday: false, type: 'weekend' },
  { date: 21, dayName: 'Mon', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 22, dayName: 'Tue', isWeekend: false, isHoliday: true, holidayTitle: 'Autumn Equinox', type: 'holiday' },
  { date: 23, dayName: 'Wed', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 24, dayName: 'Thu', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 25, dayName: 'Fri', isWeekend: false, isHoliday: false, holidayTitle: 'Midterm Review', type: 'event' },
  { date: 26, dayName: 'Sat', isWeekend: true, isHoliday: false, type: 'weekend' },
  { date: 27, dayName: 'Sun', isWeekend: true, isHoliday: false, type: 'weekend' },
  { date: 28, dayName: 'Mon', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 29, dayName: 'Tue', isWeekend: false, isHoliday: false, type: 'class' },
  { date: 30, dayName: 'Wed', isWeekend: false, isHoliday: false, type: 'class' },
];

export const CalendarScreen: React.FC = () => {
  const { sessionState } = useFlow();
  const [days, setDays] = useState<CalendarDayInfo[]>(INITIAL_SEPTEMBER_DAYS);
  const [selectedDay, setSelectedDay] = useState<number | null>(14);

  const handleToggleDay = (date: number) => {
    setSelectedDay(date);
    setDays((prev) =>
      prev.map((d) => {
        if (d.date !== date) return d;
        let nextType: 'class' | 'holiday' | 'event' | 'weekend' = 'class';
        if (d.type === 'class') nextType = 'holiday';
        else if (d.type === 'holiday') nextType = 'event';
        else if (d.type === 'event') nextType = 'weekend';
        else nextType = 'class';

        return {
          ...d,
          type: nextType,
          isWeekend: nextType === 'weekend',
          isHoliday: nextType === 'holiday',
        };
      })
    );
  };

  const handleResetDefaults = () => {
    setDays(INITIAL_SEPTEMBER_DAYS);
  };

  const workingDays = days.filter((d) => d.type === 'class' || d.type === 'event').length;
  const holidays = days.filter((d) => d.type === 'holiday').length;
  const weekends = days.filter((d) => d.type === 'weekend').length;

  return (
    <div className="stage-workspace animate-fade-in">
      <div className="stage-container">
        {/* Stage Header */}
        <div className="stage-header">
          <div className="stage-header-main">
            <span className="stage-eyebrow">Step 4 of 7 • Schedule Matrix</span>
            <h1 className="stage-title">Calendar & Session Days Matrix</h1>
            <p className="stage-subtitle">
              Verify daily instructional status for {sessionState.selectedMonth}. Click any date cell to cycle its schedule classification.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw size={13} />}
            onClick={handleResetDefaults}
          >
            Reset Defaults
          </Button>
        </div>

        {/* Legend Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-2-5) var(--space-4)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {/* Legend Items */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--success-500)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Class Day ({workingDays})
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--info-500)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Holiday ({holidays})
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--warning-500)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Review / Exam (1)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--border-strong)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Weekend ({weekends})
              </span>
            </div>
          </div>

          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Click date to cycle: Class → Holiday → Review → Weekend
          </span>
        </div>

        {/* Calendar Grid Card */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <CalendarIcon size={16} color="var(--primary-600)" />
              <CardTitle>{sessionState.selectedMonth}</CardTitle>
            </div>
            <Badge variant="primary">{workingDays} Instruction Days</Badge>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            <div className="calendar-grid">
              {/* Day of Week Headers */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="calendar-header-day">
                  {d}
                </div>
              ))}

              {/* Leading day: Aug 31 (Monday) */}
              <div className="cal-day-cell is-outside-month">
                <div className="cal-day-top">
                  <span className="cal-day-num" style={{ opacity: 0.5 }}>31</span>
                  <span style={{ fontSize: '10px', opacity: 0.5 }}>Aug</span>
                </div>
              </div>

              {/* September Days (1 to 30) */}
              {days.map((day) => {
                const isSelected = selectedDay === day.date;

                return (
                  <div
                    key={day.date}
                    className={`cal-day-cell ${day.isWeekend ? 'is-weekend' : ''} ${
                      day.isHoliday ? 'is-holiday' : ''
                    } ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleToggleDay(day.date)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') handleToggleDay(day.date);
                    }}
                  >
                    <div className="cal-day-top">
                      <span className="cal-day-num">{day.date}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{day.dayName}</span>
                    </div>

                    <div style={{ marginTop: 'var(--space-1)' }}>
                      {day.type === 'class' && (
                        <span className="badge badge-success" style={{ fontSize: '10px', padding: '1px 5px' }}>
                          Class
                        </span>
                      )}
                      {day.type === 'holiday' && (
                        <span className="badge badge-info" style={{ fontSize: '10px', padding: '1px 5px' }}>
                          {day.holidayTitle || 'Holiday'}
                        </span>
                      )}
                      {day.type === 'event' && (
                        <span className="badge badge-warning" style={{ fontSize: '10px', padding: '1px 5px' }}>
                          {day.holidayTitle || 'Review'}
                        </span>
                      )}
                      {day.type === 'weekend' && (
                        <span className="badge badge-neutral" style={{ fontSize: '10px', padding: '1px 5px' }}>
                          Weekend
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Trailing days: Oct 1-4 to complete the 35-cell grid */}
              {[
                { date: 1, name: 'Thu' },
                { date: 2, name: 'Fri' },
                { date: 3, name: 'Sat' },
                { date: 4, name: 'Sun' },
              ].map((trailing) => (
                <div key={trailing.date} className="cal-day-cell is-outside-month">
                  <div className="cal-day-top">
                    <span className="cal-day-num" style={{ opacity: 0.5 }}>{trailing.date}</span>
                    <span style={{ fontSize: '10px', opacity: 0.5 }}>Oct</span>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Selected Date Context Hint */}
        {selectedDay && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-surface)',
              padding: 'var(--space-2-5) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <Info size={13} color="var(--primary-600)" style={{ flexShrink: 0 }} />
            <span>
              Active selection: <strong>September {selectedDay}, {sessionState.selectedYear || new Date().getFullYear()}</strong>. Click cell to cycle classification.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
