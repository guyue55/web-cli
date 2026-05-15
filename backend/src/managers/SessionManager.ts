import { WebSocket } from 'ws';
import { type ISession } from '@web-cli/shared';
import { PTYFactory } from './PTYFactory.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { assertAllowedPath } from '../utils/pathGuard.js';

const execAsync = promisify(exec);

export class SessionManager {
  private static sessions = new Map<string, ISession>();
  private static timeouts = new Map<string, NodeJS.Timeout>();

  private static async hasChildProcesses(pid: number): Promise<boolean> {
    try {
      // pgrep -P <pid> returns PIDs of child processes. 
      // This works on macOS (Darwin) and Linux.
      const { stdout } = await execAsync(`pgrep -P ${pid}`);
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  static getSessionKey(projectPath: string, uuid: string): string {
    return `${projectPath}:${uuid}`;
  }

  static getOrCreateSession(uuid: string, projectPath: string, cols: number = 100, rows: number = 30): ISession {
    const safeProjectPath = assertAllowedPath(projectPath, 'projectPath');
    const sessionKey = this.getSessionKey(safeProjectPath, uuid);
    
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
    console.log(`[SessionManager] ${isNew ? 'Creating NEW' : 'Resuming'} Gemini session at ${safeProjectPath} (${cols}x${rows})`);
    
    const geminiPath = process.env.GEMINI_PATH || 'gemini';
    const ptyProcess = PTYFactory.create(uuid, safeProjectPath, cols, rows, isNew, geminiPath);

    const session: ISession = {
      id: uuid,
      projectPath: safeProjectPath,
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
      
      // If no clients left, schedule session destruction check
      if (session.clients.size === 0) {
        const cleanup = async () => {
          const s = this.sessions.get(sessionKey);
          if (!s || s.clients.size > 0) {
            // Client returned or session already gone
            this.timeouts.delete(sessionKey);
            return;
          }

          const hasChildren = await this.hasChildProcesses(s.pty.pid);
          if (hasChildren) {
            console.log(`[SessionManager] Session ${sessionKey} has active child processes. Postponing cleanup for 1m.`);
            const nextTimeout = setTimeout(cleanup, 1 * 60 * 1000);
            this.timeouts.set(sessionKey, nextTimeout);
            return;
          }

          console.log(`[SessionManager] Cleaning up idle session: ${sessionKey}`);
          if (s.pty && s.pty.kill) {
             s.pty.kill();
          }
          this.sessions.delete(sessionKey);
          this.timeouts.delete(sessionKey);
        };

        console.log(`[SessionManager] No clients left for ${sessionKey}. Scheduling idle check in 1m.`);
        const timeout = setTimeout(cleanup, 1 * 60 * 1000);
        this.timeouts.set(sessionKey, timeout);
      }
    }
  }
}
