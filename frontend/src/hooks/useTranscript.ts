import { useState, useEffect, useCallback } from 'react';
import type { HistoryItem } from '@web-cli/shared';
import { ApiService } from '../services/ApiService';
import {
  createEmptyTranscriptState,
  DEFAULT_TRANSCRIPT_PAGE_SIZE,
  getVisibleTranscriptState,
  mergeTranscriptPage,
} from '../utils/transcriptState';

export function useTranscript(selectedSession: HistoryItem | null) {
  const sessionId = selectedSession?.id;
  const [state, setState] = useState(() => createEmptyTranscriptState(sessionId));

  const currentState = getVisibleTranscriptState(state, sessionId);

  const loadTranscript = useCallback(async (session: HistoryItem, currentOffset: number, append: boolean = false) => {
    if (currentState.isLoading && !append) return;
    setState(prev => ({
      ...(prev.sessionId === session.id ? prev : createEmptyTranscriptState(session.id)),
      isLoading: true
    }));

    try {
      const limit = DEFAULT_TRANSCRIPT_PAGE_SIZE;
      const data = await ApiService.getTranscript(session.id, session.projectName, limit, currentOffset);
      setState(prev => mergeTranscriptPage(prev, session, data, currentOffset, limit));
    } catch (e) {
      console.error('Failed to load transcript', e);
      setState(prev => prev.sessionId === session.id ? { ...prev, isLoading: false } : prev);
    }
  }, [currentState.isLoading]);

  useEffect(() => {
    if (selectedSession) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadTranscript(selectedSession, 0).catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession?.id]);

  const loadMore = () => {
    if (currentState.hasMore && !currentState.isLoading && selectedSession) {
      const newOffset = currentState.offset + DEFAULT_TRANSCRIPT_PAGE_SIZE;
      loadTranscript(selectedSession, newOffset, true).catch(console.error);
    }
  };

  return {
    transcript: currentState.transcript,
    isLoading: currentState.isLoading,
    hasMore: currentState.hasMore,
    loadMore
  };
}
