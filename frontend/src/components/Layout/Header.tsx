import React from 'react';
import { type HistoryItem } from '../../hooks/useSessions';

interface HeaderProps {
  selectedSession: HistoryItem | null;
  selectedSessionLabel: string;
  theme: string;
  isLiveMode: boolean;
  onToggleTheme: () => void;
  onToggleLiveMode: (mode: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedSession,
  selectedSessionLabel,
  theme,
  isLiveMode,
  onToggleTheme,
  onToggleLiveMode
}) => {
  return (
    <header className="header">
      <div className="header-left">
         <span className="brand-logo">
           Gemini
         </span>
      </div>
      
      <div className="header-center">
        <h1>{selectedSessionLabel}</h1>
      </div>
      
      <div className="header-right">
         <button className="theme-toggle" onClick={onToggleTheme} title="切换主题" aria-label="切换主题">
            <span className="material-symbols-outlined">
               {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
         </button>
         {selectedSession && (
           <div className="header-tabs">
             <button 
             className={`tab-btn ${!isLiveMode ? 'active' : ''}`}
             onClick={() => onToggleLiveMode(false)}
              aria-pressed={!isLiveMode}
            >
               历史
             </button>
             <button 
             className={`tab-btn ${isLiveMode ? 'active' : ''}`}
             onClick={() => onToggleLiveMode(true)}
              aria-pressed={isLiveMode}
            >
               交互
             </button>
           </div>
         )}
      </div>
    </header>
  );
};
