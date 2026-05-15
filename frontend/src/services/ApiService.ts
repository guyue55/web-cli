import type { ChatMessage, DiscoveryMessage, SessionMetadata } from '@web-cli/shared';

const HOST = window.location.hostname || 'localhost';
const IS_DEFAULT_PORT =
  window.location.port === '' ||
  window.location.port === '80' ||
  window.location.port === '443';

const DEFAULT_API_BASE = IS_DEFAULT_PORT
  ? `${window.location.origin}/api`
  : `http://${HOST}:3001`;

const DEFAULT_WS_BASE = IS_DEFAULT_PORT
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${HOST}/ws`
  : `ws://${HOST}:3001`;

const ENV = import.meta.env as Record<string, string | undefined>;
const BASE_URL = ENV.VITE_API_BASE ?? DEFAULT_API_BASE;
const WS_URL = ENV.VITE_WS_BASE ?? DEFAULT_WS_BASE;
const AUTH_TOKEN = ENV.VITE_AUTH_TOKEN ?? '';

function authHeaders(): Record<string, string> {
  return AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {};
}

function appendAuthToken(url: string): string {
  if (!AUTH_TOKEN) return url;
  const parsed = new URL(url);
  parsed.searchParams.set('authToken', AUTH_TOKEN);
  return parsed.toString();
}

export class ApiService {
  static async getActiveSessions(): Promise<string[]> {
    const res = await fetch(`${BASE_URL}/active-sessions`, { headers: authHeaders() });
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
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch transcript');
    return res.json();
  }

  static async getFiles(path?: string): Promise<{ name: string; isDirectory: boolean; path: string }[]> {
    const url = path 
      ? `${BASE_URL}/files?path=${encodeURIComponent(path)}`
      : `${BASE_URL}/files`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch files');
    return res.json();
  }

  static async restartSession(uuid: string, projectPath: string): Promise<void> {
    const url = `${BASE_URL}/history/${uuid}/restart?projectPath=${encodeURIComponent(projectPath)}`;
    const res = await fetch(url, { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to restart session');
  }

  static async renameSession(uuid: string, projectName: string, newName: string): Promise<void> {
    const url = `${BASE_URL}/history/${uuid}/rename`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ projectName, newName })
    });
    if (!res.ok) throw new Error('Failed to rename session');
  }

  static async deleteSession(uuid: string, projectPath: string): Promise<void> {
    const url = `${BASE_URL}/history/${uuid}?projectPath=${encodeURIComponent(projectPath)}`;
    const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to delete session');
  }

  static async getSessionMetadata(): Promise<Record<string, SessionMetadata>> {
    const res = await fetch(`${BASE_URL}/history-metadata`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch session metadata');
    return res.json();
  }

  static async updateSessionMetadata(
    uuid: string,
    projectPath: string,
    metadata: SessionMetadata
  ): Promise<SessionMetadata> {
    const url = `${BASE_URL}/history/${uuid}/metadata?projectPath=${encodeURIComponent(projectPath)}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(metadata)
    });
    if (!res.ok) throw new Error('Failed to update session metadata');
    return res.json();
  }

  static getTerminalWsUrl(
    uuid: string,
    projectPath: string,
    cols?: number,
    rows?: number
  ): string {
    const url = new URL(WS_URL);
    url.searchParams.set('uuid', uuid);
    url.searchParams.set('projectPath', projectPath);
    if (cols) url.searchParams.set('cols', String(cols));
    if (rows) url.searchParams.set('rows', String(rows));
    return appendAuthToken(url.toString());
  }

  static connectDiscovery(onMessage: (msg: DiscoveryMessage) => void): () => void {
    const ws = new WebSocket(appendAuthToken(`${WS_URL}/discovery`));
    let closeWhenReady = false;

    ws.onopen = () => {
      if (closeWhenReady) {
        ws.close(1000, 'discovery cleanup');
      }
    };

    ws.onmessage = (event) => {
      onMessage(JSON.parse(event.data));
    };
    return () => {
      if (ws.readyState === WebSocket.CONNECTING) {
        closeWhenReady = true;
        return;
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'discovery cleanup');
      }
    };
  }
}
