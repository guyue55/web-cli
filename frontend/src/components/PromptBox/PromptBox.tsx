import React, { useState, useRef, useEffect } from 'react';

interface PromptBoxProps {
  onSubmit: (text: string) => void;
}

// --- Icons (Unified with Gemini Style) ---
const IconSend = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>;

const SLASH_COMMANDS = [
  { cmd: '/help', desc: '获取帮助' },
  { cmd: '/clear', desc: '清空会话' },
  { cmd: '/model', desc: '切换模型' },
  { cmd: '/sandbox', desc: '开启沙箱' },
];

export const PromptBox: React.FC<PromptBoxProps> = ({ onSubmit }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showCommands = text.startsWith('/');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) {
        onSubmit(text);
        setText('');
      }
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [text]);

  const selectCommand = (cmd: string) => {
    setText(cmd + ' ');
    textareaRef.current?.focus();
  };

  const handleWheel = (e: React.WheelEvent) => {
    const el = textareaRef.current;
    if (!el) return;
    const isAtTop = el.scrollTop === 0;
    const isAtBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 2;
    
    if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
       // Let propagate
    } else {
       e.stopPropagation();
    }
  };

  return (
    <div className="prompt-container-outer" onWheel={handleWheel}>
      {showCommands && (
        <div className="slash-commands-menu glass-effect">
          {SLASH_COMMANDS.map((item) => (
            <div 
              key={item.cmd} 
              className="command-item"
              onClick={() => selectCommand(item.cmd)}
            >
              <span className="cmd-name">{item.cmd}</span>
              <span className="cmd-desc">{item.desc}</span>
            </div>
          ))}
        </div>
      )}
      
      <div className="prompt-container" onClick={() => textareaRef.current?.focus()}>
        <div className="prompt-input-row">
          <textarea 
            ref={textareaRef}
            className="prompt-textarea" 
            rows={1}
            placeholder="问问 Gemini..." 
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          
          <button 
            className={`send-btn-circle ${text.trim() ? 'active' : ''}`}
            disabled={!text.trim()}
            onClick={(e) => {
              e.stopPropagation();
              if (text.trim()) {
                onSubmit(text);
                setText('');
              }
            }}
          >
            <IconSend />
          </button>
        </div>
      </div>
      <div className="prompt-disclaimer">
        Gemini 可能会显示不准确的信息，请通过查阅其回答进行验证。
      </div>
    </div>
  );
};
