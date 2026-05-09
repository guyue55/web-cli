const cp = require('child_process');
try {
  const p = cp.spawn('/bin/bash', ['-c', 'echo "Hello from child process"']);
  p.stdout.on('data', d => console.log(d.toString()));
  p.on('exit', () => console.log("Exited"));
} catch (e) {
  console.error("Error:", e);
}
