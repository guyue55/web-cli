import React from 'react';

interface WelcomeScreenProps {
  onHandlePromptSubmit: (text: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onHandlePromptSubmit }) => {
  return (
    <div className="welcome-screen">
       <div className="welcome-greeting">
         <h2 className="gradient-text">您好，开发者</h2>
         <p className="subtitle">我是您的 Gemini 代码助手。今天想做些什么？</p>
       </div>
       
       <div className="suggestion-grid">
          <div className="suggestion-card" onClick={() => onHandlePromptSubmit("帮我分析当前项目的架构")}>
             <span className="card-icon">🏗️</span>
             <p>分析项目架构</p>
          </div>
          <div className="suggestion-card" onClick={() => onHandlePromptSubmit("检查代码中的潜在漏洞")}>
             <span className="card-icon">🛡️</span>
             <p>安全漏洞检查</p>
          </div>
          <div className="suggestion-card" onClick={() => onHandlePromptSubmit("为我编写单元测试")}>
             <span className="card-icon">🧪</span>
             <p>编写单元测试</p>
          </div>
          <div className="suggestion-card" onClick={() => onHandlePromptSubmit("重构并优化这段逻辑")}>
             <span className="card-icon">⚡</span>
             <p>重构优化代码</p>
          </div>
       </div>
    </div>
  );
};
