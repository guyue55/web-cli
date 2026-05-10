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

    const isNew = uuid.startsWith('new-');
    console.log(`[SessionManager] ${isNew ? 'Creating NEW' : 'Resuming'} Gemini session at ${projectPath}`);
    
    let ptyProcess: any;
    let useFallback = false;

    // Command: resume or new
    // Use --prompt-interactive " " to force interactive mode even without a TTY
    const args = isNew ? 
      ['--skip-trust', '--approval-mode', 'yolo', '--prompt-interactive', ' '] : 
      ['--resume', uuid, '--skip-trust', '--approval-mode', 'yolo', '--prompt-interactive', ' '];

    const geminiPath = '/Users/guyue/.nvm/versions/node/v24.13.0/bin/gemini';

    try {
      ptyProcess = pty.spawn(geminiPath, args, {
        name: 'xterm-256color',
        cols: 100,
        rows: 30,
        cwd: projectPath,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', FORCE_COLOR: '1' } as any
      });
    } catch (err) {
      console.warn(`[SessionManager] node-pty failed: ${err}. Falling back to child_process.spawn.`);
      useFallback = true;
    }

    if (useFallback) {
      // Robust Python PTY Bridge with explicit window size and flush logic
      const pyArgs = isNew ? 
        ['--skip-trust', '--approval-mode', 'yolo', '--prompt-interactive', ' '] : 
        ['--resume', uuid, '--skip-trust', '--approval-mode', 'yolo', '--prompt-interactive', ' '];
      
      const pyScript = `
import pty, os, sys, termios, struct, fcntl

def set_size(fd):
    # Set terminal size to 30 rows, 100 cols
    size = struct.pack("HHHH", 30, 100, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, size)

def spawn_process():
    os.environ['TERM'] = 'xterm-256color'
    os.environ['COLUMNS'] = '100'
    os.environ['LINES'] = '30'
    
    # Use pty.fork to have more control over the child's environment
    pid, fd = pty.fork()
    if pid == 0: # Child
        os.execv(r'${geminiPath}', [r'${geminiPath}'] + ${JSON.stringify(pyArgs)})
    else: # Parent
        set_size(fd)
        try:
            while True:
                # Direct data transfer between pipes and PTY
                data = os.read(fd, 1024)
                if not data: break
                os.write(sys.stdout.fileno(), data)
                sys.stdout.flush()
        except EOFError:
            pass
        except Exception:
            pass

if __name__ == "__main__":
    spawn_process()
`.trim();
      
      console.log(`[SessionManager] Spawning via Robust Python PTY Bridge...`);
      const cp = spawn('/usr/bin/python3', ['-u', '-c', pyScript], { // -u for unbuffered binary I/O
        cwd: projectPath,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', FORCE_COLOR: '1' } as any,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let onDataCb: (data: string) => void = () => {};
      let onExitCb: (status: { exitCode: number; signal?: number }) => void = () => {};

      cp.stdout?.on('data', (data) => onDataCb(data.toString()));
      cp.stderr?.on('data', (data) => {
        const msg = data.toString();
        console.error(`[SessionManager] Fallback stderr: ${msg}`);
        // Don't show technical PTY errors to user unless critical
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

      ptyProcess = {
        write: (data: string) => {
          if (cp.stdin?.writable) cp.stdin.write(data);
        },
        resize: () => {},
        onData: (cb: (data: string) => void) => {
          onDataCb = cb;
        },
        onExit: (cb: (status: { exitCode: number; signal?: number }) => void) => {
          onExitCb = (status) => {
            // Ensure callback is called only once
            onExitCb = () => {};
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
      
      // Notify all clients that the session has ended
      session.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'exit', code: exitCode }));
          client.close(); // Close the connection as the session is gone
        }
      });
      
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
