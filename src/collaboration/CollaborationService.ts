import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  onDisconnect,
  type Database,
  type Unsubscribe,
} from 'firebase/database';
import firebaseConfig from './firebaseConfig';
import type {
  UserRole,
  CollaboratorPresence,
  RoomAttendanceUpdate,
  RoomFirebaseState,
} from './types';

export const COLOR_PALETTE = [
  '#6366f1', // Indigo (Host / Sender)
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Rose
  '#06b6d4', // Cyan
] as const;

export class CollaborationService {
  private app: FirebaseApp;
  private db: Database;
  private unsubscribes: Unsubscribe[] = [];

  public roomCode: string | null = null;
  public role: UserRole = null;
  public myUid: string;
  public myColor: string = COLOR_PALETTE[0];
  public myDisplayName: string = '';

  constructor() {
    this.app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    this.db = getDatabase(this.app);
    this.myUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public async createRoom(displayName: string, initialState: RoomFirebaseState): Promise<string> {
    await this.leaveRoom();

    const code = this.generateRoomCode();
    this.roomCode = code;
    this.role = 'sender';
    this.myColor = COLOR_PALETTE[0];
    this.myDisplayName = displayName || 'Host';

    const rootRef = ref(this.db, `rooms/${code}`);
    const stateRef = ref(this.db, `rooms/${code}/state`);
    const createdAtRef = ref(this.db, `rooms/${code}/createdAt`);
    const myPresenceRef = ref(this.db, `rooms/${code}/presence/${this.myUid}`);

    await set(stateRef, initialState);
    await set(createdAtRef, Date.now());

    const presenceData: CollaboratorPresence = {
      displayName: this.myDisplayName,
      color: this.myColor,
      cursor: null,
      joinedAt: Date.now(),
    };

    await set(myPresenceRef, presenceData);
    await onDisconnect(myPresenceRef).remove();

    return code;
  }

  public async joinRoom(
    roomCodeInput: string,
    displayName: string,
    onStateSnapshot: (state: RoomFirebaseState) => void,
    onPresenceUpdate: (presence: Record<string, CollaboratorPresence>) => void
  ): Promise<void> {
    await this.leaveRoom();

    const code = roomCodeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || code.length < 4) {
      throw new Error('Please enter a valid room code.');
    }

    const stateRef = ref(this.db, `rooms/${code}/state`);
    const snapshot = await get(stateRef);

    if (!snapshot.exists()) {
      throw new Error('Room not found. Please verify the room code.');
    }

    this.roomCode = code;
    this.role = 'receiver';
    this.myDisplayName = displayName || 'Collaborator';

    // Determine color based on existing presence count
    const presenceRef = ref(this.db, `rooms/${code}/presence`);
    const presenceSnapshot = await get(presenceRef);
    const existingCount = presenceSnapshot.exists()
      ? Object.keys(presenceSnapshot.val() || {}).length
      : 1;
    this.myColor = COLOR_PALETTE[Math.min(existingCount, COLOR_PALETTE.length - 1)];

    const myPresenceRef = ref(this.db, `rooms/${code}/presence/${this.myUid}`);
    const presenceData: CollaboratorPresence = {
      displayName: this.myDisplayName,
      color: this.myColor,
      cursor: null,
      joinedAt: Date.now(),
    };

    await set(myPresenceRef, presenceData);
    await onDisconnect(myPresenceRef).remove();

    // Subscribe to state and presence
    this.subscribeState(onStateSnapshot);
    this.subscribePresence(onPresenceUpdate);
  }

  public subscribeState(onStateSnapshot: (state: RoomFirebaseState) => void): () => void {
    if (!this.roomCode) return () => {};

    const stateRef = ref(this.db, `rooms/${this.roomCode}/state`);
    const unsub = onValue(
      stateRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onStateSnapshot(snapshot.val() as RoomFirebaseState);
        }
      },
      (error) => {
        console.error('Failed to listen to room state:', error);
      }
    );

    this.unsubscribes.push(unsub);
    return unsub;
  }

  public subscribePresence(
    onPresenceUpdate: (presence: Record<string, CollaboratorPresence>) => void
  ): () => void {
    if (!this.roomCode) return () => {};

    const presenceRef = ref(this.db, `rooms/${this.roomCode}/presence`);
    const unsub = onValue(
      presenceRef,
      (snapshot) => {
        onPresenceUpdate(
          snapshot.exists() ? (snapshot.val() as Record<string, CollaboratorPresence>) : {}
        );
      },
      (error) => {
        console.error('Failed to listen to room presence:', error);
      }
    );

    this.unsubscribes.push(unsub);
    return unsub;
  }

  public async pushAttendanceChange(update: RoomAttendanceUpdate): Promise<void> {
    if (!this.roomCode) return;

    const path = `rooms/${this.roomCode}/state/attendance/${update.date}/${update.personId}/${update.classId}`;
    const targetRef = ref(this.db, path);
    await set(targetRef, update.value);
  }

  public async updateCursor(date: string, personId: string): Promise<void> {
    if (!this.roomCode) return;

    const cursorRef = ref(this.db, `rooms/${this.roomCode}/presence/${this.myUid}/cursor`);
    await set(cursorRef, { date, personId });
  }

  public async clearCursor(): Promise<void> {
    if (!this.roomCode) return;

    const cursorRef = ref(this.db, `rooms/${this.roomCode}/presence/${this.myUid}/cursor`);
    await set(cursorRef, null);
  }

  public async leaveRoom(): Promise<void> {
    // Unsubscribe from real-time events
    this.unsubscribes.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // ignore
      }
    });
    this.unsubscribes = [];

    // Remove self from presence
    if (this.roomCode && this.myUid) {
      try {
        const myPresenceRef = ref(this.db, `rooms/${this.roomCode}/presence/${this.myUid}`);
        await set(myPresenceRef, null);
      } catch {
        // ignore network error on leaving
      }
    }

    this.roomCode = null;
    this.role = null;
  }
}
