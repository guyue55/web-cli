import { WebSocket } from 'ws';
import { type IPtyProcess } from '@web-cli/shared';

export interface ISession {
  id: string; // UUID
  projectPath: string;
  pty: IPtyProcess;
  buffer: string;
  clients: Set<WebSocket>;
}
