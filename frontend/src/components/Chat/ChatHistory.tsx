import React, { useRef, useEffect } from 'react';
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

  return (
    <div className="content-area" onScroll={handleScroll} ref={containerRef}>
      <div className="transcript-container">
        {hasMore && transcript.length > 0 && (
          <div className="load-more-indicator">
            {isLoading ? '...' : '↑ Previous'}
          </div>
        )}
        
        <div className="chat-flow">
          {transcript.map((msg, i) => (
            <div key={i} className={`chat-bubble ${msg.role}`}>
              <div className="bubble-avatar">
                {msg.role === 'user' ? 'U' : '✦'}
              </div>
              <div className="bubble-content">
                {typeof msg.content === 'string' ? (
                   <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                   <pre>{JSON.stringify(msg.content)}</pre>
                )}
              </div>
            </div>
          ))}
          
          {transcript.length > 0 && (
            <div className="continue-prompt" style={{ display: 'flex', justifyContent: 'center', marginTop: '60px' }}>
               <button className="new-chat-btn" style={{ width: 'auto' }} onClick={onStartLive}>
                 Resume Realtime Agent
               </button>
            </div>
          )}
        </div>

        {transcript.length === 0 && !isLoading && (
          <div className="welcome-screen">
             <div className="welcome-icon">✦</div>
             <h2>How can I help you today?</h2>
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
