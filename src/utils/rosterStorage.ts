import type { Person } from '../types';

export const ROSTER_STORAGE_KEY = 'attendly_student_roster_v1';

/**
 * Loads the persisted student roster from localStorage.
 * Returns an empty array if not present or on error.
 */
export function loadPersistedRoster(): Person[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(ROSTER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (p): p is Person =>
          p !== null &&
          typeof p === 'object' &&
          typeof p.name === 'string' &&
          typeof p.rollNumber === 'string'
      );
    }
  } catch (err) {
    console.warn('[RosterStorage] Failed to read persisted roster from localStorage:', err);
  }
  return [];
}

/**
 * Persists the student roster to localStorage.
 */
export function savePersistedRoster(people: Person[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(people));
  } catch (err) {
    console.warn('[RosterStorage] Failed to save roster to localStorage:', err);
  }
}

/**
 * Clears the persisted student roster from localStorage.
 */
export function clearPersistedRoster(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(ROSTER_STORAGE_KEY);
  } catch (err) {
    console.warn('[RosterStorage] Failed to clear roster from localStorage:', err);
  }
}
