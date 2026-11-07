import React, { useState, useRef, useEffect } from 'react';
import {
  Wifi,
  Copy,
  Check,
  Users,
  LogOut,
  AlertCircle,
  Radio,
  X,
  Loader2,
} from 'lucide-react';
import { useFlow } from '../../context';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export const ProfilePanel: React.FC = () => {
  const { collaboration } = useFlow();
  const {
    session,
    collaborators,
    connectionName,
    setConnectionName,
    createRoom,
    leaveRoom,
    cancelConnecting,
    isConnecting,
    error,
    clearError,
  } = collaboration;

  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCopyCode = async () => {
    if (!session?.roomCode) return;
    try {
      await navigator.clipboard.writeText(session.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleStartSender = async () => {
    try {
      clearError();
      await createRoom();
    } catch {
      // error is handled in hook
    }
  };

  const handleLeave = async () => {
    await leaveRoom();
  };

  // Profile icon display character
  const initialChar = connectionName.trim()
    ? connectionName.trim().charAt(0).toUpperCase()
    : '';

  const activeCollaboratorsList = Object.entries(collaborators || {});
  const otherCollaborators = activeCollaboratorsList.filter(([uid]) => uid !== session?.myUid);

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* Profile / Collab Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          clearError();
        }}
        title={session ? `Live Room: ${session.roomCode} (${session.role === 'sender' ? 'Host' : 'Receiver'})` : 'Profile & Live Collaboration'}
        aria-label="Profile and Live Collaboration"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 8px 2px 4px',
          borderRadius: 'var(--radius-full, 9999px)',
          border: session
            ? '1.5px solid var(--success-500, #10b981)'
            : '1px solid var(--border-default)',
          backgroundColor: session ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-surface)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          fontSize: '11px',
          fontWeight: 600,
          boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.05))',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = session
            ? 'rgba(16, 185, 129, 0.18)'
            : 'var(--bg-surface-hover, rgba(0,0,0,0.04))';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = session
            ? 'rgba(16, 185, 129, 0.12)'
            : 'var(--bg-surface)';
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: session?.myColor || 'var(--primary-600, #4f46e5)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initialChar || <Wifi size={10} />}
        </span>

        <span
          style={{
            maxWidth: 80,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {session ? `${session.roomCode.slice(0, 3)}-${session.roomCode.slice(3)}` : (connectionName || 'Host')}
        </span>

        {session && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'var(--success-500, #10b981)',
              display: 'inline-block',
              boxShadow: '0 0 4px rgba(16,185,129,0.6)',
            }}
          />
        )}
      </button>

      {/* Floating Collab Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 320,
            backgroundColor: 'var(--bg-surface, #ffffff)',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border-default, #e5e7eb)',
            boxShadow: 'var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1))',
            padding: 14,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 8,
              borderBottom: '1px solid var(--border-subtle, #f3f4f6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Radio size={15} style={{ color: session ? 'var(--success-500)' : 'var(--primary-600)' }} />
              <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                {session?.role === 'receiver' ? 'Receiver Session' : 'Host Live Collaboration'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 4,
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Connection Name Input */}
          <Input
            label="Connection Name"
            placeholder="e.g. Host, Teacher"
            value={connectionName}
            onChange={(e) => setConnectionName(e.target.value)}
            disabled={isConnecting}
            helperText="Display name shown to collaborators."
          />

          {/* Active Session Quick Bar (always visible when connected) */}
          {session && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm, 6px)',
                backgroundColor: session.role === 'sender' ? 'rgba(79, 70, 229, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                border: session.role === 'sender' ? '1px solid rgba(79, 70, 229, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                  Active {session.role === 'sender' ? 'Host Session' : 'Receiver Room'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', letterSpacing: 1.5, color: session.role === 'sender' ? 'var(--primary-600)' : 'var(--success-600)' }}>
                  {session.roomCode.slice(0, 3)}-{session.roomCode.slice(3)}
                </span>
              </div>
              <Button
                variant={session.role === 'sender' ? 'danger' : 'secondary'}
                size="sm"
                icon={<LogOut size={12} />}
                onClick={handleLeave}
              >
                {session.role === 'sender' ? 'End Session' : 'Leave Room'}
              </Button>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm, 4px)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--danger-600, #dc2626)',
                fontSize: 'var(--text-xs)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{error}</span>
            </div>
          )}

          {/* Body Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {session?.role === 'sender' ? (
              <>
                <div
                  style={{
                    padding: 12,
                    backgroundColor: 'var(--bg-canvas, #f9fafb)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    border: '1px dashed var(--border-default)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Share this code with receivers on the Setup page:
                  </span>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      letterSpacing: 3,
                      fontFamily: 'monospace',
                      color: 'var(--primary-600, #4f46e5)',
                    }}
                  >
                    {session.roomCode.slice(0, 3)}-{session.roomCode.slice(3)}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={copied ? <Check size={13} /> : <Copy size={13} />}
                    onClick={handleCopyCode}
                  >
                    {copied ? 'Code Copied!' : 'Copy Code'}
                  </Button>
                  {isConnecting && (
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 2,
                      }}
                    >
                      <Loader2 size={10} className="animate-spin" /> Synchronizing room data...
                    </span>
                  )}
                </div>

                {/* Connected Collaborators */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>Connected Collaborators:</span>
                    <span>{otherCollaborators.length} online</span>
                  </div>

                  {otherCollaborators.length === 0 ? (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Waiting for receivers to join...
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {otherCollaborators.map(([uid, presence]) => (
                        <div
                          key={uid}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full, 9999px)',
                            backgroundColor: 'var(--bg-canvas)',
                            fontSize: 11,
                            border: '1px solid var(--border-default)',
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: presence.color,
                            }}
                          />
                          <span>{presence.displayName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  variant="danger"
                  size="sm"
                  icon={<LogOut size={13} />}
                  onClick={handleLeave}
                  style={{ marginTop: 4 }}
                >
                  End Session
                </Button>
              </>
            ) : session?.role === 'receiver' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  style={{
                    padding: 10,
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    fontSize: 12,
                    color: 'var(--success-700, #047857)',
                  }}
                >
                  Connected to Room <strong>{session.roomCode}</strong> as Receiver. Changes you mark are saved directly to the Host PC.
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  <Users size={12} />
                  <span>{activeCollaboratorsList.length} total in room</span>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  icon={<LogOut size={13} />}
                  onClick={handleLeave}
                >
                  Leave Room & Return to Setup
                </Button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  Start a live collaboration session from this laptop. Receivers on the Setup screen can enter your 6-character room code to join and mark attendance. All attendance records will be saved directly into your local Excel workbook.
                </p>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Button
                    variant="primary"
                    size="md"
                    loading={isConnecting}
                    onClick={handleStartSender}
                    style={{ flex: 1 }}
                  >
                    Start as Sender
                  </Button>
                  {isConnecting && (
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={cancelConnecting}
                      style={{ color: 'var(--danger-600)' }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
