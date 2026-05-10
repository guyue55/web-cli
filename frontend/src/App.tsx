import { useState } from 'react';
import Terminal from './components/Terminal/Terminal';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  const handleSelectSession = (session: HistoryItem) => {
    setSelectedSession(session);
    setIsLiveMode(false);
    setInitialPrompt(null);
    if (window.innerWidth <= 768) setIsSidebarCollapsed(true);
  };

  const handleNewChat = () => {
    setSelectedSession(null);
    setIsLiveMode(false);
    setInitialPrompt(null);
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
        <header className="header">
          <div className="header-left">
             <span className="brand-logo">
               Gemini
               <span className="material-symbols-outlined sparkles-icon">sparkles</span>
             </span>
          </div>
          
          <div className="header-center">
            <h1>{selectedSession?.name || 'Gemini'}</h1>
          </div>
          
          <div className="header-right">
             <button className="theme-toggle" onClick={toggleTheme} title="切换主题">
                <span className="material-symbols-outlined">
                   {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                </span>
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

        <div className={`content-area ${isLiveMode ? 'live-mode' : ''}`}>
          {selectedSession ? (
            <>
              {isLiveMode ? (
                <div className="terminal-container">
                   <Terminal 
                     uuid={selectedSession.id} 
                     projectPath={selectedSession.projectPath} 
                     initialPrompt={initialPrompt}
                     theme={theme}
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
               <div className="welcome-greeting">
                 <h2 className="gradient-text">您好，开发者</h2>
                 <p className="subtitle">我是您的 Gemini 代码助手。今天想做些什么？</p>
               </div>
               
               <div className="suggestion-grid">
                  <div className="suggestion-card" onClick={() => handlePromptSubmit("帮我分析当前项目的架构")}>
                     <span className="card-icon">🏗️</span>
                     <p>分析项目架构</p>
                  </div>
                  <div className="suggestion-card" onClick={() => handlePromptSubmit("检查代码中的潜在漏洞")}>
                     <span className="card-icon">🛡️</span>
                     <p>安全漏洞检查</p>
                  </div>
                  <div className="suggestion-card" onClick={() => handlePromptSubmit("为我编写单元测试")}>
                     <span className="card-icon">🧪</span>
                     <p>编写单元测试</p>
                  </div>
                  <div className="suggestion-card" onClick={() => handlePromptSubmit("重构并优化这段逻辑")}>
                     <span className="card-icon">⚡</span>
                     <p>重构优化代码</p>
                  </div>
               </div>
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
