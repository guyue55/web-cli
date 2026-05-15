import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
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
}
