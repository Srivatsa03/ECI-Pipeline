'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Overview', icon: '▚', group: 'Operations' },
  { href: '/tickets', label: 'Action Tickets', icon: '◈', group: 'Operations' },
  { href: '/changes', label: 'Change Feed', icon: '≋', group: 'Operations' },
  { href: '/graph', label: 'Knowledge Graph', icon: '◍', group: 'Intelligence' },
  { href: '/analytics', label: 'Benchmarks', icon: '▟', group: 'Intelligence' },
  { href: '/sources', label: 'Sources', icon: '◇', group: 'Intelligence' },
  { href: '/chat', label: 'Threat Assistant', icon: '⌘', group: 'Intelligence' },
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
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const groups = [...new Set(navItems.map(i => i.group))];

  return (
    <div className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand" style={{ padding: '24px 22px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            position: 'relative', width: 38, height: 38, borderRadius: 11,
            background: 'var(--gradient-1)', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 19, fontWeight: 800, color: '#1a1205',
            boxShadow: '0 4px 16px rgba(245,181,68,0.3)',
          }}>
            S
            <div style={{
              position: 'absolute', left: 0, right: 0, height: 8,
              background: 'rgba(255,255,255,0.35)', filter: 'blur(3px)',
              animation: 'scan 3.2s linear infinite',
            }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-primary)' }}>
              SENTINEL
            </div>
            <div className="eyebrow" style={{ fontSize: 9.5, marginTop: 1 }}>
              ECI · CHANGE INTEL
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '14px 0', flex: 1, overflowY: 'auto' }}>
        {groups.map(group => (
          <div key={group} className="sidebar-group" style={{ marginBottom: 10 }}>
            <div className="eyebrow sidebar-group-label" style={{ padding: '6px 22px', fontSize: 9.5 }}>{group}</div>
            {navItems.filter(i => i.group === group).map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
              >
                <span className="sidebar-ico">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer" style={{ padding: '14px 22px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span className="status-pill" style={{ padding: '5px 10px' }}>
            <span className="live-dot" /> ONLINE
          </span>
          {mounted && (
            <button
              onClick={toggleTheme}
              className="btn-ghost"
              style={{ padding: '5px 9px', fontSize: 14 }}
              title="Toggle theme"
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          )}
        </div>
        <div className="eyebrow" style={{ fontSize: 9.5 }}>DeltaRAG + Graph-RAG</div>
      </div>
    </div>
  );
}
