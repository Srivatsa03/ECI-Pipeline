'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Sidebar from '../../components/Sidebar';

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { role: 'agent', content: 'Hello! I am connected to the **Graph-RAG** backend. What vulnerabilities or changes would you like to investigate?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(scrollToBottom, [messages]);

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
      <Sidebar />
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 0, position: 'relative' }}>
        
        {/* Header */}
        <header style={{ padding: '24px 40px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Threat Intelligence Assistant</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>Interactive Graph-RAG Query System</p>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                background: m.role === 'user' ? 'var(--accent-blue)' : 'var(--bg-paper)',
                color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                padding: '24px', borderRadius: '16px',
                borderBottomRightRadius: m.role === 'user' ? '4px' : '16px',
                borderBottomLeftRadius: m.role === 'agent' ? '4px' : '16px',
                maxWidth: '80%', fontSize: '15px', lineHeight: 1.6,
                border: m.role === 'agent' ? '1px solid var(--border)' : 'none',
                boxShadow: m.role === 'user' ? '0 4px 12px rgba(59, 130, 246, 0.2)' : '0 4px 12px rgba(0,0,0,0.1)',
                overflowX: 'auto'
              }} className="markdown-body">
                {m.role === 'user' ? (
                  m.content
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                background: 'var(--bg-paper)', color: 'var(--text-muted)',
                padding: '24px', borderRadius: '16px', borderBottomLeftRadius: '4px', maxWidth: '80%',
                fontSize: '15px', border: '1px solid var(--border)'
              }}>
                <span className="dot-typing">Traversing Knowledge Graph...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: '24px 40px', borderTop: '1px solid var(--border)', background: 'var(--bg-paper)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '16px', maxWidth: '1000px', margin: '0 auto' }}>
            <input
              type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Query CVEs, Policy Drops, or Ask Architectural context..."
              style={{
                flex: 1, background: 'var(--bg-default)', border: '1px solid var(--border)',
                padding: '16px 24px', borderRadius: '32px', color: '#fff', outline: 'none', fontSize: '16px',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
              }}
            />
            <button type="submit" disabled={isLoading} style={{
              background: 'var(--gradient-1)', color: '#fff', border: 'none', borderRadius: '32px',
              padding: '0 32px', fontWeight: 600, fontSize: '16px', cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1, transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}>
              Execute Query
            </button>
          </form>
        </div>

      </main>
    </>
  );
}
