import React, { useState, useEffect } from 'react';
import type { HistoryItem, ProjectEntry } from '../../hooks/useSessions';

interface SidebarProps {
  groupedHistory: { name: string, items: HistoryItem[] }[];
  activeSessions: string[];
  projects: ProjectEntry[];
  selectedSession: HistoryItem | null;
  onSelectSession: (session: HistoryItem) => void;
  onNewChat: () => void;
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
  searchQuery,
  onSearchChange,
  isLoading,
  collapsed,
  onToggle
}) => {
  // Track collapse state for each project, default to true (collapsed)
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('gemini-collapsed-projects');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('gemini-collapsed-projects', JSON.stringify(collapsedProjects));
  }, [collapsedProjects]);

  const toggleProject = (projectName: string) => {
    setCollapsedProjects(prev => ({
      ...prev,
      [projectName]: !prev[projectName]
    }));
  };

  return (
    <div className={`sidebar-wrapper ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-top">
        <button className="icon-btn sidebar-toggle-btn" onClick={onToggle} title="Toggle Sidebar">☰</button>
        {!collapsed && (
          <>
            <button className="new-chat-btn-official" onClick={onNewChat}>
              <span className="plus-icon">＋</span> 发起新对话
            </button>
            <div className="sidebar-search-container">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                className="sidebar-search-input" 
                placeholder="搜索会话..." 
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
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

          // If not in collapsedProjects yet, default to collapsed (true)
          const isProjectCollapsed = collapsedProjects[projectName] !== false;

          return (
            <div key={projectName} className="project-group">
              {!collapsed && (
                <div 
                  className={`project-label collapsible ${isProjectCollapsed ? 'is-collapsed' : ''}`} 
                  onClick={() => toggleProject(projectName)}
                  title={`路径: ${project?.path || 'N/A'}`}
                >
                  <span className="chevron-icon">›</span>
                  <span className="project-icon">📁</span>
                  <span className="project-name-text">{projectName}</span>
                  {project?.isScanning && <div className="tiny-spinner" />}
                </div>
              )}
              
              {!isProjectCollapsed && !collapsed && (
                <ul className="session-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {filteredItems.map((item) => {
                    const isActive = activeSessions.includes(`${item.projectPath}:${item.id}`);
                    const hoverInfo = `标题: ${item.name}\n时间: ${item.time}\n项目: ${item.projectName}\n路径: ${item.projectPath}`;
                    
                    return (
                      <li 
                        key={item.id} 
                        className={`session-card ${item.id === selectedSession?.id ? 'active' : ''}`}
                        onClick={() => onSelectSession(item)}
                        title={hoverInfo}
                      >
                        <div className="card-main">
                          <span className="history-name">{item.name}</span>
                        </div>
                        
                        {isActive && (
                          <div className="history-footer">
                            <div className="active-dot" style={{ width: 6, height: 6, backgroundColor: '#10b981', borderRadius: '50%', boxShadow: '0 0 4px #10b981' }} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {collapsed && (
                <div className="collapsed-project-indicator" title={projectName}>
                   📁
                </div>
              )}
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
