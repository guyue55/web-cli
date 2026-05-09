import { Router } from 'express';
import { GeminiService } from '../services/GeminiService.js';
import { SessionManager } from '../managers/SessionManager.js';
import fs from 'fs';
import path from 'path';

export const apiRouter = Router();

apiRouter.get('/active-sessions', (req, res) => {
  res.json(SessionManager.getActiveSessions());
});

apiRouter.get('/history', async (req, res) => {
  try {
    const history = GeminiService.getCachedSessions();
    res.json(history);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

apiRouter.post('/history/refresh', async (req, res) => {
  try {
    res.json({ message: 'Refresh triggered' });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

apiRouter.get('/history/:uuid/transcript', async (req, res) => {
  const projectName = req.query.projectName as string;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;

  if (!projectName) return res.status(400).json({ error: 'projectName is required' });
  try {
    const transcript = await GeminiService.getTranscript(req.params.uuid, projectName, limit, offset);
    res.json(transcript);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

apiRouter.delete('/history/:uuid', async (req, res) => {
  const projectPath = req.query.projectPath as string;
  if (!projectPath) return res.status(400).json({ error: 'projectPath is required' });
  try {
    await GeminiService.deleteSession(req.params.uuid, projectPath);
    res.sendStatus(204);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

apiRouter.get('/files', async (req, res) => {
  const dir = (req.query.path as string) || process.cwd();
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const files = entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.resolve(dir, entry.name)
    }));
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
