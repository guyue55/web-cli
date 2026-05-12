import React, { useState, useEffect } from 'react';
import { 
  IconGemini, IconInterrupt, IconClear, 
  IconRefresh, IconExpand, IconShrink, IconArrowDown 
} from './TerminalIcons';

export const TerminalHeader = React.memo(({ 
  status, 
  ws,
  isPaletteOpen, 
  isSearchVisible, 
  isFocusMode, 
  isHelperVisible, 
  isMobile,
  searchQuery,
  searchMatches,
  onExplain,
  onTogglePalette,
  onToggleSearch,
  onToggleFocus,
  onToggleHelper,
  onRestart,
  onInterrupt,
  onClear,
  onSearch
}: {
  status: string,
  ws: WebSocket | null,
  isPaletteOpen: boolean,
  isSearchVisible: boolean,
  isFocusMode: boolean,
  isHelperVisible: boolean,
  isMobile: boolean,
  searchQuery: string,
  searchMatches: { current: number, total: number },
  onExplain: (customText?: string) => void,
  onTogglePalette: () => void,
  onToggleSearch: () => void,
  onToggleFocus: () => void,
  onToggleHelper: () => void,
  onRestart: () => void,
  onInterrupt: () => void,
  onClear: () => void,
  onSearch: (q: string, dir?: 'next' | 'prev') => void
}) => {
  const [isPulseActive, setIsPulseActive] = useState(false);
  const [errorPerceived, setErrorPerceived] = useState(false);

  useEffect(() => {
    if (!ws) return;
    const onMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'output') {
          const data = payload.data.toLowerCase();
          if (data.includes('error') || data.includes('failed') || data.includes('exception')) {
            setErrorPerceived(true);
          }
          setIsPulseActive(true);
          const t = setTimeout(() => setIsPulseActive(false), 200);
          return () => clearTimeout(t);
        }
      } catch { /* ignore */ }
    };
    ws.addEventListener('message', onMessage);
    return () => ws.removeEventListener('message', onMessage);
  }, [ws]);

  return (
    <div className="terminal-toolbar premium-header">
      <div className="terminal-title">
         <div className={`gemini-logo-container ${isPulseActive ? 'pulsing' : ''}`}>
           <IconGemini /> 
         </div>
         <span className="terminal-name">Gemini 执行环境</span>
      </div>

      <div className="instance-status-pill-premium">
         <div className={`status-glow-ring ${status}`}></div>
         <span className={`status-dot-v2 ${status}`} />
         <span className="status-text">{status === 'connected' ? '执行中' : status === 'connecting' ? '正在连接' : '已断开'}</span>
      </div>
      
      <div className="toolbar-actions-group">
         <div className="action-button-group">
           <button 
             className={`terminal-btn-gemini ai-highlight ${errorPerceived ? 'error-perceived' : ''}`} 
             title={errorPerceived ? "检测到错误，交给 AI 解释" : "AI 解释当前内容"} 
             onClick={(e) => { e.stopPropagation(); onExplain(); setErrorPerceived(false); }}
           >
             <span className="material-symbols-outlined">auto_awesome</span>
           </button>
           <button 
             className={`terminal-btn-gemini ${isPaletteOpen ? 'active' : ''}`}
             title="指令历史 (Cmd/Ctrl+P)"
             onClick={(e) => { e.stopPropagation(); onTogglePalette(); }}
           >
             <span className="material-symbols-outlined">auto_fix_high</span>
           </button>
         </div>

         {isSearchVisible && (
           <div className="terminal-search-bar-pro glass-effect" onClick={(e) => e.stopPropagation()}>
             <span className="material-symbols-outlined">search</span>
             <input 
               type="text" 
               placeholder="搜索内容..." 
               autoFocus
               onChange={(e) => onSearch(e.target.value)}
               onKeyDown={(e) => {
                 if (e.key === 'Enter') onSearch((e.target as HTMLInputElement).value);
                 if (e.key === 'Escape') onToggleSearch();
               }}
             />
             <div className="search-count">{searchMatches.total > 0 ? `${searchMatches.current}/${searchMatches.total}` : '0/0'}</div>
             <button onClick={() => onSearch(searchQuery, 'prev')}><IconArrowDown /></button>
             <button onClick={onToggleSearch}><IconInterrupt /></button>
           </div>
         )}

         <div className="action-button-group">
           <button className={`terminal-btn-gemini ${isSearchVisible ? 'active' : ''}`} title="查找 (Ctrl+F)" onClick={onToggleSearch}><span className="material-symbols-outlined">search</span></button>
           <button className="terminal-btn-gemini" title="中断 (Ctrl+C)" onClick={onInterrupt}><IconInterrupt /></button>
           <button className="terminal-btn-gemini" title="重置终端" onClick={onClear}><IconClear /></button>
         </div>

         {isMobile && (
           <button 
             className={`terminal-btn-gemini ${isHelperVisible ? 'active' : ''}`}
             onClick={onToggleHelper}
           >
             <span className="material-symbols-outlined">keyboard</span>
           </button>
         )}

         <div className="action-button-group">
           <button className="terminal-btn-gemini" onClick={onToggleFocus}>{isFocusMode ? <IconShrink /> : <IconExpand />}</button>
           <button className="terminal-btn-official-accent" onClick={onRestart}><IconRefresh /></button>
         </div>
      </div>
    </div>
  );
});
