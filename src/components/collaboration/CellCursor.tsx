import React from 'react';
import { useFlow } from '../../context';
import type { CollaboratorPresence } from '../../collaboration/types';

export interface CellCursorProps {
  date: string;
  personId: string;
}

export const useCollaboratorCursor = (
  date: string,
  personId: string
): CollaboratorPresence | null => {
  const { collaboration } = useFlow();
  const { session, collaborators } = collaboration;

  if (!session) return null;

  for (const [uid, presence] of Object.entries(collaborators || {})) {
    if (uid === session.myUid) continue;
    if (presence.cursor?.date === date && presence.cursor?.personId === personId) {
      return presence;
    }
  }

  return null;
};

export const CellCursor: React.FC<CellCursorProps> = ({ date, personId }) => {
  const collaborator = useCollaboratorCursor(date, personId);

  if (!collaborator) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 2,
        right: 4,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        backgroundColor: collaborator.color,
        color: '#ffffff',
        fontSize: 9,
        fontWeight: 700,
        padding: '1px 5px',
        borderRadius: 3,
        pointerEvents: 'none',
        zIndex: 5,
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
      title={`${collaborator.displayName} is viewing this student`}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          display: 'inline-block',
        }}
      />
      {collaborator.displayName.slice(0, 10)}
    </div>
  );
};
