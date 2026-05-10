import React, { useState, useRef, useEffect } from 'react';

interface PromptBoxProps {
  onSubmit: (text: string) => void;
}

export const PromptBox: React.FC<PromptBoxProps> = ({ onSubmit }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [text]);

  return (
    <div className="prompt-container">
      <button className="icon-btn-plain" title="添加文件">
        <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--text-secondary)' }}>add</span>
      </button>
      
      <textarea 
        ref={textareaRef}
        className="prompt-textarea" 
        rows={1}
        placeholder="问问 Gemini" 
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      
      <div className="prompt-actions">
          <div className="model-selector-pill">
             快速 ▾
          </div>
          <button className="icon-btn-plain" title="语音输入" style={{ padding: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>mic</span>
          </button>
          <button 
            className={`send-btn-circle ${text.trim() ? 'active' : ''}`}
            disabled={!text.trim()}
            onClick={() => {
              onSubmit(text);
              setText('');
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>send</span>
          </button>
      </div>
    </div>
  );
};
