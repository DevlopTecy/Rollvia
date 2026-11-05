import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  goOnline,
  onValue,
  onDisconnect,
  type Database,
  type Unsubscribe,
} from 'firebase/database';
import firebaseConfig from './firebaseConfig';
import type {
  UserRole,
  CollaboratorPresence,
  CollaborationSession,
  RoomAttendanceUpdate,
  RoomFirebaseState,
  RoomSaveRequest,
  RoomSaveResponse,
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
    // Pre-warm the WebSocket connection to asia-southeast1
    try {
      goOnline(this.db);
    } catch {
      // ignore
    }
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

  /**
   * Instantly allocates a room code and local session object in 0ms (optimistic).
   */
  public prepareRoom(displayName: string): { code: string; session: CollaborationSession } {
    const code = this.generateRoomCode();
    this.roomCode = code;
    this.role = 'sender';
    this.myColor = COLOR_PALETTE[0];
    this.myDisplayName = displayName || 'Host';

    return {
      code,
      session: {
        roomCode: code,
        role: 'sender',
        myUid: this.myUid,
        myColor: this.myColor,
        myDisplayName: this.myDisplayName,
      },
    };
  }

  /**
   * Performs an atomic multi-path update to Firebase Realtime Database.
   */
  public async publishRoom(
    code: string,
    displayName: string,
    initialState: RoomFirebaseState
  ): Promise<void> {
    this.roomCode = code;
    this.role = 'sender';
    this.myColor = COLOR_PALETTE[0];
    this.myDisplayName = displayName || 'Host';

    const rootRef = ref(this.db);
    const myPresenceRef = ref(this.db, `rooms/${code}/presence/${this.myUid}`);

    const presenceData: CollaboratorPresence = {
      displayName: this.myDisplayName,
      color: this.myColor,
      cursor: null,
      joinedAt: Date.now(),
    };

    const updates: Record<string, unknown> = {
      [`rooms/${code}/state`]: initialState,
      [`rooms/${code}/createdAt`]: Date.now(),
      [`rooms/${code}/presence/${this.myUid}`]: presenceData,
    };

    // Parallel atomic write and onDisconnect registration
    await Promise.all([
      update(rootRef, updates),
      onDisconnect(myPresenceRef).remove(),
    ]);
  }

  public async createRoom(displayName: string, initialState: RoomFirebaseState): Promise<string> {
    await this.leaveRoom();
    const { code } = this.prepareRoom(displayName);
    await this.publishRoom(code, displayName, initialState);
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
    let snapshot = await get(stateRef);

    // If snapshot doesn't exist yet (host optimistic room publishing in progress), retry up to 4 times
    if (!snapshot.exists()) {
      for (let attempt = 1; attempt <= 4; attempt++) {
        await new Promise((res) => setTimeout(res, 800));
        snapshot = await get(stateRef);
        if (snapshot.exists()) break;
      }
    }

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

  public async batchPushAttendance(updates: RoomAttendanceUpdate[]): Promise<void> {
    if (!this.roomCode || updates.length === 0) return;

    const payload: Record<string, boolean> = {};
    for (const u of updates) {
      payload[`rooms/${this.roomCode}/state/attendance/${u.date}/${u.personId}/${u.classId}`] = u.value;
    }
    const rootRef = ref(this.db);
    await update(rootRef, payload);
  }

  /**
   * Sends a remote save request to the host laptop and waits for response.
   */
  public async requestRemoteSave(targetDate: string): Promise<RoomSaveResponse> {
    if (!this.roomCode) {
      throw new Error('Not connected to a live collaboration room.');
    }

    const requestId = `save_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const requestData: RoomSaveRequest = {
      id: requestId,
      targetDate,
      requestedBy: this.myDisplayName || 'Receiver',
      requesterUid: this.myUid,
      timestamp: Date.now(),
    };

    const reqRef = ref(this.db, `rooms/${this.roomCode}/saveRequest`);
    const respRef = ref(this.db, `rooms/${this.roomCode}/saveResponse`);

    return new Promise<RoomSaveResponse>((resolve, reject) => {
      let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
      let unsub: Unsubscribe | null = null;

      const cleanup = () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (unsub) {
          try { unsub(); } catch { /* ignore */ }
        }
      };

      // Set 15s timeout
      timeoutTimer = setTimeout(() => {
        cleanup();
        reject(new Error('Save request timed out. The host laptop may be busy, sleeping, or disconnected.'));
      }, 15000);

      // Listen for host response
      unsub = onValue(respRef, (snap) => {
        if (snap.exists()) {
          const resp = snap.val() as RoomSaveResponse;
          if (resp && resp.requestId === requestId) {
            cleanup();
            if (resp.success) {
              resolve(resp);
            } else {
              reject(new Error(resp.error || 'Host failed to save attendance to disk.'));
            }
          }
        }
      });

      // Write save request to Firebase
      set(reqRef, requestData).catch((err) => {
        cleanup();
        reject(err);
      });
    });
  }

  /**
   * Subscribes host to remote save requests from connected receivers.
   */
  public subscribeSaveRequest(onSaveRequest: (req: RoomSaveRequest) => void): () => void {
    if (!this.roomCode) return () => {};

    const reqRef = ref(this.db, `rooms/${this.roomCode}/saveRequest`);
    let lastHandledId = '';
    const unsub = onValue(reqRef, (snapshot) => {
      if (snapshot.exists()) {
        const req = snapshot.val() as RoomSaveRequest;
        if (req && req.id && req.id !== lastHandledId && req.requesterUid !== this.myUid) {
          lastHandledId = req.id;
          onSaveRequest(req);
        }
      }
    });

    this.unsubscribes.push(unsub);
    return unsub;
  }

  /**
   * Host responds to a remote save request with success or error.
   */
  public async respondRemoteSave(response: RoomSaveResponse): Promise<void> {
    if (!this.roomCode) return;
    const respRef = ref(this.db, `rooms/${this.roomCode}/saveResponse`);
    await set(respRef, response);
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
