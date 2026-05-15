import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { WebSocket } from 'ws';
import type { HistoryItem, ChatMessage } from '@web-cli/shared';
import { parseTranscriptContent } from './transcriptParser.js';

const execAsync = promisify(exec);
const GEMINI_BASE_DIR = path.join(os.homedir(), '.gemini');

export class GeminiService {
  private static sessionCache: HistoryItem[] = [];
  private static isScanning = false;
  private static transcriptCache = new Map<string, {
    size: number;
    mtimeMs: number;
    messages: ChatMessage[];
  }>();

  static getCachedSessions(): HistoryItem[] {
    return this.sessionCache;
  }

  static generateNewId(): string {
    return `new-${Date.now()}`;
  }

  /**
   * High-performance background scanner. 
   * Uses FS-peeking to update cache without spawning processes.
   */
  static async startBackgroundScanner() {
    if (this.isScanning) return;
    this.isScanning = true;

    const scan = async () => {
      console.log(`[GeminiService] Peeking FS for session cache update...`);
      try {
        const projectsFile = path.join(GEMINI_BASE_DIR, 'projects.json');
        if (!fs.existsSync(projectsFile)) return;

        const { projects } = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
        const allRecords: HistoryItem[] = [];

        for (const [projectPath, projectName] of Object.entries(projects as Record<string, string>)) {
          const chatDir = path.join(GEMINI_BASE_DIR, 'tmp', projectName, 'chats');
          if (!fs.existsSync(chatDir)) continue;

          try {
            const files = fs.readdirSync(chatDir).filter(f => f.endsWith('.jsonl'));
            for (const file of files) {
              const filePath = path.join(chatDir, file);
              const stats = fs.statSync(filePath);
              // Extract full UUID from file content (first line)
              let uuid = '';
              let sessionName = 'Untitled Session';
              try {
                // Read only the first 64KB for efficiency
                const fd = fs.openSync(filePath, 'r');
                const buffer = Buffer.alloc(65536);
                const bytesRead = fs.readSync(fd, buffer, 0, 65536, 0);
                fs.closeSync(fd);
                
                const contentPrefix = buffer.toString('utf-8', 0, bytesRead);
                const lines = contentPrefix.split('\n');
                // Remove last line if it's likely partial
                if (bytesRead === 65536 && !contentPrefix.endsWith('\n')) {
                  lines.pop();
                }

                if (lines[0]) {
                  try {
                    const firstEntry = JSON.parse(lines[0]);
                    uuid = firstEntry.sessionId || '';
                    if (firstEntry.customName) {
                      sessionName = firstEntry.customName;
                    }
                  } catch (e) {
                    if (lines[0].length > 60000) {
                      console.warn(`[GeminiService] First line too long (>64KB) for session ${file}`);
                    }
                  }
                }

                // If UUID extraction failed from first line, fallback to filename logic
                if (!uuid) {
                  const match = file.match(/session-.*-(.*)\.jsonl$/);
                  uuid = (match ? match[1] : null) || file.replace('.jsonl', '');
                }

                if (sessionName === 'Untitled Session') {
                  let firstGemini = '';
                  for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line || !line.trim()) continue;
                    try {
                      const entry = JSON.parse(line);
                      let text = '';
                      if (typeof entry.content === 'string') {
                        text = entry.content;
                      } else if (Array.isArray(entry.content)) {
                        text = entry.content.map((p: any) => p.text || '').join('');
                      }

                      if (entry.type === 'user' && text.trim()) {
                        sessionName = text.trim();
                        break;
                      }
                      if (entry.type === 'gemini' && text.trim() && !firstGemini) {
                        firstGemini = text.trim();
                      }
                    } catch (e) {}
                  }
                  if (sessionName === 'Untitled Session' && firstGemini) {
                    sessionName = firstGemini;
                  }
                  if (sessionName !== 'Untitled Session' && sessionName.length > 50) {
                    sessionName = sessionName.substring(0, 47) + '...';
                  }
                }

                if (sessionName === 'Untitled Session') {
                  console.log(`[GeminiService] Could not determine name for ${file}, prefix length: ${contentPrefix.length}, lines: ${lines.length}`);
                  if (lines.length > 0 && lines[0]) {
                     console.log(`[GeminiService] Sample line: ${lines[0].substring(0, 100)}...`);
                  }
                }
              } catch (e) {
                if (!uuid) {
                  const match = file.match(/session-.*-(.*)\.jsonl$/);
                  uuid = (match ? match[1] : null) || file.replace('.jsonl', '');
                }
              }

              allRecords.push({
                projectPath,
                projectName,
                index: '?', 
                name: sessionName,
                time: stats.mtime.toLocaleDateString(),
                updatedAt: stats.mtime.getTime(),
                id: uuid
              });
            }
          } catch (e) {}
        }

        this.sessionCache = allRecords.sort((a, b) => b.updatedAt - a.updatedAt);
        console.log(`[GeminiService] Cache updated: ${allRecords.length} sessions.`);
      } catch (error) {
        console.error('[GeminiService] Scan failed:', error);
      } finally {
        setTimeout(() => scan(), 30000); // Update every 30s
      }
    };
    scan();
  }

  static async getTranscript(uuid: string, projectName: string, limit: number = 20, offset: number = 0): Promise<ChatMessage[]> {
    if (uuid.startsWith('new-')) return [];
    
    try {
      const filePath = this.resolveSessionFilePath(uuid, projectName);
      if (!filePath) return [];

      const messages = this.getOrParseTranscript(filePath);
      if (offset >= messages.length) return [];

      const reversed = [...messages].reverse();
      const paginated = reversed.slice(offset, offset + limit);
      return paginated.reverse();
    } catch (error) {
      console.error(`GeminiService.getTranscript failed:`, error);
      return [];
    }
  }

  private static resolveSessionFilePath(uuid: string, projectName: string): string | null {
    const chatDir = path.join(GEMINI_BASE_DIR, 'tmp', projectName, 'chats');
    if (!fs.existsSync(chatDir)) return null;

    const files = fs.readdirSync(chatDir);
    const exactMatch = files.find(f => f.includes(uuid) && f.endsWith('.jsonl'));
    if (exactMatch) return path.join(chatDir, exactMatch);

    const shortId = uuid.substring(0, 8);
    const legacyFile = files.find(f => f.includes(shortId) && f.endsWith('.jsonl'));
    return legacyFile ? path.join(chatDir, legacyFile) : null;
  }

  private static getOrParseTranscript(filePath: string): ChatMessage[] {
    const stats = fs.statSync(filePath);
    const cached = this.transcriptCache.get(filePath);

    if (cached && cached.size === stats.size && cached.mtimeMs === stats.mtimeMs) {
      return cached.messages;
    }

    const messages = this.parseTranscriptFile(filePath);
    this.transcriptCache.set(filePath, {
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      messages,
    });

    return messages;
  }

  private static parseTranscriptFile(filePath: string): ChatMessage[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseTranscriptContent(content);
  }

  static async deleteSession(uuid: string, projectPath: string): Promise<void> {
    try {
      const { stdout } = await execAsync('gemini --list-sessions', { cwd: projectPath });
      const lines = stdout.split('\n');
      const sessionRegex = /^\s*(\d+)\.\s+(.*)\s+\((.*)\)\s+\[(.*)\]/;
      
      let indexToDelete: string | null = null;
      for (const line of lines) {
        const cleanLine = line.replace(/\x1B\[[0-9;]*[mK]/g, '');
        const match = cleanLine.match(sessionRegex);
        if (match && match[4] && match[4].trim() === uuid) {
          indexToDelete = match[1] || null;
          break;
        }
      }

      if (indexToDelete) {
        await execAsync(`gemini --delete-session ${indexToDelete}`, { cwd: projectPath });
      }
    } catch (error) {
      console.error(`[GeminiService] deleteSession failed:`, error);
      throw error;
    }
  }

  static async renameSession(uuid: string, projectName: string, newName: string): Promise<void> {
    try {
      const chatDir = path.join(GEMINI_BASE_DIR, 'tmp', projectName, 'chats');
      if (!fs.existsSync(chatDir)) return;

      const files = fs.readdirSync(chatDir);
      const shortId = uuid.substring(0, 8);
      const sessionFile = files.find(f => f.includes(shortId) && f.endsWith('.jsonl'));

      if (!sessionFile) return;

      const filePath = path.join(chatDir, sessionFile);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      if (lines.length > 0 && lines[0]) {
        try {
          const firstLine = JSON.parse(lines[0]);
          firstLine.customName = newName;
          lines[0] = JSON.stringify(firstLine);
          fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
        } catch (e) {
          console.error(`Failed to parse first line for renaming:`, e);
        }
      }
    } catch (error) {
      console.error(`[GeminiService] renameSession failed:`, error);
      throw error;
    }
  }
}
