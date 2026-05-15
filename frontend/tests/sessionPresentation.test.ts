import test from 'node:test';
import assert from 'node:assert/strict';
import type { HistoryItem } from '@web-cli/shared';
import {
  getSessionDisplayName,
  getSessionSecondaryLabel,
  isUntitledSessionName,
} from '../src/utils/sessionPresentation.ts';

const baseSession: HistoryItem = {
  id: 'session-1',
  index: '0',
  name: 'Untitled Session',
  projectName: 'web-cli',
  projectPath: '/tmp/web-cli',
  time: '2026/5/15 10:00',
  updatedAt: Date.UTC(2026, 4, 15, 10, 0, 0),
};

test('isUntitledSessionName recognizes empty and placeholder titles', () => {
  assert.equal(isUntitledSessionName(''), true);
  assert.equal(isUntitledSessionName(' Untitled Session '), true);
  assert.equal(isUntitledSessionName('未命名会话'), true);
  assert.equal(isUntitledSessionName('Meaningful task name'), false);
});

test('getSessionDisplayName preserves explicit names and synthesizes fallback names', () => {
  assert.equal(getSessionDisplayName({ ...baseSession, name: 'Refactor transcript parser' }), 'Refactor transcript parser');
  assert.match(getSessionDisplayName(baseSession), /^web-cli · /);
});

test('getSessionSecondaryLabel includes time and project path', () => {
  assert.equal(getSessionSecondaryLabel(baseSession), '2026/5/15 10:00 · /tmp/web-cli');
});
