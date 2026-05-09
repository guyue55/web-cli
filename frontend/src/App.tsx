import React, { useState } from 'react';
import Terminal from './components/Terminal';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatHistory } from './components/Chat/ChatHistory';
import { useSessions, type HistoryItem } from './hooks/useSessions';
import { useTranscript } from './hooks/useTranscript';
import './App.css';

function App() {
  const { activeSessions, projects, groupedHistory, isDiscovering } = useSessions();
  const [selectedSession, setSelectedSession] = useState<HistoryItem | null>(null);
  const { transcript, isLoading: isLoadingTranscript, hasMore, loadMore } = useTranscript(selectedSession);
  
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  const handleSelectSession = (session: HistoryItem) => {
    setSelectedSession(session);
    setIsLiveMode(false);
    setInitialPrompt(null);
  };

  const handleNewChat = () => {
    // Start a new session in the first project by default, or current project
    const defaultProject = projects[0] || { path: window.location.pathname, name: 'default' };
    const newSession: HistoryItem = {
      id: `new-${Date.now()}`,
      name: 'New Chat',
      projectPath: defaultProject.path,
      projectName: defaultProject.name,
      index: '0',
      time: 'Just now',
      updatedAt: Date.now()
    };
    setSelectedSession(newSession);
    setIsLiveMode(true); // Jump straight to terminal for new chat
    setInitialPrompt(null);
  };

  const handlePromptSubmit = (text: string) => {
    if (!text.trim()) return;
    
    if (!selectedSession) {
      // If no session selected, start a new one with this prompt
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
      setIsLiveMode(true);
    } else {
      setInitialPrompt(text);
      setIsLiveMode(true);
    }
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
        onSearchChange={setSearchQuery}
        isLoading={isDiscovering}
        collapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className="main-content">
        <header className="header">
          <div className="header-left">
             <h1>{selectedSession?.name || 'Gemini'}</h1>
             {isDiscovering && <span className="scanning-indicator">Streaming Discovery...</span>}
          </div>
          <div className="header-actions">
             {selectedSession && (
               <div className="header-tabs">
                 <button 
                   className={`tab-btn ${!isLiveMode ? 'active' : ''}`}
                   onClick={() => setIsLiveMode(false)}
                 >
                   History
                 </button>
                 <button 
                   className={`tab-btn ${isLiveMode ? 'active' : ''}`}
                   onClick={() => setIsLiveMode(true)}
                 >
                   Live Agent
                 </button>
               </div>
             )}
          </div>
        </header>

        <div className="content-area">
          {selectedSession ? (
            <>
              {isLiveMode ? (
                <div className="terminal-container" style={{ height: '100%', background: '#000' }}>
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
               <h2>Hello, I'm Gemini</h2>
               <p style={{ color: 'var(--text-secondary)' }}>Choose a session or type below to start coding.</p>
               {isDiscovering && <p style={{ fontSize: '12px', marginTop: '20px' }}>Looking for your projects...</p>}
            </div>
          )}
        </div>

        {!isLiveMode && (
          <div className="prompt-container">
            <input 
              className="prompt-input" 
              type="text" 
              placeholder="Ask me anything about your project..." 
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePromptSubmit((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
            <div className="prompt-actions">
               <button className="icon-btn" title="Voice">🎤</button>
               <button className="icon-btn" title="Image">🖼️</button>
               <button 
                  className="icon-btn send-btn" 
                  style={{ color: 'var(--accent-blue)' }}
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement;
                    handlePromptSubmit(input.value);
                    input.value = '';
                  }}
                >
                  ▲
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
