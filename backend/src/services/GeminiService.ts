import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { WebSocket } from 'ws';
import type { HistoryItem, ChatMessage } from '@web-cli/shared';

const execAsync = promisify(exec);
const GEMINI_BASE_DIR = path.join(os.homedir(), '.gemini');

export class GeminiService {
  private static sessionCache: HistoryItem[] = [];
  private static isScanning = false;

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
                // Read only the first 2KB for efficiency
                const fd = fs.openSync(filePath, 'r');
                const buffer = Buffer.alloc(2048);
                const bytesRead = fs.readSync(fd, buffer, 0, 2048, 0);
                fs.closeSync(fd);
                
                const contentPrefix = buffer.toString('utf-8', 0, bytesRead);
                const lines = contentPrefix.split('\n');

                if (lines[0]) {
                  try {
                    const firstEntry = JSON.parse(lines[0]);
                    uuid = firstEntry.sessionId || '';
                  } catch (e) {}
                }

                // If UUID extraction failed from first line, fallback to filename logic
                if (!uuid) {
                  const match = file.match(/session-.*-(.*)\.jsonl$/);
                  uuid = (match ? match[1] : null) || file.replace('.jsonl', '');
                }

                const firstMsgLine = lines.find(l => l && l.trim() && l.includes('"type":"user"'));
                if (firstMsgLine) {
                  try {
                    const entry = JSON.parse(firstMsgLine);
                    sessionName = typeof entry.content === 'string' ? entry.content : 
                                  (Array.isArray(entry.content) ? entry.content.map((p: any) => p.text || '').join('') : 'Complex Session');
                    if (sessionName.length > 50) sessionName = sessionName.substring(0, 47) + '...';
                  } catch (e) {}
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
      const chatDir = path.join(GEMINI_BASE_DIR, 'tmp', projectName, 'chats');
      if (!fs.existsSync(chatDir)) return [];

      const files = fs.readdirSync(chatDir);
      const shortId = uuid.substring(0, 8);
      const sessionFile = files.find(f => f.includes(shortId) && f.endsWith('.jsonl'));

      if (!sessionFile) return [];

      const filePath = path.join(chatDir, sessionFile);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      const allMessages: ChatMessage[] = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if ((entry.type === 'user' || entry.type === 'gemini') && entry.content) {
            let messageContent = '';
            if (typeof entry.content === 'string') {
              messageContent = entry.content;
            } else if (Array.isArray(entry.content)) {
              messageContent = entry.content.map((part: any) => part.text || '').join('');
            }

            allMessages.push({ 
              role: entry.type === 'user' ? 'user' : 'assistant', 
              content: messageContent.trim(), 
              timestamp: entry.timestamp 
            });
          }
        } catch (e) {}
      }

      const reversed = [...allMessages].reverse();
      const paginated = reversed.slice(offset, offset + limit);
      return paginated.reverse();
    } catch (error) {
      console.error(`GeminiService.getTranscript failed:`, error);
      return [];
    }
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
}
