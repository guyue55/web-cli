import type { Request, Response } from 'express';
import { GeminiService } from '../services/GeminiService.js';
import { SessionManager } from '../managers/SessionManager.js';
import { assertAllowedPath } from '../utils/pathGuard.js';
import { SessionMetadataService } from '../services/SessionMetadataService.js';

export class SessionController {
  static getActiveSessions(req: Request, res: Response) {
    res.json(SessionManager.getActiveSessions());
  }

  static getHistory(req: Request, res: Response) {
    try {
      const metadataStore = SessionMetadataService.getAll();
      const history = GeminiService.getCachedSessions().map(item => ({
        ...item,
        ...(metadataStore[SessionMetadataService.getSessionKey(item.projectPath, item.id)] || {})
      }));
      res.json(history);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  static triggerRefresh(req: Request, res: Response) {
    try {
      res.json({ message: 'Refresh triggered' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  static async getTranscript(req: Request, res: Response) {
    const { uuid } = req.params;
    const projectName = req.query.projectName as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!projectName) {
      res.status(400).json({ error: 'projectName is required' });
      return;
    }
    
    try {
      const transcript = await GeminiService.getTranscript(uuid as string, projectName, limit, offset);
      res.json(transcript);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  static async deleteSession(req: Request, res: Response) {
    const { uuid } = req.params;
    const projectPath = req.query.projectPath as string;
    if (!projectPath) {
      res.status(400).json({ error: 'projectPath is required' });
      return;
    }
    
    try {
      const safeProjectPath = assertAllowedPath(projectPath, 'projectPath');
      await GeminiService.deleteSession(uuid as string, safeProjectPath);
      SessionMetadataService.remove(safeProjectPath, uuid as string);
      res.sendStatus(204);
    } catch (e) {
      const message = (e as Error).message;
      res.status(message.includes('outside allowed workspace roots') ? 403 : 500).json({ error: message });
    }
  }

  static async renameSession(req: Request, res: Response) {
    const { uuid } = req.params;
    const { projectName, newName } = req.body;

    if (!projectName || !newName) {
      res.status(400).json({ error: 'projectName and newName are required' });
      return;
    }

    try {
      await GeminiService.renameSession(uuid as string, projectName, newName);
      res.json({ message: 'Session renamed successfully' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  static getSessionMetadata(req: Request, res: Response) {
    try {
      res.json(SessionMetadataService.getAll());
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  static updateSessionMetadata(req: Request, res: Response) {
    const { uuid } = req.params;
    const projectPath = req.query.projectPath as string;
    if (!projectPath) {
      res.status(400).json({ error: 'projectPath is required' });
      return;
    }

    try {
      const safeProjectPath = assertAllowedPath(projectPath, 'projectPath');
      const metadata = SessionMetadataService.update(safeProjectPath, uuid as string, req.body || {});
      res.json(metadata);
    } catch (e) {
      const message = (e as Error).message;
      res.status(message.includes('outside allowed workspace roots') ? 403 : 500).json({ error: message });
    }
  }

  static forceRestartSession(req: Request, res: Response) {
    const { uuid } = req.params;
    const projectPath = req.query.projectPath as string;
    if (!uuid || !projectPath) {
      res.status(400).json({ error: 'uuid and projectPath are required' });
      return;
    }
    let safeProjectPath: string;
    try {
      safeProjectPath = assertAllowedPath(projectPath, 'projectPath');
    } catch (e) {
      res.status(403).json({ error: (e as Error).message });
      return;
    }
    const sessionKey = SessionManager.getSessionKey(safeProjectPath, uuid as string);
    SessionManager.forceKillSession(sessionKey);
    res.json({ message: 'Session killed, please reconnect' });
  }
}
