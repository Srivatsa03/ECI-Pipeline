'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';

const categoryInfo = {
  security_bulletin: { label: 'Security Bulletin', icon: '🛡️', color: '#ef4444' },
  cve_feed: { label: 'CVE Feed', icon: '⚠️', color: '#f59e0b' },
  developer_docs: { label: 'Developer Docs', icon: '📘', color: '#3b82f6' },
  policy_update: { label: 'Policy Update', icon: '📋', color: '#8b5cf6' },
  oem_bulletin: { label: 'OEM Bulletin', icon: '📱', color: '#06b6d4' },
};

export default function SourcesPage() {
  const [sources, setSources] = useState([]);

  useEffect(() => {
    fetch('/api/sources').then(r => r.json()).then(d => setSources(Array.isArray(d) ? d : []));
  }, []);

  const grouped = sources.reduce((acc, s) => {
    const cat = s.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <>
      <Sidebar />
      <div className="main-content">
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Source Registry</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {sources.length} monitored feeds across {Object.keys(grouped).length} categories
          </p>
        </div>

        {Object.entries(grouped).map(([cat, srcs]) => {
          const info = categoryInfo[cat] || { label: cat, icon: '📄', color: '#6b7280' };
          return (
            <div key={cat} style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 20 }}>{info.icon}</span>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>{info.label}</h2>
                <span style={{
                  padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  background: `${info.color}20`, color: info.color,
                }}>{srcs.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                {srcs.map(s => (
                  <div key={s.id} className="glass-card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 240 }}>{s.name}</h3>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                        background: s.active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: s.active ? '#6ee7b7' : '#fca5a5',
                      }}>{s.active ? 'ACTIVE' : 'OFF'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, wordBreak: 'break-all' }}>
                      {s.url?.substring(0, 60)}...
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{s.snapshot_count || 0}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Snapshots</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{s.change_count || 0}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Changes</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>P{s.priority}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Priority</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
