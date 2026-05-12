import React, { useState, useEffect, useRef } from 'react';
import type { HistoryItem, ProjectEntry } from '../../hooks/useSessions';
import { ApiService } from '../../services/ApiService';

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
  renameSessionLocal: (id: string, name: string) => void;
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
  onToggle,
  renameSessionLocal
}) => {
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('gemini-collapsed-projects');
    return saved ? JSON.parse(saved) : {};
  });

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('gemini-collapsed-projects', JSON.stringify(collapsedProjects));
  }, [collapsedProjects]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleProject = (projectName: string) => {
    setCollapsedProjects(prev => ({
      ...prev,
      [projectName]: !prev[projectName]
    }));
  };

  const handleStartRename = (e: React.MouseEvent, item: HistoryItem) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditName(item.name);
  };

  const handleConfirmRename = async (item: HistoryItem) => {
    if (!editName.trim() || editName === item.name) {
      setEditingId(null);
      return;
    }
    try {
      await ApiService.renameSession(item.id, item.projectName, editName);
      renameSessionLocal(item.id, editName);
      setEditingId(null);
    } catch {
      alert('重命名失败');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, item: HistoryItem) => {
    if (e.key === 'Enter') handleConfirmRename(item);
    if (e.key === 'Escape') setEditingId(null);
  };

  return (
    <div className={`sidebar-wrapper ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-top">
        <button className="sidebar-toggle-btn" onClick={onToggle} title="Toggle Sidebar">
          <span className="material-symbols-outlined">menu</span>
        </button>

        <button 
          className={`new-chat-btn-official ${collapsed ? 'is-mini' : ''}`} 
          onClick={onNewChat}
          title={collapsed ? "发起新对话" : undefined}
        >
          <span className="material-symbols-outlined plus-icon">add</span>
          {!collapsed && <span>发起新对话</span>}
        </button>

        {!collapsed && (
          <div className="sidebar-search-container">
            <span className="material-symbols-outlined search-icon" style={{ fontSize: 20 }}>search</span>
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
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
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
                  <span className="material-symbols-outlined project-icon" style={{ fontSize: 18 }}>folder</span>
                  <span className="project-name-text">{projectName}</span>
                  
                  <div className="project-meta-indicators">
                    {anyActive && isProjectCollapsed && (
                      <span className="active-status-dot-mini" />
                    )}
                    <span className="session-count-badge">{filteredItems.length}</span>
                    <span className="material-symbols-outlined chevron-icon" style={{ fontSize: 16 }}>expand_more</span>
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
                            className={`session-card ${item.id === selectedSession?.id ? 'active' : ''} ${editingId === item.id ? 'editing' : ''}`}
                            onClick={() => editingId !== item.id && onSelectSession(item)}
                            title={hoverInfo}
                          >
                            {editingId === item.id ? (
                              <input 
                                className="rename-input"
                                autoFocus
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={() => handleConfirmRename(item)}
                                onKeyDown={(e) => handleKeyDown(e, item)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <>
                                <span className="history-name">{item.name}</span>
                                <div className="session-actions">
                                   <button className="rename-btn" onClick={(e) => handleStartRename(e, item)}>
                                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                   </button>
                                   {isActive && (
                                     <div className="active-dot" style={{ flexShrink: 0, width: 6, height: 6, backgroundColor: '#10b981', borderRadius: '50%', boxShadow: '0 0 4px #10b981' }} />
                                   )}
                                </div>
                              </>
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
                     <span className="material-symbols-outlined">folder</span>
                     {anyActive && <span className="active-status-dot-mini" style={{ position: 'absolute', top: -2, right: -2 }} />}
                   </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sidebar-bottom">
          <div className="sidebar-bottom-container" ref={menuRef}>
            {isMenuOpen && (
              <div className="sidebar-floating-menu glass-effect">
                <div className="menu-item" onClick={() => { setIsMenuOpen(false); }}>
                  <span className="material-symbols-outlined">help</span>
                  <span>帮助 (Help)</span>
                </div>
                <div className="menu-item" onClick={() => { setIsMenuOpen(false); }}>
                  <span className="material-symbols-outlined">history</span>
                  <span>活动 (Activity)</span>
                </div>
                <div className="menu-divider" />
                <div className="menu-item" onClick={() => { setIsMenuOpen(false); }}>
                  <span className="material-symbols-outlined">settings</span>
                  <span>设置 (Settings)</span>
                </div>
              </div>
            )}
            <div 
              className={`sidebar-item-static settings-btn ${isMenuOpen ? 'active' : ''}`} 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="设置"
            >
               <span className="icon-span">
                 <span className="material-symbols-outlined">settings</span>
               </span>
               {!collapsed && <span>设置</span>}
            </div>
          </div>
      </div>
    </div>
  );
};