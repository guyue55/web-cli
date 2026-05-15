import { lazy, Suspense, useMemo, useState } from 'react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatHistory } from './components/Chat/ChatHistory';
import { PromptBox } from './components/PromptBox/PromptBox';
import { useSessions, type HistoryItem } from './hooks/useSessions';
import { useTranscript } from './hooks/useTranscript';
import { useTheme } from './hooks/useTheme';
import { Header } from './components/Layout/Header';
import { WelcomeScreen } from './components/Layout/WelcomeScreen';
import { WorkspacePanel, type WorkspacePanelMode } from './components/Layout/WorkspacePanel';
import { getSessionDisplayName, isUntitledSessionName } from './utils/sessionPresentation';
import './App.css';

const Terminal = lazy(() => import('./components/Terminal/Terminal'));

function App() {
  const {
    activeSessions,
    projects,
    groupedHistory,
    isDiscovering,
    renameSessionLocal,
    deleteSessionLocal,
    updateSessionMetadataLocal,
    clearSessionMetadataLocal
  } = useSessions();
  const [selectedSession, setSelectedSession] = useState<HistoryItem | null>(() => {
    const saved = localStorage.getItem('last_session_v2');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem('last_session_v2');
      return null;
    }
  });
  const { transcript, isLoading: isLoadingTranscript, hasMore, loadMore } = useTranscript(selectedSession);
  const { theme, toggleTheme } = useTheme();
  
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [workspacePanelMode, setWorkspacePanelMode] = useState<WorkspacePanelMode>(null);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [terminalSessionsStarted, setTerminalSessionsStarted] = useState<Record<string, boolean>>({});
  const [newSessionProjectPath, setNewSessionProjectPath] = useState<string>(() => {
    return localStorage.getItem('new_session_project_path') || '';
  });
  const [terminalFontSize, setTerminalFontSize] = useState<number>(() => {
    return Number(localStorage.getItem('terminal_font_size') || '14');
  });
  const [mobileHelperDefaultVisible, setMobileHelperDefaultVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('terminal_mobile_helper_visible');
    return saved === null ? true : saved === 'true';
  });

  const defaultProject = useMemo(() => {
    const savedProject = projects.find(project => project.path === newSessionProjectPath);
    if (savedProject) return savedProject;

    const lastSession = groupedHistory[0]?.items[0];
    if (lastSession) {
      return { path: lastSession.projectPath, name: lastSession.projectName };
    }

    return projects[0] || { path: '.', name: 'default' };
  }, [groupedHistory, newSessionProjectPath, projects]);

  const handleNewSessionProjectChange = (projectPath: string) => {
    setNewSessionProjectPath(projectPath);
    localStorage.setItem('new_session_project_path', projectPath);
  };

  const handleTerminalFontSizeChange = (fontSize: number) => {
    setTerminalFontSize(fontSize);
    localStorage.setItem('terminal_font_size', String(fontSize));
  };

  const handleMobileHelperDefaultChange = (visible: boolean) => {
    setMobileHelperDefaultVisible(visible);
    localStorage.setItem('terminal_mobile_helper_visible', String(visible));
  };

  const markTerminalStarted = (sessionId: string) => {
    setTerminalSessionsStarted(prev => (
      prev[sessionId] ? prev : { ...prev, [sessionId]: true }
    ));
  };

  const toggleLiveMode = (mode: boolean) => {
    if (mode && selectedSession) {
      markTerminalStarted(selectedSession.id);
    }
    setIsLiveMode(mode);
  };

  const handleSelectSession = (session: HistoryItem) => {
    setSelectedSession(session);
    localStorage.setItem('last_session_v2', JSON.stringify(session));
    setIsLiveMode(false);
    setInitialPrompt(null);
    setWorkspacePanelMode(null);
    if (window.innerWidth <= 768) setIsSidebarCollapsed(true);
  };

  const handleNewChat = () => {
    setSelectedSession(null);
    localStorage.removeItem('last_session_v2');
    setIsLiveMode(false);
    setInitialPrompt(null);
    setWorkspacePanelMode(null);
  };

  const handlePromptSubmit = (text: string) => {
    if (!text.trim()) return;
    
    if (!selectedSession) {
      const newSession: HistoryItem = {
        id: `new-${Date.now()}`,
        name: text.substring(0, 30),
        projectPath: defaultProject.path,
        projectName: defaultProject.name,
        index: '0',
        time: 'Just now',
        updatedAt: Date.now()
      };
      setSelectedSession(newSession);
      localStorage.setItem('last_session_v2', JSON.stringify(newSession));
      setInitialPrompt(text);
      setIsLiveMode(true);
      markTerminalStarted(newSession.id);
      setWorkspacePanelMode(null);
    } else {
      // Force terminal mode and send prompt
      setInitialPrompt(text);
      markTerminalStarted(selectedSession.id);
      if (!isLiveMode) setIsLiveMode(true);
      setWorkspacePanelMode(null);
    }
  };

  const untitledSessionCount = useMemo(() => (
    groupedHistory.reduce((total, group) => (
      total + group.items.filter(item => isUntitledSessionName(item.name)).length
    ), 0)
  ), [groupedHistory]);

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
      <button 
        className="mobile-hamburger" 
        aria-label={isSidebarCollapsed ? '打开侧边栏' : '关闭侧边栏'}
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      >
        ☰
      </button>

      {/* Mobile Overlay */}
      {!isSidebarCollapsed && (
        <div className="mobile-overlay" onClick={() => setIsSidebarCollapsed(true)} />
      )}

      <Sidebar 
        groupedHistory={groupedHistory}
        activeSessions={activeSessions}
        projects={projects}
        selectedSession={selectedSession}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isLoading={isDiscovering}
        collapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        renameSessionLocal={renameSessionLocal}
        deleteSessionLocal={deleteSessionLocal}
        updateSessionMetadataLocal={updateSessionMetadataLocal}
        clearSessionMetadataLocal={clearSessionMetadataLocal}
        onOpenPanel={setWorkspacePanelMode}
      />

      <div className="main-content">
        <Header 
          selectedSession={selectedSession}
          selectedSessionLabel={selectedSession ? getSessionDisplayName(selectedSession) : 'Gemini'}
          theme={theme}
          isLiveMode={isLiveMode}
          onToggleTheme={toggleTheme}
          onToggleLiveMode={toggleLiveMode}
        />

        <div className={`content-area ${isLiveMode ? 'live-mode' : ''}`}>
          {selectedSession ? (
            <div className="content-stack">
              <div 
                className="chat-view-layer" 
                style={{ display: isLiveMode ? 'none' : 'flex' }}
              >
                <ChatHistory 
                  transcript={transcript}
                  isLoading={isLoadingTranscript}
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                  onStartLive={() => setIsLiveMode(true)}
                />
              </div>
              
              <div 
                className="terminal-view-layer"
                style={{ display: isLiveMode ? 'flex' : 'none' }}
              >
                {(isLiveMode || terminalSessionsStarted[selectedSession.id]) && (
                  <Suspense fallback={<div className="terminal-loading-state">正在加载交互终端...</div>}>
                    <Terminal 
                      uuid={selectedSession.id} 
                      projectPath={selectedSession.projectPath} 
                      initialPrompt={initialPrompt}
                      theme={theme}
                      terminalFontSize={terminalFontSize}
                      mobileHelperDefaultVisible={mobileHelperDefaultVisible}
                      preferredTabId={selectedSession.id}
                      isVisible={isLiveMode}
                      onSendToChat={handlePromptSubmit}
                    />
                  </Suspense>
                )}
              </div>
            </div>
          ) : (
            <WelcomeScreen
              onHandlePromptSubmit={handlePromptSubmit}
              projects={projects}
              selectedProjectPath={defaultProject.path}
              onProjectChange={handleNewSessionProjectChange}
            />
          )}
        </div>

        {!isLiveMode && (
          <PromptBox onSubmit={handlePromptSubmit} />
        )}
      </div>

      <WorkspacePanel
        mode={workspacePanelMode}
        theme={theme}
        projects={projects}
        groupedHistory={groupedHistory}
        activeSessions={activeSessions}
        selectedProjectPath={defaultProject.path}
        terminalFontSize={terminalFontSize}
        mobileHelperDefaultVisible={mobileHelperDefaultVisible}
        untitledSessionCount={untitledSessionCount}
        onClose={() => setWorkspacePanelMode(null)}
        onToggleTheme={toggleTheme}
        onProjectChange={handleNewSessionProjectChange}
        onTerminalFontSizeChange={handleTerminalFontSizeChange}
        onMobileHelperDefaultChange={handleMobileHelperDefaultChange}
        onSelectSession={handleSelectSession}
      />
    </div>
  );
}

export default App;
