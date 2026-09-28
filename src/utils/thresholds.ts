/**
 * Attendance percentage color helper.
 *
 * Thresholds:
 *   >= 75%  → green
 *   >= 60%  → orange
 *   <  60%  → red
 *
 * No status labels ("Healthy", "Warning", "Critical") are produced.
 */

export interface AttendanceColor {
  /** CSS color value for text/foreground */
  color: string;
  /** CSS color value for background */
  bgColor: string;
  /** CSS color value for border */
  borderColor: string;
}

export function parsePercentage(value: string | number): number {
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  const cleaned = String(value).replace(/%/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Returns the attendance color info for a given percentage value.
 * >= 75 → green, >= 60 → orange, < 60 → red.
 */
export function getAttendanceColor(percentageValue: string | number): AttendanceColor {
  const percentage = parsePercentage(percentageValue);

  if (percentage >= 75) {
    return {
      color: 'var(--success-600, #16a34a)',
      bgColor: 'var(--success-50, #f0fdf4)',
      borderColor: 'var(--success-200, #bbf7d0)',
    };
  }

  if (percentage >= 60) {
    return {
      color: 'var(--warning-600, #d97706)',
      bgColor: 'var(--warning-50, #fffbeb)',
      borderColor: 'var(--warning-200, #fde68a)',
    };
  }

  return {
    color: 'var(--danger-600, #dc2626)',
    bgColor: 'var(--danger-50, #fef2f2)',
    borderColor: 'var(--danger-200, #fecaca)',
  };
}
