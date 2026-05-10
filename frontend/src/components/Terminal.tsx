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

// Premium SVG Icons
const IconInterrupt = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>;
const IconClear = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h8c1 0 2 1 2 2v2"></path></svg>;
const IconCopy = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>;
const IconCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
const IconDownload = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;
const IconRefresh = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>;
const IconKeyboard = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><path d="M6 8h.01"></path><path d="M10 8h.01"></path><path d="M14 8h.01"></path><path d="M18 8h.01"></path><path d="M6 12h.01"></path><path d="M10 12h.01"></path><path d="M14 12h.01"></path><path d="M18 12h.01"></path><path d="M7 16h10"></path></svg>;

const Terminal: React.FC<TerminalProps> = ({ uuid, projectPath, initialPrompt, theme }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const sentInitialRef = useRef(false);

  const connect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    setConnectionStatus('connecting');

    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:3001?uuid=${uuid}&projectPath=${encodeURIComponent(projectPath)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      if (initialPrompt && !sentInitialRef.current) {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data: initialPrompt + '\r' }));
            sentInitialRef.current = true;
          }
        }, 500);
      }
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
      fontFamily: '"JetBrains Mono", Menlo, Monaco, monospace',
      theme: {
        background: isDark ? '#131314' : '#ffffff',
        foreground: isDark ? '#e3e3e3' : '#1f1f1f',
        cursor: '#4285f4',
        selectionBackground: isDark ? 'rgba(66, 133, 244, 0.3)' : 'rgba(66, 133, 244, 0.2)',
        black: isDark ? '#000000' : '#1f1f1f',
        white: isDark ? '#e3e3e3' : '#ffffff',
      },
      allowProposedApi: true,
      scrollback: 5000
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    xtermRef.current = term;

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

    return () => {
      resizeObserver.disconnect();
      if (wsRef.current) wsRef.current.close();
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
    a.download = `gemini-cli-terminal-${new Date().toISOString().slice(0,10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`terminal-wrapper ${theme || 'light'}`}>
      <div className="terminal-toolbar">
        <div className="terminal-title">
           <span className="terminal-type-icon">$_</span>
           <span className="terminal-name">实时交互终端</span>
        </div>

        <div className="instance-pill">
           <span className={`status-dot-inner ${connectionStatus}`} />
           <span>
             {connectionStatus === 'connected' ? '已连接' : 
              connectionStatus === 'connecting' ? '启动中' : '已断开'}
           </span>
        </div>
        
        <div className="toolbar-actions">
           <button className="terminal-action-btn" title="中断 (Ctrl+C)" onClick={handleInterrupt}>
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
           <button className="terminal-action-btn" title="重新连接" onClick={connect}>
             <span className="icon-span"><IconRefresh /></span>
           </button>
           <button className="terminal-action-btn mobile-keyboard-btn" title="呼起键盘" onClick={() => inputRef.current?.focus()}>
             <span className="icon-span"><IconKeyboard /></span>
           </button>
        </div>
      </div>
      
      <div className="terminal-inner">
        <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
        
        {connectionStatus === 'disconnected' && (
           <div className="terminal-overlay">
              <div className="overlay-content">
                 <h3>终端已离线</h3>
                 <p>交互实例已停止响应，可能是由于长时间闲置或网络问题。</p>
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
