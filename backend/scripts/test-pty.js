const pty = require('node-pty');
try {
  const p = pty.spawn('/bin/bash', [], { name: 'xterm-color', cols: 80, rows: 24 });
  console.log("Spawned:", p.pid);
  p.kill();
} catch (e) {
  console.error("Error:", e);
}
