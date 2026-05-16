import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectEntry } from '../../hooks/useSessions';
import { ApiService } from '../../services/ApiService';

interface WelcomeScreenProps {
  onHandlePromptSubmit: (cmd: string) => void;
  projects: ProjectEntry[];
  workspaceRoots: { name: string; path: string }[];
  selectedProjectPath: string;
  defaultWorkspaceRoot: { name: string; path: string } | null;
  onProjectChange: (projectPath: string) => void;
  onAddProject: (projectPath: string, name: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onHandlePromptSubmit,
  projects,
  workspaceRoots,
  selectedProjectPath,
  defaultWorkspaceRoot,
  onProjectChange,
  onAddProject,
}) => {
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isBrowsingFolders, setIsBrowsingFolders] = useState(false);
  const [browserPath, setBrowserPath] = useState('');
  const [browserEntries, setBrowserEntries] = useState<{ name: string; isDirectory: boolean; path: string }[]>([]);
  const [isLoadingBrowser, setIsLoadingBrowser] = useState(false);
  const [browserError, setBrowserError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setIsProjectMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedProject = useMemo(() => (
    projects.find(project => project.path === selectedProjectPath) || null
  ), [projects, selectedProjectPath]);

  const projectSummaryTitle = selectedProject
    ? selectedProject.name
    : '默认工作区';

  const projectSummaryDescription = selectedProject
    ? selectedProjectPath
    : `${defaultWorkspaceRoot?.path || workspaceRoots[0]?.path || '当前工作目录'} · 将自动创建新文件夹`;

  const browserRoots = useMemo(() => (
    workspaceRoots.length > 0
      ? workspaceRoots
      : defaultWorkspaceRoot
        ? [defaultWorkspaceRoot]
        : []
  ), [defaultWorkspaceRoot, workspaceRoots]);

  const selectedBrowserRoot = useMemo(() => {
    if (!browserPath) return null;
    return browserRoots.find((root) => browserPath === root.path || browserPath.startsWith(`${root.path}/`)) || null;
  }, [browserPath, browserRoots]);

  const navigateBrowserTo = async (nextPath: string) => {
    setBrowserPath(nextPath);
    setIsLoadingBrowser(true);
    setBrowserError(null);
    try {
      const entries = await ApiService.getFiles(nextPath);
      setBrowserEntries(entries.filter((entry) => entry.isDirectory).sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setBrowserEntries([]);
      setBrowserError('目录读取失败，请确认当前路径在允许的工作区内。');
    } finally {
      setIsLoadingBrowser(false);
    }
  };

  const openFolderBrowser = () => {
    setIsProjectMenuOpen(false);
    setIsBrowsingFolders(true);
    setBrowserError(null);
    setBrowserEntries([]);
    const initialPath = selectedProjectPath || defaultWorkspaceRoot?.path || browserRoots[0]?.path || '';
    if (initialPath) {
      navigateBrowserTo(initialPath).catch(() => undefined);
    } else {
      setBrowserPath('');
    }
  };

  const confirmBrowserSelection = () => {
    if (!browserPath) return;
    try {
      const segments = browserPath.split('/').filter(Boolean);
      const name = segments[segments.length - 1] || browserPath;
      onAddProject(browserPath, name);
      onProjectChange(browserPath);
      setIsProjectMenuOpen(false);
      setIsBrowsingFolders(false);
    } catch {
      setBrowserError('选择项目目录失败。');
    }
  };

  const actions = [
    {
      title: '开始新会话',
      desc: '创建一个全新的 Gemini 交互式执行环境',
      cmd: '/new',
      icon: 'add_circle'
    },
    {
      title: '获取帮助',
      desc: '查看所有可用的指令和功能说明',
      cmd: '/help',
      icon: 'help_center'
    },
    {
      title: '查看记忆',
      desc: '查看 Gemini 对当前项目的理解和记忆',
      cmd: '/memory show',
      icon: 'neurology'
    },
    {
      title: '技能列表',
      desc: '列出所有可用的代理技能和工具',
      cmd: '/skills list',
      icon: 'bolt'
    }
  ];

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-header">
          <div className="welcome-logo">
            Gemini
          </div>
          <h1>欢迎使用 Gemini Web CLI</h1>
          <p>智能、快速、可视化的终端执行环境</p>
        </div>

        <div className="welcome-project-picker">
          <div className="project-picker-copy">
            <span className="material-symbols-outlined">folder_managed</span>
            <div>
              <span className="project-picker-label">新会话项目</span>
              <strong>{projectSummaryTitle}</strong>
              <small>{projectSummaryDescription}</small>
            </div>
          </div>
          <div className="project-picker-actions">
            <button
              ref={triggerRef}
              className="project-picker-trigger"
              type="button"
              onClick={() => setIsProjectMenuOpen((open) => !open)}
              aria-expanded={isProjectMenuOpen}
            >
              <span>{selectedProject ? '切换项目' : '默认工作区'}</span>
              <span className="material-symbols-outlined">expand_more</span>
            </button>

            {isProjectMenuOpen && (
              <div ref={menuRef} className="project-picker-menu">
                <button
                  type="button"
                  className={`project-picker-option ${selectedProjectPath ? '' : 'active'}`}
                  onClick={() => {
                    onProjectChange('');
                    setIsProjectMenuOpen(false);
                  }}
                >
                  <div>
                    <strong>默认工作区</strong>
                    <span>{defaultWorkspaceRoot?.path || workspaceRoots[0]?.path || '当前工作目录'} 下自动创建新文件夹</span>
                  </div>
                </button>

                {projects.length > 0 && (
                  <div className="project-picker-section">
                    <span className="project-picker-section-label">已有项目</span>
                    <div className="project-picker-option-list">
                      {projects.map((project) => (
                        <button
                          key={project.path}
                          type="button"
                          className={`project-picker-option ${selectedProjectPath === project.path ? 'active' : ''}`}
                          onClick={() => {
                            onProjectChange(project.path);
                            setIsProjectMenuOpen(false);
                          }}
                        >
                          <div>
                            <strong>{project.name}</strong>
                            <span>{project.path}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="project-picker-section">
                  <div className="project-picker-inline-actions">
                    <button type="button" className="project-picker-secondary-btn" onClick={openFolderBrowser}>
                      <span className="material-symbols-outlined">create_new_folder</span>
                      <span>添加项目</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="quick-actions-grid">
          {actions.map((action) => (
            <div 
              key={action.cmd} 
              className="action-card"
              onClick={() => onHandlePromptSubmit(action.cmd)}
            >
              <div className="action-icon">
                <span className="material-symbols-outlined">{action.icon}</span>
              </div>
              <h3>{action.title}</h3>
              <p>{action.desc}</p>
              <div className="action-footer">
                <code>{action.cmd}</code>
                <span className="material-symbols-outlined">arrow_forward</span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="welcome-footer">
          <p>提示：你可以直接在终端输入指令，或点击上方卡片快速开始。</p>
        </div>
      </div>

      {isBrowsingFolders && (
        <div className="project-browser-modal-backdrop" onClick={() => setIsBrowsingFolders(false)}>
          <div className="project-browser-modal" onClick={(event) => event.stopPropagation()}>
            <div className="project-browser-modal-header">
              <div>
                <span className="project-picker-label">添加项目</span>
                <strong>选择一个目录作为新项目</strong>
              </div>
              <button
                type="button"
                className="project-browser-close-btn"
                onClick={() => setIsBrowsingFolders(false)}
                aria-label="关闭目录选择弹窗"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="project-browser-panel">
              <div className="project-browser-toolbar">
                <button
                  type="button"
                  className="project-browser-nav-btn"
                  onClick={() => {
                    if (!selectedBrowserRoot || browserPath === selectedBrowserRoot.path) {
                      setBrowserPath('');
                      setBrowserEntries([]);
                      return;
                    }
                    const nextPath = browserPath.split('/').slice(0, -1).join('/') || selectedBrowserRoot.path;
                    navigateBrowserTo(nextPath).catch(() => undefined);
                  }}
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="project-browser-path">
                  {browserPath || '选择工作区'}
                </div>
              </div>

              {browserPath ? (
                <div className="project-browser-directory-list">
                  {isLoadingBrowser ? (
                    <div className="project-browser-empty">正在读取目录...</div>
                  ) : browserEntries.length === 0 ? (
                    <div className="project-browser-empty">当前目录下没有可继续进入的子目录。</div>
                  ) : (
                    browserEntries.map((entry) => (
                      <button
                        key={entry.path}
                        type="button"
                        className="project-browser-directory"
                        onClick={() => { navigateBrowserTo(entry.path).catch(() => undefined); }}
                      >
                        <span className="material-symbols-outlined">folder</span>
                        <div>
                          <strong>{entry.name}</strong>
                          <span>{entry.path}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="project-browser-root-list compact">
                  {browserRoots.map((root) => (
                    <button
                      key={root.path}
                      type="button"
                      className="project-browser-root"
                      onClick={() => { navigateBrowserTo(root.path).catch(() => undefined); }}
                    >
                      <strong>{root.name}</strong>
                      <span>{root.path}</span>
                    </button>
                  ))}
                </div>
              )}

              {browserError && <div className="project-create-error">{browserError}</div>}

              <div className="project-browser-footer">
                <button
                  type="button"
                  className="project-picker-secondary-btn"
                  onClick={() => setIsBrowsingFolders(false)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="project-create-btn"
                  onClick={confirmBrowserSelection}
                  disabled={!browserPath}
                >
                  选择此目录
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
