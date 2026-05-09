import { useState, useEffect } from 'react';
import type { HistoryItem } from './useSessions';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export function useTranscript(selectedSession: HistoryItem | null) {
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadTranscript = async (session: HistoryItem, currentOffset: number, append: boolean = false) => {
    if (isLoading && !append) return;
    setIsLoading(true);
    try {
      const host = window.location.hostname || 'localhost';
      const limit = 20;
      const url = `http://${host}:3001/history/${session.id}/transcript?projectName=${encodeURIComponent(session.projectName)}&limit=${limit}&offset=${currentOffset}`;
      
      const res = await fetch(url).catch(() => null);
      if (!res || !res.ok) {
        console.warn('Transcript fetch failed or empty');
        return;
      }

      const data = await res.json();
      if (!Array.isArray(data)) {
        console.error('Invalid data format: expected array');
        return;
      }
      
      if (data.length < limit) setHasMore(false);
      setTranscript(prev => currentOffset === 0 ? data : [...data, ...prev]);
    } catch (e) {
      console.error('Failed to load transcript', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSession) {
      setOffset(0);
      setTranscript([]);
      setHasMore(true);
      loadTranscript(selectedSession, 0);
    } else {
      setTranscript([]);
    }
  }, [selectedSession?.id]);

  const loadMore = () => {
    if (hasMore && !isLoading && selectedSession) {
      const newOffset = offset + 20;
      setOffset(newOffset);
      loadTranscript(selectedSession, newOffset, true);
    }
  };

  return {
    transcript,
    isLoading,
    hasMore,
    loadMore
  };
}
