import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
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
const stripAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~]*)*)?\u0007/g, '');

const Terminal: React.FC<TerminalProps> = ({ uuid, projectPath, initialPrompt, theme }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [systemError, setSystemError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [hasNewContent, setHasNewContent] = useState(false);
  const [isPulseActive, setIsPulseActive] = useState(false);
  const executionLockedRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    setStatus('connecting');
    setSystemError(null);

    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:3001?uuid=${uuid}&projectPath=${encodeURIComponent(projectPath)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      // Accurate synchronization of TTY environment
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN && xtermRef.current) {
          fitAddonRef.current?.fit();
          const { cols, rows } = xtermRef.current;
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
          xtermRef.current.focus();
        }
      }, 200);

      // Reliable execution warmup
      if (initialPrompt && executionLockedRef.current !== `${uuid}-${initialPrompt}`) {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data: initialPrompt + '\r' }));
            executionLockedRef.current = `${uuid}-${initialPrompt}`;
          }
        }, 800);
      } else if (!initialPrompt) {
        // Force interactive shell if no initial prompt
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data: '\r' }));
          }
        }, 500);
      }
      setTimeout(() => {
        xtermRef.current?.focus();
        fitAddonRef.current?.fit();
      }, 100);
    };
    
    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('disconnected');
    
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'output' && xtermRef.current) {
          const term = xtermRef.current;
          const isAtBottom = term.buffer.active.viewportY >= term.buffer.active.baseY - 1;
          
          const rawData = payload.data;
          term.write(rawData);

          if (rawData.includes('[System Error]') || rawData.includes('[Critical Error]')) {
            const cleanMsg = stripAnsi(rawData).replace(/\[(System|Critical) Error\]/, '').trim();
            setSystemError(cleanMsg);
          }
          
          if (isAtBottom) {
            term.scrollToBottom();
          }

          setIsPulseActive(true);
          setTimeout(() => setIsPulseActive(false), 200);
        } else if (payload.type === 'exit') {
          setStatus('disconnected');
        }
      } catch (e) {}
    };
  }, [uuid, projectPath, initialPrompt]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const isDark = theme === 'dark';

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Google Sans Mono", "JetBrains Mono", monospace',
      theme: {
        background: isDark ? '#131314' : '#ffffff',
        foreground: isDark ? '#e3e3e3' : '#1f1f1f',
        cursor: '#4285f4',
        selectionBackground: isDark ? 'rgba(138, 180, 248, 0.3)' : 'rgba(66, 133, 244, 0.2)',
        black: isDark ? '#000000' : '#3c4043',
        brightBlack: isDark ? '#5f6368' : '#70757a',
        white: isDark ? '#e3e3e3' : '#ffffff',
      },
      allowProposedApi: true,
      scrollback: 10000,
      cursorStyle: 'block',
      convertEol: true, // Crucial for handle \n to \r\n correctly
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const ro = new ResizeObserver(() => {
      if (xtermRef.current) {
        try { fitAddon.fit(); } catch(e) {}
      }
    });
    ro.observe(terminalRef.current);

    connect();

    term.onData(data => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    term.onResize(size => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols: size.cols, rows: size.rows }));
      }
    });

    term.onScroll(() => {
      const isBottom = term.buffer.active.viewportY >= term.buffer.active.baseY - 2;
      setHasNewContent(!isBottom);
    });

    // Handle clicks to focus
    const handleContainerClick = () => {
      term.focus();
    };
    terminalRef.current.addEventListener('click', handleContainerClick);

    return () => {
      ro.disconnect();
      if (terminalRef.current) {
        terminalRef.current.removeEventListener('click', handleContainerClick);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      term.dispose();
    };
  }, [uuid, projectPath, theme, connect]);

  const handleCopy = () => {
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
    }
  };

  const handleDownload = () => {
    if (!xtermRef.current) return;
    xtermRef.current.selectAll();
    const raw = xtermRef.current.getSelection();
    xtermRef.current.clearSelection();
    
    const clean = stripAnsi(raw);
    const blob = new Blob([clean], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `terminal-execution-${uuid.slice(0, 8)}-${ts}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scrollToBottom = () => {
    if (xtermRef.current) {
      xtermRef.current.scrollToBottom();
      xtermRef.current.focus();
    }
  };

  return (
    <div className={`terminal-wrapper ${theme || 'light'} ${isFocusMode ? 'fullscreen-focus' : ''}`}>
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
           <div className="action-button-group">
             <button className="terminal-btn-gemini" title="中断 (Ctrl+C)" 
               onClick={() => wsRef.current?.send(JSON.stringify({ type: 'input', data: '\x03' }))}>
               <IconInterrupt />
             </button>
             <button className="terminal-btn-gemini" title="重置终端" onClick={() => xtermRef.current?.reset()}>
               <IconClear />
             </button>
           </div>

           <div className="action-button-group">
             <button className="terminal-btn-gemini" title="复制内容" onClick={handleCopy}>
               {isCopied ? <IconCheck /> : <IconCopy />}
             </button>
             <button className="terminal-btn-gemini" title="下载日志" onClick={handleDownload}>
               <IconDownload />
             </button>
           </div>

           <div className="action-button-group">
             <button className="terminal-btn-gemini" title={isFocusMode ? "退出全屏" : "全屏模式"} 
               onClick={() => setIsFocusMode(!isFocusMode)}>
               {isFocusMode ? <IconShrink /> : <IconExpand />}
             </button>
             <button className="terminal-btn-official-accent" title="重新启动" onClick={connect}>
               <IconRefresh />
             </button>
           </div>
        </div>
      </div>
      
      <div className="terminal-inner">
        <div ref={terminalRef} className="xterm-container-gemini" />
        
        {hasNewContent && (
          <button className="scroll-bottom-fab" onClick={scrollToBottom}>
             <IconArrowDown /> 最新输出
          </button>
        )}

        {status === 'connecting' && (
           <div className="terminal-overlay-modern">
              <div className="overlay-card-gemini glass-effect">
                 <div className="gemini-loader-container">
                    <div className="gemini-loader-ring"></div>
                    <IconGemini />
                 </div>
                 <h3>正在连接执行环境...</h3>
                 <p>正在拉起 Gemini 会话并建立加密隧道。这通常需要几秒钟时间。</p>
              </div>
           </div>
        )}

        {status === 'disconnected' && !systemError && (
           <div className="terminal-overlay-modern">
              <div className="overlay-card-gemini glass-effect">
                 <div className="gemini-sparkle-container">
                    <IconGemini />
                 </div>
                 <h3>会话已就绪</h3>
                 <p>执行环境已准备就绪。由于安全策略，请点击下方按钮激活交互式终端会话。</p>
                 <button className="btn-gemini-glow" onClick={connect}>
                    <IconRefresh /> 开启交互会话
                 </button>
              </div>
           </div>
        )}

        {systemError && (
           <div className="terminal-overlay-modern">
              <div className="overlay-card-gemini glass-effect error-border">
                 <div className="gemini-error-icon-container">
                    <IconInterrupt />
                 </div>
                 <h3>执行环境报错</h3>
                 <p className="error-msg-detail">{systemError}</p>
                 <button className="btn-gemini-glow error-bg" onClick={connect}>
                    <IconRefresh /> 重试连接
                 </button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default Terminal;
