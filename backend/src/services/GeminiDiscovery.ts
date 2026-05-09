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
  id: string; // UUID
}

/**
 * GeminiDiscovery V5: Blazing fast discovery using direct filesystem access.
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

      // 1. Immediately stream project list
      ws.send(JSON.stringify({ 
        type: 'project-list', 
        projects: projectEntries.map(([path, name]) => ({ path, name })) 
      }));

      console.log(`[Discovery] Starting fast FS scan for ${projectEntries.length} projects`);
      let totalFound = 0;

      for (const [projectPath, projectName] of projectEntries) {
        try {
          const chatDir = path.join(GEMINI_BASE_DIR, 'tmp', projectName, 'chats');
          if (!fs.existsSync(chatDir)) continue;

          ws.send(JSON.stringify({ type: 'project-scanning', projectName }));

          const files = fs.readdirSync(chatDir).filter(f => f.endsWith('.jsonl'));
          
          for (const file of files) {
            // Extract UUID from filename: session-YYYY-MM-DDTHH-mm-UUID.jsonl
            const match = file.match(/session-.*-(.*)\.jsonl$/);
            const uuid = match ? match[1] : file.replace('.jsonl', '');
            
            // For the 'name', we briefly peek at the first line of the file
            let sessionName = 'Untitled Session';
            try {
              const firstLine = fs.readFileSync(path.join(chatDir, file), 'utf-8').split('\n')[0];
              if (firstLine) {
                const entry = JSON.parse(firstLine);
                sessionName = entry.content ? (typeof entry.content === 'string' ? entry.content : 'Complex Session') : 'Empty Session';
                if (sessionName.length > 30) sessionName = sessionName.substring(0, 30) + '...';
              }
            } catch (e) {}

            const record: GeminiSessionRecord = {
              projectPath,
              projectName,
              index: '?', // Index is CLI-only, use UUID as primary
              name: sessionName,
              time: fs.statSync(path.join(chatDir, file)).mtime.toLocaleDateString(),
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

      console.log(`[Discovery] FS scan complete. Found ${totalFound} sessions.`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'discovery-complete', count: totalFound }));
      }
    } catch (error) {
      console.error('GeminiDiscovery failed:', error);
    }
  }
}
