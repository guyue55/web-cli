import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { SessionManager } from './managers/SessionManager.js';
import { GeminiDiscovery } from './services/GeminiDiscovery.js';

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Route 1: Discovery (Streaming scan)
    if (pathname === '/discovery') {
      console.log('[WebSocket] New discovery connection');
      GeminiDiscovery.discoverAndStream(ws);
      return;
    }

    // Route 2: Terminal Session (Resume by UUID)
    const uuid = url.searchParams.get('uuid');
    const projectPath = url.searchParams.get('projectPath');
    const cols = parseInt(url.searchParams.get('cols') || '100');
    const rows = parseInt(url.searchParams.get('rows') || '30');

    if (!uuid || !projectPath) {
      return;
    }

    const sessionKey = SessionManager.getSessionKey(projectPath, uuid);

    try {
      const session = SessionManager.getOrCreateSession(uuid, projectPath, cols, rows);
      session.clients.add(ws);
      ws.send(JSON.stringify({ type: 'output', data: session.buffer }));

      ws.on('message', (message: string) => {
        try {
          const payload = JSON.parse(message.toString());
          if (payload.type === 'input') {
            session.pty.write(payload.data);
          } else if (payload.type === 'resize') {
            session.pty.resize(payload.cols, payload.rows);
          }
        } catch (e) {
          console.error('[WebSocket] Failed to parse message', e);
        }
      });

      ws.on('close', () => {
        SessionManager.removeClientFromSession(sessionKey, ws);
        console.log(`[WebSocket] Client disconnected from session: ${sessionKey}`);
      });
    } catch (err) {
      ws.send(JSON.stringify({ type: 'output', data: `\r\n\x1b[31m[Error] ${ (err as Error).message }\x1b[0m\r\n` }));
      ws.close();
    }
  });
}
