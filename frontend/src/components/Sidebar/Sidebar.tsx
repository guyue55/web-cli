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
        <button className="sidebar-toggle-btn" onClick={onToggle} title="Toggle Sidebar">☰</button>

        <button 
          className={`new-chat-btn-official ${collapsed ? 'is-mini' : ''}`} 
          onClick={onNewChat}
          title={collapsed ? "发起新对话" : undefined}
        >
          <span className="plus-icon">＋</span>
          {!collapsed && <span>发起新对话</span>}
        </button>

        {!collapsed && (
          <div className="sidebar-search-container">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              className="sidebar-search-input" 
              placeholder="搜索会话..." 
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="search-clear-btn" 
                onClick={() => onSearchChange('')}
                title="清空搜索"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>

      <div className="sidebar-mid session-list-container">
        {!collapsed && <div className="sidebar-section-label">最近</div>}
        
        {groupedHistory.length === 0 && isLoading ? (
          <div className="skeleton-list">
             {[1,2,3].map(i => <div key={i} className="skeleton-item" style={{ height: 32, margin: '4px 10px', borderRadius: 16, backgroundColor: 'var(--bg-hover)' }} />)}
          </div>
        ) : groupedHistory.map(({ name: projectName, items }) => {
          const project = projects.find(p => p.name === projectName);
          const filteredItems = items.filter(item => 
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
          );

          if (searchQuery && filteredItems.length === 0) return null;

          const anyActive = filteredItems.some(item => 
            activeSessions.includes(`${item.projectPath}:${item.id}`)
          );

          const isProjectCollapsed = searchQuery ? false : (collapsedProjects[projectName] !== false);

          return (
            <div key={projectName} className="project-group">
              {!collapsed && (
                <div 
                  className={`project-label collapsible ${isProjectCollapsed ? 'is-collapsed' : ''}`} 
                  onClick={() => toggleProject(projectName)}
                  title={`路径: ${project?.path || 'N/A'}`}
                >
                  <span className="project-icon">📁</span>
                  <span className="project-name-text">{projectName}</span>
                  
                  <div className="project-meta-indicators">
                    {anyActive && isProjectCollapsed && (
                      <span className="active-status-dot-mini" />
                    )}
                    <span className="session-count-badge">{filteredItems.length}</span>
                    <span className="chevron-icon">▼</span>
                  </div>
                </div>
              )}
              
              {!collapsed && (
                <div className={`project-session-container ${isProjectCollapsed ? 'is-collapsed' : ''}`}>
                  <div className="project-session-inner">
                    <ul className="session-list">
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
                  </div>
                </div>
              )}

              {collapsed && (
                <div className="collapsed-project-indicator" title={`${projectName}${anyActive ? ' (有活动会话)' : ''}`}>
                   <div style={{ position: 'relative', display: 'inline-block' }}>
                     📁
                     {anyActive && <span className="active-status-dot-mini" style={{ position: 'absolute', top: -2, right: -2 }} />}
                   </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sidebar-bottom">
         {!collapsed && (
           <div className="sidebar-item-static">
             <span>⚙️</span> 设置和帮助
           </div>
         )}
      </div>
    </div>
  );
};
