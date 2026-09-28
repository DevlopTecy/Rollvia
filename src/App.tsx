import React from 'react';
import { FlowProvider, ThemeProvider, useFlow } from './context';
import { TitleBar } from './components/layout/TitleBar';
import { SetupWizard } from './components/screens/SetupWizard';
import { WorkspaceHeader } from './components/workspace/WorkspaceHeader';
import { AttendanceGrid } from './components/workspace/AttendanceGrid';
import { StudentsView } from './components/workspace/StudentsView';
import { TimetableView } from './components/workspace/TimetableView';

const WorkspaceApp: React.FC = () => {
  const { activeTab } = useFlow();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TitleBar />
      <WorkspaceHeader />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeTab === 'attendance' && <AttendanceGrid />}
        {activeTab === 'students' && <StudentsView />}
        {activeTab === 'timetable' && <TimetableView />}
      </main>
    </div>
  );
};

const SetupApp: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
    <TitleBar />
    <SetupWizard />
  </div>
);

const MainRouter: React.FC = () => {
  const { sessionState } = useFlow();
  return sessionState.appPhase === 'workspace' ? <WorkspaceApp /> : <SetupApp />;
};

export function App() {
  return (
    <ThemeProvider>
      <FlowProvider>
        <MainRouter />
      </FlowProvider>
    </ThemeProvider>
  );
}

export default App;
