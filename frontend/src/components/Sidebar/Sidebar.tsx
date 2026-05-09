import React from 'react';
import type { HistoryItem, ProjectEntry } from '../../hooks/useSessions';

interface SidebarProps {
  groupedHistory: { name: string, items: HistoryItem[] }[];
  activeSessions: string[];
  projects: ProjectEntry[];
  selectedSession: HistoryItem | null;
  onSelectSession: (session: HistoryItem) => void;
  onNewChat: () => void;
  onDeleteSession: (session: HistoryItem) => void;
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
  onNewChat,
  onDeleteSession,
  searchQuery,
  isLoading,
  collapsed,
  onToggle
}) => {
  return (
    <div className={`sidebar-wrapper ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-top">
        <button className="icon-btn" onClick={onToggle} title="Toggle Sidebar" style={{ marginBottom: 12 }}>☰</button>
        {!collapsed && (
          <>
            <button className="new-chat-btn" onClick={onNewChat}>
              <span>＋</span> 发起新对话
            </button>
            <div className="sidebar-item-static">
              <span>🏠</span> 我的内容
            </div>
            <div style={{ marginTop: 12, padding: '0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>笔记本</div>
            <div className="sidebar-item-static">
              <span>📖</span> Untitled notebook
            </div>
            <div className="sidebar-item-static">
              <span>＋</span> 新建笔记本
            </div>
          </>
        )}
      </div>

      <div className="sidebar-mid session-list-container">
        {!collapsed && <div style={{ marginTop: 12, padding: '0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>最近</div>}
        {groupedHistory.length === 0 && isLoading ? (
          <div className="skeleton-list">
             {[1,2,3].map(i => <div key={i} className="skeleton-item" style={{ height: 40, margin: 10, borderRadius: 10, backgroundColor: 'var(--bg-hover)' }} />)}
          </div>
        ) : groupedHistory.map(({ name: projectName, items }) => {
          const project = projects.find(p => p.name === projectName);
          const filteredItems = items.filter(item => 
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
          );

          if (searchQuery && filteredItems.length === 0) return null;

          return (
            <div key={projectName} className="project-group">
              {!collapsed && (
                <div className="project-label">
                  <span>{projectName}</span>
                  {project?.isScanning && <div className="tiny-spinner" />}
                </div>
              )}
              <ul className="session-list">
                {filteredItems.map((item) => {
                  const isActive = activeSessions.includes(`${item.projectPath}:${item.id}`);
                  return (
                    <li 
                      key={item.id} 
                      className={`session-card ${item.id === selectedSession?.id ? 'active' : ''}`}
                      onClick={() => onSelectSession(item)}
                      title={item.name}
                    >
                      <div className="card-main">
                        {!collapsed && <span className="history-name">{item.name}</span>}
                        {collapsed ? (
                          <span className="icon">💬</span>
                        ) : (
                          <button 
                            className="delete-btn" 
                            title="Delete Session"
                            onClick={(e) => {
                               e.stopPropagation();
                               onDeleteSession(item);
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      
                      {!collapsed && (
                        <div className="history-footer">
                          <span>{item.time}</span>
                          {isActive && <div className="active-dot" />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {!collapsed && (
        <div className="sidebar-bottom">
           <div className="sidebar-item-static">
             <span>⚙️</span> 设置和帮助
           </div>
        </div>
      )}
    </div>
  );
};
