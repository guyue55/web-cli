import type { ChatMessage, DiscoveryMessage } from '@web-cli/shared';

const HOST = window.location.hostname || 'localhost';
const BASE_URL = `http://${HOST}:3001`;
const WS_URL = `ws://${HOST}:3001`;

export class ApiService {
  static async getActiveSessions(): Promise<string[]> {
    const res = await fetch(`${BASE_URL}/active-sessions`);
    if (!res.ok) throw new Error('Failed to fetch active sessions');
    return res.json();
  }

  static async getTranscript(
    sessionId: string, 
    projectName: string, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<ChatMessage[]> {
    const url = `${BASE_URL}/history/${sessionId}/transcript?projectName=${encodeURIComponent(projectName)}&limit=${limit}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch transcript');
    return res.json();
  }

  static async getFiles(path?: string): Promise<{ name: string; isDirectory: boolean; path: string }[]> {
    const url = path 
      ? `${BASE_URL}/files?path=${encodeURIComponent(path)}`
      : `${BASE_URL}/files`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch files');
    return res.json();
  }

  static async restartSession(uuid: string, projectPath: string): Promise<void> {
    const url = `${BASE_URL}/history/${uuid}/restart?projectPath=${encodeURIComponent(projectPath)}`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to restart session');
  }

  static connectDiscovery(onMessage: (msg: DiscoveryMessage) => void): () => void {
    const ws = new WebSocket(`${WS_URL}/discovery`);
    ws.onmessage = (event) => {
      onMessage(JSON.parse(event.data));
    };
    return () => ws.close();
  }
}
