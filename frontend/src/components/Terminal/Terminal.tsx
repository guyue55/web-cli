import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { ApiService } from '../../services/ApiService';
import '@xterm/xterm/css/xterm.css';
import {
  IconGemini, IconInterrupt, IconClear, IconCopy,
  IconRefresh, IconArrowDown, IconProcess
} from './TerminalIcons';
import { TerminalStatusBar } from './TerminalStatusBar';
import { TerminalHeader } from './TerminalHeader';

import type { TerminalProps } from '@web-cli/shared';

// eslint-disable-next-line no-control-regex
const stripAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~]*)*)?\u0007/g, '');

const QUICK_COMMANDS = [
  { cmd: '/help', label: '获取指令帮助', icon: 'help' },
  { cmd: '/memory show', label: '查看项目记忆', icon: 'neurology' },
  { cmd: '/skills list', label: '列出代理技能', icon: 'bolt' },
  { cmd: 'git status -sb', label: 'Git 简报', icon: 'account_tree' },
  { cmd: 'npm run dev', label: '启动开发服务器', icon: 'terminal' },
  { cmd: '/reset', label: '重置当前会话', icon: 'refresh' },
];

interface SessionState {
  status: 'connecting' | 'connected' | 'disconnected';
  ws: WebSocket | null;
  xterm: XTerm | null;
  searchAddon: SearchAddon | null;
  fitAddon: FitAddon | null;
}

/**
 * TerminalSession component handles the lifecycle of a single terminal session.
 */
const TerminalSession = React.memo(({ 
  id, 
  projectPath, 
  active, 
  theme, 
  fontSize, 
  initialPrompt, 
  onSessionUpdate,
  setIsCopied,
  setPasteError,
  setContextMenu,
  setSelectionPosition
}: {
  id: string;
  projectPath: string;
  active: boolean;
  theme: string;
  fontSize: number;
  initialPrompt: string | null;
  onSessionUpdate: (id: string, data: SessionState) => void;
  setIsCopied: (val: boolean) => void;
  setPasteError: (msg: string | null) => void;
  setContextMenu: (pos: { x: number, y: number } | null) => void;
  setSelectionPosition: (pos: { x: number, y: number } | null) => void;
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [systemError, setSystemError] = useState<string | null>(null);
  const [isOverlayDismissed, setIsOverlayDismissed] = useState(false);
  const [errorDetailsVisible, setErrorDetailsVisible] = useState(false);
  const [hasNewContent, setHasNewContent] = useState(false);
  const [visualBell, setVisualBell] = useState(false);

  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const executionLockedRef = useRef<string | null>(null);

  const handlersRef = useRef({ setIsCopied, setPasteError, setContextMenu, setSelectionPosition, active });
  useEffect(() => {
    handlersRef.current = { setIsCopied, setPasteError, setContextMenu, setSelectionPosition, active };
  }, [setIsCopied, setPasteError, setContextMenu, setSelectionPosition, active]);

  const handleCopy = useCallback(async (isAuto = false) => {
    const term = xtermRef.current;
    if (!term) return;
    const content = term.getSelection() || '';
    if (content) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(content);
        } else {
          throw new Error('API unavailable');
        }
        handlersRef.current.setIsCopied(true);
        setTimeout(() => handlersRef.current.setIsCopied(false), 2000);
      } catch {
        const textArea = document.createElement("textarea");
        textArea.value = content;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand("copy");
          handlersRef.current.setIsCopied(true);
          setTimeout(() => handlersRef.current.setIsCopied(false), 2000);
        } catch { /* ignore */ }
        document.body.removeChild(textArea);
      }
    }
    if (!isAuto) {
      handlersRef.current.setContextMenu(null);
      handlersRef.current.setSelectionPosition(null);
    }
  }, []);

  const handlePaste = useCallback(async (silent = false) => {
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
        if (!silent) handlersRef.current.setPasteError('浏览器不支持脚本访问剪贴板。请使用 Ctrl+V。');
        return;
      }
      // Only call readText for middle-click or menu, NOT for Ctrl+V (which is native)
      const text = await navigator.clipboard.readText();
      if (text && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
      }
    } catch {
      if (!silent) {
        handlersRef.current.setPasteError('粘贴失败，请检查浏览器权限。');
        setTimeout(() => handlersRef.current.setPasteError(null), 4000);
      }
    }
    handlersRef.current.setContextMenu(null);
  }, []);

  const handleSelectionChange = useCallback(() => {
    const term = xtermRef.current;
    if (!term || !handlersRef.current.active) return;
    if (term.hasSelection()) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        handlersRef.current.setSelectionPosition({ 
           x: Math.round(rect.left + rect.width / 2), 
           y: Math.round(rect.top - 58) 
        });
      }
    } else {
      handlersRef.current.setSelectionPosition(null);
    }
  }, []);

  const connect = useCallback((initialCols?: number, initialRows?: number) => {
    // 1. Cleanup previous connection and timers
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (connTimeoutRef.current) {
      clearTimeout(connTimeoutRef.current);
      connTimeoutRef.current = null;
    }
    if (stableTimerRef.current) {
      clearTimeout(stableTimerRef.current);
      stableTimerRef.current = null;
    }

    let isConnected = false;
    setStatus('connecting');
    setIsOverlayDismissed(false);
    // Only reset error if this is a fresh manual attempt (reconnectAttemptsRef.current === 0)
    if (reconnectAttemptsRef.current === 0) setSystemError(null);

    const host = window.location.hostname || 'localhost';
    const isDefaultPort =
      window.location.port === '' ||
      window.location.port === '80' ||
      window.location.port === '443';
    const dimensions = initialCols ? `&cols=${initialCols}&rows=${initialRows}` : '';
    const wsBase = isDefaultPort
      ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws`
      : `ws://${host}:3001`;
    const wsUrl = `${wsBase}?uuid=${id}&projectPath=${encodeURIComponent(projectPath)}${dimensions}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // 3. Connection timeout (15s)
    connTimeoutRef.current = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn('[Terminal] Connection timed out');
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
        handleFailure({ code: 4008, reason: 'Connection Timeout' });
      }
    }, 15000);

    const handleFailure = (errInfo: { code?: number, reason?: string }) => {
      if (connTimeoutRef.current) {
        clearTimeout(connTimeoutRef.current);
        connTimeoutRef.current = null;
      }
      if (stableTimerRef.current) {
        clearTimeout(stableTimerRef.current);
        stableTimerRef.current = null;
      }
      
      if (reconnectAttemptsRef.current < 3) {
        reconnectAttemptsRef.current += 1;
        setStatus('connecting');
        const delay = 1000 * Math.min(reconnectAttemptsRef.current, 5);
        reconnectTimerRef.current = setTimeout(() => connect(initialCols, initialRows), delay);
      } else {
        setStatus('disconnected');
        setSystemError(`执行环境异常 (代码: ${errInfo.code || 'N/A'})。已重试 3 次均失败，请检查配置或后端服务。`);
      }
    };

    ws.onopen = () => {
      if (connTimeoutRef.current) {
        clearTimeout(connTimeoutRef.current);
        connTimeoutRef.current = null;
      }
      isConnected = true;
      setStatus('connected');
      setSystemError(null);
      
      // Only reset retry count if connection is stable for 5s
      stableTimerRef.current = setTimeout(() => {
        reconnectAttemptsRef.current = 0;
      }, 5000);

      if (!initialCols && xtermRef.current) {
        fitAddonRef.current?.fit();
        const { cols, rows } = xtermRef.current;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    };

    ws.onclose = (event) => {
      if (connTimeoutRef.current) {
        clearTimeout(connTimeoutRef.current);
        connTimeoutRef.current = null;
      }
      if (stableTimerRef.current) {
        clearTimeout(stableTimerRef.current);
        stableTimerRef.current = null;
      }

      isConnected = false;
      if (event.code === 1000) {
        setStatus('disconnected');
        return;
      }
      handleFailure({ code: event.code, reason: event.reason || 'WebSocket closed' });
    };

    ws.onerror = (err) => {
      if (connTimeoutRef.current) {
        clearTimeout(connTimeoutRef.current);
        connTimeoutRef.current = null;
      }
      console.error('[Terminal] WebSocket Error:', err);
      // handleFailure will be triggered by onclose following error
    };

    const writeBuffer: string[] = [];
    let rafId: number;
    let isInitialBuffer = true;
    let hasReceivedData = false;

    const flushBuffer = async () => {
      if (writeBuffer.length > 0 && xtermRef.current) {
        const term = xtermRef.current;
        const isAtBottom = term.buffer.active.viewportY >= term.buffer.active.baseY - 1;
        term.write(writeBuffer.join(''));
        writeBuffer.length = 0;
        if (isAtBottom) term.scrollToBottom();
      }
      rafId = requestAnimationFrame(() => flushBuffer());
    };
    rafId = requestAnimationFrame(() => flushBuffer());

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'output' && xtermRef.current) {
          const data = payload.data;
          if (data) hasReceivedData = true;
          writeBuffer.push(data);
          if (!isInitialBuffer && (data.includes('[System Error]') || data.includes('[Critical Error]'))) {
            setSystemError(stripAnsi(data).replace(/\[(System|Critical) Error\]/, '').trim());
          }
          isInitialBuffer = false;
        } else if (payload.type === 'exit') {
          if (isConnected) {
             isConnected = false;
             handleFailure({ code: 4009, reason: 'Session Exited' });
          }
        }
      } catch { /* ignore */ }
    };

    // Auto-send initial prompt once connected AND we've seen some output
    const checkReady = setInterval(() => {
      if (initialPrompt && isConnected && hasReceivedData && wsRef.current?.readyState === WebSocket.OPEN) {
        const lockKey = `${id}-${initialPrompt}`;
        if (executionLockedRef.current !== lockKey) {
          wsRef.current.send(JSON.stringify({ type: 'input', data: initialPrompt + '\r' }));
          executionLockedRef.current = lockKey;
          clearInterval(checkReady);
        }
      }
    }, 100);

    ws.addEventListener('close', () => {
       cancelAnimationFrame(rafId);
       clearInterval(checkReady);
    });
  }, [id, projectPath, initialPrompt]);

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
    
    const resizeObserver = new ResizeObserver(() => {
       if (terminalRef.current?.offsetParent && fitAddonRef.current) {
          fitAddonRef.current.fit();
          if (wsRef.current?.readyState === WebSocket.OPEN && xtermRef.current) {
             wsRef.current.send(JSON.stringify({ type: 'resize', cols: xtermRef.current.cols, rows: xtermRef.current.rows }));
          }
       }
    });
    resizeObserver.observe(terminalRef.current);

    setTimeout(() => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        connect(xtermRef.current.cols, xtermRef.current.rows);
      }
    }, 300);

    term.onData(data => {
      if (data.startsWith('\x1b[?')) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    term.onBell(() => {
      setVisualBell(true);
      setTimeout(() => setVisualBell(false), 200);
    });

    term.onScroll(() => {
      const isBottom = term.buffer.active.viewportY >= term.buffer.active.baseY - 2;
      setHasNewContent(!isBottom);
    });

    term.onSelectionChange(() => handleSelectionChange());

    // Auto-copy on select
    const handleMouseUpInner = () => {
      if (term.hasSelection()) {
        handleCopy(true);
      }
    };

    const handleMouseDownInner = (e: MouseEvent) => {
      if (e.button === 1) { // Middle click
        e.preventDefault();
        handlePaste(true);
      }
    };

    const handleContextMenuInner = (e: MouseEvent) => {
      e.preventDefault();
      handlersRef.current.setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const termNode = terminalRef.current;
    termNode.addEventListener('mouseup', handleMouseUpInner);
    termNode.addEventListener('mousedown', handleMouseDownInner);
    termNode.addEventListener('contextmenu', handleContextMenuInner);

    // Keyboard shortcuts - prioritized native behavior for paste
    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown') {
        const isCopy = (e.ctrlKey || e.metaKey) && e.key === 'c';
        const isPaste = (e.ctrlKey || e.metaKey) && e.key === 'v';

        if (isCopy && term.hasSelection()) {
          // Native behavior for copy usually works well if selection is captured.
          // Force update system clipboard if needed.
          handleCopy(); 
          return false;
        }

        if (isPaste) {
          // DO NOT prevent default. Let browser's native paste handler in terminal's hidden textarea work.
          // This ensures the MOST RECENT system clipboard content is pasted.
          return true;
        }
      }
      return true;
    });

    return () => {
      resizeObserver.disconnect();
      termNode.removeEventListener('mouseup', handleMouseUpInner);
      termNode.removeEventListener('mousedown', handleMouseDownInner);
      termNode.removeEventListener('contextmenu', handleContextMenuInner);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      term.dispose();
    };
  }, [id, projectPath, theme, fontSize, connect, handleCopy, handlePaste, handleSelectionChange]);

  useEffect(() => {
    if (active && xtermRef.current && fitAddonRef.current) {
      // Multiple attempts to ensure layout is settled
      const attemptFit = () => {
        const termNode = terminalRef.current;
        if (termNode && termNode.clientWidth > 0 && fitAddonRef.current) {
          fitAddonRef.current.fit();
          xtermRef.current?.focus();
          // Sync size if connected
          if (wsRef.current?.readyState === WebSocket.OPEN && xtermRef.current) {
             wsRef.current.send(JSON.stringify({ type: 'resize', cols: xtermRef.current.cols, rows: xtermRef.current.rows }));
          }
        }
      };

      attemptFit();
      const timers = [100, 300, 600, 1000, 2000].map(ms => setTimeout(attemptFit, ms));
      
      return () => timers.forEach(clearTimeout);
    }
  }, [active]);

  const [hasEverBeenActive, setHasEverBeenActive] = useState(active);
  useEffect(() => {
    if (active) setHasEverBeenActive(true);
  }, [active]);

  useEffect(() => {
    if (hasEverBeenActive && status === 'disconnected' && !systemError && !isOverlayDismissed) {
       connect();
    }
  }, [hasEverBeenActive, status, systemError, isOverlayDismissed, connect]);

  useEffect(() => {
    onSessionUpdate(id, {
      status,
      ws: wsRef.current,
      xterm: xtermRef.current,
      searchAddon: searchAddonRef.current,
      fitAddon: fitAddonRef.current
    });
  }, [id, status, onSessionUpdate]);

  const scrollToBottom = () => {
    if (xtermRef.current) {
      xtermRef.current.scrollToBottom();
      setHasNewContent(false);
    }
  };

  const copyErrorToClipboard = (text: string) => {
    const cleanText = stripAnsi(text);
    navigator.clipboard.writeText(cleanText);
  };

  return (
    <div className={`terminal-session-container ${active ? 'active' : 'hidden'} ${visualBell ? 'visual-bell-active' : ''}`} style={{ display: active ? 'flex' : 'none', flex: 1, flexDirection: 'column', position: 'relative', height: '100%', width: '100%' }}>
      <div className="terminal-inner">
        <div ref={terminalRef} className="xterm-container-gemini" />
      </div>

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

      {systemError && !isOverlayDismissed && status !== 'connected' && (
         <div className="terminal-overlay-modern">
            <div className="overlay-card-gemini glass-effect error-border">
               <button className="overlay-close-btn" onClick={() => setIsOverlayDismissed(true)}>×</button>
               <div className="gemini-error-icon-container"><IconInterrupt /></div>
               <h3>执行环境异常</h3>
               <div className="error-msg-container" onMouseEnter={() => setErrorDetailsVisible(true)} onMouseLeave={() => setErrorDetailsVisible(false)}>
                 <p className="error-msg-detail">{systemError.length > 150 ? systemError.slice(0, 150) + '...' : systemError}</p>
                 {errorDetailsVisible && systemError.length > 150 && (
                   <div className="error-details-tooltip glass-effect">{systemError}</div>
                 )}
               </div>
               <div className="error-actions">
                 <button className="btn-gemini-glow error-bg" onClick={() => connect()}><IconRefresh /> 重新连接</button>
                 <button className="btn-gemini-outline" onClick={() => copyErrorToClipboard(systemError)}>
                   <IconCopy /> 复制错误详情
                 </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
});

const Terminal: React.FC<TerminalProps> = React.memo(({ uuid, projectPath, initialPrompt, theme, onSendToChat }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [fontSize] = useState(14);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState({ current: 0, total: 0 });
  const [isCopied, setIsCopied] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [selectionPosition, setSelectionPosition] = useState<{ x: number, y: number } | null>(null);
  
  const [ctrlLatched, setCtrlLatched] = useState(false);
  const [altLatched, setAltLatched] = useState(false);
  const [isHelperVisible, setIsHelperVisible] = useState(true);

  const [tabs, setTabs] = useState<{id: string, label: string, color?: string}[]>(() => {
    const saved = localStorage.getItem('terminal_tabs_v4');
    return saved ? JSON.parse(saved) : [{ id: uuid, label: 'Gemini', color: 'blue' }];
  });
  const [activeTabId, setActiveTabId] = useState(uuid);
  const [sessionData, setSessionData] = useState<Record<string, SessionState>>({});
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number, y: number, id: string } | null>(null);

  const [commandHistory, setHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('terminal_cmd_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (uuid) {
      setActiveTabId(uuid);
      setTabs(prev => {
        if (prev.some(t => t.id === uuid)) return prev;
        const newTabs = [...prev, { id: uuid, label: `会话 ${prev.length + 1}`, color: 'blue' }];
        localStorage.setItem('terminal_tabs_v4', JSON.stringify(newTabs));
        return newTabs;
      });
    }
  }, [uuid]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768 || /Android|iPhone/i.test(navigator.userAgent));
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const activeSession = useMemo(() => sessionData[activeTabId] || { status: 'disconnected', ws: null, xterm: null, searchAddon: null, fitAddon: null }, [sessionData, activeTabId]);

  const handleSessionUpdate = useCallback((id: string, data: SessionState) => {
    setSessionData(prev => ({ ...prev, [id]: data }));
  }, []);

  const handleTabSwitch = (id: string) => {
    setActiveTabId(id);
    localStorage.setItem('terminal_active_tab_id', id);
  };

  const addTab = () => {
    const newId = `new-tab-${Date.now()}`;
    const newTabs = [...tabs, { id: newId, label: `会话 ${tabs.length + 1}`, color: 'blue' }];
    setTabs(newTabs);
    setActiveTabId(newId);
    localStorage.setItem('terminal_tabs_v4', JSON.stringify(newTabs));
  };

  const removeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    localStorage.setItem('terminal_tabs_v4', JSON.stringify(newTabs));
    if (activeTabId === id) setActiveTabId(newTabs[0].id);
    setSessionData(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const sendKey = useCallback((key: string) => {
    const ws = activeSession.ws;
    if (ws?.readyState === WebSocket.OPEN) {
      let finalKey = key;
      if (ctrlLatched && key.length === 1) {
        const code = key.toUpperCase().charCodeAt(0) - 64;
        if (code >= 1 && code <= 26) finalKey = String.fromCharCode(code);
        setCtrlLatched(false);
      } else if (altLatched && key.length === 1) {
        finalKey = '\x1b' + key;
        setAltLatched(false);
      }
      ws.send(JSON.stringify({ type: 'input', data: finalKey }));
    }
  }, [activeSession.ws, ctrlLatched, altLatched]);

  const handleClear = useCallback(() => {
    const { xterm, ws } = activeSession;
    if (xterm) { xterm.clear(); xterm.reset(); }
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data: '\x1b[2J\x1b[H\x0c' }));
    }
    setContextMenu(null);
  }, [activeSession]);

  const handleCopyGlobal = useCallback(async () => {
    const { xterm } = activeSession;
    if (xterm) {
      const content = xterm.getSelection() || '';
      if (content) {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(content);
          } else {
            throw new Error('API unavailable');
          }
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        } catch {
          const textArea = document.createElement("textarea");
          textArea.value = content;
          textArea.style.position = "fixed";
          textArea.style.left = "-9999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            document.execCommand("copy");
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
          } catch { /* ignore */ }
          document.body.removeChild(textArea);
        }
      }
    }
    setContextMenu(null);
    setSelectionPosition(null);
  }, [activeSession]);

  const handlePasteGlobal = useCallback(async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const text = await navigator.clipboard.readText();
        const ws = activeSession.ws;
        if (text && ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data: text }));
        }
      } else {
        setPasteError('浏览器不支持脚本访问剪贴板。请使用 Ctrl+V。');
      }
    } catch {
      setPasteError('粘贴失败，请检查浏览器权限。');
      setTimeout(() => setPasteError(null), 4000);
    }
    setContextMenu(null);
  }, [activeSession.ws]);

  const handleSearch = useCallback((query: string, direction: 'next' | 'prev' = 'next', isIncremental = false) => {
    setSearchQuery(query);
    const { searchAddon } = activeSession;
    if (searchAddon && query) {
      const found = direction === 'next' 
        ? searchAddon.findNext(query, { incremental: isIncremental })
        : searchAddon.findPrevious(query, { incremental: isIncremental });
      setSearchMatches({ current: found ? 1 : 0, total: found ? 1 : 0 });
    } else {
      setSearchMatches({ current: 0, total: 0 });
    }
  }, [activeSession]);

  const runCommand = useCallback((cmd: string) => {
    const ws = activeSession.ws;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data: cmd + '\r' }));
      const newHistory = [cmd, ...commandHistory.filter(h => h !== cmd)].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem('terminal_cmd_history', JSON.stringify(newHistory));
    }
    setIsPaletteOpen(false);
  }, [activeSession.ws, commandHistory]);

  const explainWithGemini = useCallback((customText?: string) => {
    if (!onSendToChat) return;
    const { xterm } = activeSession;
    let textToExplain = customText || xterm?.getSelection();
    
    if (!textToExplain && xterm) {
      const buffer = xterm.buffer.active;
      textToExplain = '';
      for (let i = Math.max(0, buffer.length - 60); i < buffer.length; i++) {
        textToExplain += buffer.getLine(i)?.translateToString() + '\n';
      }
    }

    if (textToExplain) {
      onSendToChat(`请帮我分析这段终端输出：\n\n\`\`\`\n${stripAnsi(textToExplain)}\n\`\`\``);
      setContextMenu(null);
      setSelectionPosition(null);
    }
  }, [activeSession, onSendToChat]);

  const handleRestart = async () => {
    try {
      await ApiService.restartSession(activeTabId, projectPath);
    } catch { /* ignore */ }
  };

  const getFilteredPaletteItems = useCallback(() => {
    const items = [
      ...commandHistory.map(h => ({ cmd: h, label: h, type: 'history', icon: 'history' })),
      ...QUICK_COMMANDS.map(q => ({ ...q, type: 'action' }))
    ];
    if (!searchQuery) return items;
    return items.filter(i => i.cmd.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [commandHistory, searchQuery]);

  return (
    <div 
      ref={wrapperRef}
      className={`terminal-wrapper ${theme || 'light'} ${isFocusMode ? 'fullscreen-focus' : ''}`}
      onClick={() => { setContextMenu(null); setIsPaletteOpen(false); setTabContextMenu(null); }}
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
               const rect = wrapperRef.current?.getBoundingClientRect();
               if (rect) setTabContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, id: tab.id });
             }}
           >
             <IconProcess name={tab.label} />
             {editingTabId === tab.id ? (
               <input 
                 className="tab-edit-input"
                 defaultValue={tab.label}
                 autoFocus
                 onBlur={(e) => {
                   const newTabs = tabs.map(t => t.id === tab.id ? { ...t, label: e.target.value || t.label } : t);
                   setTabs(newTabs);
                   localStorage.setItem('terminal_tabs_v4', JSON.stringify(newTabs));
                   setEditingTabId(null);
                 }}
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
        status={activeSession.status}
        ws={activeSession.ws}
        isPaletteOpen={isPaletteOpen}
        isSearchVisible={isSearchVisible}
        isFocusMode={isFocusMode}
        isHelperVisible={isHelperVisible}
        isMobile={isMobile}
        searchQuery={searchQuery}
        searchMatches={searchMatches}
        onExplain={explainWithGemini}
        onTogglePalette={() => setIsPaletteOpen(!isPaletteOpen)}
        onToggleSearch={() => setIsSearchVisible(!isSearchVisible)}
        onToggleFocus={() => setIsFocusMode(!isFocusMode)}
        onToggleHelper={() => setIsHelperVisible(!isHelperVisible)}
        onRestart={handleRestart}
        onInterrupt={() => sendKey('\x03')}
        onClear={handleClear}
        onSearch={handleSearch}
      />
      
      <div className="terminal-inner">
        {tabs.map(tab => (
          <TerminalSession 
            key={tab.id}
            id={tab.id}
            active={tab.id === activeTabId}
            projectPath={projectPath}
            theme={theme || 'light'}
            fontSize={fontSize}
            initialPrompt={tab.id === uuid ? (initialPrompt || null) : null}
            onSessionUpdate={handleSessionUpdate}
            setIsCopied={setIsCopied}
            setPasteError={setPasteError}
            setContextMenu={setContextMenu}
            setSelectionPosition={setSelectionPosition}
          />
        ))}
      </div>

      {isPaletteOpen && createPortal(
          <div className="terminal-command-palette glass-premium" style={{ position: 'fixed', top: '15%', left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}>
            <div className="palette-search-wrapper">
              <span className="material-symbols-outlined" style={{ color: 'var(--accent-blue)' }}>search</span>
              <input 
                type="text" 
                placeholder="键入指令或检索最近记录..." 
                autoFocus
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="palette-results">
              {getFilteredPaletteItems().map((item, idx) => (
                <div key={idx} className="palette-item" onClick={() => runCommand(item.cmd)}>
                  <span className="material-symbols-outlined item-icon">{item.icon}</span>
                  <div className="item-text"><span className="item-label">{item.label}</span></div>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}

      {contextMenu && createPortal(
        <div className="terminal-context-menu glass-effect" style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}>
          <div className="menu-item ai-action" onClick={() => explainWithGemini()}>
            <span className="material-symbols-outlined">auto_awesome</span>
            交给 Gemini 解释
          </div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={handleCopyGlobal}><IconCopy /> 复制 (Copy)</div>
          <div className="menu-item" onClick={handlePasteGlobal}><span className="material-symbols-outlined">content_paste</span> 粘贴 (Paste)</div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={handleClear}><IconClear /> 清除屏幕</div>
        </div>,
        document.body
      )}

      {selectionPosition && createPortal(
        <div className="terminal-selection-popup glass-effect" style={{ position: 'fixed', top: selectionPosition.y, left: selectionPosition.x, zIndex: 9999 }}>
          <button onClick={handleCopyGlobal}><IconCopy /> 复制</button>
          <div className="popup-divider" />
          <button onClick={() => explainWithGemini()} className="ai-btn-small"><span className="material-symbols-outlined">auto_awesome</span> 解释</button>
        </div>,
        document.body
      )}

      {tabContextMenu && createPortal(
        <div className="terminal-context-menu glass-effect tab-menu" style={{ position: 'fixed', top: tabContextMenu.y, left: tabContextMenu.x, zIndex: 9999 }} onClick={(e) => e.stopPropagation()}>
          <div className="menu-item" onClick={() => { setEditingTabId(tabContextMenu.id); setTabContextMenu(null); }}>重命名</div>
          <div className="menu-item error-text" onClick={(e) => { removeTab(e, tabContextMenu.id); setTabContextMenu(null); }}>关闭标签</div>
        </div>,
        document.body
      )}

      {isMobile && isHelperVisible && (
        <div className="mobile-terminal-helper glass-effect">
          <div className="helper-row">
            <button className={`helper-btn ${ctrlLatched ? 'latched' : ''}`} onClick={() => setCtrlLatched(!ctrlLatched)}>CTRL</button>
            <button className={`helper-btn ${altLatched ? 'latched' : ''}`} onClick={() => setAltLatched(!altLatched)}>ALT</button>
            <button className="helper-btn" onClick={() => sendKey('\t')}>TAB</button>
            <button className="helper-btn" onClick={() => sendKey('\x1b')}>ESC</button>
          </div>
          <div className="helper-row">
            <button className="helper-btn" onClick={() => sendKey('\x1b[A')}>↑</button>
            <button className="helper-btn" onClick={() => sendKey('\x1b[B')}>↓</button>
            <button className="helper-btn" onClick={() => sendKey('\x1b[D')}>←</button>
            <button className="helper-btn" onClick={() => sendKey('\x1b[C')}>→</button>
          </div>
        </div>
      )}

      {isCopied && createPortal(<div className="gemini-copy-toast glass-effect">已复制</div>, document.body)}
      {pasteError && createPortal(<div className="gemini-copy-toast glass-effect error-toast">{pasteError}</div>, document.body)}
      
      <TerminalStatusBar ws={activeSession.ws} status={activeSession.status} />
    </div>
  );
});

export default Terminal;
