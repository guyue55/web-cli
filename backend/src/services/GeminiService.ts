import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);
const GEMINI_BASE_DIR = path.join(os.homedir(), '.gemini');

export interface GeminiSessionRecord {
  projectPath: string;
  projectName: string;
  index: string;
  name: string;
  time: string;
  id: string; // UUID
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export class GeminiService {
  private static sessionCache: GeminiSessionRecord[] = [];
  private static isScanning = false;

  static getCachedSessions(): GeminiSessionRecord[] {
    return this.sessionCache;
  }

  static async startBackgroundScanner() {
    if (this.isScanning) return;
    this.isScanning = true;

    const scan = async () => {
      console.log(`[GeminiService] Scanning all projects for sessions...`);
      try {
        const projectsFile = path.join(GEMINI_BASE_DIR, 'projects.json');
        if (!fs.existsSync(projectsFile)) {
          console.warn('[GeminiService] projects.json not found');
          return;
        }

        const { projects } = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
        const allRecords: GeminiSessionRecord[] = [];

        const scanPromises = Object.entries(projects as Record<string, string>).map(async ([projectPath, projectName]) => {
          if (!fs.existsSync(projectPath)) return;
          try {
            const { stdout } = await execAsync('gemini --list-sessions', { cwd: projectPath, timeout: 8000 });
            const lines = stdout.split('\n');
            const sessionRegex = /^\s*(\d+)\.\s+(.*)\s+\((.*)\)\s+\[(.*)\]/;
            
            let projCount = 0;
            for (const line of lines) {
              const cleanLine = line.replace(/\x1B\[[0-9;]*[mK]/g, '');
              const match = cleanLine.match(sessionRegex);
              if (match) {
                allRecords.push({
                  projectPath,
                  projectName,
                  index: match[1],
                  name: match[2].trim(),
                  time: match[3].trim(),
                  id: match[4].trim()
                });
                projCount++;
              }
            }
            if (projCount > 0) console.log(`[GeminiService] Found ${projCount} sessions in ${projectName}`);
          } catch (e) {
            // Silence project-specific errors
          }
        });

        await Promise.all(scanPromises);
        this.sessionCache = allRecords;
        console.log(`[GeminiService] Cache updated. Total sessions: ${allRecords.length}`);
      } catch (error) {
        console.error('[GeminiService] Background scan failed:', error);
      } finally {
        setTimeout(() => scan(), 60000);
      }
    };
    scan();
  }

  static async getTranscript(uuid: string, projectName: string, limit: number = 20, offset: number = 0): Promise<ChatMessage[]> {
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
            // Fix: content can be a string OR an array of parts [{text: "..."}]
            let messageContent = '';
            if (typeof entry.content === 'string') {
              messageContent = entry.content;
            } else if (Array.isArray(entry.content)) {
              messageContent = entry.content
                .map((part: any) => part.text || '')
                .join('');
            }

            allMessages.push({ 
              role: entry.type === 'user' ? 'user' : 'assistant', 
              content: messageContent, 
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

  static async deleteSession(index: string, projectPath: string): Promise<void> {
    try {
      await execAsync(`gemini --delete-session ${index}`, { cwd: projectPath });
      this.sessionCache = this.sessionCache.filter(s => !(s.index === index && s.projectPath === projectPath));
    } catch (error) {
      throw error;
    }
  }
}
