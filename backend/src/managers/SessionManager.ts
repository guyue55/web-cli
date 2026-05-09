import * as pty from 'node-pty';
import { spawn } from 'child_process';
import { WebSocket } from 'ws';

export interface ISession {
  id: string; // UUID
  projectPath: string;
  pty: {
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    onData: (cb: (data: string) => void) => void;
    onExit: (cb: (status: { exitCode: number; signal?: number }) => void) => void;
  };
  buffer: string;
  clients: Set<WebSocket>;
}

export class SessionManager {
  private static sessions = new Map<string, ISession>();

  static getSessionKey(projectPath: string, uuid: string): string {
    return `${projectPath}:${uuid}`;
  }

  static getOrCreateSession(uuid: string, projectPath: string): ISession {
    const sessionKey = this.getSessionKey(projectPath, uuid);
    if (this.sessions.has(sessionKey)) {
      return this.sessions.get(sessionKey)!;
    }

    console.log(`[SessionManager] Resuming Gemini session UUID: ${uuid} at ${projectPath}`);
    
    let ptyProcess: any;
    let useFallback = false;

    // Direct resume using UUID
    try {
      ptyProcess = pty.spawn('gemini', ['--resume', uuid, '--trust'], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: projectPath,
        env: { ...process.env, TERM: 'xterm-256color' } as any
      });
    } catch (err) {
      console.warn(`[SessionManager] node-pty failed: ${(err as Error).message}. Falling back to child_process.spawn.`);
      useFallback = true;
    }

    if (useFallback) {
      const cp = spawn('gemini', ['--resume', uuid, '--trust'], {
        cwd: projectPath,
        env: { ...process.env, TERM: 'xterm-256color' } as any,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let onDataCb: (data: string) => void = () => {};
      let onExitCb: (status: { exitCode: number; signal?: number }) => void = () => {};

      cp.stdout?.on('data', (data) => onDataCb(data.toString()));
      cp.stderr?.on('data', (data) => onDataCb(data.toString()));
      cp.on('exit', (code, signal) => onExitCb({ exitCode: code ?? 0, signal: signal ? 1 : undefined }));

      ptyProcess = {
        write: (data: string) => {
          cp.stdin?.write(data);
        },
        resize: () => {},
        onData: (cb: (data: string) => void) => {
          onDataCb = cb;
        },
        onExit: (cb: (status: { exitCode: number; signal?: number }) => void) => {
          onExitCb = cb;
        }
      };
    }

    const session: ISession = {
      id: uuid,
      projectPath,
      pty: ptyProcess,
      buffer: '',
      clients: new Set()
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
      console.log(`[SessionManager] Gemini Session ${uuid} exited with code ${exitCode}`);
      this.sessions.delete(sessionKey);
    });

    this.sessions.set(sessionKey, session);
    return session;
  }

  static getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  static removeClientFromSession(sessionKey: string, ws: WebSocket) {
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.clients.delete(ws);
    }
  }
}
