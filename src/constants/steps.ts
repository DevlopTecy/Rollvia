import type { StepMeta, Student, ClassSession, LegacyAttendanceRecord, WeeklyTimetable } from '../types';

export const STEPS: StepMeta[] = [
  {
    id: 1,
    key: 'connection',
    title: 'Storage Setup',
    shortLabel: 'Storage',
    subtitle: 'Google Sheets or Excel',
    description: 'Select how you want to save attendance: Google Sheets or Excel.',
  },
  {
    id: 2,
    key: 'people',
    title: 'Students Setup',
    shortLabel: 'Students',
    subtitle: 'Roster details',
    description: 'Enter number of people and collect details for each member.',
  },
  {
    id: 3,
    key: 'date',
    title: 'Month Setup',
    shortLabel: 'Month',
    subtitle: 'Select month and starting date',
    description: 'Select month and choose your attendance date.',
  },
  {
    id: 4,
    key: 'classes',
    title: 'Weekly Timetable',
    shortLabel: 'Timetable',
    subtitle: 'Weekly schedule',
    description: 'Choose the subjects scheduled during the week.',
  },
  {
    id: 5,
    key: 'attendance',
    title: 'Attendance',
    shortLabel: 'Attendance',
    subtitle: 'Roll call',
    description: 'Mark present or absent for scheduled subjects.',
  },
  {
    id: 6,
    key: 'completion',
    title: 'Completion',
    shortLabel: 'Completion',
    subtitle: 'Save & Export',
    description: 'Review summary and save attendance records.',
  },
];

export const INITIAL_WEEKLY_TIMETABLE: WeeklyTimetable = {
  Monday: [
    { id: 'sub-mon-1', name: 'DBMS' },
    { id: 'sub-mon-2', name: 'Java' },
  ],
  Tuesday: [
    { id: 'sub-tue-1', name: 'PP' },
    { id: 'sub-tue-2', name: 'DCCN' },
  ],
  Wednesday: [
    { id: 'sub-wed-1', name: 'Java' },
    { id: 'sub-wed-2', name: 'OS' },
    { id: 'sub-wed-3', name: 'DCCN' },
  ],
  Thursday: [
    { id: 'sub-thu-1', name: 'DBMS' },
    { id: 'sub-thu-2', name: 'PP' },
  ],
  Friday: [
    { id: 'sub-fri-1', name: 'Java' },
    { id: 'sub-fri-2', name: 'OS' },
  ],
  Saturday: [
    { id: 'sub-sat-1', name: 'Lab' },
  ],
  Sunday: [],
};


export const INITIAL_MEMBERS: Student[] = [];
export const INITIAL_CLASSES: ClassSession[] = [];
export const INITIAL_ATTENDANCE: Record<string, LegacyAttendanceRecord> = {};
