import React from 'react';
import type { HistoryItem, ProjectEntry } from '../../hooks/useSessions';
import { getSessionDisplayName } from '../../utils/sessionPresentation';

export type WorkspacePanelMode = 'settings' | 'activity' | 'help' | null;

interface WorkspacePanelProps {
  mode: WorkspacePanelMode;
  theme: string;
  projects: ProjectEntry[];
  defaultWorkspaceRoot: { name: string; path: string } | null;
  groupedHistory: { name: string; items: HistoryItem[] }[];
  activeSessions: string[];
  selectedProjectPath: string;
  terminalFontSize: number;
  mobileHelperDefaultVisible: boolean;
  untitledSessionCount: number;
  onClose: () => void;
  onToggleTheme: () => void;
  onProjectChange: (projectPath: string) => void;
  onTerminalFontSizeChange: (fontSize: number) => void;
  onMobileHelperDefaultChange: (visible: boolean) => void;
  onSelectSession: (session: HistoryItem) => void;
}

const PANEL_TITLES: Record<Exclude<WorkspacePanelMode, null>, string> = {
  settings: '设置',
  activity: '活动',
  help: '帮助',
};

export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  mode,
  theme,
  projects,
  defaultWorkspaceRoot,
  groupedHistory,
  activeSessions,
  selectedProjectPath,
  terminalFontSize,
  mobileHelperDefaultVisible,
  untitledSessionCount,
  onClose,
  onToggleTheme,
  onProjectChange,
  onTerminalFontSizeChange,
  onMobileHelperDefaultChange,
  onSelectSession,
}) => {
  if (!mode) return null;

  const recentSessions = groupedHistory
    .flatMap(group => group.items)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);

  const scanningProjects = projects.filter(project => project.isScanning);
  const totalSessions = groupedHistory.reduce((total, group) => total + group.items.length, 0);

  return (
    <div className="workspace-panel-backdrop" onClick={onClose}>
      <aside
        className="workspace-panel glass-effect"
        role="dialog"
        aria-modal="true"
        aria-label={PANEL_TITLES[mode]}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="workspace-panel-header">
          <div>
            <div className="workspace-panel-eyebrow">Workspace</div>
            <h2>{PANEL_TITLES[mode]}</h2>
          </div>
          <button className="workspace-panel-close" onClick={onClose} aria-label="关闭面板">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {mode === 'settings' && (
          <div className="workspace-panel-body">
            <section className="workspace-section">
              <div className="workspace-section-header">
                <h3>外观与默认项</h3>
                <p>把常用偏好收在一个固定位置，降低每次启动和切换的摩擦。</p>
              </div>

              <div className="workspace-setting-row">
                <div>
                  <strong>主题</strong>
                  <span>{theme === 'dark' ? '当前为深色模式' : '当前为浅色模式'}</span>
                </div>
                <button className="workspace-action-btn" onClick={onToggleTheme}>
                  切换到{theme === 'dark' ? '浅色' : '深色'}
                </button>
              </div>

              <label className="workspace-field">
                <span>新会话默认项目</span>
                <select value={selectedProjectPath} onChange={(event) => onProjectChange(event.target.value)}>
                  <option value="">
                    默认工作区{defaultWorkspaceRoot ? ` · ${defaultWorkspaceRoot.path}` : ''}
                  </option>
                  {projects.map(project => (
                    <option key={project.path} value={project.path}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="workspace-field">
                <span>终端字号</span>
                <div className="workspace-range-row">
                  <input
                    type="range"
                    min="12"
                    max="18"
                    step="1"
                    value={terminalFontSize}
                    onChange={(event) => onTerminalFontSizeChange(Number(event.target.value))}
                  />
                  <strong>{terminalFontSize}px</strong>
                </div>
              </label>

              <label className="workspace-toggle-row">
                <div>
                  <strong>移动端辅助键默认显示</strong>
                  <span>首次进入终端时默认展示 CTRL / ALT / 方向键辅助区。</span>
                </div>
                <input
                  type="checkbox"
                  checked={mobileHelperDefaultVisible}
                  onChange={(event) => onMobileHelperDefaultChange(event.target.checked)}
                />
              </label>
            </section>
          </div>
        )}

        {mode === 'activity' && (
          <div className="workspace-panel-body">
            <section className="workspace-metrics-grid">
              <div className="workspace-metric-card">
                <span>活动会话</span>
                <strong>{activeSessions.length}</strong>
              </div>
              <div className="workspace-metric-card">
                <span>项目数</span>
                <strong>{projects.length}</strong>
              </div>
              <div className="workspace-metric-card">
                <span>历史会话</span>
                <strong>{totalSessions}</strong>
              </div>
              <div className="workspace-metric-card warning">
                <span>待命名会话</span>
                <strong>{untitledSessionCount}</strong>
              </div>
            </section>

            <section className="workspace-section">
              <div className="workspace-section-header">
                <h3>最近活动</h3>
                <p>优先展示最近更新过的会话，方便快速回到上下文。</p>
              </div>

              <div className="workspace-session-list">
                {recentSessions.length === 0 ? (
                  <div className="workspace-empty-state">还没有历史会话。</div>
                ) : recentSessions.map(session => (
                  <button
                    key={`${session.projectPath}:${session.id}`}
                    className="workspace-session-row"
                    onClick={() => {
                      onSelectSession(session);
                      onClose();
                    }}
                  >
                    <div>
                      <strong>{getSessionDisplayName(session)}</strong>
                      <span>{session.projectName} · {session.time}</span>
                    </div>
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="workspace-section">
              <div className="workspace-section-header">
                <h3>扫描状态</h3>
                <p>这里显示仍在同步中的项目，帮助判断历史列表是否已经完整。</p>
              </div>
              {scanningProjects.length === 0 ? (
                <div className="workspace-empty-state">当前没有项目在扫描。</div>
              ) : (
                <div className="workspace-tag-list">
                  {scanningProjects.map(project => (
                    <span key={project.path} className="workspace-tag">
                      {project.name}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {mode === 'help' && (
          <div className="workspace-panel-body">
            <section className="workspace-section">
              <div className="workspace-section-header">
                <h3>快速上手</h3>
                <p>把最常用的入口和命令聚到一起，减少新用户的犹豫成本。</p>
              </div>
              <div className="workspace-command-list">
                {[
                  ['/help', '查看可用命令与说明'],
                  ['/memory show', '查看当前项目记忆'],
                  ['/skills list', '列出技能与工具'],
                  ['git status -sb', '快速查看代码状态'],
                  ['npm run dev', '启动当前项目开发服务'],
                ].map(([command, description]) => (
                  <div key={command} className="workspace-command-row">
                    <code>{command}</code>
                    <span>{description}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="workspace-section">
              <div className="workspace-section-header">
                <h3>使用建议</h3>
                <p>这几个习惯能让终端模式和历史模式配合得更顺手。</p>
              </div>
              <ul className="workspace-help-list">
                <li>需要快速追溯输出时切到“历史”，需要继续执行时切回“交互”。</li>
                <li>新会话前先确认项目目录，避免把命令发到错误工作区。</li>
                <li>看到未命名会话较多时，优先在侧栏改名，后续检索会轻松很多。</li>
              </ul>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
};
