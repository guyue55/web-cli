import React from 'react';

interface PromptBoxProps {
  onSubmit: (text: string) => void;
}

export const PromptBox: React.FC<PromptBoxProps> = ({ onSubmit }) => {
  return (
    <div className="prompt-container">
      <button className="icon-btn" title="Add File">＋</button>
      <input 
        className="prompt-input" 
        type="text" 
        placeholder="问问 Gemini" 
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const val = (e.target as HTMLInputElement).value;
            onSubmit(val);
            (e.target as HTMLInputElement).value = '';
          }
        }}
      />
      <div className="prompt-actions">
          <div className="model-selector" style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 12, color: 'var(--text-secondary)' }}>
             快速 ▾
          </div>
          <button className="icon-btn" title="Voice">🎤</button>
          <button 
            className="icon-btn send-btn" 
            style={{ color: 'var(--accent-blue)' }}
            onClick={(e) => {
              const input = e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement;
              onSubmit(input.value);
              input.value = '';
            }}
          >
            ▲
          </button>
      </div>
    </div>
  );
};
