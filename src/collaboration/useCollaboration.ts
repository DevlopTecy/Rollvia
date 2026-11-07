import { useState, useRef, useEffect, useCallback } from 'react';
import { CollaborationService } from './CollaborationService';
import type {
  UserRole,
  CollaborationSession,
  CollaboratorPresence,
  RoomFirebaseState,
  RoomAttendanceUpdate,
  RoomSaveRequest,
  RoomSaveResponse,
} from './types';

const STORAGE_KEY_NAME = 'rollvia_connection_name';

export interface UseCollaborationOptions {
  getSnapshot?: () => RoomFirebaseState;
  onRemoteStateReceived?: (state: RoomFirebaseState, role?: UserRole) => void;
  onRemoteAttendanceCell?: (update: RoomAttendanceUpdate) => void;
  onRemoteSaveRequested?: (req: RoomSaveRequest) => void;
}

export const useCollaboration = (options?: UseCollaborationOptions) => {
  const serviceRef = useRef<CollaborationService | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [collaborators, setCollaborators] = useState<Record<string, CollaboratorPresence>>({});
  const [connectionName, setConnectionNameState] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(STORAGE_KEY_NAME) || '';
    }
    return '';
  });
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const getService = useCallback((): CollaborationService => {
    if (!serviceRef.current) {
      serviceRef.current = new CollaborationService();
    }
    return serviceRef.current;
  }, []);

  const setConnectionName = useCallback((name: string) => {
    setConnectionNameState(name);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY_NAME, name);
      } catch {
        // ignore
      }
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const leaveRoom = useCallback(async (): Promise<void> => {
    setIsConnecting(false);
    setSession(null);
    setCollaborators({});
    setError(null);
    try {
      if (serviceRef.current) {
        await serviceRef.current.leaveRoom();
      }
    } catch {
      // ignore
    }
  }, []);

  const cancelConnecting = useCallback(async (): Promise<void> => {
    setIsConnecting(false);
    await leaveRoom();
  }, [leaveRoom]);

  const createRoom = useCallback(
    async (customSnapshot?: RoomFirebaseState): Promise<string> => {
      setError(null);
      try {
        const service = getService();
        const snapshot = customSnapshot || optionsRef.current?.getSnapshot?.();
        if (!snapshot) {
          throw new Error('Unable to capture attendance snapshot to host room.');
        }

        const name = connectionName.trim() || 'Host';

        // 1. Instantly allocate room code and set session in 0ms so sender sees code immediately!
        const { code, session: newSession } = service.prepareRoom(name);
        setSession(newSession);

        // 2. Publish initial room snapshot to Firebase in parallel
        setIsConnecting(true);
        try {
          await service.publishRoom(code, name, snapshot);

          // Listen for collaborators presence
          service.subscribePresence((presence) => {
            setCollaborators(presence);
          });

          // Listen for state changes (e.g. from receivers)
          service.subscribeState((remoteState) => {
            optionsRef.current?.onRemoteStateReceived?.(remoteState, 'sender');
          });

          // Listen for remote save requests from receivers
          service.subscribeSaveRequest((req) => {
            optionsRef.current?.onRemoteSaveRequested?.(req);
          });
        } catch (publishErr: unknown) {
          const rawMsg = publishErr instanceof Error ? publishErr.message : 'Failed to publish room.';
          const msg =
            rawMsg.toLowerCase().includes('appcheck') ||
            rawMsg.toLowerCase().includes('unauthorized') ||
            rawMsg.toLowerCase().includes('permission_denied')
              ? 'Firebase App Check is blocking desktop connections. In Firebase Console > App Check > Realtime Database, switch Enforcement to "Unenforce".'
              : rawMsg;
          setError(msg);
          // Rollback local session if publish failed
          setSession(null);
          await service.leaveRoom();
          throw publishErr;
        } finally {
          setIsConnecting(false);
        }

        return code;
      } catch (err: unknown) {
        setIsConnecting(false);
        throw err;
      }
    },
    [connectionName, getService]
  );

  const joinRoom = useCallback(
    async (roomCode: string): Promise<void> => {
      setIsConnecting(true);
      setError(null);
      try {
        const service = getService();
        const name = connectionName.trim() || 'Collaborator';
        const sanitizedCode = roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

        // 1. Establish session optimistically so role='receiver' is available immediately
        const newSession: CollaborationSession = {
          roomCode: sanitizedCode,
          role: 'receiver',
          myUid: service.myUid,
          myColor: service.myColor,
          myDisplayName: name,
        };
        setSession(newSession);

        // 2. Join room in Firebase
        await service.joinRoom(
          sanitizedCode,
          name,
          (remoteState) => {
            optionsRef.current?.onRemoteStateReceived?.(remoteState, 'receiver');
          },
          (presence) => {
            setCollaborators(presence);
          },
          () => {
            // Host ended room callback
            setSession(null);
            setCollaborators({});
            setError('The host has ended this collaboration session.');
          }
        );
      } catch (err: unknown) {
        setSession(null);
        const msg = err instanceof Error ? err.message : 'Failed to join room.';
        setError(msg);
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [connectionName, getService]
  );

  const updateMyCursor = useCallback(
    (date: string, personId: string) => {
      if (session && serviceRef.current) {
        serviceRef.current.updateCursor(date, personId).catch(() => {});
      }
    },
    [session]
  );

  const clearMyCursor = useCallback(() => {
    if (session && serviceRef.current) {
      serviceRef.current.clearCursor().catch(() => {});
    }
  }, [session]);

  const broadcastAttendanceCell = useCallback(
    async (update: RoomAttendanceUpdate): Promise<void> => {
      if (session && serviceRef.current) {
        await serviceRef.current.pushAttendanceChange(update).catch(() => {});
      }
    },
    [session]
  );

  const broadcastAttendanceBatch = useCallback(
    async (updates: RoomAttendanceUpdate[]): Promise<void> => {
      if (session && serviceRef.current) {
        await serviceRef.current.batchPushAttendance(updates).catch(() => {});
      }
    },
    [session]
  );

  const requestRemoteSave = useCallback(
    async (targetDate: string): Promise<RoomSaveResponse> => {
      if (!session || !serviceRef.current) {
        throw new Error('Not connected to a live collaboration room.');
      }
      return serviceRef.current.requestRemoteSave(targetDate);
    },
    [session]
  );

  const respondRemoteSave = useCallback(
    async (response: RoomSaveResponse): Promise<void> => {
      if (session && serviceRef.current) {
        await serviceRef.current.respondRemoteSave(response);
      }
    },
    [session]
  );

  // Notify Electron IPC about collaboration session status
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as unknown as { electronAPI?: { send?: (ch: string) => void } }).electronAPI?.send) {
      const api = (window as unknown as { electronAPI: { send: (ch: string) => void } }).electronAPI;
      if (session) {
        api.send('collab-active');
      } else {
        api.send('collab-inactive');
      }
    }
  }, [session]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (serviceRef.current) {
        serviceRef.current.leaveRoom().catch(() => {});
      }
      if (typeof window !== 'undefined' && (window as unknown as { electronAPI?: { send?: (ch: string) => void } }).electronAPI?.send) {
        (window as unknown as { electronAPI: { send: (ch: string) => void } }).electronAPI.send('collab-inactive');
      }
    };
  }, []);

  return {
    session,
    collaborators,
    connectionName,
    setConnectionName,
    createRoom,
    joinRoom,
    leaveRoom,
    cancelConnecting,
    updateMyCursor,
    clearMyCursor,
    broadcastAttendanceCell,
    broadcastAttendanceBatch,
    requestRemoteSave,
    respondRemoteSave,
    getService: () => serviceRef.current,
    isConnected: !!session,
    isConnecting,
    error,
    clearError,
  };
};

export type CollaborationContextValue = ReturnType<typeof useCollaboration>;

