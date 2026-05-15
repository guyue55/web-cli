import test from 'node:test';
import assert from 'node:assert/strict';
import { extractContentText, parseTranscriptContent, toDisplayText } from '../src/services/transcriptParser.ts';

test('parseTranscriptContent parses message, thought, tool call, system info, and error entries', () => {
  const transcript = [
    JSON.stringify({
      type: 'user',
      timestamp: '2026-05-15T10:00:00.000Z',
      content: [{ text: 'hello from user' }]
    }),
    JSON.stringify({
      type: 'gemini',
      timestamp: '2026-05-15T10:00:01.000Z',
      content: [{ text: 'assistant reply' }],
      thoughts: [{ subject: 'Plan', description: 'Think first', timestamp: '2026-05-15T10:00:01.500Z' }],
      toolCalls: [{
        name: 'search_code',
        displayName: 'Search Code',
        description: 'Search repository',
        args: { query: 'Sidebar' },
        resultDisplay: { summary: 'Found 3 matches' }
      }]
    }),
    JSON.stringify({
      type: 'info',
      timestamp: '2026-05-15T10:00:02.000Z',
      content: 'Background scan complete'
    }),
    JSON.stringify({
      type: 'error',
      timestamp: '2026-05-15T10:00:03.000Z',
      content: 'Something failed'
    })
  ].join('\n');

  const result = parseTranscriptContent(transcript);

  assert.equal(result.length, 6);
  assert.deepEqual(
    result.map(item => ({ kind: item.kind, label: item.label, content: item.content })),
    [
      { kind: 'message', label: undefined, content: 'hello from user' },
      { kind: 'message', label: undefined, content: 'assistant reply' },
      { kind: 'thought', label: 'Plan', content: 'Plan\nThink first' },
      {
        kind: 'tool_call',
        label: 'Search Code',
        content: 'Search Code\n\nSearch repository\n\n{\n  "summary": "Found 3 matches"\n}'
      },
      { kind: 'system', label: '系统信息', content: 'Background scan complete' },
      { kind: 'error', label: '系统错误', content: 'Something failed' },
    ]
  );
});

test('parseTranscriptContent gracefully ignores malformed lines and preserves error entries', () => {
  const transcript = [
    '{bad json',
    JSON.stringify({ type: 'error', timestamp: '2026-05-15T10:00:03.000Z', content: 'Something failed' })
  ].join('\n');

  const result = parseTranscriptContent(transcript);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, 'error');
  assert.equal(result[0]?.label, '系统错误');
});

test('extractContentText and toDisplayText normalize heterogeneous content safely', () => {
  assert.equal(extractContentText([{ text: 'alpha' }, { content: 'beta' }, {}]), 'alphabeta');
  assert.equal(toDisplayText({ ok: true }), '{\n  "ok": true\n}');
  assert.equal(toDisplayText(undefined), '');
});
