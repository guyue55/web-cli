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
              // Read only the first 64KB for UUID and name to be efficient
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
              
              // 1. Get full UUID from first line
              if (lines[0]) {
                try {
                  const firstEntry = JSON.parse(lines[0]);
                  uuid = firstEntry.sessionId || '';
                  if (firstEntry.customName) {
                    sessionName = firstEntry.customName;
                  }
                } catch (e) {
                  // If first line is huge and still truncated at 64KB, we log it
                  if (lines[0].length > 60000) {
                    console.warn(`[GeminiDiscovery] First line too long (>64KB) for session ${file}`);
                  }
                }
              }

              // Fallback to filename parsing if content is corrupted or UUID missing
              if (!uuid) {
                const match = file.match(/session-.*-(.*)\.jsonl$/);
                uuid = (match ? match[1] : null) || file.replace('.jsonl', '');
              }

              // 2. Find first message for session name (look in the prefix first)
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
                  } catch (e) {
                    // Ignore partial lines
                  }
                }
                if (sessionName === 'Untitled Session' && firstGemini) {
                  sessionName = firstGemini;
                }
                if (sessionName !== 'Untitled Session' && sessionName.length > 50) {
                  sessionName = sessionName.substring(0, 47) + '...';
                }
              }

              if (sessionName === 'Untitled Session') {
                console.log(`[GeminiDiscovery] Could not determine name for ${file}, prefix length: ${contentPrefix.length}, lines: ${lines.length}`);
                if (lines.length > 0 && lines[0]) {
                   console.log(`[GeminiDiscovery] Sample line: ${lines[0].substring(0, 100)}...`);
                }
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
