import type { HistoryItem } from '@web-cli/shared';

const UNTITLED_PATTERNS = [
  'untitled session',
  'new session',
  'session',
  '未命名会话',
];

export function isUntitledSessionName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return true;
  return UNTITLED_PATTERNS.some(pattern => normalized === pattern);
}

function formatSessionTime(session: HistoryItem): string {
  if (session.updatedAt) {
    return new Date(session.updatedAt).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return session.time || '刚刚创建';
}

export function getSessionDisplayName(session: HistoryItem): string {
  if (!isUntitledSessionName(session.name)) {
    return session.name.trim();
  }

  return `${session.projectName} · ${formatSessionTime(session)}`;
}

export function getSessionSecondaryLabel(session: HistoryItem): string {
  return `${session.time} · ${session.projectPath}`;
}
