import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { ApiService } from '../../services/ApiService';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  uuid: string;
  projectPath: string;
  initialPrompt?: string | null;
  theme?: string;
  onSendToChat?: (text: string) => void;
}

// --- Premium SVG Assets (Gemini Style) ---
const IconGemini = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path className="gemini-sparkle-path" d="M12 2L14.85 9.15L22 12L14.85 14.85L12 22L9.15 14.85L2 12L9.15 9.15L12 2Z" fill="url(#gemini_gradient)" />
    <defs>
      <linearGradient id="gemini_gradient" x1="2" y1="12" x2="22" y2="12" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4285F4" />
        <stop offset="0.5" stopColor="#9B72CB" />
        <stop offset="1" stopColor="#D96570" />
      </linearGradient>
    </defs>
  </svg>
);
const IconInterrupt = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
const IconClear = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
const IconCopy = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const IconCheck = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconDownload = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IconRefresh = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
const IconExpand = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>;
const IconShrink = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>;
const IconArrowDown = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 13l5 5 5-5M7 6l5 5 5-5"/></svg>;

// --- Process Aware Icons ---
const IconProcess = ({ name }: { name: string }) => {
  const n = name.toLowerCase();
  if (n.includes('git')) return <span className="material-symbols-outlined process-icon">account_tree</span>;
  if (n.includes('npm') || n.includes('node')) return <span className="material-symbols-outlined process-icon">terminal</span>;
  if (n.includes('python') || n.includes('py')) return <span className="material-symbols-outlined process-icon">developer_mode_tv</span>;
  return <span className="material-symbols-outlined process-icon">code</span>;
};

// eslint-disable-next-line no-control-regex
const stripAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~]*)*)?\u0007/g, '');

const TerminalStatusBar = React.memo(({ ws, status }: { ws: WebSocket | null, status: string }) => {
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    if (status !== 'connected' || !ws) return;
    
    let lastPing = 0;
    const onMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'pong') {
          setLatency(Date.now() - lastPing);
        }
      } catch { /* ignore */ }
    };

    ws.addEventListener('message', onMessage);

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        lastPing = Date.now();
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 5000);

    return () => {
      ws.removeEventListener('message', onMessage);
      clearInterval(heartbeat);
    };
  }, [ws, status]);

  return (
    <div className="terminal-footer-status glass-effect">
       <div className="footer-left">
          <span className="footer-info-item"><span className="label">环境:</span> node v24.13.0</span>
          <span className="footer-info-item"><span className="label">渲染:</span> xterm-webgl</span>
       </div>
       <div className="footer-right">
          <span className="footer-info-item">
            <span className="status-dot-mini connected" />
            加密隧道已建立
          </span>
          {latency !== null && (
            <span className="footer-info-item"><span className="label">延迟:</span> {latency}ms</span>
          )}
       </div>
    </div>
  );
});

const TerminalHeader = React.memo(({ 
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

const Terminal: React.FC<TerminalProps> = ({ uuid, projectPath, initialPrompt, theme, onSendToChat }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [wsInstance, setWsInstance] = useState<WebSocket | null>(null);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [hasNewContent, setHasNewContent] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [visualBell, setVisualBell] = useState(false);
  const [selectionPosition, setSelectionPosition] = useState<{ x: number, y: number } | null>(null);
  const [ctrlLatched, setCtrlLatched] = useState(false);
  const [altLatched, setAltLatched] = useState(false);
  const [isHelperVisible, setIsHelperVisible] = useState(true);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState({ current: 0, total: 0 });
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isFocusHighlight, setIsFocusHighlight] = useState(false);
  const [isOverlayDismissed, setIsOverlayDismissed] = useState(false);
  
  const [commandHistory, setHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('terminal_cmd_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [tabs, setTabs] = useState<{id: string, label: string, color?: string}[]>(() => {
    const saved = localStorage.getItem('terminal_tabs_v4');
    return saved ? JSON.parse(saved) : [{ id: uuid, label: 'Gemini', color: 'blue' }];
  });
  const [activeTabId, setActiveTabId] = useState(() => {
    const saved = localStorage.getItem('terminal_active_tab_id');
    // Ensure the saved ID actually exists in the loaded tabs, otherwise fallback to uuid
    const savedTabs = localStorage.getItem('terminal_tabs_v4');
    const tabsList = savedTabs ? (JSON.parse(savedTabs) as {id: string}[]) : [];
    if (saved && tabsList.some((t) => t.id === saved)) return saved;
    return uuid;
  });
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number, y: number, id: string } | null>(null);

  const lastTapRef = useRef<number>(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const executionLockedRef = useRef<string | null>(null);
  const connectRef = useRef<(cols?: number, rows?: number) => void>(() => {});

  const handleTabSwitch = (id: string) => {
    setActiveTabId(id);
    localStorage.setItem('terminal_active_tab_id', id);
    triggerHaptic();
  };

  const triggerHapticRef = useRef<() => void>(() => {});
  useEffect(() => {
    triggerHapticRef.current = () => {
      if (isMobile && window.navigator.vibrate) {
        window.navigator.vibrate(10);
      }
    };
  }, [isMobile]);

  const triggerHaptic = useCallback(() => {
    triggerHapticRef.current();
  }, []);

  const addTab = () => {
    const newId = `${uuid}-tab-${tabs.length}`;
    const newTabs = [...tabs, { id: newId, label: `会话 ${tabs.length + 1}`, color: 'blue' }];
    setTabs(newTabs);
    setActiveTabId(newId);
    localStorage.setItem('terminal_tabs_v4', JSON.stringify(newTabs));
    triggerHaptic();
  };

  const removeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    localStorage.setItem('terminal_tabs_v4', JSON.stringify(newTabs));
    if (activeTabId === id) setActiveTabId(newTabs[0].id);
    triggerHaptic();
  };

  const handleTabRename = (id: string, newLabel: string) => {
    const newTabs = tabs.map(t => t.id === id ? { ...t, label: newLabel || t.label } : t);
    setTabs(newTabs);
    localStorage.setItem('terminal_tabs_v4', JSON.stringify(newTabs));
    setEditingTabId(null);
  };

  const setTabColor = (id: string, color: string) => {
    const newTabs = tabs.map(t => t.id === id ? { ...t, color } : t);
    setTabs(newTabs);
    localStorage.setItem('terminal_tabs_v4', JSON.stringify(newTabs));
    setTabContextMenu(null);
    triggerHaptic();
  };

  const QUICK_COMMANDS = [
    { cmd: '/help', label: '获取指令帮助', icon: 'help' },
    { cmd: '/memory show', label: '查看项目记忆', icon: 'neurology' },
    { cmd: '/skills list', label: '列出代理技能', icon: 'bolt' },
    { cmd: 'git status -sb', label: 'Git 简报', icon: 'account_tree' },
    { cmd: 'npm run dev', label: '启动开发服务器', icon: 'terminal' },
    { cmd: '/reset', label: '重置当前会话', icon: 'refresh' },
  ];

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|iPhone/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      const currentTimer = reconnectTimerRef.current;
      if (currentTimer) clearTimeout(currentTimer);
    };
  }, []);

  const sendKey = useCallback((key: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      let finalKey = key;
      if (ctrlLatched && key.length === 1) {
        const code = key.toUpperCase().charCodeAt(0) - 64;
        if (code >= 1 && code <= 26) finalKey = String.fromCharCode(code);
        setCtrlLatched(false);
      } else if (altLatched && key.length === 1) {
        finalKey = '\x1b' + key;
        setAltLatched(false);
      }
      wsRef.current.send(JSON.stringify({ type: 'input', data: finalKey }));
      triggerHaptic();
    }
  }, [ctrlLatched, altLatched, triggerHaptic]);

  const handleCopy = useCallback(async (isAuto: boolean | React.MouseEvent = false) => {
    if (xtermRef.current) {
      const autoFlag = typeof isAuto === 'boolean' ? isAuto : false;
      const content = xtermRef.current.getSelection() || '';
      let textToCopy = content;
      
      if (!textToCopy && !autoFlag) {
        xtermRef.current.selectAll();
        textToCopy = xtermRef.current.getSelection();
        xtermRef.current.clearSelection();
      }

      if (textToCopy) {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(textToCopy);
          } else {
            throw new Error('Clipboard API unavailable');
          }
        } catch {
          // Fallback to legacy copy
          const textArea = document.createElement("textarea");
          textArea.value = textToCopy;
          textArea.style.position = "fixed";
          textArea.style.left = "-9999px";
          textArea.style.top = "0";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
        }
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }
      setContextMenu(null);
      setSelectionPosition(null);
      triggerHaptic();
    }
  }, [triggerHaptic]);

  const handlePaste = useCallback(async () => {
    try {
      // Industrial-grade check: Clipboard API requires HTTPS or localhost
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        const reason = !window.isSecureContext 
          ? '浏览器安全策略限制：非 HTTPS 环境无法通过菜单粘贴。请使用 Ctrl+V 或切换至 HTTPS/Localhost。' 
          : '您的浏览器可能禁用了剪贴板访问。请在地址栏权限设置中允许“剪贴板”访问。';
        throw new Error(reason);
      }
      
      const text = await navigator.clipboard.readText();
      if (text && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
      }
    } catch (err: unknown) {
      console.error('Terminal Paste Error:', err);
      const error = err as Error;
      if (error.name === 'NotAllowedError') {
        alert('无法访问剪贴板。请在浏览器权限设置中允许“剪贴板”读取，或直接使用键盘快捷键 Ctrl+V / Cmd+V。');
      } else {
        alert(error.message || '粘贴失败，请检查浏览器权限。');
      }
    } finally {
      setContextMenu(null);
      triggerHaptic();
    }
  }, [triggerHaptic]);

  const handleClear = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.reset();
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // CSI 2 J: Clear entire screen
      // CSI H: Home cursor
      // \x0c: Ctrl+L (Force shell prompt redraw)
      wsRef.current.send(JSON.stringify({ type: 'input', data: '\x1b[2J\x1b[H\x0c' }));
    }
    setContextMenu(null);
    triggerHaptic();
  }, [triggerHaptic]);

  const handleSearch = useCallback((query: string, direction: 'next' | 'prev' = 'next') => {
    if (!query) {
      setSearchMatches({ current: 0, total: 0 });
      return;
    }
    setSearchQuery(query);
    if (searchAddonRef.current) {
      if (direction === 'next') searchAddonRef.current.findNext(query, { incremental: true });
      else searchAddonRef.current.findPrevious(query);
      setSearchMatches({ current: 1, total: 1 });
    }
  }, []);

  const runCommand = useCallback((cmd: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: cmd + '\r' }));
      const newHistory = [cmd, ...commandHistory.filter(h => h !== cmd)].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem('terminal_cmd_history', JSON.stringify(newHistory));
      triggerHaptic();
    }
    setIsPaletteOpen(false);
  }, [commandHistory, triggerHaptic]);

  const explainWithGemini = useCallback((customText?: string) => {
    if (!onSendToChat) return;
    let textToExplain = customText;
    if (!textToExplain && xtermRef.current) {
      textToExplain = xtermRef.current.getSelection();
      if (!textToExplain) {
        const term = xtermRef.current;
        const totalLines = term.buffer.active.length;
        textToExplain = '';
        for (let i = Math.max(0, totalLines - 40); i < totalLines; i++) {
          const line = term.buffer.active.getLine(i);
          if (line) textToExplain += line.translateToString() + '\n';
        }
      }
    }
    if (textToExplain) {
      onSendToChat(`请帮我分析这段终端输出。如果是报错，请解释原因并给出修复建议：\n\n\`\`\`\n${stripAnsi(textToExplain)}\n\`\`\``);
      setContextMenu(null);
      setSelectionPosition(null);
      triggerHaptic();
    }
  }, [onSendToChat, triggerHaptic]);

  const handleSelectionChange = useCallback(() => {
    if (!xtermRef.current) return;
    const term = xtermRef.current;
    if (term.hasSelection()) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Premium Anchor-Simulation Positioning
        // Uses fixed coordinates to avoid container shifts
        setSelectionPosition({ 
           x: Math.round(rect.left + rect.width / 2), 
           y: Math.round(rect.top - 58) 
        });
      }
    } else {
      setSelectionPosition(null);
    }
  }, []);

  const initialPromptRef = useRef(initialPrompt);
  useEffect(() => { initialPromptRef.current = initialPrompt; }, [initialPrompt]);

  const handleCopyRef = useRef(handleCopy);
  useEffect(() => { handleCopyRef.current = handleCopy; }, [handleCopy]);

  const handlePasteRef = useRef(handlePaste);
  useEffect(() => { handlePasteRef.current = handlePaste; }, [handlePaste]);

  const handleClearRef = useRef(handleClear);
  useEffect(() => { handleClearRef.current = handleClear; }, [handleClear]);

  const handleSelectionChangeRef = useRef(handleSelectionChange);
  useEffect(() => { handleSelectionChangeRef.current = handleSelectionChange; }, [handleSelectionChange]);

  const connect = useCallback((initialCols?: number, initialRows?: number) => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

    setStatus('connecting');
    setIsOverlayDismissed(false);
    setSystemError(null);

    const host = window.location.hostname || 'localhost';
    const isDefaultPort =
      window.location.port === '' ||
      window.location.port === '80' ||
      window.location.port === '443';
    const dimensions = initialCols ? `&cols=${initialCols}&rows=${initialRows}` : '';
    const wsBase = isDefaultPort
      ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws`
      : `ws://${host}:3001`;
    const wsUrl = `${wsBase}?uuid=${activeTabId}&projectPath=${encodeURIComponent(projectPath)}${dimensions}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setWsInstance(ws);

    ws.onopen = () => {
      setStatus('connected');
      reconnectAttemptsRef.current = 0;
      if (!initialCols && xtermRef.current) {
        fitAddonRef.current?.fit();
        const { cols, rows } = xtermRef.current;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
      
      const currentPrompt = initialPromptRef.current;
      if (currentPrompt && executionLockedRef.current !== `${activeTabId}-${currentPrompt}`) {
        ws.send(JSON.stringify({ type: 'input', data: currentPrompt + '\r' }));
        executionLockedRef.current = `${activeTabId}-${currentPrompt}`;
      }

      setTimeout(() => {
        if (xtermRef.current) {
          xtermRef.current.focus();
          fitAddonRef.current?.fit();
        }
      }, 100);
    };

    ws.onclose = (event) => {
      setStatus('disconnected');
      if (event.code !== 1000) {
        setSystemError(`连接意外断开 (代码: ${event.code})。请检查后端服务状态或尝试重新连接。`);
      }
    };

    ws.onerror = () => {
      // 2026 Resilience: Silent retry for transient handshake failures during refresh
      if (reconnectAttemptsRef.current < 3) {
        console.warn('[Terminal] WebSocket handshake failed, retrying silently...');
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => connectRef.current(initialCols, initialRows), 1000);
      } else {
        setStatus('disconnected');
        setSystemError('无法建立 WebSocket 连接。执行环境可能已关闭或网络受限。');
      }
    };

    const writeBuffer: string[] = [];
    let rafId: number;
    let isInitialBuffer = true;

    const flushBuffer = async () => {
      if (writeBuffer.length > 0 && xtermRef.current) {
        const term = xtermRef.current;
        const isAtBottom = term.buffer.active.viewportY >= term.buffer.active.baseY - 1;
        
        // Batch write
        term.write(writeBuffer.join(''));
        writeBuffer.length = 0;
        
        if (isAtBottom) term.scrollToBottom();

        // Yield to maintain high INP (2026 standard)
        if ('scheduler' in window && typeof (window as unknown as {scheduler: {yield: () => Promise<void>}}).scheduler.yield === 'function') {
           await (window as unknown as {scheduler: {yield: () => Promise<void>}}).scheduler.yield();
        }
      }
      rafId = requestAnimationFrame(() => flushBuffer());
    };
    rafId = requestAnimationFrame(() => flushBuffer());

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'output' && xtermRef.current) {
          const data = payload.data;
          writeBuffer.push(data);
          
          if (!isInitialBuffer && (data.includes('[System Error]') || data.includes('[Critical Error]'))) {
            setSystemError(stripAnsi(data).replace(/\[(System|Critical) Error\]/, '').trim());
          }
          isInitialBuffer = false;
        } else if (payload.type === 'exit') {
          setStatus('disconnected');
        }
      } catch { /* ignore */ }
    };

    ws.addEventListener('close', () => {
       cancelAnimationFrame(rafId);
       setWsInstance(null);
    });
  }, [activeTabId, projectPath]);

  const scrollToBottom = () => {
    if (xtermRef.current) {
      xtermRef.current.scrollToBottom();
      setHasNewContent(false);
    }
  };

  // Handle subsequent prompt submissions without terminal re-init
  useEffect(() => {
    if (initialPrompt && status === 'connected' && wsRef.current?.readyState === WebSocket.OPEN) {
       const lockKey = `${activeTabId}-${initialPrompt}`;
       if (executionLockedRef.current !== lockKey) {
          wsRef.current.send(JSON.stringify({ type: 'input', data: initialPrompt + '\r' }));
          executionLockedRef.current = lockKey;
       }
    }
  }, [initialPrompt, status, activeTabId]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (!terminalRef.current) return;
    const isDark = theme === 'dark';
    const term = new XTerm({
      cursorBlink: true,
      fontSize: fontSize,
      fontFamily: '"Google Sans Mono", "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
      theme: {
        background: 'transparent',
        foreground: isDark ? '#e3e3e3' : '#1f1f1f',
        cursor: '#4285f4',
        cursorAccent: isDark ? '#131314' : '#ffffff',
        selectionBackground: isDark ? 'rgba(138, 180, 248, 0.4)' : 'rgba(66, 133, 244, 0.3)',
        black: isDark ? '#000000' : '#3c4043',
        red: '#ea4335',
        green: '#34a853',
        yellow: '#fbbc04',
        blue: '#4285f4',
        magenta: '#af5fd7',
        cyan: '#00abc0',
        white: isDark ? '#e3e3e3' : '#ffffff',
        brightBlack: isDark ? '#5f6368' : '#70757a',
        brightRed: '#f28b82',
        brightGreen: '#81c995',
        brightYellow: '#fdd663',
        brightBlue: '#8ab4f8',
        brightMagenta: '#c58af9',
        brightCyan: '#82d1f1',
        brightWhite: isDark ? '#ffffff' : '#202124',
      },
      allowProposedApi: true,
      scrollback: 20000,
      cursorStyle: 'block',
      convertEol: true,
      minimumContrastRatio: 4.5,
      screenReaderMode: true,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    const unicode11Addon = new Unicode11Addon();
    term.loadAddon(unicode11Addon);
    term.unicode.activeVersion = '11';
    term.loadAddon(new WebLinksAddon());
    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;

    term.open(terminalRef.current);
    try { term.loadAddon(new WebglAddon()); } catch { /* fallback */ }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    
    // Industrial-grade resize observation with stability threshold
    let resizeTimeout: ReturnType<typeof setTimeout>;
    let lastWidth = 0;
    let lastHeight = 0;
    
    const resizeObserver = new ResizeObserver((entries) => {
       const entry = entries[0];
       if (!entry) return;
       
       const { width, height } = entry.contentRect;
       // Only trigger if change is significant (> 4px) to ignore focus-glow/border jitters
       if (Math.abs(width - lastWidth) > 4 || Math.abs(height - lastHeight) > 4) {
          lastWidth = width;
          lastHeight = height;
          
          if (terminalRef.current?.offsetParent) {
             clearTimeout(resizeTimeout);
             resizeTimeout = setTimeout(() => {
                if (fitAddonRef.current && xtermRef.current) {
                   fitAddonRef.current.fit();
                   if (wsRef.current?.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({ 
                         type: 'resize', 
                         cols: xtermRef.current.cols, 
                         rows: xtermRef.current.rows 
                      }));
                   }
                }
             }, 300); // Stable debounce
          }
       }
    });
    resizeObserver.observe(terminalRef.current);

    setTimeout(() => {
      if (xtermRef.current) {
        fitAddonRef.current?.fit();
        connect(xtermRef.current.cols, xtermRef.current.rows);
      }
    }, 300); // Increased delay for stability on refresh

    term.onData(data => {
      // 2026 Resilience: Suppress Device Attributes (DA) ghost responses (e.g. \x1b[?1;2c)
      // These are often triggered by shell probes on connect/refresh.
      if (data.startsWith('\x1b[?')) return;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    term.onSelectionChange(() => handleSelectionChangeRef.current());
    const handleFocus = () => setIsFocusHighlight(true);
    const handleBlur = () => setIsFocusHighlight(false);
    const textarea = term.textarea;
    if (textarea) {
      textarea.addEventListener('focus', handleFocus);
      textarea.addEventListener('blur', handleBlur);
    }

    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown') {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        if ((e.ctrlKey || e.metaKey) && e.key === '=') { setFontSize(f => Math.min(24, f + 1)); return false; }
        if ((e.ctrlKey || e.metaKey) && e.key === '-') { setFontSize(f => Math.max(8, f - 1)); return false; }
        if (!isMac && e.ctrlKey && e.key === 'v') { handlePasteRef.current(); return false; }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'p')) { 
          if (e.key === 'f') setIsSearchVisible(prev => !prev);
          else setIsPaletteOpen(prev => !prev);
          return false; 
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') { 
          handleClearRef.current();
          return false; 
        }
      }
      return true;
    });

    term.onBell(() => {
      setVisualBell(true);
      setTimeout(() => setVisualBell(false), 200);
    });

    term.onScroll(() => {
      const isBottom = term.buffer.active.viewportY >= term.buffer.active.baseY - 2;
      setHasNewContent(!isBottom);
    });

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setTimeout(() => {
          try { 
            fitAddon.fit(); 
            term.focus();
          } catch { /* ignore */ }
        }, 100);
      }
    }, { threshold: 0.1 });
    observer.observe(terminalRef.current);

    const termNode = terminalRef.current;
    const handleContainerClick = () => { term.focus(); setContextMenu(null); };
    const handleContextMenu = (e: MouseEvent) => { 
      e.preventDefault(); 
      let x = e.clientX;
      let y = e.clientY;
      
      // Viewport boundary checks (Industrial Grade)
      const menuWidth = 190;
      const menuHeight = 250;
      if (x + menuWidth > window.innerWidth) x -= menuWidth;
      if (y + menuHeight > window.innerHeight) y -= menuHeight;
      if (x < 10) x = 10;
      if (y < 10) y = 10;

      setContextMenu({ x, y }); 
    };
    
    const handleTouch = (e: TouchEvent) => {
       // Only stop propagation if we are interacting with the terminal content
       // This prevents accidental sidebar swipes
       if (termNode && termNode.contains(e.target as Node)) {
          e.stopPropagation();
       }
    };

    const handleMouseUp = () => {
      if (term.hasSelection()) {
        handleCopyRef.current(true);
      }
    };

    termNode.addEventListener('click', handleContainerClick);
    termNode.addEventListener('contextmenu', handleContextMenu);
    termNode.addEventListener('mouseup', handleMouseUp);
    termNode.addEventListener('touchstart', handleTouch, { passive: true });
    termNode.addEventListener('touchmove', handleTouch, { passive: true });
    termNode.addEventListener('dragover', (e) => e.preventDefault());

    return () => {
      resizeObserver.disconnect();
      observer.disconnect();
      termNode.removeEventListener('click', handleContainerClick);
      termNode.removeEventListener('contextmenu', handleContextMenu);
      termNode.removeEventListener('mouseup', handleMouseUp);
      termNode.removeEventListener('touchstart', handleTouch);
      termNode.removeEventListener('touchmove', handleTouch);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      term.dispose();
    };
  }, [activeTabId, projectPath, theme, connect, fontSize]);

  const handleDoubleTap = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      handlePaste();
    }
    lastTapRef.current = now;
  }, [handlePaste]);

  const handleForceRestart = async () => {
    try {
      setStatus('connecting');
      await ApiService.restartSession(activeTabId, projectPath);
      connect(xtermRef.current?.cols, xtermRef.current?.rows);
    } catch { connect(); }
  };

  const handleDownload = () => {
    if (!xtermRef.current) return;
    xtermRef.current.selectAll();
    const clean = stripAnsi(xtermRef.current.getSelection());
    xtermRef.current.clearSelection();
    const blob = new Blob([clean], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal-execution-${activeTabId.slice(0, 8)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      ref={wrapperRef}
      className={`terminal-wrapper ${theme || 'light'} ${isFocusMode ? 'fullscreen-focus' : ''} ${isFocusHighlight ? 'focused' : ''} ${visualBell ? 'visual-bell-active' : ''} ${(systemError || status === 'disconnected') && !isOverlayDismissed ? 'overlay-active' : ''}`}
      onClick={() => { setContextMenu(null); setIsPaletteOpen(false); setTabContextMenu(null); }}
      onTouchEnd={isMobile ? handleDoubleTap : undefined}
    >
      <div className="terminal-tabs-bar">
         {tabs.map((tab) => (
           <div 
             key={tab.id} 
             className={`terminal-tab ${activeTabId === tab.id ? 'active' : ''} tab-color-${tab.color || 'blue'}`}
             onClick={() => handleTabSwitch(tab.id)}
             onDoubleClick={() => setEditingTabId(tab.id)}
             onContextMenu={(e) => {
               e.preventDefault();
               if (!wrapperRef.current) return;
               const rect = wrapperRef.current.getBoundingClientRect();
               let x = e.clientX - rect.left;
               let y = e.clientY - rect.top;
               
               const menuWidth = 180;
               const menuHeight = 160;
               if (x + menuWidth > rect.width) x -= menuWidth;
               if (y + menuHeight > rect.height) y -= menuHeight;
               if (x < 5) x = 5;
               if (y < 5) y = 5;

               setTabContextMenu({ x, y, id: tab.id });
             }}
           >
             <IconProcess name={tab.label} />
             {editingTabId === tab.id ? (
               <input 
                 className="tab-edit-input"
                 defaultValue={tab.label}
                 autoFocus
                 onBlur={(e) => handleTabRename(tab.id, e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleTabRename(tab.id, e.currentTarget.value)}
               />
             ) : (
               <span className="tab-label">{tab.label}</span>
             )}
             {tabs.length > 1 && <span className="tab-close" onClick={(e) => removeTab(e, tab.id)}>×</span>}
           </div>
         ))}
         <button className="add-tab-btn" onClick={addTab}>+</button>
      </div>

      <TerminalHeader 
        status={status}
        ws={wsInstance}
        isPaletteOpen={isPaletteOpen}
        isSearchVisible={isSearchVisible}
        isFocusMode={isFocusMode}
        isHelperVisible={isHelperVisible}
        isMobile={isMobile}
        searchQuery={searchQuery}
        searchMatches={searchMatches}
        onExplain={(text) => explainWithGemini(text)}
        onTogglePalette={() => setIsPaletteOpen(!isPaletteOpen)}
        onToggleSearch={() => setIsSearchVisible(!isSearchVisible)}
        onToggleFocus={() => setIsFocusMode(!isFocusMode)}
        onToggleHelper={() => setIsHelperVisible(!isHelperVisible)}
        onRestart={handleForceRestart}
        onInterrupt={() => sendKey('\x03')}
        onClear={handleClear}
        onSearch={handleSearch}
      />
      
      <div className="terminal-inner">
        <div ref={terminalRef} className="xterm-container-gemini" />
      </div>
      
      {isPaletteOpen && createPortal(
          <div className="terminal-command-palette glass-effect" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999 }} onClick={(e) => e.stopPropagation()}>
            <div className="palette-search-wrapper">
              <span className="material-symbols-outlined">search</span>
              <input 
                type="text" 
                placeholder="搜索指令或历史..." 
                autoFocus
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runCommand((e.target as HTMLInputElement).value);
                  if (e.key === 'Escape') setIsPaletteOpen(false);
                }}
              />
              <span className="palette-hint">ESC 退出</span>
            </div>
            <div className="palette-results">
              {commandHistory.length > 0 && (
                <>
                  <div className="palette-section-header">最近指令</div>
                  {commandHistory.map(h => (
                    <div key={h} className="palette-item history-item" onClick={() => runCommand(h)}>
                      <span className="material-symbols-outlined item-icon">history</span>
                      <div className="item-text"><span className="item-label">{h}</span></div>
                    </div>
                  ))}
                </>
              )}
              <div className="palette-section-header">常用操作</div>
              {QUICK_COMMANDS.map(q => (
                <div key={q.cmd} className="palette-item" onClick={() => runCommand(q.cmd)}>
                  <span className="material-symbols-outlined item-icon">{q.icon}</span>
                  <div className="item-text"><span className="item-label">{q.label}</span><span className="item-cmd">{q.cmd}</span></div>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}

        {selectionPosition && createPortal(
          <div className="terminal-selection-popup glass-effect" style={{ position: 'fixed', top: selectionPosition.y, left: selectionPosition.x, zIndex: 9999 }}>
            <button onClick={handleCopy}>
              {isCopied ? <><IconCheck /> 已复制</> : <><IconCopy /> 复制</>}
            </button>
            <div className="popup-divider" />
            <button onClick={() => { handleSearch(xtermRef.current?.getSelection() || ''); setSelectionPosition(null); }} className="ai-btn-small">
               <span className="material-symbols-outlined">search</span> 查找
            </button>
            <div className="popup-divider" />
            <button onClick={() => explainWithGemini()} className="ai-btn-small">
               <span className="material-symbols-outlined">auto_awesome</span> 解释
            </button>
          </div>,
          document.body
        )}

        {tabContextMenu && createPortal(
          <div className="terminal-context-menu glass-effect tab-menu" style={{ position: 'fixed', top: tabContextMenu.y, left: tabContextMenu.x, zIndex: 9999 }} onClick={(e) => e.stopPropagation()}>
            <div className="menu-header-label">标记颜色</div>
            <div className="color-picker-row">
               <div className="color-circle blue" onClick={() => setTabColor(tabContextMenu.id, 'blue')} />
               <div className="color-circle purple" onClick={() => setTabColor(tabContextMenu.id, 'purple')} />
               <div className="color-circle green" onClick={() => setTabColor(tabContextMenu.id, 'green')} />
               <div className="color-circle red" onClick={() => setTabColor(tabContextMenu.id, 'red')} />
            </div>
            <div className="menu-divider" />
            <div className="menu-item" onClick={() => { setEditingTabId(tabContextMenu.id); setTabContextMenu(null); }}>重命名</div>
            <div className="menu-item error-text" onClick={(e) => { removeTab(e, tabContextMenu.id); setTabContextMenu(null); }}>关闭标签</div>
          </div>,
          document.body
        )}

        {contextMenu && createPortal(
          <div className="terminal-context-menu glass-effect" style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }} onClick={(e) => e.stopPropagation()}>
            <div className="menu-item ai-action" onClick={() => explainWithGemini()}>
              <span className="material-symbols-outlined">auto_awesome</span>
              交给 Gemini 解释 (Explain)
            </div>
            <div className="menu-divider" />
            <div className="menu-item" onClick={handleCopy}><IconCopy /> 复制 (Copy) <span className="menu-shortcut">Cmd+C</span></div>
            <div className="menu-item" onClick={handlePaste}><span className="material-symbols-outlined">content_paste</span> 粘贴 (Paste) <span className="menu-shortcut">Cmd+V</span></div>
            <div className="menu-divider" />
            <div className="menu-item" onClick={handleDownload}><IconDownload /> 下载完整日志</div>
            <div className="menu-item" onClick={handleClear}><IconClear /> 清除屏幕 (Clear)</div>
          </div>,
          document.body
        )}

        {isMobile && isHelperVisible && status === 'connected' && (
          <div className="mobile-terminal-helper glass-effect">
            <div className="helper-row">
              <button className={`helper-btn latchable ${ctrlLatched ? 'latched' : ''}`} onClick={() => setCtrlLatched(!ctrlLatched)}>CTRL</button>
              <button className={`helper-btn latchable ${altLatched ? 'latched' : ''}`} onClick={() => setAltLatched(!altLatched)}>ALT</button>
              <button className="helper-btn ai-action-btn" onClick={() => explainWithGemini()}>
                <span className="material-symbols-outlined">auto_awesome</span>
              </button>
              <button className="helper-btn" onClick={() => sendKey('\x1b')}>ESC</button>
              <button className="helper-btn" onClick={() => sendKey('\t')}>TAB</button>
            </div>
            <div className="helper-row">
              <button className="helper-btn" onClick={() => sendKey('\x03')}>^C</button>
              <button className="helper-btn" onClick={() => sendKey('\x1b\x1b[5~')}>PgUp</button>
              <button className="helper-btn" onClick={() => sendKey('\x1b\x1b[6~')}>PgDn</button>
              <button className="helper-btn" onClick={() => sendKey('\x1b[A')}>↑</button>
              <button className="helper-btn" onClick={() => sendKey('\x1b[B')}>↓</button>
              <button className="helper-btn" onClick={() => sendKey('\x1b[D')}>←</button>
              <button className="helper-btn" onClick={() => sendKey('\x1b[C')}>→</button>
            </div>
          </div>
        )}

        {hasNewContent && (
          <button className="scroll-bottom-fab" onClick={scrollToBottom}>
             <IconArrowDown /> 最新输出
          </button>
        )}

        {status === 'connecting' && (
           <div className="terminal-overlay-modern">
              <div className="overlay-card-gemini glass-effect">
                 <div className="gemini-loader-container"><div className="gemini-loader-ring"></div><IconGemini /></div>
                 <h3>正在连接执行环境...</h3>
                 <p>正在拉起 Gemini 会话并建立加密隧道。这通常需要几秒钟时间。</p>
              </div>
           </div>
        )}

        {status === 'disconnected' && !systemError && !isOverlayDismissed && (
           <div className="terminal-overlay-modern">
              <div className="overlay-card-gemini glass-effect">
                 <button className="overlay-close-btn" onClick={() => setIsOverlayDismissed(true)}>×</button>
                 <div className="gemini-sparkle-container"><IconGemini /></div>
                 <h3>会话已就绪</h3>
                 <p>执行环境已准备就绪。由于安全策略，请点击下方按钮激活交互式终端会话。</p>
                 <button className="btn-gemini-glow" onClick={() => connect()}><IconRefresh /> 开启交互会话</button>
              </div>
           </div>
        )}

        {systemError && !isOverlayDismissed && (
           <div className="terminal-overlay-modern">
              <div className="overlay-card-gemini glass-effect error-border">
                 <button className="overlay-close-btn" onClick={() => setIsOverlayDismissed(true)}>×</button>
                 <div className="gemini-error-icon-container"><IconInterrupt /></div>
                 <h3>执行环境异常</h3>
                 <p className="error-msg-detail">{systemError}</p>
                 <button className="btn-gemini-glow error-bg" onClick={() => connect()}><IconRefresh /> 重新连接</button>
              </div>
           </div>
        )}

      <TerminalStatusBar ws={wsInstance} status={status} />
    </div>
  );
};

export default Terminal;
