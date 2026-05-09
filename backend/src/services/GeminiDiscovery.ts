import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { WebSocket } from 'ws';

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

/**
 * GeminiDiscovery V4: Manages real-time streaming session discovery.
 */
export class GeminiDiscovery {
  /**
   * Scans projects and streams results to a WebSocket client.
   */
  static async discoverAndStream(ws: WebSocket) {
    const projectsFile = path.join(GEMINI_BASE_DIR, 'projects.json');
    if (!fs.existsSync(projectsFile)) {
      ws.send(JSON.stringify({ type: 'discovery-complete', count: 0 }));
      return;
    }

    try {
      const { projects } = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
      const projectEntries = Object.entries(projects as Record<string, string>);

      // 1. Immediately send the project list so UI can show folders
      ws.send(JSON.stringify({ 
        type: 'project-list', 
        projects: projectEntries.map(([path, name]) => ({ path, name })) 
      }));

      // 2. Discover sessions project-by-project and stream them
      console.log(`[Discovery] Starting sequential scan of ${projectEntries.length} projects`);
      let totalFound = 0;
      
      for (const [projectPath, projectName] of projectEntries) {
        if (!fs.existsSync(projectPath)) {
          console.warn(`[Discovery] Path does not exist: ${projectPath}`);
          continue;
        }

        try {
          console.log(`[Discovery] Scanning project: ${projectName} at ${projectPath}`);
          ws.send(JSON.stringify({ type: 'project-scanning', projectName }));

          // Use a shorter timeout to avoid hanging the whole stream
          const { stdout } = await execAsync('gemini --list-sessions', { cwd: projectPath, timeout: 5000 });
          const lines = stdout.split('\n');
          // More robust regex
          const sessionRegex = /^\s*(\d+)\.\s+(.*?)\s+\((.*?)\)\s+\[(.*?)\]/;
          
          let projectFound = 0;
          for (const line of lines) {
            const cleanLine = line.replace(/\x1B\[[0-9;]*[mK]/g, '').trim();
            if (!cleanLine) continue;

            const match = cleanLine.match(sessionRegex);
            if (match) {
              const record: GeminiSessionRecord = {
                projectPath,
                projectName,
                index: match[1],
                name: match[2].trim(),
                time: match[3].trim(),
                id: match[4].trim()
              };
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'session-found', record }));
              }
              totalFound++;
              projectFound++;
            }
          }
          console.log(`[Discovery] Found ${projectFound} sessions in ${projectName}`);
          ws.send(JSON.stringify({ type: 'project-complete', projectName }));
        } catch (e) {
          console.error(`[Discovery] Error scanning ${projectName}:`, (e as Error).message);
          ws.send(JSON.stringify({ type: 'project-error', projectName, error: (e as Error).message }));
        }
      }

      console.log(`[Discovery] Total discovery complete. Found ${totalFound} sessions.`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'discovery-complete', count: totalFound }));
      }
    } catch (error) {
      console.error('GeminiDiscovery failed:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: (error as Error).message }));
      }
    }
  }
}
