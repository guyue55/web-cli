import type { ChatMessage } from '@web-cli/shared';

export function parseTranscriptContent(content: string): ChatMessage[] {
  const lines = content.split('\n').filter(line => line.trim());
  const messages: ChatMessage[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const push = (message: ChatMessage | null) => {
        if (message && message.content.trim()) {
          messages.push(message);
        }
      };

      const contentText = extractContentText(entry.content);

      if (entry.type === 'user' || entry.type === 'gemini') {
        push(contentText.trim()
          ? {
              role: entry.type === 'user' ? 'user' : 'assistant',
              kind: 'message',
              content: contentText.trim(),
              timestamp: entry.timestamp
            }
          : null);

        if (Array.isArray(entry.thoughts)) {
          for (const thought of entry.thoughts) {
            push({
              role: 'assistant',
              kind: 'thought',
              label: thought.subject || '思考',
              content: [thought.subject, thought.description].filter(Boolean).join('\n'),
              timestamp: thought.timestamp || entry.timestamp
            });
          }
        }

        if (Array.isArray(entry.toolCalls)) {
          for (const toolCall of entry.toolCalls) {
            const toolSummary = [
              toolCall.displayName || toolCall.name || '工具调用',
              toolCall.description,
              toDisplayText(toolCall.resultDisplay),
            ].filter(Boolean).join('\n\n');

            push({
              role: 'assistant',
              kind: 'tool_call',
              label: toolCall.displayName || toolCall.name || '工具调用',
              content: toolSummary || toDisplayText(toolCall.args) || '工具调用完成',
              timestamp: toolCall.timestamp || entry.timestamp
            });
          }
        }
      } else if (entry.type === 'thought' || entry.type === 'call') {
        push({
          role: 'assistant',
          kind: entry.type === 'thought' ? 'thought' : 'tool_call',
          label: entry.name || entry.subject || entry.type,
          content: contentText.trim() || toDisplayText(entry.args || entry.result || entry),
          timestamp: entry.timestamp
        });
      } else if (entry.type === 'error' || entry.type === 'info') {
        push({
          role: 'assistant',
          kind: entry.type === 'error' ? 'error' : 'system',
          label: entry.type === 'error' ? '系统错误' : '系统信息',
          content: contentText.trim() || String(entry.content || ''),
          timestamp: entry.timestamp
        });
      }
    } catch {
      // Ignore malformed JSONL entries so one bad line does not poison the whole transcript.
    }
  }

  return messages;
}

export function extractContentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part: { text?: string; content?: string }) => {
      if (typeof part?.text === 'string') return part.text;
      if (typeof part?.content === 'string') return part.content;
      return '';
    })
    .join('');
}

export function toDisplayText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
