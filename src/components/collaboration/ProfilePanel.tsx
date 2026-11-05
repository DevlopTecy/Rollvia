import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Wifi,
  Copy,
  Check,
  Users,
  LogOut,
  AlertCircle,
  Radio,
  X,
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
    joinRoom,
    leaveRoom,
    isConnecting,
    error,
    clearError,
  } = collaboration;

  const [isOpen, setIsOpen] = useState(false);
  const [userTab, setUserTab] = useState<'sender' | 'receiver' | null>(null);
  const activeTab = userTab || session?.role || 'sender';
  const [joinCodeInput, setJoinCodeInput] = useState('');
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

  const handleJoinReceiver = async () => {
    if (!joinCodeInput.trim()) return;
    try {
      clearError();
      await joinRoom(joinCodeInput.trim());
    } catch {
      // error is handled in hook
    }
  };

  const handleLeave = async () => {
    await leaveRoom();
    setJoinCodeInput('');
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
        title={session ? `Live Room: ${session.roomCode} (${session.role})` : 'Live Collaboration'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          borderRadius: 'var(--radius-full, 9999px)',
          border: session
            ? '2px solid var(--success-500, #10b981)'
            : '1px solid var(--border-default)',
          backgroundColor: session ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-surface)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: session?.myColor || 'var(--primary-600, #4f46e5)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {initialChar || <User size={12} />}
        </div>

        {session ? (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--success-600, #059669)',
              letterSpacing: 0.5,
            }}
          >
            <Radio size={12} className="animate-pulse" />
            LIVE {session.roomCode}
          </span>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>Connect</span>
        )}
      </button>

      {/* Floating Card Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 320,
            backgroundColor: 'var(--bg-elevated, #ffffff)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)',
            zIndex: 1000,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wifi size={15} style={{ color: 'var(--primary-600, #4f46e5)' }} />
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                Live Collaboration
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                border: 'none',
                background: 'transparent',
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
            placeholder="e.g. Hitesh, Friend"
            value={connectionName}
            onChange={(e) => setConnectionName(e.target.value)}
            disabled={isConnecting}
            helperText="Display name shown to collaborators."
          />

          {/* Role Tabs */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-canvas, #f3f4f6)',
              borderRadius: 'var(--radius-sm, 6px)',
              padding: 2,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setUserTab('sender');
                clearError();
              }}
              style={{
                flex: 1,
                padding: '6px 0',
                border: 'none',
                borderRadius: 'var(--radius-sm, 4px)',
                fontSize: 'var(--text-xs)',
                fontWeight: activeTab === 'sender' ? 600 : 500,
                backgroundColor: activeTab === 'sender' ? 'var(--bg-surface, #ffffff)' : 'transparent',
                color: activeTab === 'sender' ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                boxShadow: activeTab === 'sender' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Sender (Host)
            </button>
            <button
              type="button"
              onClick={() => {
                setUserTab('receiver');
                clearError();
              }}
              style={{
                flex: 1,
                padding: '6px 0',
                border: 'none',
                borderRadius: 'var(--radius-sm, 4px)',
                fontSize: 'var(--text-xs)',
                fontWeight: activeTab === 'receiver' ? 600 : 500,
                backgroundColor: activeTab === 'receiver' ? 'var(--bg-surface, #ffffff)' : 'transparent',
                color: activeTab === 'receiver' ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                boxShadow: activeTab === 'receiver' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Receiver (Join)
            </button>
          </div>

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

          {/* SENDER TAB CONTENT */}
          {activeTab === 'sender' && (
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
                      Share this code with your friends:
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
                        Waiting for friends to join...
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
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  You are currently joined to Room <strong>{session.roomCode}</strong> as a Receiver.
                  Leave that room to host a new session.
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    Start a session from this laptop. All attendance records will be saved directly on your PC.
                  </p>
                  <Button
                    variant="primary"
                    size="md"
                    loading={isConnecting}
                    onClick={handleStartSender}
                  >
                    Start as Sender
                  </Button>
                </>
              )}
            </div>
          )}

          {/* RECEIVER TAB CONTENT */}
          {activeTab === 'receiver' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {session?.role === 'receiver' ? (
                <>
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
                    Connected to Room <strong>{session.roomCode}</strong>. Changes you make will be saved on the Sender&apos;s PC.
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
                    Leave Room
                  </Button>
                </>
              ) : session?.role === 'sender' ? (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  You are currently hosting Room <strong>{session.roomCode}</strong> as Sender.
                  End your session if you wish to join another room as Receiver.
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    Enter the 6-character Room Code provided by the Sender:
                  </p>
                  <Input
                    placeholder="e.g. KD7421"
                    value={joinCodeInput}
                    maxLength={7}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    disabled={isConnecting}
                    style={{ textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: 2, fontWeight: 700 }}
                  />
                  <Button
                    variant="primary"
                    size="md"
                    loading={isConnecting}
                    disabled={joinCodeInput.trim().length < 4}
                    onClick={handleJoinReceiver}
                  >
                    Join Session
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
