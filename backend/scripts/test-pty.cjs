const pty = require('node-pty');
const path = require('path');

console.log('Testing node-pty...');
try {
    const ptyProcess = pty.spawn('sh', ['-c', 'gemini --version'], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: '/tmp',
        env: process.env
    });

    ptyProcess.on('data', function(data) {
        console.log('Data:', data);
    });

    ptyProcess.on('exit', function(exitCode) {
        console.log('Exit:', exitCode);
    });
} catch (e) {
    console.error('Failed:', e);
}
