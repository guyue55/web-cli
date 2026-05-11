import React, { useState, useRef, useEffect } from 'react';

interface PromptBoxProps {
  onSubmit: (text: string) => void;
}

// --- Icons (Unified with Gemini Style) ---
const IconPlus = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconMic = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
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
    // No need to setShowCommands here as it's derived
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [text]);

  const selectCommand = (cmd: string) => {
    setText(cmd + ' ');
    textareaRef.current?.focus();
  };

  return (
    <div className="prompt-container-outer">
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
      
      <div className="prompt-container">
        <button className="icon-btn-plain" title="添加文件">
          <IconPlus />
        </button>
        
        <textarea 
          ref={textareaRef}
          className="prompt-textarea" 
          rows={1}
          placeholder="问问 Gemini..." 
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        
        <div className="prompt-actions">
            <div className="model-selector-pill">
               Gemini 1.5 Pro ▾
            </div>
            <div className="prompt-action-btns">
              <button className="icon-btn-plain mic-btn" title="语音输入">
                <IconMic />
              </button>
              <button 
                className={`send-btn-circle ${text.trim() ? 'active' : ''}`}
                disabled={!text.trim()}
                onClick={() => {
                  onSubmit(text);
                  setText('');
                }}
              >
                <IconSend />
              </button>
            </div>
        </div>
      </div>
      <div className="prompt-disclaimer">
        Gemini 可能会显示不准确的信息，请通过查阅其回答进行验证。
      </div>
    </div>
  );
};

