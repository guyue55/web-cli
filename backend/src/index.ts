import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { GeminiService } from './services/GeminiService.js';
import { apiRouter } from './routes/api.js';
import { setupWebSocket } from './websocket.js';
import { SecurityConfig } from './config/SecurityConfig.js';
import { requireHttpAuth } from './middleware/auth.js';
import { isOriginAllowed } from './utils/originGuard.js';

const app = express();
app.use(cors({
  origin(origin, callback) {
    callback(null, isOriginAllowed(origin) ? (origin || true) : false);
  },
  credentials: true
}));
app.use((req, res, next) => {
  if (!isOriginAllowed(req.headers.origin)) {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }
  next();
});
app.use(express.json());
app.use(requireHttpAuth);

// API Routes
app.use('/', apiRouter);
app.use('/api', apiRouter);

const server = createServer(app);
const wss = new WebSocketServer({ server });

setupWebSocket(wss);

const PORT = process.env.PORT || 3001;

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Global Gemini Session Manager listening on http://0.0.0.0:${PORT}`);
  if (!SecurityConfig.isAuthEnabled()) {
    console.warn('[Security] WEB_CLI_AUTH_TOKEN is not set. Running in local development open mode.');
  }
  GeminiService.startBackgroundScanner(); // Background scanning
});
