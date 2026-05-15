import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChatMessage, HistoryItem } from '@web-cli/shared';
import {
  createEmptyTranscriptState,
  DEFAULT_TRANSCRIPT_PAGE_SIZE,
  getVisibleTranscriptState,
  mergeTranscriptPage,
} from '../src/utils/transcriptState.ts';

const session: HistoryItem = {
  id: 'session-1',
  index: '0',
  name: 'Transcript session',
  projectName: 'web-cli',
  projectPath: '/tmp/web-cli',
  time: 'now',
  updatedAt: 1,
};

test('getVisibleTranscriptState resets state for a different session', () => {
  const current = createEmptyTranscriptState('session-1');
  current.transcript = [{ role: 'assistant', content: 'old' }];

  const visible = getVisibleTranscriptState(current, 'session-2');

  assert.equal(visible.sessionId, 'session-2');
  assert.deepEqual(visible.transcript, []);
  assert.equal(visible.hasMore, true);
});

test('mergeTranscriptPage replaces transcript on first page and prepends older pages', () => {
  const firstPage: ChatMessage[] = [
    { role: 'user', content: 'latest user' },
    { role: 'assistant', content: 'latest assistant' },
  ];
  const secondPage: ChatMessage[] = [
    { role: 'user', content: 'older user' },
  ];

  const initial = createEmptyTranscriptState(session.id);
  const mergedFirst = mergeTranscriptPage(initial, session, firstPage, 0, DEFAULT_TRANSCRIPT_PAGE_SIZE);
  const mergedSecond = mergeTranscriptPage(mergedFirst, session, secondPage, DEFAULT_TRANSCRIPT_PAGE_SIZE, DEFAULT_TRANSCRIPT_PAGE_SIZE);

  assert.deepEqual(mergedFirst.transcript, firstPage);
  assert.deepEqual(mergedSecond.transcript, [...secondPage, ...firstPage]);
  assert.equal(mergedSecond.hasMore, false);
});
