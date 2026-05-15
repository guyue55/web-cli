import React, { useRef, useState, useEffect, useMemo } from 'react';
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
  const [expandedProcessGroups, setExpandedProcessGroups] = useState<Record<string, boolean>>({});

  type MessageGroup = {
    type: 'message';
    role: string;
    content: string;
    timestamp?: string;
    kind?: ChatMessage['kind'];
  };

  type ProcessEntry = {
    role: string;
    content: string;
    timestamp?: string;
    kind: 'thought' | 'tool_call';
    label?: string;
  };

  type ProcessGroup = {
    type: 'process';
    id: string;
    items: ProcessEntry[];
  };

  type EventGroup = {
    type: 'event';
    role: string;
    content: string;
    timestamp?: string;
    kind?: Exclude<ChatMessage['kind'], 'message' | 'thought' | 'tool_call'>;
    label?: string;
  };

  const groupedTranscript = useMemo(() => {
    const groups: Array<MessageGroup | ProcessGroup | EventGroup> = [];
    let pendingProcessItems: ProcessEntry[] = [];

    const flushProcessGroup = () => {
      if (pendingProcessItems.length === 0) return;
      groups.push({
        type: 'process',
        id: `${pendingProcessItems[0].timestamp || 'process'}-${groups.length}`,
        items: pendingProcessItems,
      });
      pendingProcessItems = [];
    };

    transcript.forEach((msg) => {
      const lastGroup = groups[groups.length - 1];
      const msgContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

      if (msg.kind === 'thought' || msg.kind === 'tool_call') {
        pendingProcessItems.push({
          role: msg.role,
          content: msgContent,
          timestamp: msg.timestamp,
          kind: msg.kind,
          label: msg.label,
        });
        return;
      }

      flushProcessGroup();

      if (msg.kind && msg.kind !== 'message') {
        groups.push({
          type: 'event',
          role: msg.role,
          content: msgContent,
          timestamp: msg.timestamp,
          kind: msg.kind,
          label: msg.label,
        });
        return;
      }

      if (lastGroup && lastGroup.type === 'message' && lastGroup.role === msg.role && (!lastGroup.kind || lastGroup.kind === 'message')) {
        lastGroup.content += '\n\n' + msgContent;
      } else {
        groups.push({ type: 'message', role: msg.role, content: msgContent, timestamp: msg.timestamp, kind: 'message' });
      }
    });

    flushProcessGroup();
    return groups;
  }, [transcript]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!isLoading && transcript.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
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

  const copyFullMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    alert('消息已复制到剪贴板');
  };

  const getProcessSummary = (items: ProcessEntry[]) => {
    const thoughtCount = items.filter(item => item.kind === 'thought').length;
    const toolCount = items.filter(item => item.kind === 'tool_call').length;
    const parts = [];
    if (thoughtCount > 0) parts.push(`${thoughtCount} 条思考`);
    if (toolCount > 0) parts.push(`${toolCount} 次处理`);
    return parts.join(' · ');
  };

  const getProcessSnippet = (content: string) => {
    return content.replace(/\s+/g, ' ').trim().slice(0, 80);
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
          {groupedTranscript.map((msg, i) => {
            if (msg.type === 'process') {
              const expanded = Boolean(expandedProcessGroups[msg.id]);
              return (
                <div key={msg.id} className={`transcript-process-group ${expanded ? 'expanded' : ''}`}>
                  <button
                    className="transcript-process-toggle"
                    onClick={() => setExpandedProcessGroups(prev => ({ ...prev, [msg.id]: !expanded }))}
                    aria-expanded={expanded}
                  >
                    <div className="transcript-process-summary">
                      <span className="transcript-process-title">思考与处理过程</span>
                      <span className="transcript-process-meta">{getProcessSummary(msg.items)}</span>
                    </div>
                    <span className="transcript-process-preview">
                      {msg.items.slice(0, 2).map(item => getProcessSnippet(item.content || item.label || '')).filter(Boolean).join(' · ')}
                    </span>
                    <span className="material-symbols-outlined transcript-process-chevron">expand_more</span>
                  </button>

                  {expanded && (
                    <div className="transcript-process-body">
                      {msg.items.map((item, itemIndex) => (
                        <div key={`${msg.id}-${itemIndex}`} className={`transcript-process-item ${item.kind}`}>
                          <div className="transcript-process-item-header">
                            <span className="transcript-process-item-label">{item.label || (item.kind === 'thought' ? '思考' : '处理')}</span>
                            {item.timestamp && <span className="transcript-process-item-time">{formatTime(item.timestamp)}</span>}
                          </div>
                          <div className="transcript-process-item-body markdown-body">
                            <ReactMarkdown components={{ pre: CodeBlock }}>{item.content}</ReactMarkdown>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            if (msg.type === 'event' && msg.kind) {
              return (
                <div key={i} className={`transcript-event ${msg.kind}`}>
                  <div className="transcript-event-header">
                    <span className="transcript-event-label">{msg.label || '系统事件'}</span>
                    {msg.timestamp && <span className="transcript-event-time">{formatTime(msg.timestamp)}</span>}
                  </div>
                  <div className="transcript-event-body markdown-body">
                    <ReactMarkdown components={{ pre: CodeBlock }}>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              );
            }

            return (
              <div key={i} className={`chat-bubble ${msg.role}`}>
                <div className="bubble-avatar">
                  {msg.role === 'user' ? (
                    <div className="user-avatar-content">U</div>
                  ) : (
                    <span className="assistant-avatar-icon">✦</span>
                  )}
                </div>
                <div className="bubble-content">
                  <div className="markdown-body">
                    <ReactMarkdown components={{ pre: CodeBlock }}>{msg.content}</ReactMarkdown>
                  </div>
                  
                  <div className="message-actions-wrapper">
                    <div className="message-actions">
                      <button className="action-btn-circle copy-btn" title="复制消息" aria-label="复制消息" onClick={() => copyFullMessage(msg.content)}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>content_copy</span>
                      </button>
                    </div>
                  </div>

                  {msg.timestamp && (
                    <div className="bubble-timestamp">
                        {formatTime(msg.timestamp)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
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
          <div className="chat-flow">
            {[1, 2, 3].map(i => (
              <div key={i} className={`chat-bubble assistant`}>
                <div className="bubble-avatar skeleton" style={{ borderRadius: '50%' }} />
                <div className="bubble-content">
                  <div className="skeleton skeleton-bubble" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
