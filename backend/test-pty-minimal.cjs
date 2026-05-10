const pty = require('node-pty');
console.log('Testing node-pty with minimal env...');
try {
    const ptyProcess = pty.spawn('/usr/bin/true', [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: '/tmp',
        env: { PATH: '/usr/bin:/bin' }
    });
    ptyProcess.on('exit', (code) => console.log('Exit:', code));
} catch (e) {
    console.error('Failed:', e);
}
