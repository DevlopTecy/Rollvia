export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * Determines whether a year is a leap year.
 * A year is a leap year if divisible by 4, except end-of-century years which must be divisible by 400.
 */
export const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

/**
 * Returns an array of dynamically supported years:
 * from (Current Year - 1) through (Current Year + 15).
 * Automatically moves forward as real calendar year changes.
 */
export const getSupportedYears = (referenceDate: Date = new Date()): number[] => {
  const currentYear = referenceDate.getFullYear();
  const startYear = currentYear - 1;
  const endYear = currentYear + 15;
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }
  return years;
};

export const getMinSupportedYear = (referenceDate: Date = new Date()): number => {
  return referenceDate.getFullYear() - 1;
};

export const getMaxSupportedYear = (referenceDate: Date = new Date()): number => {
  return referenceDate.getFullYear() + 15;
};

export const isYearSupported = (year: number, referenceDate: Date = new Date()): boolean => {
  return year >= getMinSupportedYear(referenceDate) && year <= getMaxSupportedYear(referenceDate);
};

/**
 * Calculates the exact number of days in a given month of a year.
 * Month index is 0-based (0 for January, 1 for February, ..., 11 for December).
 */
export const getDaysInMonth = (year: number, monthIndex: number): number => {
  return new Date(year, monthIndex + 1, 0).getDate();
};

export interface CalendarDayCell {
  day: number;
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: number; // 0: Mon, 1: Tue, ... 6: Sun
  dayName: string;
  isWeekend: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;
}

export interface MonthCalendarData {
  year: number;
  monthIndex: number;
  monthName: string;
  totalDays: number;
  isLeap: boolean;
  weekdayCount: number;
  weekendCount: number;
  leadingDays: CalendarDayCell[];
  currentDays: CalendarDayCell[];
  trailingDays: CalendarDayCell[];
  allCells: CalendarDayCell[];
}

export const getMonthCalendarData = (
  year: number,
  monthIndex: number,
  userToday: Date = new Date()
): MonthCalendarData => {
  const totalDays = getDaysInMonth(year, monthIndex);
  const isLeap = isLeapYear(year);

  const todayYear = userToday.getFullYear();
  const todayMonth = userToday.getMonth();
  const todayDay = userToday.getDate();

  // First day of month (0: Sun, 1: Mon, ... 6: Sat)
  const firstDayJs = new Date(year, monthIndex, 1).getDay();
  // Convert to Monday-based index (0: Mon, 1: Tue, ..., 6: Sun)
  const firstDayMondayBased = (firstDayJs + 6) % 7;

  // Leading days from previous month
  const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
  const prevMonthYear = monthIndex === 0 ? year - 1 : year;
  const prevMonthTotalDays = getDaysInMonth(prevMonthYear, prevMonthIndex);

  const leadingDays: CalendarDayCell[] = [];
  for (let i = firstDayMondayBased - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const dayOfWeek = (firstDayMondayBased - 1 - i) % 7;
    const dateStr = `${prevMonthYear}-${String(prevMonthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    leadingDays.push({
      day: dayNum,
      dateStr,
      dayOfWeek,
      dayName: DAY_NAMES[dayOfWeek],
      isWeekend: dayOfWeek === 5 || dayOfWeek === 6,
      isToday: false,
      isCurrentMonth: false,
    });
  }

  // Current month days
  let weekdayCount = 0;
  let weekendCount = 0;
  const currentDays: CalendarDayCell[] = [];

  for (let d = 1; d <= totalDays; d++) {
    const colIndex = (firstDayMondayBased + d - 1) % 7;
    const isWeekend = colIndex === 5 || colIndex === 6;
    if (isWeekend) {
      weekendCount++;
    } else {
      weekdayCount++;
    }

    const isToday = todayYear === year && todayMonth === monthIndex && todayDay === d;
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    currentDays.push({
      day: d,
      dateStr,
      dayOfWeek: colIndex,
      dayName: DAY_NAMES[colIndex],
      isWeekend,
      isToday,
      isCurrentMonth: true,
    });
  }

  // Trailing days from next month to complete the row grid (multiples of 7)
  const totalCount = leadingDays.length + currentDays.length;
  const totalGridSlots = Math.ceil(totalCount / 7) * 7;
  const trailingNeeded = totalGridSlots - totalCount;

  const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;
  const nextMonthYear = monthIndex === 11 ? year + 1 : year;
  const trailingDays: CalendarDayCell[] = [];

  for (let t = 1; t <= trailingNeeded; t++) {
    const colIndex = (firstDayMondayBased + totalDays + t - 1) % 7;
    const isWeekend = colIndex === 5 || colIndex === 6;
    const dateStr = `${nextMonthYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(t).padStart(2, '0')}`;

    trailingDays.push({
      day: t,
      dateStr,
      dayOfWeek: colIndex,
      dayName: DAY_NAMES[colIndex],
      isWeekend,
      isToday: false,
      isCurrentMonth: false,
    });
  }

  return {
    year,
    monthIndex,
    monthName: MONTH_NAMES[monthIndex],
    totalDays,
    isLeap,
    weekdayCount,
    weekendCount,
    leadingDays,
    currentDays,
    trailingDays,
    allCells: [...leadingDays, ...currentDays, ...trailingDays],
  };
};

/**
 * Formats a date into a human readable string.
 * Example: "Monday, September 28, 2026"
 */
export const formatFullDisplayDate = (year: number, monthIndex: number, day: number): string => {
  const d = new Date(year, monthIndex, day);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/**
 * Returns the Weekday name ('Monday' ... 'Sunday') for a YYYY-MM-DD date string.
 */
export const getWeekdayForDate = (dateStr: string): 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday' => {
  if (!dateStr) return 'Monday';
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return 'Monday';
  }
  const jsDay = new Date(parts[0], parts[1] - 1, parts[2]).getDay(); // 0: Sun, 1: Mon, ... 6: Sat
  const weekdayNames: ('Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday')[] = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return weekdayNames[jsDay];
};

/**
 * Returns the subjects scheduled for a given date according to the weekly timetable.
 */
export const getSubjectsForDate = (
  dateStr: string,
  timetable?: Record<string, { id: string; name: string }[]>
): { id: string; name: string }[] => {
  if (!timetable || !dateStr) return [];
  const weekday = getWeekdayForDate(dateStr);
  return timetable[weekday] || [];
};

