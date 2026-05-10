import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export class FileController {
  static async getFiles(req: Request, res: Response) {
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
  }
}
