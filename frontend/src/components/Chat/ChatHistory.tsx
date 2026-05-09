import React, { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../../hooks/useTranscript';

interface ChatHistoryProps {
  transcript: ChatMessage[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onStartLive: () => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  transcript,
  isLoading,
  hasMore,
  onLoadMore,
  onStartLive
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0 && hasMore && !isLoading) {
      onLoadMore();
    }
  };

  const formatTime = (ts?: string) => {
    if (!ts) return '';
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="content-area" onScroll={handleScroll} ref={containerRef}>
      <div className="transcript-container">
        {hasMore && transcript.length > 0 && (
          <div className="load-more-indicator">
            {isLoading ? '...' : '↑ 加载更多'}
          </div>
        )}
        
        <div className="chat-flow">
          {transcript.map((msg, i) => (
            <div key={i} className={`chat-bubble ${msg.role}`}>
              <div className="bubble-avatar">
                {msg.role === 'user' ? 'U' : '✦'}
              </div>
              <div className="bubble-content">
                {msg.role === 'user' && (
                   <div className="bubble-label" style={{ marginBottom: 4 }}>You</div>
                )}
                {typeof msg.content === 'string' ? (
                   <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                   <pre>{JSON.stringify(msg.content)}</pre>
                )}
                {msg.timestamp && (
                   <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8 }}>
                      {formatTime(msg.timestamp)}
                   </div>
                )}
              </div>
            </div>
          ))}
          
          {transcript.length > 0 && (
            <div className="continue-prompt" style={{ display: 'flex', justifyContent: 'center', marginTop: '80px' }}>
               <button className="new-chat-btn" style={{ width: 'auto', borderRadius: '24px', padding: '12px 48px' }} onClick={onStartLive}>
                 继续此对话 →
               </button>
            </div>
          )}
        </div>

        {transcript.length === 0 && !isLoading && (
          <div className="welcome-screen">
             <div className="welcome-icon">✦</div>
             <h2>有什么我可以帮您的吗？</h2>
          </div>
        )}

        {isLoading && transcript.length === 0 && (
          <div className="loading-history">
            <div className="spinner" />
          </div>
        )}
      </div>
    </div>
  );
};
