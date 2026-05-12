import * as pty from 'node-pty';
import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import { StringDecoder } from 'string_decoder';
import fs from 'fs';

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

    const geminiPath = process.env.GEMINI_PATH || 'gemini';

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
      // Industrial-grade Python PTY Bridge: Binary-safe, Threaded, Debounced Resize
      const pyArgs = isNew ? 
        ['--skip-trust', '--approval-mode', 'yolo', '--prompt-interactive', ' '] : 
        ['--resume', uuid, '--skip-trust', '--approval-mode', 'yolo', '--prompt-interactive', ' '];
      
      const pyScript = `
import pty, os, sys, select, termios, struct, fcntl, signal, time, threading

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
    try:
        pid, fd = pty.fork()
    except Exception as e:
        sys.stderr.write(f"Fork failed: {e}\\n")
        return

    if pid == 0:
        try:
            # Use execvp to allow PATH resolution for the gemini command
            os.execvp(r'${geminiPath}', [r'${geminiPath}'] + ${JSON.stringify(pyArgs)})
        except Exception as e:
            sys.stderr.write(f"Exec failed: {e}\\n")
            os._exit(1)
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
            except Exception as e:
                sys.stderr.write(f"PTY read error: {e}\\n")

        def stdin_to_pty():
            try:
                while True:
                    data = os.read(sys.stdin.fileno(), 16384)
                    if not data: break
                    os.write(fd, data)
            except Exception as e:
                sys.stderr.write(f"Stdin read error: {e}\\n")

        t1 = threading.Thread(target=pty_to_stdout, daemon=True)
        t2 = threading.Thread(target=stdin_to_pty, daemon=True)
        t1.start()
        t2.start()
        try:
            while t1.is_alive(): time.sleep(0.1)
        except: pass
        finally:
            if os.path.exists(size_file): os.remove(size_file)

if __name__ == "__main__":
    bridge()
`.trim();
      
      console.log(`[SessionManager] Spawning Threaded Binary-Safe Python Bridge (Optimized Discovery)...`);
      
      const decoder = new StringDecoder('utf8');
      let onDataCb: (data: string) => void = () => {};
      let onExitCb: (status: { exitCode: number; signal?: number }) => void = () => {};
      const sizeFilePath = `/tmp/gemini-term-size-${uuid}.tmp`;

      let activeCp: any = null;
      let discoveryStep = 1;

      const startBridge = (cmd: string) => {
        const proc = spawn(cmd, ['-u', '-c', pyScript], {
          cwd: projectPath,
          env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', FORCE_COLOR: '1', LANG: 'en_US.UTF-8' } as any,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        proc.stdin?.on('error', (err: any) => console.warn(`[SessionManager] Bridge stdin error: ${err.message}`));
        
        proc.stdout?.on('data', (chunk: Buffer) => {
          if (proc === activeCp) onDataCb(decoder.write(chunk));
        });

        proc.stderr?.on('data', (data: any) => {
          const msg = data.toString();
          
          // SILENT FAILOVER: Detect broken pyenv/conda shims without notifying frontend
          if (discoveryStep === 1 && (msg.includes('pyenv: version') || msg.includes('command not found'))) {
             console.warn(`[SessionManager] Tier 1 environment check failed. Silently switching to Tier 2...`);
             discoveryStep = 2;
             proc.kill();
             activeCp = startBridge('/usr/bin/python3');
             return;
          }

          if (proc === activeCp) {
            console.error(`[SessionManager] PTY Bridge Error: ${msg}`);
            // Only send error to UI if it's not a standard terminal initialization noise
            if (!msg.includes('tcgetattr') && !msg.includes('ioctl')) {
              onDataCb(`\x1b[31m[System Error] ${msg}\x1b[0m`);
            }
          }
        });

        proc.on('error', (err: any) => {
          if (discoveryStep === 1) {
            discoveryStep = 2;
            activeCp = startBridge('/usr/bin/python3');
          } else {
            console.error(`[SessionManager] Python discovery exhausted: ${err.message}`);
            onDataCb(`\x1b[31m[Critical Error] 执行环境启动失败。详细原因: ${err.message}\\x1b[0m`);
            onExitCb({ exitCode: 1 });
          }
        });

        proc.on('exit', (code: any, signal: any) => {
          if (proc === activeCp) onExitCb({ exitCode: code ?? 0, signal: signal ? 1 : undefined as any });
        });

        return proc;
      };

      activeCp = startBridge('python3');

      ptyProcess = {
        write: (data: string) => {
          try {
            if (activeCp?.stdin?.writable) activeCp.stdin.write(data);
          } catch (e) {
            console.warn(`[SessionManager] Failed to write to PTY: ${e}`);
          }
        },
        kill: () => {
          activeCp?.kill();
          try { fs.unlinkSync(sizeFilePath); } catch (e) {}
        },
        resize: (newCols: number, newRows: number) => {
          try {
            fs.writeFileSync(sizeFilePath, `${newRows},${newCols}`);
            activeCp?.kill('SIGUSR1');
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
