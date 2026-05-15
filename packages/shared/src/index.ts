export type HistoryItem = {
  projectPath: string;
  projectName: string;
  index: string;
  name: string;
  time: string;
  updatedAt: number;
  id: string; // UUID
  pinned?: boolean;
  archived?: boolean;
  tags?: string[];
};

export interface ProjectEntry {
  path: string;
  name: string;
  isScanning?: boolean;
}

export type DiscoveryMessage = 
  | { type: 'project-list'; projects: { path: string; name: string }[] }
  | { type: 'project-scanning'; projectName: string }
  | { type: 'session-found'; record: HistoryItem }
  | { type: 'project-complete'; projectName: string }
  | { type: 'project-error'; projectName: string; error: string }
  | { type: 'discovery-complete' };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  kind?: 'message' | 'thought' | 'tool_call' | 'system' | 'error';
  label?: string;
}

export interface IPtyProcess {
  pid: number;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (status: { exitCode: number; signal?: number }) => void) => void;
  kill: () => void;
}

export interface TerminalProps {
  uuid: string;
  projectPath: string;
  initialPrompt?: string | null;
  theme?: string;
  terminalFontSize?: number;
  mobileHelperDefaultVisible?: boolean;
  preferredTabId?: string;
  isVisible?: boolean;
  onSendToChat?: (text: string) => void;
}

export interface ISession {
  id: string;
  projectPath: string;
  pty: IPtyProcess;
  buffer: string;
  clients: Set<any>;
}

export interface SessionMetadata {
  pinned?: boolean;
  archived?: boolean;
  tags?: string[];
}
