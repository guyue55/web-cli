import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  uuid: string;
  projectPath: string;
}

const Terminal: React.FC<TerminalProps> = ({ uuid, projectPath }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const term = new XTerm({
      cursorBlink: true,
      fontSize: isMobile ? 12 : 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#131314',
        foreground: '#e3e3e3',
        cursor: '#4285f4'
      }
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;

    const host = window.location.hostname;
    // Connect specifying the uuid
    const wsUrl = `ws://${host}:3001?uuid=${uuid}&projectPath=${encodeURIComponent(projectPath)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'output') {
        term.write(payload.data);
      }
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    term.onResize((size) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: size.cols, rows: size.rows }));
      }
    });

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    const handleClick = () => {
      term.focus();
      if (isMobile && inputRef.current) {
        inputRef.current.focus();
      }
    };
    terminalRef.current.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (terminalRef.current) {
        terminalRef.current.removeEventListener('click', handleClick);
      }
      ws.close();
      term.dispose();
    };
  }, [uuid, projectPath]);

  const focusInput = () => {
    if (inputRef.current) inputRef.current.focus();
    if (xtermRef.current) xtermRef.current.focus();
  };

  return (
    <div className="terminal-wrapper">
      <div className="terminal-toolbar">
        <span className={`status-dot ${isConnected ? 'online' : 'offline'}`}></span>
        <span className="toolbar-label">{isConnected ? 'Active Instance' : 'Waking up Agent...'}</span>
        <button onClick={focusInput} className="mobile-only">Focus Keyboard</button>
      </div>
      <div className="terminal-inner">
        <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
        <input
          ref={inputRef}
          type="text"
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            left: 0,
            top: 0,
            width: '1px',
            height: '1px'
          }}
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
