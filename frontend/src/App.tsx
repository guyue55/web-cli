import { useState } from 'react';
import Terminal from './components/Terminal/Terminal';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatHistory } from './components/Chat/ChatHistory';
import { PromptBox } from './components/PromptBox/PromptBox';
import { useSessions, type HistoryItem } from './hooks/useSessions';
import { useTranscript } from './hooks/useTranscript';
import { useTheme } from './hooks/useTheme';
import { Header } from './components/Layout/Header';
import { WelcomeScreen } from './components/Layout/WelcomeScreen';
import './App.css';

function App() {
  const { activeSessions, projects, groupedHistory, isDiscovering } = useSessions();
  const [selectedSession, setSelectedSession] = useState<HistoryItem | null>(() => {
    const saved = localStorage.getItem('last_session_v2');
    return saved ? JSON.parse(saved) : null;
  });
  const { transcript, isLoading: isLoadingTranscript, hasMore, loadMore } = useTranscript(selectedSession);
  const { theme, toggleTheme } = useTheme();
  
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  const toggleLiveMode = (mode: boolean) => {
    // View Transitions API (2026 standard)
    if (document.startViewTransition) {
       // View Transitions API (2026 standard)
       document.startViewTransition(() => setIsLiveMode(mode));
    } else {
       setIsLiveMode(mode);
    }
  };

  const handleSelectSession = (session: HistoryItem) => {
    const update = () => {
      setSelectedSession(session);
      localStorage.setItem('last_session_v2', JSON.stringify(session));
      setIsLiveMode(false);
      setInitialPrompt(null);
    };
    // View Transitions API (2026 standard)
    if (document.startViewTransition) {
       // View Transitions API (2026 standard)
       document.startViewTransition(update);
    } else {
       update();
    }
    if (window.innerWidth <= 768) setIsSidebarCollapsed(true);
  };

  const handleNewChat = () => {
    const update = () => {
      setSelectedSession(null);
      localStorage.removeItem('last_session_v2');
      setIsLiveMode(false);
      setInitialPrompt(null);
    };
    // View Transitions API (2026 standard)
    if (document.startViewTransition) {
       // View Transitions API (2026 standard)
       document.startViewTransition(update);
    } else {
       update();
    }
  };

  const handlePromptSubmit = (text: string) => {
    if (!text.trim()) return;
    
    if (!selectedSession) {
      const defaultProject = projects[0] || { path: '/', name: 'default' };
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
    } else {
      // Force terminal mode and send prompt
      setInitialPrompt(text);
      if (!isLiveMode) setIsLiveMode(true);
    }
  };

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
      <button 
        className="mobile-hamburger" 
        aria-label="Toggle Sidebar"
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
      />

      <div className="main-content">
        <Header 
          selectedSession={selectedSession}
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
                 <Terminal 
                   uuid={selectedSession.id} 
                   projectPath={selectedSession.projectPath} 
                   initialPrompt={initialPrompt}
                   theme={theme}
                   onSendToChat={handlePromptSubmit}
                 />
              </div>
            </div>
          ) : (
            <WelcomeScreen onHandlePromptSubmit={handlePromptSubmit} />
          )}
        </div>

        {!isLiveMode && (
          <PromptBox onSubmit={handlePromptSubmit} />
        )}
      </div>
    </div>
  );
}

export default App;
