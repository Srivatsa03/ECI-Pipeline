'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'agent', content: 'Hello! I am connected to the Graph-RAG backend. What vulnerabilities or changes would you like to investigate?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(scrollToBottom, [messages]);

  const toggleChat = () => setIsOpen(!isOpen);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const query = input;
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'agent', content: data.response }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'agent', content: `Oops, something broke: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <div 
        onClick={toggleChat}
        style={{
          position: 'fixed', bottom: 30, right: 30, width: 60, height: 60,
          borderRadius: 30, background: 'var(--accent-blue)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4)', cursor: 'pointer', zIndex: 9999,
          transition: 'transform 0.2s ease', transform: isOpen ? 'scale(0)' : 'scale(1)',
        }}
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>

      {/* Chat Window */}
      <div className="glass-card" style={{
        position: 'fixed', bottom: isOpen ? 30 : -800, right: 30,
        width: 380, height: 600, display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)', zIndex: 10000,
        transition: 'bottom 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        overflow: 'hidden', padding: 0
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', background: 'rgba(59, 130, 246, 0.1)', 
          borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Threat Assistant</div>
            <div style={{ fontSize: 12, color: 'var(--accent-blue)' }}>● Graph-RAG Active</div>
          </div>
          <button onClick={toggleChat} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 24, cursor: 'pointer'
          }}>×</button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)',
              color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
              padding: '12px 16px', borderRadius: 16,
              borderBottomRightRadius: m.role === 'user' ? 4 : 16,
              borderBottomLeftRadius: m.role === 'agent' ? 4 : 16,
              maxWidth: '85%', fontSize: 14, lineHeight: 1.5,
              border: m.role === 'agent' ? '1px solid var(--border)' : 'none',
              overflowX: 'auto'
            }} className="markdown-body">
              {m.role === 'user' ? (
                m.content
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              )}
            </div>
          ))}
          {isLoading && (
            <div style={{
              alignSelf: 'flex-start', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)',
              padding: '12px 16px', borderRadius: 16, borderBottomLeftRadius: 4, maxWidth: '85%',
              fontSize: 14, border: '1px solid var(--border)'
            }}>
              <span className="dot-typing">Traversing Graph...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{
          padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 12, background: '#0B1120'
        }}>
          <input
            type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Search vulnerabilities..."
            style={{
              flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
              padding: '12px 16px', borderRadius: 24, color: '#fff', outline: 'none'
            }}
          />
          <button type="submit" disabled={isLoading} style={{
            background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 24,
            padding: '0 20px', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1
          }}>
            Send
          </button>
        </form>
      </div>
    </>
  );
}
