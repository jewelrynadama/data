import { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles } from 'lucide-react';
import type { Customer } from '../types';
import { askPearlAI } from '../utils/aiEngines';
import type { AIResponse } from '../utils/aiEngines';

interface Props {
  customers: Customer[];
}

export default function PearlAIChatWidget({ customers }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string; actions?: string[] }[]>([
    { role: 'ai', text: 'Halo! Saya Pearl AI 🤖. Ada yang bisa saya bantu terkait analitik CRM Anda hari ini?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    const query = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: query }]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response: AIResponse = askPearlAI(query, customers);
      setMessages(prev => [
        ...prev, 
        { role: 'ai', text: response.answer, actions: response.suggestedActions }
      ]);
      setIsTyping(false);
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <>
      <button 
        className="pearl-ai-fab"
        onClick={() => setIsOpen(true)}
        style={{ display: isOpen ? 'none' : 'flex' }}
      >
        <Sparkles size={24} />
      </button>

      {isOpen && (
        <div className="pearl-ai-window">
          <div className="pearl-ai-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="pearl-ai-avatar"><Sparkles size={16} /></div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Pearl AI</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Virtual CRM Assistant</div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="btn-close-dark">
              <X size={20} />
            </button>
          </div>

          <div className="pearl-ai-body">
            {messages.map((msg, i) => (
              <div key={i} className={`pearl-message-wrapper ${msg.role}`}>
                <div className="pearl-message">
                  {msg.text.split('\n').map((line, j) => (
                    <span key={j}>{line}<br /></span>
                  ))}
                </div>
                {msg.actions && msg.actions.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {msg.actions.map((act, k) => (
                      <button key={k} className="pearl-action-btn">✨ {act}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="pearl-message-wrapper ai">
                <div className="pearl-message typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="pearl-ai-footer">
            <input 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tanya soal pelanggan atau omzet..."
            />
            <button onClick={handleSend} disabled={!input.trim()}><Send size={18} /></button>
          </div>
        </div>
      )}

      <style>{`
        .pearl-ai-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 28px;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          color: white;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          z-index: 9999;
        }
        .pearl-ai-fab:hover {
          transform: translateY(-4px) scale(1.05);
          box-shadow: 0 8px 16px rgba(124, 58, 237, 0.5);
        }
        
        .pearl-ai-window {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 350px;
          max-width: calc(100vw - 32px);
          height: 500px;
          max-height: calc(100vh - 100px);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.2);
          display: flex;
          flex-direction: column;
          z-index: 10000;
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .pearl-ai-header {
          background: linear-gradient(135deg, #1e1e2d, #181824);
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: white;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .pearl-ai-avatar {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-close-dark {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-close-dark:hover { color: white; }

        .pearl-ai-body {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: var(--bg-main);
        }

        .pearl-message-wrapper {
          display: flex;
          flex-direction: column;
          max-width: 85%;
        }
        .pearl-message-wrapper.user {
          align-self: flex-end;
          align-items: flex-end;
        }
        .pearl-message-wrapper.ai {
          align-self: flex-start;
          align-items: flex-start;
        }

        .pearl-message {
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.5;
        }
        .user .pearl-message {
          background: var(--primary);
          color: white;
          border-bottom-right-radius: 4px;
        }
        .ai .pearl-message {
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-primary);
          border-bottom-left-radius: 4px;
        }

        .pearl-action-btn {
          background: rgba(124, 58, 237, 0.1);
          color: #7c3aed;
          border: 1px solid rgba(124, 58, 237, 0.3);
          padding: 6px 12px;
          border-radius: 16px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pearl-action-btn:hover {
          background: #7c3aed;
          color: white;
        }

        .pearl-ai-footer {
          padding: 12px 16px;
          background: var(--bg-card);
          border-top: 1px solid var(--border);
          display: flex;
          gap: 10px;
        }
        .pearl-ai-footer input {
          flex: 1;
          background: var(--bg-input);
          border: 1px solid var(--border);
          padding: 10px 14px;
          border-radius: 20px;
          color: var(--text-primary);
          font-size: 13px;
          outline: none;
        }
        .pearl-ai-footer input:focus {
          border-color: var(--primary);
        }
        .pearl-ai-footer button {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          background: var(--primary);
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .pearl-ai-footer button:disabled {
          background: var(--border);
          cursor: not-allowed;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
          align-items: center;
          padding: 14px 16px !important;
        }
        .typing-indicator span {
          width: 6px;
          height: 6px;
          border-radius: 3px;
          background: var(--text-muted);
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        @media (max-width: 600px) {
          .pearl-ai-window {
            bottom: 16px;
            right: 16px;
            width: calc(100vw - 32px);
            height: calc(100vh - 100px);
          }
          .pearl-ai-fab {
            bottom: 16px;
            right: 16px;
          }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
