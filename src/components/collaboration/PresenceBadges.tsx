import React from 'react';
import { useFlow } from '../../context';

export const PresenceBadges: React.FC = () => {
  const { collaboration } = useFlow();
  const { session, collaborators } = collaboration;

  if (!session) return null;

  const otherCollaborators = Object.entries(collaborators || {})
    .filter(([uid]) => uid !== session.myUid)
    .slice(0, 4);

  if (otherCollaborators.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        marginRight: 4,
      }}
      title={`${otherCollaborators.length} collaborator(s) online`}
    >
      {otherCollaborators.map(([uid, presence], index) => {
        const initial = presence.displayName?.trim()?.charAt(0)?.toUpperCase() || '?';
        return (
          <div
            key={uid}
            title={presence.displayName}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: presence.color,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              border: '2px solid var(--bg-header, #ffffff)',
              marginLeft: index === 0 ? 0 : -8,
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              cursor: 'default',
              userSelect: 'none',
              zIndex: 10 - index,
            }}
          >
            {initial}
          </div>
        );
      })}
    </div>
  );
};
