import * as pty from 'node-pty';
import os from 'os';

console.log('OS:', os.platform(), os.release());
console.log('Node:', process.version);

try {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    console.log('Attempting to spawn:', shell);
    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env as any
    });

    ptyProcess.onData((data) => {
        console.log('PTY Data received:', JSON.stringify(data));
        ptyProcess.kill();
    });

    ptyProcess.onExit(({ exitCode }) => {
        console.log('PTY Exited with code:', exitCode);
        process.exit(0);
    });
} catch (e) {
    console.error('PTY Spawn Failed Error:', e);
    process.exit(1);
}
