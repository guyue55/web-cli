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
        <button className="icon-btn" onClick={onToggle} title="Toggle Sidebar" style={{ marginBottom: 8 }}>☰</button>
        {!collapsed && (
          <>
            <button className="new-chat-btn" onClick={onNewChat}>
              <span>＋</span> 发起新对话
            </button>
            <div className="sidebar-item-static">
              <span>🏠</span> 我的内容
            </div>
          </>
        )}
      </div>

      <div className="sidebar-mid session-list-container">
        {!collapsed && <div style={{ marginTop: 16, padding: '0 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>最近</div>}
        
        {groupedHistory.length === 0 && isLoading ? (
          <div className="skeleton-list">
             {[1,2,3].map(i => <div key={i} className="skeleton-item" style={{ height: 40, margin: '8px 10px', borderRadius: 20, backgroundColor: 'var(--bg-hover)' }} />)}
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
              <ul className="session-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {filteredItems.map((item) => {
                  const isActive = activeSessions.includes(`${item.projectPath}:${item.id}`);
                  // Enhanced title for hover info
                  const hoverInfo = `${item.name}\n时间: ${item.time}\n路径: ${item.projectPath}`;
                  
                  return (
                    <li 
                      key={item.id} 
                      className={`session-card ${item.id === selectedSession?.id ? 'active' : ''}`}
                      onClick={() => onSelectSession(item)}
                      title={hoverInfo}
                    >
                      <div className="card-main">
                        {!collapsed && <span className="history-name">{item.name}</span>}
                        {collapsed && (
                          <span style={{ fontSize: 16 }}>💬</span>
                        )}
                      </div>
                      
                      {!collapsed && isActive && (
                        <div className="history-footer">
                          <div className="active-dot" style={{ width: 6, height: 6, backgroundColor: '#10b981', borderRadius: '50%', boxShadow: '0 0 4px #10b981' }} />
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
