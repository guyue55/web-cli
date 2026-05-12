import React from 'react';
import { type HistoryItem } from '../../hooks/useSessions';

interface HeaderProps {
  selectedSession: HistoryItem | null;
  theme: string;
  isLiveMode: boolean;
  onToggleTheme: () => void;
  onToggleLiveMode: (mode: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedSession,
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
           <span className="material-symbols-outlined sparkles-icon">sparkles</span>
         </span>
      </div>
      
      <div className="header-center">
        <h1>{selectedSession?.name || 'Gemini'}</h1>
      </div>
      
      <div className="header-right">
         <button className="theme-toggle" onClick={onToggleTheme} title="切换主题">
            <span className="material-symbols-outlined">
               {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
         </button>
         {selectedSession && (
           <div className="header-tabs">
             <button 
               className={`tab-btn ${!isLiveMode ? 'active' : ''}`}
               onClick={() => onToggleLiveMode(false)}
             >
               历史
             </button>
             <button 
               className={`tab-btn ${isLiveMode ? 'active' : ''}`}
               onClick={() => onToggleLiveMode(true)}
             >
               交互
             </button>
           </div>
         )}
      </div>
    </header>
  );
};
