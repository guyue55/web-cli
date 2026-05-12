import { WebSocket } from 'ws';
import { type ISession } from '@web-cli/shared';
import { PTYFactory } from './PTYFactory.js';

export class SessionManager {
  private static sessions = new Map<string, ISession>();
  private static timeouts = new Map<string, NodeJS.Timeout>();

  static getSessionKey(projectPath: string, uuid: string): string {
    return `${projectPath}:${uuid}`;
  }

  static getOrCreateSession(uuid: string, projectPath: string, cols: number = 100, rows: number = 30): ISession {
    const sessionKey = this.getSessionKey(projectPath, uuid);
    
    // Clear any existing cleanup timeout if client returns
    if (this.timeouts.has(sessionKey)) {
      clearTimeout(this.timeouts.get(sessionKey)!);
      this.timeouts.delete(sessionKey);
    }

    if (this.sessions.has(sessionKey)) {
      const existing = this.sessions.get(sessionKey)!;
      // Re-sync size on reconnection
      existing.pty.resize(cols, rows);
      return existing;
    }

    const isNew = uuid.startsWith('new-');
    console.log(`[SessionManager] ${isNew ? 'Creating NEW' : 'Resuming'} Gemini session at ${projectPath} (${cols}x${rows})`);
    
    const geminiPath = process.env.GEMINI_PATH || 'gemini';
    const ptyProcess = PTYFactory.create(uuid, projectPath, cols, rows, isNew, geminiPath);

    const session: ISession = {
      id: uuid,
      projectPath,
      pty: ptyProcess,
      buffer: '',
      clients: new Set<WebSocket>()
    };

    ptyProcess.onData((data: string) => {
      session.buffer += data;
      if (session.buffer.length > 200000) {
        session.buffer = session.buffer.slice(-200000);
      }
      
      session.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'output', data }));
        }
      });
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      console.log(`[SessionManager] Session ${uuid} exited with code ${exitCode}`);
      session.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'exit', code: exitCode }));
          client.close();
        }
      });
      this.sessions.delete(sessionKey);
      if (this.timeouts.has(sessionKey)) {
        clearTimeout(this.timeouts.get(sessionKey)!);
        this.timeouts.delete(sessionKey);
      }
    });

    this.sessions.set(sessionKey, session);
    return session;
  }

  static forceKillSession(sessionKey: string) {
    const session = this.sessions.get(sessionKey);
    if (session) {
      console.log(`[SessionManager] Force killing session: ${sessionKey}`);
      if (session.pty && session.pty.kill) {
        session.pty.kill();
      }
      session.clients.forEach(c => c.close(1000, 'Session force restarted'));
      this.sessions.delete(sessionKey);
    }
  }

  static getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  static removeClientFromSession(sessionKey: string, ws: WebSocket) {
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.clients.delete(ws);
      
      // If no clients left, schedule session destruction in 5 minutes
      if (session.clients.size === 0) {
        console.log(`[SessionManager] No clients left for ${sessionKey}. Scheduling destruction in 5m.`);
        const timeout = setTimeout(() => {
          console.log(`[SessionManager] Cleaning up idle session: ${sessionKey}`);
          if (session.pty && session.pty.kill) {
             session.pty.kill();
          }
          this.sessions.delete(sessionKey);
          this.timeouts.delete(sessionKey);
        }, 5 * 60 * 1000);
        this.timeouts.set(sessionKey, timeout);
      }
    }
  }
}
