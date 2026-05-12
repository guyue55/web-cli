import React, { useState, useEffect } from 'react';

export const TerminalStatusBar = React.memo(({ ws, status }: { ws: WebSocket | null, status: string }) => {
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
       <span className="footer-info-item">
         <span className="status-dot-mini connected" />
         <span className="label">STATUS:</span> 加密隧道已建立
       </span>
       {latency !== null && (
         <span className="footer-info-item"><span className="label">延迟:</span> {latency}ms</span>
       )}
       {ws && (
         <span className="footer-info-item">
           <span className="label">SESSION:</span> 
           {new URL(ws.url).searchParams.get('uuid')?.slice(0, 8)}
         </span>
       )}
    </div>
  );
});
