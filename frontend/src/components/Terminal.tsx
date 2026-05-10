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

// Ultra-Premium SVG Icons
const IconInterrupt = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>;
const IconClear = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h8c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;
const IconCopy = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>;
const IconCheck = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
const IconDownload = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;
const IconRefresh = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>;
const IconMaximize = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg>;
const IconMinimize = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h6v6"></path><path d="M20 10h-6V4"></path><path d="M14 10l7-7"></path><path d="M10 14l-7 7"></path></svg>;
const IconArrowDown = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 13l5 5 5-5M7 6l5 5 5-5"></path></svg>;
const IconKeyboard = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><path d="M6 8h.01"></path><path d="M10 8h.01"></path><path d="M14 8h.01"></path><path d="M18 8h.01"></path><path d="M6 12h.01"></path><path d="M10 12h.01"></path><path d="M14 12h.01"></path><path d="M18 12h.01"></path><path d="M7 16h10"></path></svg>;

const Terminal: React.FC<TerminalProps> = ({ uuid, projectPath, initialPrompt, theme }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const sentInitialRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    setConnectionStatus('connecting');

    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:3001?uuid=${uuid}&projectPath=${encodeURIComponent(projectPath)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      // Execute initial prompt once per unique command
      if (initialPrompt && sentInitialRef.current !== initialPrompt) {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data: initialPrompt + '\r' }));
            sentInitialRef.current = initialPrompt;
          }
        }, 650);
      }
      setTimeout(() => fitAddonRef.current?.fit(), 100);
    };
    
    ws.onclose = () => setConnectionStatus('disconnected');
    
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'output' && xtermRef.current) {
          xtermRef.current.write(payload.data);
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.onerror = () => setConnectionStatus('disconnected');
  }, [uuid, projectPath, initialPrompt]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isDark = theme === 'dark';

    const term = new XTerm({
      cursorBlink: true,
      fontSize: isMobile ? 12 : 14,
      fontFamily: '"JetBrains Mono", "Cascadia Code", Menlo, Monaco, monospace',
      theme: {
        background: isDark ? '#131314' : '#f8f9fa',
        foreground: isDark ? '#e3e3e3' : '#202124',
        cursor: '#4285f4',
        selectionBackground: isDark ? 'rgba(66, 133, 244, 0.3)' : 'rgba(66, 133, 244, 0.2)',
        black: isDark ? '#000000' : '#3c4043',
        brightBlack: isDark ? '#5f6368' : '#70757a',
        white: isDark ? '#e3e3e3' : '#ffffff',
      },
      allowProposedApi: true,
      scrollback: 10000,
      cursorStyle: 'bar',
      cursorWidth: 2
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const resizeObserver = new ResizeObserver(() => {
      if (xtermRef.current) {
        try {
          fitAddon.fit();
        } catch (e) {}
      }
    });
    
    resizeObserver.observe(terminalRef.current);

    connect();

    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    term.onResize((size) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols: size.cols, rows: size.rows }));
      }
    });

    term.onScroll(() => {
      const isUp = term.buffer.active.viewportY < term.buffer.active.baseY - 5;
      setIsScrolledUp(isUp);
    });

    return () => {
      resizeObserver.disconnect();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      term.dispose();
    };
  }, [uuid, projectPath, theme, connect]);

  const handleClear = () => {
    if (xtermRef.current) {
      xtermRef.current.reset();
      xtermRef.current.focus();
    }
  };

  const handleCopy = () => {
    if (xtermRef.current) {
      xtermRef.current.selectAll();
      const selection = xtermRef.current.getSelection();
      navigator.clipboard.writeText(selection);
      xtermRef.current.clearSelection();
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const handleInterrupt = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: '\x03' }));
    }
  };

  const handleDownload = () => {
    if (!xtermRef.current) return;
    xtermRef.current.selectAll();
    const content = xtermRef.current.getSelection();
    xtermRef.current.clearSelection();
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `gemini-workstation-${ts}.log`;
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
    <div className={`terminal-wrapper ${theme || 'light'} ${isFullscreen ? 'fullscreen-focus' : ''}`}>
      <div className="terminal-toolbar">
        <div className="terminal-title">
           <span className="terminal-type-icon">$_</span>
           <span className="terminal-name">执行实例</span>
        </div>

        <div className="instance-pill" title={projectPath}>
           <span className={`status-dot-inner ${connectionStatus}`} />
           <span>
             {connectionStatus === 'connected' ? '就绪' : 
              connectionStatus === 'connecting' ? '启动中' : '离线'}
           </span>
        </div>
        
        <div className="toolbar-actions">
           <button className="terminal-action-btn" title="中断进程 (Ctrl+C)" onClick={handleInterrupt}>
             <span className="icon-span"><IconInterrupt /></span>
           </button>
           <button className="terminal-action-btn" title="清屏" onClick={handleClear}>
             <span className="icon-span"><IconClear /></span>
           </button>
           <button className="terminal-action-btn" title="复制内容" onClick={handleCopy}>
             <span className="icon-span">{copyFeedback ? <IconCheck /> : <IconCopy />}</span>
           </button>
           <button className="terminal-action-btn" title="导出日志" onClick={handleDownload}>
             <span className="icon-span"><IconDownload /></span>
           </button>
           <button className="terminal-action-btn" title={isFullscreen ? "退出全屏" : "专注模式"} onClick={() => setIsFullscreen(!isFullscreen)}>
             <span className="icon-span">{isFullscreen ? <IconMinimize /> : <IconMaximize />}</span>
           </button>
           <button className="terminal-action-btn" title="重启实例" onClick={connect}>
             <span className="icon-span"><IconRefresh /></span>
           </button>
           <button className="terminal-action-btn mobile-keyboard-btn" title="呼起键盘" onClick={() => inputRef.current?.focus()}>
             <span className="icon-span"><IconKeyboard /></span>
           </button>
        </div>
      </div>
      
      <div className="terminal-inner">
        <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
        
        {isScrolledUp && (
          <button className="scroll-bottom-btn" onClick={scrollToBottom} title="滚到底部">
             <IconArrowDown /> 发现新输出
          </button>
        )}

        {connectionStatus === 'disconnected' && (
           <div className="terminal-overlay">
              <div className="overlay-content">
                 <div className="overlay-icon-container">
                    <IconInterrupt />
                 </div>
                 <h3>交互实例已停止</h3>
                 <p>该终端会话已断开连接。您可以重新启动实例来继续当前任务。</p>
                 <button className="reconnect-btn-premium" onClick={connect}>
                   <span className="icon-span"><IconRefresh /></span> 重新启动实例
                 </button>
              </div>
           </div>
        )}

        <input
          ref={inputRef}
          type="text"
          className="hidden-mobile-input"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck="false"
          onChange={(e) => {
            const val = e.target.value;
            if (val && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'input', data: val }));
              e.target.value = '';
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'input', data: '\r' }));
            } else if (e.key === 'Backspace' && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'input', data: '\x7f' }));
            }
          }}
        />
      </div>
    </div>
  );
};

export default Terminal;
