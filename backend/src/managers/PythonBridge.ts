export const getPythonBridgeScript = (uuid: string, geminiPath: string, pyArgs: string[], rows: number, cols: number) => `
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
