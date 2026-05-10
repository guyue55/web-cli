import { spawn } from 'child_process';

const args = ['-q', '/dev/null', 'gemini', '--skip-trust', '--approval-mode', 'yolo'];
console.log('Spawning script', args.join(' '));

const cp = spawn('script', args, {
    env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' },
    stdio: ['pipe', 'pipe', 'pipe']
});

cp.stdout.on('data', (data) => {
    console.log('STDOUT:', data.toString());
});

cp.stderr.on('data', (data) => {
    console.log('STDERR:', data.toString());
});

cp.on('exit', (code) => {
    console.log('EXIT:', code);
});

setTimeout(() => {
    console.log('Sending input...');
    cp.stdin.write('help\r\n'); // Use \r\n for TTY
}, 2000);

setTimeout(() => {
    cp.kill();
    process.exit(0);
}, 10000);
