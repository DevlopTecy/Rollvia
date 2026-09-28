import React, { useState } from 'react';
import { Layers, RotateCcw, HelpCircle, Users, Sparkles } from 'lucide-react';
import { useFlow } from '../../context';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Badge } from '../ui/Badge';
import { ThemeToggle } from '../ui/ThemeToggle';

export const AppHeader: React.FC = () => {
  const { sessionState, resetFlow } = useFlow();
  const [showAbout, setShowAbout] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  return (
    <>
      <header className="app-header">
        <div className="header-left">
          <div className="header-app-tag">
            <Layers size={13} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {sessionState.academicYear}
            </span>
            <span style={{ color: 'var(--border-default)' }}>/</span>
            <span style={{ color: 'var(--text-secondary)' }}>{sessionState.departmentName}</span>
          </div>

          <Badge variant="success" dot>
            Session Active
          </Badge>
        </div>

        <div className="header-right">
          <div className="header-app-tag">
            <Users size={12} style={{ color: 'var(--text-muted)' }} />
            <span>{sessionState.people.length > 0 ? sessionState.people.length : (sessionState.members?.length || 0)} Enrolled</span>
          </div>

          <ThemeToggle />

          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw size={13} />}
            onClick={() => setShowResetConfirm(true)}
            title="Restart Attendance Flow"
          >
            Reset
          </Button>

          <Button
            variant="ghost"
            size="sm"
            icon={<HelpCircle size={13} />}
            onClick={() => setShowAbout(true)}
            title="About Rollvia"
          >
            Help
          </Button>
        </div>
      </header>

      {/* Reset Confirmation Dialog */}
      <Dialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset Workflow?"
        description="Return to Step 1 (Storage Setup) while preserving your underlying roster settings."
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => {
                resetFlow();
                setShowResetConfirm(false);
              }}
            >
              Reset to Start
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          This will rewind the step progression to Step 1 without deleting your underlying roster, academic parameters, or course configurations.
        </p>
      </Dialog>

      {/* About Rollvia Dialog */}
      <Dialog
        isOpen={showAbout}
        onClose={() => setShowAbout(false)}
        title="About Rollvia"
        description="Version 1.0.0 – Windows Desktop Edition"
        footer={
          <Button variant="primary" size="md" onClick={() => setShowAbout(false)}>
            Close
          </Button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--primary-50)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>Rollvia Desktop</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Fast, distraction-free attendance manager designed for productivity.
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--bg-canvas)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-xs)',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}
          >
            <div><strong>Environment:</strong> Windows Native Desktop Shell</div>
            <div><strong>Workflow:</strong> Storage → Students → Month → Weekly Timetable → Attendance → Completion</div>
          </div>
        </div>
      </Dialog>
    </>
  );
};
