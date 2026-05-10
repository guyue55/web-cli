import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { GeminiService } from './services/GeminiService.js';
import { apiRouter } from './routes/api.js';
import { setupWebSocket } from './websocket.js';

const app = express();
app.use(cors());
app.use(express.json());

// API Routes
app.use('/', apiRouter);

const server = createServer(app);
const wss = new WebSocketServer({ server });

setupWebSocket(wss);

const PORT = process.env.PORT || 3001;

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Global Gemini Session Manager listening on http://0.0.0.0:${PORT}`);
  GeminiService.startBackgroundScanner(); // Background scanning
});
