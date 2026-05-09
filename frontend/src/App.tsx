import { useState } from 'react';
import Terminal from './components/Terminal';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatHistory } from './components/Chat/ChatHistory';
import { PromptBox } from './components/PromptBox/PromptBox';
import { useSessions, type HistoryItem } from './hooks/useSessions';
import { useTranscript } from './hooks/useTranscript';
import { useTheme } from './hooks/useTheme';
import './App.css';

function App() {
  const { activeSessions, projects, groupedHistory, isDiscovering } = useSessions();
  const [selectedSession, setSelectedSession] = useState<HistoryItem | null>(null);
  const { transcript, isLoading: isLoadingTranscript, hasMore, loadMore } = useTranscript(selectedSession);
  const { theme, toggleTheme } = useTheme();
  
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [searchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  const handleSelectSession = (session: HistoryItem) => {
    setSelectedSession(session);
    setIsLiveMode(false);
    setInitialPrompt(null);
    if (window.innerWidth <= 768) setIsSidebarCollapsed(true);
  };

  const handleNewChat = () => {
    const defaultProject = projects[0] || { path: window.location.pathname, name: 'default' };
    const newSession: HistoryItem = {
      id: `new-${Date.now()}`,
      name: '新对话',
      projectPath: defaultProject.path,
      projectName: defaultProject.name,
      index: '0',
      time: 'Just now',
      updatedAt: Date.now()
    };
    setSelectedSession(newSession);
    setIsLiveMode(true);
    setInitialPrompt(null);
    if (window.innerWidth <= 768) setIsSidebarCollapsed(true);
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
      setInitialPrompt(text);
    } else {
      setInitialPrompt(text);
    }
    setIsLiveMode(true);
  };

  return (
    <div className="app-container">
      <Sidebar 
        groupedHistory={groupedHistory}
        activeSessions={activeSessions}
        projects={projects}
        selectedSession={selectedSession}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        searchQuery={searchQuery}
        isLoading={isDiscovering}
        collapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className="main-content">
        <header className="header">
          <div className="header-left">
             <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--accent-blue)' }}>Gemini</span>
          </div>
          
          <h1>{selectedSession?.name || 'Gemini'}</h1>
          
          <div className="header-right">
             <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
                {theme === 'dark' ? '☀️' : '🌙'}
             </button>
             {selectedSession && (
               <div className="header-tabs">
                 <button 
                   className={`tab-btn ${!isLiveMode ? 'active' : ''}`}
                   onClick={() => setIsLiveMode(false)}
                 >
                   历史
                 </button>
                 <button 
                   className={`tab-btn ${isLiveMode ? 'active' : ''}`}
                   onClick={() => setIsLiveMode(true)}
                 >
                   交互
                 </button>
               </div>
             )}
          </div>
        </header>

        <div className="content-area">
          {selectedSession ? (
            <>
              {isLiveMode ? (
                <div className="terminal-container">
                   <Terminal 
                     uuid={selectedSession.id} 
                     projectPath={selectedSession.projectPath} 
                     initialPrompt={initialPrompt}
                   />
                </div>
              ) : (
                <ChatHistory 
                  transcript={transcript}
                  isLoading={isLoadingTranscript}
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                  onStartLive={() => setIsLiveMode(true)}
                />
              )}
            </>
          ) : (
            <div className="welcome-screen">
               <div className="welcome-icon">✦</div>
               <h2>您好，我是 Gemini</h2>
               <p style={{ color: 'var(--text-secondary)' }}>请选择一个项目会话或在下方输入以开始编码。</p>
            </div>
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
