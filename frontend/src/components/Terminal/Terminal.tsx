import React, { useEffect, useRef, useState, useCallback } from 'react';
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

// --- Helper Utilities ---
// eslint-disable-next-line no-control-regex
const stripAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~]*)*)?\u0007/g, '');

const Terminal: React.FC<TerminalProps> = ({ uuid, projectPath, initialPrompt, theme }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [systemError, setSystemError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [hasNewContent, setHasNewContent] = useState(false);
  const [isPulseActive, setIsPulseActive] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [visualBell, setVisualBell] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [selectionPosition, setSelectionPosition] = useState<{ x: number, y: number } | null>(null);
  const [ctrlLatched, setCtrlLatched] = useState(false);
  const [altLatched, setAltLatched] = useState(false);
  const [isHelperVisible, setIsHelperVisible] = useState(true);

  const lastTapRef = useRef<number>(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const executionLockedRef = useRef<string | null>(null);
  const connectRef = useRef<(cols?: number, rows?: number) => void>(() => {});
  const maxReconnectAttempts = 5;

  const QUICK_COMMANDS = [
    { cmd: '/help', label: '获取全部指令帮助' },
    { cmd: '/memory show', label: '查看当前项目记忆' },
    { cmd: '/skills list', label: '列出已加载的代理技能' },
    { cmd: 'ls -laR', label: '递归列出所有文件' },
    { cmd: 'git status -sb', label: '精简版 Git 状态' },
    { cmd: 'npm run dev', label: '启动本地开发服务器' },
    { cmd: '/reset', label: '强制重置当前会话' },
    { cmd: '/exit', label: '关闭并安全退出会话' },
  ];

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|iPhone/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && xtermRef.current && fitAddonRef.current) {
        setTimeout(() => {
          try { 
            fitAddonRef.current?.fit(); 
            xtermRef.current?.focus();
          } catch { /* ignore */ }
        }, 50);
      }
    }, { threshold: 0.1 });

    if (terminalRef.current) observer.observe(terminalRef.current);

    return () => {
      window.removeEventListener('resize', checkMobile);
      observer.disconnect();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
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
    }
  }, [ctrlLatched, altLatched]);

  const handleCopy = useCallback(() => {
    if (xtermRef.current) {
      const content = xtermRef.current.getSelection() || '';
      if (content) {
        navigator.clipboard.writeText(content);
      } else {
        xtermRef.current.selectAll();
        navigator.clipboard.writeText(xtermRef.current.getSelection());
        xtermRef.current.clearSelection();
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      setContextMenu(null);
      setSelectionPosition(null);
    }
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
      }
    } catch (err) {
      console.error('Failed to read clipboard', err);
    }
    setContextMenu(null);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    searchAddonRef.current?.findNext(query);
  }, []);

  const runCommand = useCallback((cmd: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: cmd + '\r' }));
    }
    setIsLibraryOpen(false);
  }, []);

  const handleSelectionChange = useCallback(() => {
    if (!xtermRef.current) return;
    const selection = xtermRef.current.getSelection();
    if (selection && selection.length > 0) {
      const range = window.getSelection()?.getRangeAt(0).getBoundingClientRect();
      if (range) {
        setSelectionPosition({ x: range.left + range.width / 2, y: range.top - 40 });
      }
    } else {
      setSelectionPosition(null);
    }
  }, []);

  const connect = useCallback((initialCols?: number, initialRows?: number) => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

    setStatus('connecting');
    setSystemError(null);

    const host = window.location.hostname || 'localhost';
    const dimensions = initialCols ? `&cols=${initialCols}&rows=${initialRows}` : '';
    const wsUrl = `ws://${host}:3001?uuid=${uuid}&projectPath=${encodeURIComponent(projectPath)}${dimensions}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      reconnectAttemptsRef.current = 0;
      if (!initialCols && xtermRef.current) {
        fitAddonRef.current?.fit();
        const { cols, rows } = xtermRef.current;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
      if (initialPrompt && executionLockedRef.current !== `${uuid}-${initialPrompt}`) {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data: initialPrompt + '\r' }));
            executionLockedRef.current = `${uuid}-${initialPrompt}`;
          }
        }, 600);
      } else if (!initialPrompt) {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data: '\x0c' }));
          }
        }, 400);
      }
      setTimeout(() => {
        xtermRef.current?.focus();
        fitAddonRef.current?.fit();
      }, 100);
    };

    ws.onclose = (event) => {
      setStatus('disconnected');
      if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        reconnectTimerRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connectRef.current(initialCols, initialRows);
        }, delay);
      }
    };

    ws.onerror = () => setStatus('disconnected');

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'output' && xtermRef.current) {
          const term = xtermRef.current;
          const isAtBottom = term.buffer.active.viewportY >= term.buffer.active.baseY - 1;
          term.write(payload.data);
          if (payload.data.includes('[System Error]') || payload.data.includes('[Critical Error]')) {
            setSystemError(stripAnsi(payload.data).replace(/\[(System|Critical) Error\]/, '').trim());
          }
          if (isAtBottom) term.scrollToBottom();
          setIsPulseActive(true);
          setTimeout(() => setIsPulseActive(false), 200);
        } else if (payload.type === 'exit') {
          setStatus('disconnected');
        }
      } catch { /* ignore */ }
    };
  }, [uuid, projectPath, initialPrompt]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (!terminalRef.current) return;
    const isDark = theme === 'dark';
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Google Sans Mono", "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
      theme: {
        background: isDark ? '#131314' : '#ffffff',
        foreground: isDark ? '#e3e3e3' : '#1f1f1f',
        cursor: '#4285f4',
        cursorAccent: isDark ? '#131314' : '#ffffff',
        selectionBackground: isDark ? 'rgba(138, 180, 248, 0.3)' : 'rgba(66, 133, 244, 0.2)',
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
      scrollback: 10000,
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
    fitAddon.fit();
    connect(term.cols, term.rows);

    term.onData(data => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    term.onScroll(() => {
      const isBottom = term.buffer.active.viewportY >= term.buffer.active.baseY - 2;
      setHasNewContent(!isBottom);
    });

    term.onBell(() => {
      setVisualBell(true);
      setTimeout(() => setVisualBell(false), 200);
    });

    term.onSelectionChange(() => handleSelectionChange());

    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown') {
        if (!((navigator.platform.toUpperCase().indexOf('MAC') >= 0)) && e.ctrlKey && e.key === 'v') {
          handlePaste();
          return false;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
          setIsSearchVisible(prev => !prev);
          return false;
        }
      }
      return true;
    });

    term.onResize(size => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols: size.cols, rows: size.rows }));
      }
    });

    const termNode = terminalRef.current;
    const handleContainerClick = () => { term.focus(); setContextMenu(null); };
    const handleContextMenu = (e: MouseEvent) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }); };
    
    termNode.addEventListener('click', handleContainerClick);
    termNode.addEventListener('contextmenu', handleContextMenu);

    return () => {
      termNode.removeEventListener('click', handleContainerClick);
      termNode.removeEventListener('contextmenu', handleContextMenu);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      term.dispose();
    };
  }, [uuid, projectPath, theme, connect, handlePaste, handleSelectionChange]);

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
      await ApiService.restartSession(uuid, projectPath);
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
    a.download = `terminal-execution-${uuid.slice(0, 8)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className={`terminal-wrapper ${theme || 'light'} ${isFocusMode ? 'fullscreen-focus' : ''} ${visualBell ? 'visual-bell-active' : ''}`}
      onClick={() => setContextMenu(null)}
      onTouchEnd={isMobile ? handleDoubleTap : undefined}
    >
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
           <span className="status-text">{status === 'connected' ? '执行中' : status === 'connecting' ? '正在连接' : '会话已断开'}</span>
        </div>
        
        <div className="toolbar-actions-group">
           {isSearchVisible && (
             <div className="terminal-search-bar">
               <input 
                 type="text" 
                 placeholder="在终端中查找..." 
                 value={searchQuery}
                 onChange={(e) => handleSearch(e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') searchAddonRef.current?.findNext(searchQuery);
                   if (e.key === 'Escape') setIsSearchVisible(false);
                 }}
                 autoFocus
               />
               <button onClick={() => searchAddonRef.current?.findPrevious(searchQuery)}><IconArrowDown /></button>
               <button onClick={() => setIsSearchVisible(false)}><IconInterrupt /></button>
             </div>
           )}

           {isMobile && (
             <button 
               className={`terminal-btn-gemini ${isHelperVisible ? 'active' : ''}`}
               onClick={() => setIsHelperVisible(!isHelperVisible)}
             >
               <span className="material-symbols-outlined">keyboard</span>
             </button>
           )}

           <div className="command-library-container">
             <button 
               className={`terminal-btn-gemini ${isLibraryOpen ? 'active' : ''}`}
               onClick={() => setIsLibraryOpen(!isLibraryOpen)}
             >
               <span className="material-symbols-outlined">auto_fix_high</span>
             </button>
             {isLibraryOpen && (
               <div className="command-library-dropdown glass-effect">
                 <div className="dropdown-header">常用指令</div>
                 {QUICK_COMMANDS.map(q => (
                   <div key={q.cmd} className="dropdown-item" onClick={() => runCommand(q.cmd)}>
                     <span className="q-cmd">{q.cmd}</span>
                     <span className="q-label">{q.label}</span>
                   </div>
                 ))}
               </div>
             )}
           </div>

           <div className="action-button-group">
             <button className="terminal-btn-gemini" title="中断 (Ctrl+C)" onClick={() => sendKey('\x03')}><IconInterrupt /></button>
             <button className="terminal-btn-gemini" title="重置终端" onClick={() => xtermRef.current?.reset()}><IconClear /></button>
           </div>

           <div className="action-button-group">
             <button className="terminal-btn-gemini" title="复制内容" onClick={handleCopy}>{isCopied ? <IconCheck /> : <IconCopy />}</button>
             <button className="terminal-btn-gemini" title="下载日志" onClick={handleDownload}><IconDownload /></button>
           </div>

           <div className="action-button-group">
             <button className="terminal-btn-gemini" onClick={() => setIsFocusMode(!isFocusMode)}>{isFocusMode ? <IconShrink /> : <IconExpand />}</button>
             <button className="terminal-btn-official-accent" onClick={() => handleForceRestart()}><IconRefresh /></button>
           </div>
        </div>
      </div>
      
      <div className="terminal-inner">
        <div ref={terminalRef} className="xterm-container-gemini" />
        
        {selectionPosition && (
          <div className="terminal-selection-popup glass-effect" style={{ top: selectionPosition.y, left: selectionPosition.x }}>
            <button onClick={handleCopy}><IconCopy /> 复制</button>
          </div>
        )}

        {contextMenu && (
          <div className="terminal-context-menu glass-effect" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
            <div className="menu-item" onClick={handleCopy}><IconCopy /> 复制 (Copy)</div>
            <div className="menu-item" onClick={handlePaste}><IconDownload /> 粘贴 (Paste)</div>
            <div className="menu-divider" />
            <div className="menu-item" onClick={() => { xtermRef.current?.reset(); setContextMenu(null); }}><IconClear /> 清除屏幕 (Clear)</div>
          </div>
        )}

        {isMobile && isHelperVisible && status === 'connected' && (
          <div className="mobile-terminal-helper glass-effect">
            <div className="helper-row">
              <button className={`helper-btn latchable ${ctrlLatched ? 'latched' : ''}`} onClick={() => setCtrlLatched(!ctrlLatched)}>CTRL</button>
              <button className={`helper-btn latchable ${altLatched ? 'latched' : ''}`} onClick={() => setAltLatched(!altLatched)}>ALT</button>
              <button className="helper-btn" onClick={() => sendKey('\x1b')}>ESC</button>
              <button className="helper-btn" onClick={() => sendKey('\t')}>TAB</button>
              <button className="helper-btn" onClick={() => sendKey('\x03')}>^C</button>
            </div>
            <div className="helper-row">
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
          <button className="scroll-bottom-fab" onClick={() => xtermRef.current?.scrollToBottom()}>
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

        {status === 'disconnected' && !systemError && (
           <div className="terminal-overlay-modern">
              <div className="overlay-card-gemini glass-effect">
                 <div className="gemini-sparkle-container"><IconGemini /></div>
                 <h3>会话已就绪</h3>
                 <p>执行环境已准备就绪。由于安全策略，请点击下方按钮激活交互式终端会话。</p>
                 <button className="btn-gemini-glow" onClick={() => connect()}><IconRefresh /> 开启交互会话</button>
              </div>
           </div>
        )}

        {systemError && (
           <div className="terminal-overlay-modern">
              <div className="overlay-card-gemini glass-effect error-border">
                 <div className="gemini-error-icon-container"><IconInterrupt /></div>
                 <h3>执行环境报错</h3>
                 <p className="error-msg-detail">{systemError}</p>
                 <button className="btn-gemini-glow error-bg" onClick={() => connect()}><IconRefresh /> 重试连接</button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default Terminal;
