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

  const handleSelectSession = (session: HistoryItem) => {
    setSelectedSession(session);
    setIsLiveMode(false);
  };

  return (
    <div className="app-container">
      <Sidebar 
        groupedHistory={groupedHistory}
        activeSessions={activeSessions}
        projects={projects}
        selectedSession={selectedSession}
        onSelectSession={handleSelectSession}
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
             {isDiscovering && <span className="scanning-indicator">Scanning Projects...</span>}
          </div>
          <div className="header-actions">
             {selectedSession && (
               <button 
                 className={`mode-toggle ${isLiveMode ? 'active' : ''}`}
                 onClick={() => setIsLiveMode(!isLiveMode)}
               >
                 {isLiveMode ? 'Exit Terminal' : 'Open Live Terminal'}
               </button>
             )}
          </div>
        </header>

        <div className="content-area">
          {selectedSession ? (
            <>
              {isLiveMode ? (
                <div className="terminal-container" style={{ height: '100%', background: '#000' }}>
                   <Terminal uuid={selectedSession.id} projectPath={selectedSession.projectPath} />
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
               <p style={{ color: 'var(--text-secondary)' }}>Choose a session to begin coding.</p>
               {isDiscovering && <p style={{ fontSize: '12px', marginTop: '20px' }}>Looking for your projects...</p>}
            </div>
          )}
        </div>

        {selectedSession && !isLiveMode && (
          <div className="prompt-container">
            <input 
              className="prompt-input" 
              type="text" 
              placeholder="Ask me anything about your project..." 
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsLiveMode(true);
              }}
            />
            <div className="prompt-actions">
               <button className="icon-btn">🎤</button>
               <button className="icon-btn">🖼️</button>
               <button className="icon-btn" style={{ color: 'var(--accent-blue)' }}>▲</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
