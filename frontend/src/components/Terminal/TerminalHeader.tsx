import React, { useState, useEffect } from 'react';
import { 
  IconGemini, IconInterrupt, IconClear, 
  IconRefresh, IconExpand, IconShrink, IconArrowDown, IconArrowUp
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
  onSearch: (q: string, dir?: 'next' | 'prev', incremental?: boolean) => void
}) => {
  const [isPulseActive, setIsPulseActive] = useState(false);
  const [errorPerceived, setErrorPerceived] = useState(false);

  useEffect(() => {
    if (!ws) return;
    let pulseTimer: ReturnType<typeof setTimeout>;
    const onMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'output') {
          const data = payload.data.toLowerCase();
          if (data.includes('error') || data.includes('failed') || data.includes('exception')) {
            setErrorPerceived(true);
          }
          setIsPulseActive(true);
          if (pulseTimer) clearTimeout(pulseTimer);
          pulseTimer = setTimeout(() => setIsPulseActive(false), 200);
        }
      } catch { /* ignore */ }
    };
    ws.addEventListener('message', onMessage);
    return () => {
      ws.removeEventListener('message', onMessage);
      if (pulseTimer) clearTimeout(pulseTimer);
    };
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
             className={`terminal-btn-gemini premium-ai-btn ${errorPerceived ? 'error-pulse' : ''}`} 
             title={errorPerceived ? "发现潜在错误，交给 Gemini 分析" : "分析当前上下文"} 
             aria-label={errorPerceived ? "发现潜在错误，交给 Gemini 分析" : "分析当前终端上下文"}
             onClick={(e) => { e.stopPropagation(); onExplain(); setErrorPerceived(false); }}
           >
             <span className="material-symbols-outlined">auto_awesome</span>
           </button>
           <button 
             className={`terminal-btn-gemini ${isPaletteOpen ? 'active' : ''}`}
             title="指令历史 (Cmd/Ctrl+P)"
             aria-label="打开指令历史"
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
               value={searchQuery}
               onChange={(e) => onSearch(e.target.value, 'next', true)}
               onKeyDown={(e) => {
                 if (e.key === 'Enter') {
                    if (e.shiftKey) onSearch(searchQuery, 'prev', false);
                    else onSearch(searchQuery, 'next', false);
                 }
                 if (e.key === 'Escape') onToggleSearch();
               }}
             />
             <div className="search-count">{searchMatches.total > 0 ? '匹配' : '无结果'}</div>
             <div className="search-nav-btns">
               <button onClick={() => onSearch(searchQuery, 'prev', false)} title="上一个 (Shift+Enter)" aria-label="查找上一个"><IconArrowUp /></button>
               <button onClick={() => onSearch(searchQuery, 'next', false)} title="下一个 (Enter)" aria-label="查找下一个"><IconArrowDown /></button>
             </div>
             <button className="search-close-btn" onClick={onToggleSearch} title="关闭 (Esc)" aria-label="关闭终端搜索"><IconInterrupt /></button>
           </div>
         )}

         <div className="action-button-group">
           <button className="terminal-btn-gemini" title="中断 (Ctrl+C)" aria-label="中断当前终端任务" onClick={onInterrupt}><IconInterrupt /></button>
           <button className="terminal-btn-gemini" title="重置终端" aria-label="清除终端屏幕" onClick={onClear}><IconClear /></button>
         </div>

         {isMobile && (
           <button 
             className={`terminal-btn-gemini ${isHelperVisible ? 'active' : ''}`}
             aria-label={isHelperVisible ? '隐藏移动端辅助键' : '显示移动端辅助键'}
             onClick={onToggleHelper}
           >
             <span className="material-symbols-outlined">keyboard</span>
           </button>
         )}

         <div className="action-button-group">
           <button className="terminal-btn-gemini" aria-label={isFocusMode ? '退出专注模式' : '进入专注模式'} onClick={onToggleFocus}>{isFocusMode ? <IconShrink /> : <IconExpand />}</button>
           <button className="terminal-btn-official-accent" aria-label="重连或重启会话" onClick={onRestart}><IconRefresh /></button>
         </div>
      </div>
    </div>
  );
});
