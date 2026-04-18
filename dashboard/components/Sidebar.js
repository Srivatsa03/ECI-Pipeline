'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '◈' },
  { href: '/tickets', label: 'Action Tickets', icon: '◉' },
  { href: '/graph', label: 'Knowledge Graph', icon: '◎' },
  { href: '/sources', label: 'Sources', icon: '◇' },
  { href: '/changes', label: 'Changes', icon: '△' },
  { href: '/chat', label: 'Threat Assistant', icon: '💬' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  return (
    <div className="sidebar">
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--gradient-1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800,
          }}>E</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>ECI Pipeline</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>CHANGE INTELLIGENCE</div>
          </div>
        </div>
      </div>

      <nav style={{ padding: '16px 0', flex: 1 }}>
        <div style={{ padding: '0 20px', marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Navigation
          </span>
        </div>
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 11,
        color: 'var(--text-muted)',
      }}>
        <span>DeltaRAG + Graph-RAG</span>
        {mounted && (
          <button 
            onClick={toggleTheme}
            style={{ 
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '4px 8px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Toggle Theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        )}
      </div>
    </div>
  );
}
