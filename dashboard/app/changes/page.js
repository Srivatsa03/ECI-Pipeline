'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import DiffBlock from '../../components/DiffBlock';

const STATUS_COLOR = {
  escalated: 'var(--del)',
  triaged: 'var(--signal)',
  closed: 'var(--add)',
  pending: 'var(--warn)',
};

function scoreColor(v) {
  if (v >= 7) return 'var(--del)';
  if (v >= 5) return 'var(--warn)';
  return 'var(--text-muted)';
}

function Score({ value, label }) {
  return (
    <div style={{ textAlign: 'right', minWidth: 58 }}>
      <div
        className="mono"
        style={{
          fontSize: 21,
          fontWeight: 600,
          letterSpacing: '-0.05em',
          color: scoreColor(value),
          lineHeight: 1,
        }}
      >
        {value ?? '—'}
      </div>
      <div className="strip-label" style={{ marginBottom: 0, marginTop: 6 }}>
        {label}
      </div>
    </div>
  );
}

export default function ChangesPage() {
  const [changes, setChanges] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/changes')
      .then((r) => r.json())
      .then((d) => setChanges(Array.isArray(d) ? d : []));
  }, []);

  const statuses = ['all', 'escalated', 'triaged', 'pending', 'closed'];
  const counts = Object.fromEntries(
    statuses.map((s) => [
      s,
      s === 'all' ? changes.length : changes.filter((c) => c.status === s).length,
    ])
  );
  const shown = filter === 'all' ? changes : changes.filter((c) => c.status === filter);

  return (
    <>
      <Sidebar />
      <div className="main-content">
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Change feed</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Every row is a diff between two snapshots, with the Sentinel agent&apos;s
            triage attached.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="mono"
              style={{
                padding: '6px 13px',
                borderRadius: 999,
                fontSize: 10.5,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                border: `1px solid ${filter === s ? 'var(--border-hover)' : 'var(--border)'}`,
                background: filter === s ? 'var(--bg-card-hover)' : 'transparent',
                color: filter === s ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {s} {counts[s]}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {shown.map((c) => (
            <div key={c.id} className="glass-card" style={{ padding: '18px 20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 18,
                  marginBottom: 14,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className="mono"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                      fontSize: 10,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      marginBottom: 9,
                    }}
                  >
                    <span style={{ color: STATUS_COLOR[c.status] || 'var(--text-muted)' }}>
                      {c.status}
                    </span>
                    <span style={{ color: 'var(--border-hover)' }}>/</span>
                    <span>{c.source_name}</span>
                    <span style={{ color: 'var(--border-hover)' }}>/</span>
                    <span>{c.source_category?.replace(/_/g, ' ')}</span>
                  </div>

                  {c.triage_title && (
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                      {c.triage_title}
                    </div>
                  )}

                  {/* triage_summary and diff_json.summary are the same string.
                      Render it once; the diff below carries the detail. */}
                  {c.triage_summary && (
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.6,
                        maxWidth: '76ch',
                      }}
                    >
                      {c.triage_summary}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 18 }}>
                  <Score value={c.relevance_score} label="Relevance" />
                  <Score value={c.local_risk_score} label="Risk" />
                </div>
              </div>

              <DiffBlock change={c} maxLines={4} />
            </div>
          ))}
        </div>

        {shown.length === 0 && (
          <div
            className="glass-card"
            style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}
          >
            <div className="eyebrow">No {filter === 'all' ? '' : filter} changes</div>
          </div>
        )}
      </div>
    </>
  );
}
