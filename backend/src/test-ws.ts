import WebSocket from 'ws';

const sessionId = 'test-session-' + Date.now();
const ws = new WebSocket(`ws://localhost:3001?sessionId=${sessionId}`);

ws.on('open', () => {
  console.log(`Connected to session: ${sessionId}`);
  
  // Wait a bit to let the PTY spawn and send initial data
  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, 2000);
});

ws.on('message', (data) => {
  console.log('Received data length:', JSON.parse(data.toString()).data.length);
});

ws.on('error', (err) => {
  console.error('WS Error:', err);
  process.exit(1);
});
