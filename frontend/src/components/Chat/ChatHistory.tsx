import React, { useRef, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '@web-cli/shared';

interface ChatHistoryProps {
  transcript: ChatMessage[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onStartLive: () => void;
}

const CodeBlock = ({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) => {
  const [copied, setCopied] = useState(false);
  
  let textContent = '';
  React.Children.forEach(children, (child) => {
    if (typeof child === 'string') textContent += child;
    else if (React.isValidElement(child) && child.props) {
      // @ts-expect-error - children might exist on props but TS doesn't know
      if (child.props.children) {
        // @ts-expect-error - same as above
        textContent += String(child.props.children);
      }
    }
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrapper">
      <button className={`copy-button ${copied ? 'copied' : ''}`} onClick={handleCopy}>
        {copied ? '已复制' : '复制'}
      </button>
      <pre {...props}>{children}</pre>
    </div>
  );
};

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  transcript,
  isLoading,
  hasMore,
  onLoadMore,
  onStartLive
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!isLoading && transcript.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript.length, isLoading]);

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
    } catch {
      return '';
    }
  };

  const copyFullMessage = (content: unknown) => {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    navigator.clipboard.writeText(text);
    alert('消息已复制到剪贴板');
  };

  return (
    <div className="content-area" onScroll={handleScroll} ref={containerRef}>
      <div className="transcript-container">
        {hasMore && transcript.length > 0 && (
          <div className="load-more-indicator">
            {isLoading ? '...' : '↑ 加载历史对话'}
          </div>
        )}
        
        <div className="chat-flow">
          {transcript.map((msg, i) => (
            <div key={i} className={`chat-bubble ${msg.role}`}>
              <div className="bubble-avatar">
                {msg.role === 'user' ? (
                  <div className="user-avatar-content">U</div>
                ) : (
                  <span className="assistant-avatar-icon">✦</span>
                )}
              </div>
              <div className="bubble-content">
                {msg.role === 'user' && (
                   <div className="bubble-label">您</div>
                )}
                <div className="markdown-body">
                  {typeof msg.content === 'string' ? (
                     <ReactMarkdown components={{ pre: CodeBlock }}>{msg.content}</ReactMarkdown>
                  ) : (
                     <pre>{JSON.stringify(msg.content, null, 2)}</pre>
                  )}
                </div>
                
                {msg.role === 'assistant' && (
                  <div className="message-actions">
                    <button className="action-btn-circle" title="复制" onClick={() => copyFullMessage(msg.content)}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>content_copy</span>
                    </button>
                    <button className="action-btn-circle" title="好评">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>thumb_up</span>
                    </button>
                    <button className="action-btn-circle" title="差评">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>thumb_down</span>
                    </button>
                    <button className="action-btn-circle" title="分享">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>share</span>
                    </button>
                  </div>
                )}

                {msg.timestamp && (
                   <div className="bubble-timestamp">
                      {formatTime(msg.timestamp)}
                   </div>
                )}
              </div>
            </div>
          ))}
          
          {transcript.length > 0 && (
            <div className="continue-prompt-container">
               <button className="continue-interaction-btn" onClick={onStartLive}>
                 进入实时交互终端 →
               </button>
            </div>
          )}

          <div ref={bottomRef} style={{ height: 1, marginTop: -1 }} />
        </div>

        {transcript.length === 0 && !isLoading && (
          <div className="welcome-screen">
             <div className="welcome-greeting">
               <h2 className="gradient-text">您好，开发者</h2>
               <p className="subtitle">我是您的 Gemini 代码助手。今天想做些什么？</p>
             </div>
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
