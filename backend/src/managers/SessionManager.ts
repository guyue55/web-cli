import * as pty from 'node-pty';
import { spawn } from 'child_process';
import { WebSocket } from 'ws';

export interface ISession {
  id: string; // resumeIndex
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

  static getSessionKey(projectPath: string, index: string): string {
    return `${projectPath}:${index}`;
  }

  static getOrCreateSession(resumeIndex: string, projectPath: string): ISession {
    const sessionKey = this.getSessionKey(projectPath, resumeIndex);
    if (this.sessions.has(sessionKey)) {
      return this.sessions.get(sessionKey)!;
    }

    console.log(`[SessionManager] Resuming Gemini session #${resumeIndex} at ${projectPath}`);
    
    let ptyProcess: any;
    let useFallback = false;

    try {
      ptyProcess = pty.spawn('gemini', ['--resume', resumeIndex, '--trust'], {
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
      const cp = spawn('gemini', ['--resume', resumeIndex, '--trust'], {
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
        resize: () => {}, // Ignored in fallback
        onData: (cb: (data: string) => void) => {
          onDataCb = cb;
        },
        onExit: (cb: (status: { exitCode: number; signal?: number }) => void) => {
          onExitCb = cb;
        }
      };
    }

    const session: ISession = {
      id: resumeIndex,
      projectPath,
      pty: ptyProcess,
      buffer: '',
      clients: new Set()
    };

    ptyProcess.onData((data: string) => {
      session.buffer += data;
      // Keep buffer bounded
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
      console.log(`[SessionManager] Gemini Session ${resumeIndex} exited with code ${exitCode}`);
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
