import type { Person, ClassSession } from '../types';

export type UserRole = 'sender' | 'receiver' | null;

export interface CollaboratorPresence {
  displayName: string;
  color: string;
  cursor: {
    date: string;
    personId: string;
  } | null;
  joinedAt: number;
}

export interface CollaborationSession {
  roomCode: string;
  role: UserRole;
  myUid: string;
  myColor: string;
  myDisplayName: string;
}

export interface RoomAttendanceUpdate {
  date: string;
  personId: string;
  classId: string;
  value: boolean;
}

export interface RoomFirebaseState {
  roster: Person[];
  classes: ClassSession[];
  attendance: Record<string, Record<string, Record<string, boolean>>>;
  noClassDates: string[];
  holidayReasons: Record<string, string>;
  academicYear: string;
  departmentName: string;
}

export interface RoomSaveRequest {
  id: string;
  targetDate: string;
  requestedBy: string;
  requesterUid: string;
  timestamp: number;
}

export interface RoomSaveResponse {
  requestId: string;
  targetDate: string;
  success: boolean;
  error?: string;
  timestamp: number;
}


