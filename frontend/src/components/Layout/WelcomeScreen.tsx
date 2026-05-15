import React from 'react';
import type { ProjectEntry } from '../../hooks/useSessions';

interface WelcomeScreenProps {
  onHandlePromptSubmit: (cmd: string) => void;
  projects: ProjectEntry[];
  selectedProjectPath: string;
  onProjectChange: (projectPath: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onHandlePromptSubmit,
  projects,
  selectedProjectPath,
  onProjectChange
}) => {
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
              <strong>{projects.find(project => project.path === selectedProjectPath)?.name || 'default'}</strong>
            </div>
          </div>
          <select
            aria-label="选择新会话项目"
            value={selectedProjectPath}
            onChange={(event) => onProjectChange(event.target.value)}
            disabled={projects.length === 0}
          >
            {projects.length === 0 ? (
              <option value={selectedProjectPath}>default</option>
            ) : projects.map((project) => (
              <option key={project.path} value={project.path}>
                {project.name}
              </option>
            ))}
          </select>
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
    </div>
  );
};
