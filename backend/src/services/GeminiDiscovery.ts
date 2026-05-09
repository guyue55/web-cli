import path from 'path';
import fs from 'fs';
import os from 'os';
import { WebSocket } from 'ws';

const GEMINI_BASE_DIR = path.join(os.homedir(), '.gemini');

export interface GeminiSessionRecord {
  projectPath: string;
  projectName: string;
  index: string;
  name: string;
  time: string;
  updatedAt: number; // Numeric timestamp for sorting
  id: string; // UUID
}

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
            
            const match = file.match(/session-.*-(.*)\.jsonl$/);
            const uuid = match ? match[1] : file.replace('.jsonl', '');
            
            let sessionName = 'Untitled Session';
            try {
              const content = fs.readFileSync(filePath, 'utf-8');
              const lines = content.split('\n').filter(l => l.trim());
              for (let i = 1; i < lines.length; i++) {
                const entry = JSON.parse(lines[i]);
                if (entry.content) {
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
              }
            } catch (e) {}

            const record: GeminiSessionRecord = {
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
