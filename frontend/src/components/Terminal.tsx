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
              connectionStatus === 'connecting' ? '正在连接...' : '连接已断开'}
           </span>
        </div>
        
        <div className="toolbar-actions">
           <button className="terminal-action-btn" title="中断 (Ctrl+C)" onClick={handleInterrupt}>
             <span className="icon-span">🚫</span>
           </button>
           <button className="terminal-action-btn" title="清屏" onClick={handleClear}>
             <span className="icon-span">🧹</span>
           </button>
           <button className="terminal-action-btn" title="复制全屏" onClick={handleCopy}>
             <span className="icon-span">{copyFeedback ? '✅' : '📋'}</span>
           </button>
           <button className="terminal-action-btn" title="导出日志" onClick={handleDownload}>
             <span className="icon-span">💾</span>
           </button>
           <button className="terminal-action-btn" title="重新连接" onClick={connect}>
             <span className="icon-span">🔄</span>
           </button>
           <button className="terminal-action-btn mobile-keyboard-btn" title="呼起键盘" onClick={() => inputRef.current?.focus()}>
             <span className="icon-span">⌨️</span>
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
                   <span className="icon-span">🔄</span> 重新启动实例
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
