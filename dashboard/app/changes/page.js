'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';

export default function ChangesPage() {
  const [changes, setChanges] = useState([]);

  useEffect(() => {
    fetch('/api/changes').then(r => r.json()).then(d => setChanges(Array.isArray(d) ? d : []));
  }, []);

  return (
    <>
      <Sidebar />
      <div className="main-content">
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Change Events</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {changes.length} detected changes with Sentinel triage results
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {changes.map(c => {
            const statusColor = c.status === 'escalated' ? 'var(--accent-red)'
              : c.status === 'triaged' ? 'var(--accent-blue)'
              : c.status === 'closed' ? 'var(--accent-emerald)'
              : 'var(--accent-amber)';

            return (
              <div key={c.id} className="glass-card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: `${statusColor}20`, color: statusColor, textTransform: 'uppercase',
                      }}>{c.status}</span>
                      <span className={`category-tag cat-${c.source_category || ''}`}>
                        {c.source_category?.replace('_', ' ')}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        #{c.id} · {c.source_name}
                      </span>
                    </div>

                    {c.triage_title && (
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                        {c.triage_title}
                      </div>
                    )}

                    {c.triage_summary && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                        {c.triage_summary}
                      </div>
                    )}

                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {c.diff_json?.summary || 'No diff summary'}
                      {c.diff_json?.change_ratio ? ` · Δ ${(c.diff_json.change_ratio * 100).toFixed(0)}%` : ''}
                    </div>
                  </div>

                  {c.relevance_score != null && (
                    <div style={{ display: 'flex', gap: 16, marginLeft: 24 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: 22, fontWeight: 800,
                          color: c.relevance_score >= 7 ? 'var(--accent-red)' : c.relevance_score >= 5 ? 'var(--accent-amber)' : 'var(--text-muted)',
                        }}>{c.relevance_score}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Relevance</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: 22, fontWeight: 800,
                          color: c.local_risk_score >= 7 ? 'var(--accent-red)' : c.local_risk_score >= 5 ? 'var(--accent-amber)' : 'var(--text-muted)',
                        }}>{c.local_risk_score}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Risk</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
