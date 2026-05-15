import fs from 'fs';
import os from 'os';
import path from 'path';
import type { SessionMetadata } from '@web-cli/shared';

type MetadataStore = Record<string, SessionMetadata>;

const GEMINI_BASE_DIR = path.join(os.homedir(), '.gemini');
const METADATA_FILE = path.join(GEMINI_BASE_DIR, 'web-cli-session-metadata.json');

export class SessionMetadataService {
  private static readStore(): MetadataStore {
    try {
      if (!fs.existsSync(METADATA_FILE)) {
        return {};
      }

      const raw = fs.readFileSync(METADATA_FILE, 'utf-8');
      return raw.trim() ? JSON.parse(raw) as MetadataStore : {};
    } catch (error) {
      console.warn('[SessionMetadataService] Failed to read metadata store:', error);
      return {};
    }
  }

  private static writeStore(store: MetadataStore) {
    fs.mkdirSync(path.dirname(METADATA_FILE), { recursive: true });
    fs.writeFileSync(METADATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  }

  static getSessionKey(projectPath: string, sessionId: string): string {
    return `${projectPath}:${sessionId}`;
  }

  static getAll(): MetadataStore {
    return this.readStore();
  }

  static get(projectPath: string, sessionId: string): SessionMetadata {
    const store = this.readStore();
    return store[this.getSessionKey(projectPath, sessionId)] || {};
  }

  static update(projectPath: string, sessionId: string, patch: SessionMetadata): SessionMetadata {
    const store = this.readStore();
    const key = this.getSessionKey(projectPath, sessionId);
    const current = store[key] || {};
    const next: SessionMetadata = { ...current, ...patch };

    if (Array.isArray(patch.tags)) {
      next.tags = patch.tags.slice(0, 6);
    }

    if (!next.pinned && !next.archived && (!next.tags || next.tags.length === 0)) {
      delete store[key];
      this.writeStore(store);
      return {};
    }

    store[key] = next;
    this.writeStore(store);
    return next;
  }

  static remove(projectPath: string, sessionId: string) {
    const store = this.readStore();
    const key = this.getSessionKey(projectPath, sessionId);
    if (store[key]) {
      delete store[key];
      this.writeStore(store);
    }
  }
}
