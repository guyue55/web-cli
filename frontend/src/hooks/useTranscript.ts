import { useState, useEffect, useCallback } from 'react';
import type { HistoryItem, ChatMessage } from '@web-cli/shared';
import { ApiService } from '../services/ApiService';

export function useTranscript(selectedSession: HistoryItem | null) {
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [prevSessionId, setPrevSessionId] = useState<string | undefined>();

  if (selectedSession?.id !== prevSessionId) {
    setPrevSessionId(selectedSession?.id);
    setOffset(0);
    setTranscript([]);
    setHasMore(true);
  }

  const loadTranscript = useCallback(async (session: HistoryItem, currentOffset: number, append: boolean = false) => {
    if (isLoading && !append) return;
    setIsLoading(true);
    try {
      const limit = 20;
      const data = await ApiService.getTranscript(session.id, session.projectName, limit, currentOffset);
      
      if (data.length < limit) setHasMore(false);
      setTranscript(prev => currentOffset === 0 ? data : [...data, ...prev]);
    } catch (e) {
      console.error('Failed to load transcript', e);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  useEffect(() => {
    if (selectedSession) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadTranscript(selectedSession, 0).catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession?.id]);

  const loadMore = () => {
    if (hasMore && !isLoading && selectedSession) {
      const newOffset = offset + 20;
      setOffset(newOffset);
      loadTranscript(selectedSession, newOffset, true).catch(console.error);
    }
  };

  return {
    transcript,
    isLoading,
    hasMore,
    loadMore
  };
}
