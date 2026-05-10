import path from 'path';
import fs from 'fs';
import os from 'os';
import { WebSocket } from 'ws';
import type { HistoryItem } from '@web-cli/shared';

const GEMINI_BASE_DIR = path.join(os.homedir(), '.gemini');

/**
 * GeminiDiscovery V7: Added updatedAt timestamp for sorting.
 */
export class GeminiDiscovery {
  static async discoverAndStream(ws: WebSocket) {
    const projectsFile = path.join(GEMINI_BASE_DIR, 'projects.json');
    if (!fs.existsSync(projectsFile)) {
      ws.send(JSON.stringify({ type: 'discovery-complete', count: 0 }));
      return;
    }

    try {
      const { projects } = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
      const projectEntries = Object.entries(projects as Record<string, string>);

      ws.send(JSON.stringify({ 
        type: 'project-list', 
        projects: projectEntries.map(([path, name]) => ({ path, name })) 
      }));

      console.log(`[Discovery] Starting FS scan for sorting...`);
      let totalFound = 0;

      for (const [projectPath, projectName] of projectEntries) {
        try {
          const chatDir = path.join(GEMINI_BASE_DIR, 'tmp', projectName, 'chats');
          if (!fs.existsSync(chatDir)) continue;

          ws.send(JSON.stringify({ type: 'project-scanning', projectName }));

          const files = fs.readdirSync(chatDir).filter(f => f.endsWith('.jsonl'));
          
          for (const file of files) {
            const filePath = path.join(chatDir, file);
            const stats = fs.statSync(filePath);
            
            // Extract full UUID and name from file content
            let uuid = '';
            let sessionName = 'Untitled Session';
            try {
              // Read only the first 2KB for UUID and name to be efficient
              const fd = fs.openSync(filePath, 'r');
              const buffer = Buffer.alloc(2048);
              const bytesRead = fs.readSync(fd, buffer, 0, 2048, 0);
              fs.closeSync(fd);
              
              const contentPrefix = buffer.toString('utf-8', 0, bytesRead);
              const lines = contentPrefix.split('\n');
              
              // 1. Get full UUID from first line
              if (lines[0]) {
                try {
                  const firstEntry = JSON.parse(lines[0]);
                  uuid = firstEntry.sessionId || '';
                } catch (e) {}
              }

              // Fallback to filename parsing if content is corrupted or UUID missing
              if (!uuid) {
                const match = file.match(/session-.*-(.*)\.jsonl$/);
                uuid = (match ? match[1] : null) || file.replace('.jsonl', '');
              }

              // 2. Find first user message for session name (look in the prefix first)
              for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if (!line || !line.trim()) continue;
                try {
                  const entry = JSON.parse(line);
                  if (entry.type === 'user' && entry.content) {
                    let text = '';
                    if (typeof entry.content === 'string') {
                      text = entry.content;
                    } else if (Array.isArray(entry.content)) {
                      text = entry.content.map((p: any) => p.text || '').join('');
                    }
                    if (text.trim()) {
                      sessionName = text.trim();
                      if (sessionName.length > 50) sessionName = sessionName.substring(0, 47) + '...';
                      break; 
                    }
                  }
                } catch (e) {}
              }
            } catch (e) {
              // Last resort fallback
              if (!uuid) {
                const match = file.match(/session-.*-(.*)\.jsonl$/);
                uuid = (match ? match[1] : null) || file.replace('.jsonl', '');
              }
            }

            const record: HistoryItem = {
              projectPath,
              projectName,
              index: '?', 
              name: sessionName,
              time: stats.mtime.toLocaleDateString() + ' ' + stats.mtime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              updatedAt: stats.mtime.getTime(), // Sortable timestamp
              id: uuid
            };

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'session-found', record }));
            }
            totalFound++;
          }
          ws.send(JSON.stringify({ type: 'project-complete', projectName }));
        } catch (e) {
          console.error(`[Discovery] Error scanning FS for ${projectName}:`, e);
        }
      }

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'discovery-complete', count: totalFound }));
      }
    } catch (error) {
      console.error('GeminiDiscovery failed:', error);
    }
  }
}
