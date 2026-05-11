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
    
    let ptyProcess: any;
    let useFallback = false;

    // Command: resume or new
    const args = isNew ? 
      ['--skip-trust', '--approval-mode', 'yolo', '--prompt-interactive', ' '] : 
      ['--resume', uuid, '--skip-trust', '--approval-mode', 'yolo', '--prompt-interactive', ' '];

    const geminiPath = '/Users/guyue/.nvm/versions/node/v24.13.0/bin/gemini';

    try {
      ptyProcess = pty.spawn(geminiPath, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: projectPath,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', FORCE_COLOR: '1' } as any
      });
    } catch (err) {
      console.warn(`[SessionManager] node-pty failed: ${err}. Falling back to child_process.spawn.`);
      useFallback = true;
    }

    if (useFallback) {
      // Industrial-grade Python PTY Bridge: Binary-safe, Multiplexed, Debounced Resize
      const pyArgs = isNew ? 
        ['--skip-trust', '--approval-mode', 'yolo', '--prompt-interactive', ' '] : 
        ['--resume', uuid, '--skip-trust', '--approval-mode', 'yolo', '--prompt-interactive', ' '];
      
      const pyScript = `
import pty, os, sys, select, termios, struct, fcntl, signal, time

size_file = "/tmp/gemini-term-size-${uuid}.tmp"

def set_size(fd):
    try:
        if os.path.exists(size_file):
            with open(size_file, 'r') as f:
                content = f.read().strip()
                if content:
                    rows, cols = map(int, content.split(','))
                    if rows > 0 and cols > 0:
                        size = struct.pack("HHHH", rows, cols, 0, 0)
                        fcntl.ioctl(fd, termios.TIOCSWINSZ, size)
    except: pass

def bridge():
    import threading
    pid, fd = pty.fork()
    if pid == 0:
        os.execv(r'${geminiPath}', [r'${geminiPath}'] + ${JSON.stringify(pyArgs)})
    else:
        with open(size_file, 'w') as f: f.write(f"${rows},${cols}")
        set_size(fd)
        def handle_resize(signum, frame):
            time.sleep(0.01)
            set_size(fd)
        signal.signal(signal.SIGUSR1, handle_resize)

        def pty_to_stdout():
            try:
                while True:
                    data = os.read(fd, 65536)
                    if not data: break
                    sys.stdout.buffer.write(data)
                    sys.stdout.buffer.flush()
            except: pass

        def stdin_to_pty():
            try:
                while True:
                    data = os.read(sys.stdin.fileno(), 16384)
                    if not data: break
                    os.write(fd, data)
            except: pass

        t1 = threading.Thread(target=pty_to_stdout, daemon=True)
        t2 = threading.Thread(target=stdin_to_pty, daemon=True)
        t1.start()
        t2.start()
        
        try:
            while t1.is_alive(): time.sleep(0.5)
        except: pass
        finally:
            if os.path.exists(size_file): os.remove(size_file)

if __name__ == "__main__":
    bridge()
`.trim();
      
      console.log(`[SessionManager] Spawning Binary-Safe Python PTY Bridge...`);
      const cp = spawn('/usr/bin/python3', ['-u', '-c', pyScript], {
        cwd: projectPath,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', FORCE_COLOR: '1', LANG: 'en_US.UTF-8' } as any,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let onDataCb: (data: string) => void = () => {};
      let onExitCb: (status: { exitCode: number; signal?: number }) => void = () => {};

      cp.stdout?.on('data', (data) => onDataCb(data.toString()));
      cp.stderr?.on('data', (data) => {
        const msg = data.toString();
        console.error(`[SessionManager] Fallback stderr: ${msg}`);
        if (!msg.includes('tcgetattr') && !msg.includes('ioctl')) {
          onDataCb(`\x1b[31m[System Error] ${msg}\x1b[0m`);
        }
      });
      cp.on('error', (err) => {
        console.error(`[SessionManager] Fallback spawn error: ${err}`);
        onDataCb(`\x1b[31m[Critical Error] Failed to start gemini process: ${err.message}\x1b[0m`);
        onExitCb({ exitCode: 1 });
      });
      cp.on('exit', (code, signal) => onExitCb({ exitCode: code ?? 0, signal: signal ? 1 : undefined as any }));

      const sizeFilePath = `/tmp/gemini-term-size-${uuid}.tmp`;

      ptyProcess = {
        write: (data: string) => {
          if (cp.stdin?.writable) cp.stdin.write(data);
        },
        kill: () => {
          cp.kill();
          try { require('fs').unlinkSync(sizeFilePath); } catch (e) {}
        },
        resize: (newCols: number, newRows: number) => {
          try {
            const fs = require('fs');
            fs.writeFileSync(sizeFilePath, `${newRows},${newCols}`);
            cp.kill('SIGUSR1');
          } catch (e) {
            console.warn('[SessionManager] Resize failed', e);
          }
        },
        onData: (cb: (data: string) => void) => {
          onDataCb = cb;
        },
        onExit: (cb: (status: { exitCode: number; signal?: number }) => void) => {
          const originalOnExit = onExitCb;
          onExitCb = (status) => {
            originalOnExit(status);
            cb(status);
          };
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
      if (session.pty && (session.pty as any).kill) {
        (session.pty as any).kill();
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
          if (session.pty && (session.pty as any).kill) {
             (session.pty as any).kill();
          }
          this.sessions.delete(sessionKey);
          this.timeouts.delete(sessionKey);
        }, 5 * 60 * 1000);
        this.timeouts.set(sessionKey, timeout);
      }
    }
  }
}
