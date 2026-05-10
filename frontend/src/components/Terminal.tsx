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

// --- Premium SVG Assets (Gemini Official Style) ---
const IconInterrupt = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
const IconClear = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
const IconCopy = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const IconCheck = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconDownload = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IconRefresh = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
const IconExpand = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>;
const IconShrink = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>;
const IconArrowDown = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 13l5 5 5-5M7 6l5 5 5-5"/></svg>;
const IconKeyboard = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M6 12h.01"/><path d="M10 12h.01"/><path d="M14 12h.01"/><path d="M18 12h.01"/><path d="M7 16h10"/></svg>;

// --- Helper Utilities ---
const stripAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~]*)*)?\u0007/g, '');

const Terminal: React.FC<TerminalProps> = ({ uuid, projectPath, initialPrompt, theme }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  
  const [status, setStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [isCopied, setIsCopied] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [hasNewContent, setHasNewContent] = useState(false);
  const executionLockedRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    setStatus('connecting');

    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:3001?uuid=${uuid}&projectPath=${encodeURIComponent(projectPath)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('online');
      // Atomic command execution: ensure specific command runs only once per unique session context
      if (initialPrompt && executionLockedRef.current !== `${uuid}-${initialPrompt}`) {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data: initialPrompt + '\r' }));
            executionLockedRef.current = `${uuid}-${initialPrompt}`;
          }
        }, 800);
      }
      setTimeout(() => fitAddonRef.current?.fit(), 200);
    };
    
    ws.onclose = () => setStatus('offline');
    ws.onerror = () => setStatus('offline');
    
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'output' && xtermRef.current) {
          xtermRef.current.write(payload.data);
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

    return () => {
      ro.disconnect();
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
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `terminal-execution-${uuid.slice(0, 8)}-${dateStr}.log`;
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
      <div className="terminal-toolbar">
        <div className="terminal-title">
           <span className="terminal-type-icon">$_</span>
           <span className="terminal-name">执行实例</span>
        </div>

        <div className="instance-pill" title={`Path: ${projectPath}`}>
           <span className={`status-dot-inner ${status}`} />
           <span>{status === 'online' ? '就绪' : status === 'connecting' ? '启动中' : '离线'}</span>
        </div>
        
        <div className="toolbar-actions">
           <button className="terminal-action-btn" title="中断进程 (Ctrl+C)" 
             onClick={() => wsRef.current?.send(JSON.stringify({ type: 'input', data: '\x03' }))}>
             <span className="icon-span"><IconInterrupt /></span>
           </button>
           <button className="terminal-action-btn" title="重置终端" onClick={() => xtermRef.current?.reset()}>
             <span className="icon-span"><IconClear /></span>
           </button>
           <button className="terminal-action-btn" title="复制内容" onClick={handleCopy}>
             <span className="icon-span">{isCopied ? <IconCheck /> : <IconCopy />}</span>
           </button>
           <button className="terminal-action-btn" title="导出日志 (.log)" onClick={handleDownload}>
             <span className="icon-span"><IconDownload /></span>
           </button>
           <button className="terminal-action-btn focus-toggle" title={isFocusMode ? "退出全屏" : "全屏模式"} 
             onClick={() => setIsFocusMode(!isFocusMode)}>
             <span className="icon-span">{isFocusMode ? <IconShrink /> : <IconExpand />}</span>
           </button>
           <button className="terminal-action-btn" title="重启实例" onClick={connect}>
             <span className="icon-span"><IconRefresh /></span>
           </button>
           <button className="terminal-action-btn mobile-keyboard-btn" title="唤起键盘" onClick={() => inputRef.current?.focus()}>
             <span className="icon-span"><IconKeyboard /></span>
           </button>
        </div>
      </div>
      
      <div className="terminal-inner">
        <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
        
        {hasNewContent && (
          <button className="scroll-bottom-btn" onClick={scrollToBottom}>
             <IconArrowDown /> 发现新输出
          </button>
        )}

        {status === 'offline' && (
           <div className="terminal-overlay">
              <div className="overlay-content">
                 <div className="overlay-icon-container"><IconInterrupt /></div>
                 <h3>交互实例已停止</h3>
                 <p>该终端会话已断开连接。这可能是由于网络波动或长时间无操作引起的。</p>
                 <button className="reconnect-btn-premium" onClick={connect}>
                   <IconRefresh /> 重新启动实例
                 </button>
              </div>
           </div>
        )}

        <input ref={inputRef} type="text" className="hidden-mobile-input" 
          autoCapitalize="none" autoComplete="off" spellCheck="false"
          onChange={(e) => {
            const v = e.target.value;
            if (v && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'input', data: v }));
              e.target.value = '';
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'input', data: '\r' }));
            else if (e.key === 'Backspace' && wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'input', data: '\x7f' }));
          }}
        />
      </div>
    </div>
  );
};

export default Terminal;
