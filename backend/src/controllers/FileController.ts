import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { SecurityConfig } from '../config/SecurityConfig.js';
import { assertAllowedPath } from '../utils/pathGuard.js';

export class FileController {
  static async getFiles(req: Request, res: Response) {
    const dirParam = (req.query.path as string) || process.cwd();
    try {
      const dir = assertAllowedPath(dirParam, 'path');
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      const files = entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: path.resolve(dir, entry.name)
      }));
      res.json(files);
    } catch (e) {
      const message = (e as Error).message;
      res.status(message.includes('outside allowed workspace roots') ? 403 : 500).json({ error: message });
    }
  }

  static async getWorkspaceRoots(_req: Request, res: Response) {
    try {
      const roots = SecurityConfig.workspaceRoots().map((rootPath) => ({
        path: rootPath,
        name: path.basename(rootPath) || rootPath,
      }));
      res.json(roots);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  static async createDirectory(req: Request, res: Response) {
    const parentPath = req.body?.parentPath as string | undefined;
    const name = (req.body?.name as string | undefined)?.trim();

    if (!parentPath || !name) {
      res.status(400).json({ error: 'parentPath and name are required' });
      return;
    }

    if (name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
      res.status(400).json({ error: 'Invalid directory name' });
      return;
    }

    try {
      const safeParentPath = assertAllowedPath(parentPath, 'parentPath');
      const targetPath = path.resolve(safeParentPath, name);
      await fs.promises.mkdir(targetPath, { recursive: false });

      res.status(201).json({
        path: targetPath,
        name,
      });
    } catch (e) {
      const message = (e as Error).message;
      if (message.includes('EEXIST')) {
        res.status(409).json({ error: 'Directory already exists' });
        return;
      }
      res.status(message.includes('outside allowed workspace roots') ? 403 : 500).json({ error: message });
    }
  }
}
