import * as pty from 'node-pty';

try {
    const ptyProcess = pty.spawn('sh', [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env as any
    });
    ptyProcess.onData((data) => {
        console.log('PTY Data:', data);
        if (data.includes('$') || data.includes('#')) {
            console.log('Success! Shell started.');
            ptyProcess.write('exit\r');
        }
    });
    ptyProcess.onExit(({ exitCode }) => {
        console.log('PTY Exit:', exitCode);
        process.exit(0);
    });
} catch (e) {
    console.error('PTY Spawn Failed:', e);
    process.exit(1);
}
