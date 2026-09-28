import React, { useEffect, useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { useFlow, useTheme } from '../../context';
import attendlyLogo from '../../assets/attendly-logo.png';
import attendlyLogoDark from '../../assets/attendly-icon-dark.png';
import attendlyLogoLight from '../../assets/attendly-icon-light.png';

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const { sessionState, currentStepMeta, updateSessionState, enterWorkspace } = useFlow();
  const { theme } = useTheme();

  const currentIcon = theme === 'light' ? attendlyLogoLight : (attendlyLogoDark || attendlyLogo);

  useEffect(() => {
    if (window.electronAPI?.onMaximizeChange) {
      const cleanup = window.electronAPI.onMaximizeChange((max) => {
        setIsMaximized(max);
      });
      window.electronAPI.isMaximized().then(setIsMaximized).catch(() => {});
      return cleanup;
    }
  }, []);

  const handleMinimize = () => {
    if (window.electronAPI?.minimize) {
      window.electronAPI.minimize();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI?.maximize) {
      window.electronAPI.maximize();
    } else {
      setIsMaximized(!isMaximized);
    }
  };

  const handleClose = () => {
    if (window.electronAPI?.close) {
      window.electronAPI.close();
    }
  };

  const totalSubjects = Object.values(sessionState.weeklyTimetable || {}).reduce((acc, list) => acc + (list?.length || 0), 0);
  const canEnterWorkspace = Boolean(sessionState.excelFilePath) &&
    sessionState.people.some((p) => p.name.trim() && p.rollNumber.trim()) &&
    totalSubjects > 0;

  const handleBrandClick = () => {
    if (sessionState.appPhase === 'workspace') {
      updateSessionState({ appPhase: 'setup' });
    } else if (canEnterWorkspace) {
      enterWorkspace();
    }
  };

  return (
    <header className="app-titlebar">
      <div className="titlebar-drag-region">
        <div
          className="titlebar-brand"
          onClick={handleBrandClick}
          style={{ cursor: (sessionState.appPhase === 'workspace' || canEnterWorkspace) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '6px' }}
          title={sessionState.appPhase === 'workspace' ? 'Switch to Setup' : (canEnterWorkspace ? 'Switch to Workspace' : 'Rollvia')}
        >
          <img
            src={currentIcon}
            alt="Rollvia"
            style={{ width: '15px', height: '15px', borderRadius: '3px', objectFit: 'contain' }}
          />
          <span>Rollvia</span>
        </div>
        <div className="titlebar-divider" />
        <span className="titlebar-subtitle">
          {sessionState.institutionName} • {currentStepMeta.title}
        </span>
      </div>

      <div className="titlebar-window-controls">
        <button
          className="titlebar-btn"
          onClick={handleMinimize}
          title="Minimize"
          aria-label="Minimize"
        >
          <Minus size={12} strokeWidth={1.8} />
        </button>
        <button
          className="titlebar-btn"
          onClick={handleMaximize}
          title={isMaximized ? 'Restore' : 'Maximize'}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Copy size={11} strokeWidth={1.8} /> : <Square size={10} strokeWidth={1.8} />}
        </button>
        <button
          className="titlebar-btn close-btn"
          onClick={handleClose}
          title="Close"
          aria-label="Close"
        >
          <X size={13} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
};
