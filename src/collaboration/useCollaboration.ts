import { useState, useRef, useEffect, useCallback } from 'react';
import { CollaborationService } from './CollaborationService';
import type {
  CollaborationSession,
  CollaboratorPresence,
  RoomFirebaseState,
  RoomAttendanceUpdate,
} from './types';

const STORAGE_KEY_NAME = 'rollvia_connection_name';

export interface UseCollaborationOptions {
  getSnapshot?: () => RoomFirebaseState;
  onRemoteStateReceived?: (state: RoomFirebaseState) => void;
  onRemoteAttendanceCell?: (update: RoomAttendanceUpdate) => void;
}

export const useCollaboration = (options?: UseCollaborationOptions) => {
  const serviceRef = useRef<CollaborationService | null>(null);

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

  const createRoom = useCallback(
    async (customSnapshot?: RoomFirebaseState): Promise<string> => {
      setIsConnecting(true);
      setError(null);
      try {
        const service = getService();
        const snapshot = customSnapshot || options?.getSnapshot?.();
        if (!snapshot) {
          throw new Error('Unable to capture attendance snapshot to host room.');
        }

        const name = connectionName.trim() || 'Host';
        const roomCode = await service.createRoom(name, snapshot);

        const newSession: CollaborationSession = {
          roomCode,
          role: 'sender',
          myUid: service.myUid,
          myColor: service.myColor,
          myDisplayName: name,
        };
        setSession(newSession);

        // Listen for collaborators presence
        service.subscribePresence((presence) => {
          setCollaborators(presence);
        });

        // Listen for state changes (e.g. from receivers)
        service.subscribeState((remoteState) => {
          options?.onRemoteStateReceived?.(remoteState);
        });

        return roomCode;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create room.';
        setError(msg);
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [connectionName, getService, options]
  );

  const joinRoom = useCallback(
    async (roomCode: string): Promise<void> => {
      setIsConnecting(true);
      setError(null);
      try {
        const service = getService();
        const name = connectionName.trim() || 'Collaborator';

        await service.joinRoom(
          roomCode,
          name,
          (remoteState) => {
            options?.onRemoteStateReceived?.(remoteState);
          },
          (presence) => {
            setCollaborators(presence);
          }
        );

        const newSession: CollaborationSession = {
          roomCode: service.roomCode!,
          role: 'receiver',
          myUid: service.myUid,
          myColor: service.myColor,
          myDisplayName: name,
        };
        setSession(newSession);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to join room.';
        setError(msg);
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [connectionName, getService, options]
  );

  const leaveRoom = useCallback(async (): Promise<void> => {
    try {
      if (serviceRef.current) {
        await serviceRef.current.leaveRoom();
      }
    } finally {
      setSession(null);
      setCollaborators({});
      setError(null);
    }
  }, []);

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
    updateMyCursor,
    clearMyCursor,
    getService: () => serviceRef.current,
    isConnected: !!session,
    isConnecting,
    error,
    clearError,
  };
};

export type CollaborationContextValue = ReturnType<typeof useCollaboration>;

