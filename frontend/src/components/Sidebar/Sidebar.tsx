import React from 'react';
import type { HistoryItem, ProjectEntry } from '../../hooks/useSessions';

interface SidebarProps {
  groupedHistory: Record<string, HistoryItem[]>;
  activeSessions: string[];
  projects: ProjectEntry[];
  selectedSession: HistoryItem | null;
  onSelectSession: (session: HistoryItem) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  groupedHistory,
  activeSessions,
  projects,
  selectedSession,
  onSelectSession,
  searchQuery,
  onSearchChange,
  isLoading,
  collapsed,
  onToggle
}) => {
  return (
    <div className={`sidebar-wrapper ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <button className="icon-btn" onClick={onToggle}>☰</button>
        {!collapsed && <button className="new-chat-btn">＋ New Chat</button>}
      </div>

      <div className="session-list-container">
        {Object.keys(groupedHistory).length === 0 && isLoading ? (
          <div className="skeleton-list">
             {[1,2,3].map(i => <div key={i} className="skeleton-item" style={{ height: 40, margin: 10, borderRadius: 10, backgroundColor: 'var(--bg-hover)' }} />)}
          </div>
        ) : Object.entries(groupedHistory).map(([projectName, items]) => {
          const project = projects.find(p => p.name === projectName);
          return (
            <div key={projectName} className="project-group">
              {!collapsed && (
                <div className="project-label" style={{ 
                  fontSize: '10px', 
                  color: 'var(--text-secondary)', 
                  padding: '16px 12px 8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{projectName}</span>
                  {project?.isScanning && (
                    <div className="tiny-spinner" style={{ 
                      width: 8, height: 8, border: '1px solid #444', borderTopColor: '#888', borderRadius: '50%', animation: 'spin 0.5s linear infinite'
                    }} />
                  )}
                </div>
              )}
              <ul className="session-list">
                {items.map((item) => {
                  const isActive = activeSessions.includes(`${item.projectPath}:${item.index}`);
                  return (
                    <li 
                      key={item.id} 
                      className={item.id === selectedSession?.id ? 'active' : ''}
                      onClick={() => onSelectSession(item)}
                      title={item.name}
                    >
                      {!collapsed && <span className="history-name">{item.name}</span>}
                      {collapsed ? (
                        <span className="icon">💬</span>
                      ) : (
                        <div className="history-footer">
                          <span>{item.time}</span>
                          {isActive && <div className="active-dot" />}
                        </div>
                      )}
                    </li>                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};
