import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { HistoryItem, ProjectEntry } from '../../hooks/useSessions';
import { ApiService } from '../../services/ApiService';
import type { WorkspacePanelMode } from '../Layout/WorkspacePanel';
import type { SessionMetadata } from '@web-cli/shared';
import {
  getSessionDisplayName,
  getSessionSecondaryLabel,
  isUntitledSessionName,
} from '../../utils/sessionPresentation';

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
  deleteSessionLocal: (id: string) => void;
  updateSessionMetadataLocal: (projectPath: string, id: string, metadata: SessionMetadata) => void;
  clearSessionMetadataLocal: (projectPath: string, id: string) => void;
  onOpenPanel: (mode: Exclude<WorkspacePanelMode, null>) => void;
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
  renameSessionLocal,
  deleteSessionLocal,
  updateSessionMetadataLocal,
  clearSessionMetadataLocal,
  onOpenPanel
}) => {
  const [sessionFilter, setSessionFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean | undefined>>(() => {
    const saved = localStorage.getItem('gemini-collapsed-projects');
    try {
      return saved ? JSON.parse(saved) : {};
    } catch {
      localStorage.removeItem('gemini-collapsed-projects');
      return {};
    }
  });

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const sidebarRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const sessionMenuRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; bottom: number; width: number } | null>(null);
  const [sessionMenuState, setSessionMenuState] = useState<{
    item: HistoryItem;
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    localStorage.setItem('gemini-collapsed-projects', JSON.stringify(collapsedProjects));
  }, [collapsedProjects]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideWorkspaceMenu = workspaceMenuRef.current?.contains(target);
      const clickedInsideSessionMenu = sessionMenuRef.current?.contains(target);
      const clickedSettingsButton = settingsButtonRef.current?.contains(target);
      if (!clickedInsideWorkspaceMenu && !clickedInsideSessionMenu && !clickedSettingsButton) {
        setIsMenuOpen(false);
        setSessionMenuState(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const updateMenuPosition = () => {
      const sidebarRect = sidebarRef.current?.getBoundingClientRect();
      const buttonRect = settingsButtonRef.current?.getBoundingClientRect();
      if (!sidebarRect || !buttonRect) return;

      setMenuPosition({
        left: sidebarRect.left + 12,
        bottom: window.innerHeight - buttonRect.top + 8,
        width: Math.max(sidebarRect.width - 24, 180),
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [collapsed, isMenuOpen]);

  const toggleProject = (projectName: string) => {
    setCollapsedProjects(prev => ({
      ...prev,
      [projectName]: !prev[projectName]
    }));
  };

  const openSessionMenu = (event: React.MouseEvent, item: HistoryItem) => {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const viewportPadding = 12;
    setSessionMenuState({
      item,
      top: Math.max(
        viewportPadding,
        Math.min(rect.bottom + 4, window.innerHeight - 240)
      ),
      left: Math.max(
        viewportPadding,
        Math.min(rect.right + 6, window.innerWidth - 132 - viewportPadding)
      ),
    });
  };

  const handleStartRename = (e: React.MouseEvent, item: HistoryItem) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditName(isUntitledSessionName(item.name) ? '' : item.name);
    setSessionMenuState(null);
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
      setSessionMenuState(null);
    } catch {
      alert('重命名失败');
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, item: HistoryItem) => {
    e.stopPropagation();
    const confirmed = window.confirm(`删除会话「${getSessionDisplayName(item)}」？此操作会移除 Gemini 历史记录。`);
    if (!confirmed) return;
    try {
      await ApiService.deleteSession(item.id, item.projectPath);
      deleteSessionLocal(item.id);
      clearSessionMetadataLocal(item.projectPath, item.id);
      setSessionMenuState(null);
    } catch {
      alert('删除失败');
    }
  };

  const togglePinnedSession = async (e: React.MouseEvent, item: HistoryItem) => {
    e.stopPropagation();
    const nextPinned = !item.pinned;
    try {
      const metadata = await ApiService.updateSessionMetadata(item.id, item.projectPath, { pinned: nextPinned });
      updateSessionMetadataLocal(item.projectPath, item.id, metadata);
      setSessionMenuState(current => current?.item.id === item.id ? null : current);
    } catch {
      alert('固定状态更新失败');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, item: HistoryItem) => {
    if (e.key === 'Enter') handleConfirmRename(item);
    if (e.key === 'Escape') setEditingId(null);
  };

  const toggleArchivedSession = async (e: React.MouseEvent, item: HistoryItem) => {
    e.stopPropagation();
    const nextArchived = !item.archived;
    try {
      const metadata = await ApiService.updateSessionMetadata(item.id, item.projectPath, { archived: nextArchived });
      updateSessionMetadataLocal(item.projectPath, item.id, metadata);
      setSessionMenuState(current => current?.item.id === item.id ? null : current);
    } catch {
      alert('归档状态更新失败');
    }
  };

  const editSessionTags = async (e: React.MouseEvent, item: HistoryItem) => {
    e.stopPropagation();
    const currentTags = item.tags || [];
    const nextValue = window.prompt('编辑标签，使用英文逗号分隔', currentTags.join(', '));
    if (nextValue === null) return;

    const normalizedTags = nextValue
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean)
      .slice(0, 6);

    try {
      const metadata = await ApiService.updateSessionMetadata(item.id, item.projectPath, { tags: normalizedTags });
      updateSessionMetadataLocal(item.projectPath, item.id, metadata);
      setSessionMenuState(null);
    } catch {
      alert('标签更新失败');
    }
  };

  const matchesSessionFilter = (item: HistoryItem) => {
    const isArchived = Boolean(item.archived);
    const isActive = activeSessions.includes(`${item.projectPath}:${item.id}`);

    if (sessionFilter === 'archived') return isArchived;
    if (sessionFilter === 'active') return isActive && !isArchived;
    return !isArchived;
  };

  const pinnedItems = groupedHistory
    .flatMap(group => group.items)
    .filter(item => item.pinned && matchesSessionFilter(item))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const renderSessionRow = (item: HistoryItem, key: string) => {
    const isActive = activeSessions.includes(`${item.projectPath}:${item.id}`);
    const displayName = getSessionDisplayName(item);
    const secondaryLabel = getSessionSecondaryLabel(item);
    const tags = item.tags || [];
    const isArchived = Boolean(item.archived);
    const hoverInfo = `标题: ${displayName}\n时间: ${item.time}\n项目: ${item.projectName}\n路径: ${item.projectPath}`;

    return (
      <li
        key={key}
        className={`session-card ${item.id === selectedSession?.id ? 'active' : ''} ${editingId === item.id ? 'editing' : ''} ${item.pinned ? 'pinned' : ''}`}
        onClick={() => editingId !== item.id && onSelectSession(item)}
        onKeyDown={(e) => {
          if (editingId === item.id) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectSession(item);
          }
        }}
        role="button"
        tabIndex={0}
        aria-current={item.id === selectedSession?.id ? 'page' : undefined}
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
            <div className="session-copy">
              <div className="history-title-row">
                <span className="history-name">{displayName}</span>
                {item.pinned && <span className="session-state-badge">已固定</span>}
                {isArchived && <span className="session-state-badge archived">已归档</span>}
              </div>
              <span className="history-meta">{secondaryLabel}</span>
              {tags.length > 0 && (
                <div className="session-tag-row">
                  {tags.map(tag => <span key={tag} className="session-tag">{tag}</span>)}
                </div>
              )}
            </div>
            <div className="session-card-trailing">
              {isActive && <span className="active-status-dot-mini session-active-indicator" />}
              <button
                className="session-more-btn"
                aria-label={`${displayName} 更多操作`}
                onClick={(event) => openSessionMenu(event, item)}
              >
                <span className="material-symbols-outlined">more_horiz</span>
              </button>
            </div>
          </>
        )}
      </li>
    );
  };

  return (
    <div ref={sidebarRef} className={`sidebar-wrapper ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-top">
        <button
          className="sidebar-toggle-btn"
          onClick={onToggle}
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        <button 
          className={`new-chat-btn-official ${collapsed ? 'is-mini' : ''}`} 
          onClick={onNewChat}
          title={collapsed ? "发起新对话" : undefined}
          aria-label="发起新对话"
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
        {!collapsed && (
          <div className="session-filter-row" role="tablist" aria-label="会话筛选">
            {[
              { key: 'all', label: '全部' },
              { key: 'active', label: '活动' },
              { key: 'archived', label: '归档' },
            ].map(filter => (
              <button
                key={filter.key}
                className={`session-filter-chip ${sessionFilter === filter.key ? 'active' : ''}`}
                onClick={() => setSessionFilter(filter.key as 'all' | 'active' | 'archived')}
                aria-pressed={sessionFilter === filter.key}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}

        {!collapsed && pinnedItems.length > 0 && (
          <>
            <div className="sidebar-section-label">已固定</div>
            <ul className="session-list pinned-session-list">
              {pinnedItems.map((item) => renderSessionRow(item, `pinned-${item.projectPath}-${item.id}`))}
            </ul>
          </>
        )}

        {!collapsed && <div className="sidebar-section-label">最近</div>}
        
        {groupedHistory.length === 0 && isLoading ? (
          <div className="skeleton-list">
             {[1,2,3].map(i => <div key={i} className="skeleton-item" style={{ height: 32, margin: '4px 10px', borderRadius: 16, backgroundColor: 'var(--bg-hover)' }} />)}
          </div>
        ) : groupedHistory.map(({ name: projectName, items }, projectIndex) => {
          const project = projects.find(p => p.name === projectName);
          const normalizedQuery = searchQuery.trim().toLowerCase();
          const projectMatches = normalizedQuery.length > 0 && (
            projectName.toLowerCase().includes(normalizedQuery) ||
            (project?.path || '').toLowerCase().includes(normalizedQuery)
          );
          const filteredItems = normalizedQuery.length === 0 || projectMatches
            ? items
            : items.filter(item => 
                getSessionDisplayName(item).toLowerCase().includes(normalizedQuery) ||
                item.projectName.toLowerCase().includes(normalizedQuery) ||
                item.projectPath.toLowerCase().includes(normalizedQuery) ||
                item.time.toLowerCase().includes(normalizedQuery) ||
                (item.tags || []).some(tag => tag.toLowerCase().includes(normalizedQuery))
              );
          const visibleItems = filteredItems.filter(matchesSessionFilter);

          if (searchQuery && visibleItems.length === 0) return null;
          if (!searchQuery && visibleItems.length === 0 && sessionFilter !== 'all') return null;

          const anyActive = visibleItems.some(item => 
            activeSessions.includes(`${item.projectPath}:${item.id}`)
          );

          const defaultCollapsed = !anyActive && projectIndex > 0;
          const isProjectCollapsed = normalizedQuery ? false : (collapsedProjects[projectName] ?? defaultCollapsed);

          return (
            <div key={projectName} className="project-group">
              {!collapsed && (
                <div 
                  className={`project-label collapsible ${isProjectCollapsed ? 'is-collapsed' : ''}`} 
                  onClick={() => toggleProject(projectName)}
                  title={`路径: ${project?.path || 'N/A'}`}
                  role="button"
                  tabIndex={0}
                  aria-expanded={!isProjectCollapsed}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleProject(projectName);
                    }
                  }}
                >
                  <span className="material-symbols-outlined project-icon" style={{ fontSize: 18 }}>folder</span>
                  <span className="project-name-text">{projectName}</span>
                  
                  <div className="project-meta-indicators">
                    {anyActive && isProjectCollapsed && (
                      <span className="active-status-dot-mini" />
                    )}
                    <span className="session-count-badge">{filteredItems.length}</span>
                    {sessionFilter !== 'all' && <span className="session-count-badge subtle">{visibleItems.length}</span>}
                    <span className="material-symbols-outlined chevron-icon" style={{ fontSize: 16 }}>expand_more</span>
                  </div>
                </div>
              )}
              
              {!collapsed && (
                <div className={`project-session-container ${isProjectCollapsed ? 'is-collapsed' : ''}`}>
                  <div className="project-session-inner">
                    <ul className="session-list">
                      {visibleItems.map((item) => renderSessionRow(item, item.id))}
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
          <div className="sidebar-bottom-container">
            <div 
              ref={settingsButtonRef}
              className={`sidebar-item-static settings-btn ${isMenuOpen ? 'active' : ''}`} 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="设置"
              role="button"
              tabIndex={0}
              aria-expanded={isMenuOpen}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setIsMenuOpen(!isMenuOpen);
                }
              }}
            >
               <span className="icon-span">
                 <span className="material-symbols-outlined">settings</span>
               </span>
               {!collapsed && <span>设置</span>}
            </div>
          </div>
      </div>

      {isMenuOpen && menuPosition && createPortal(
        <div
          ref={workspaceMenuRef}
          className="sidebar-floating-menu"
          style={{
            position: 'fixed',
            left: menuPosition.left,
            bottom: menuPosition.bottom,
            width: menuPosition.width,
          }}
        >
          <div className="menu-item" onClick={() => { onOpenPanel('help'); setIsMenuOpen(false); }}>
            <span className="material-symbols-outlined">help</span>
            <span>帮助</span>
          </div>
          <div className="menu-item" onClick={() => { onOpenPanel('activity'); setIsMenuOpen(false); }}>
            <span className="material-symbols-outlined">history</span>
            <span>活动</span>
          </div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={() => { onOpenPanel('settings'); setIsMenuOpen(false); }}>
            <span className="material-symbols-outlined">settings</span>
            <span>设置</span>
          </div>
        </div>,
        document.body
      )}

      {sessionMenuState && createPortal(
        <div
          ref={sessionMenuRef}
          className="session-action-menu"
          style={{
            position: 'fixed',
            top: sessionMenuState.top,
            left: sessionMenuState.left,
          }}
        >
          <div className="menu-item" onClick={(event) => handleStartRename(event, sessionMenuState.item)}>
            <span className="material-symbols-outlined">edit</span>
            <span>重命名</span>
          </div>
          <div className="menu-item" onClick={(event) => editSessionTags(event, sessionMenuState.item)}>
            <span className="material-symbols-outlined">sell</span>
            <span>编辑标签</span>
          </div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={(event) => togglePinnedSession(event, sessionMenuState.item)}>
            <span className="material-symbols-outlined">keep</span>
            <span>{sessionMenuState.item.pinned ? '取消固定' : '固定会话'}</span>
          </div>
          <div className="menu-item" onClick={(event) => toggleArchivedSession(event, sessionMenuState.item)}>
            <span className="material-symbols-outlined">archive</span>
            <span>{sessionMenuState.item.archived ? '取消归档' : '归档会话'}</span>
          </div>
          <div className="menu-divider" />
          <div className="menu-item danger" onClick={(event) => handleDeleteSession(event, sessionMenuState.item)}>
            <span className="material-symbols-outlined">delete</span>
            <span>删除</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
