import type { ChatMessage, HistoryItem } from '@web-cli/shared';

export interface TranscriptState {
  sessionId: string | undefined;
  transcript: ChatMessage[];
  isLoading: boolean;
  offset: number;
  hasMore: boolean;
}

export const DEFAULT_TRANSCRIPT_PAGE_SIZE = 20;

export function createEmptyTranscriptState(sessionId?: string): TranscriptState {
  return {
    sessionId,
    transcript: [],
    isLoading: false,
    offset: 0,
    hasMore: true,
  };
}

export function getVisibleTranscriptState(
  state: TranscriptState,
  sessionId: string | undefined
): TranscriptState {
  return state.sessionId === sessionId ? state : createEmptyTranscriptState(sessionId);
}

export function mergeTranscriptPage(
  previousState: TranscriptState,
  session: HistoryItem,
  data: ChatMessage[],
  currentOffset: number,
  pageSize: number = DEFAULT_TRANSCRIPT_PAGE_SIZE
): TranscriptState {
  const base = previousState.sessionId === session.id
    ? previousState
    : createEmptyTranscriptState(session.id);

  return {
    ...base,
    offset: currentOffset,
    hasMore: data.length >= pageSize,
    transcript: currentOffset === 0 ? data : [...data, ...base.transcript],
    isLoading: false,
  };
}
