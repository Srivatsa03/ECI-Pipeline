'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import LivePipeline from '../components/LivePipeline';
import DiffBlock from '../components/DiffBlock';

function riskColor(score) {
  if (score >= 9) return 'var(--del)';
  if (score >= 7) return 'var(--warn)';
  return 'var(--text-secondary)';
}

function relativeTime(iso) {
  if (!iso) return 'unknown';
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diff / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function TicketRow({ ticket, change }) {
  const added = change?.diff_json?.added_lines?.length ?? 0;
  const deleted = change?.diff_json?.deleted_lines?.length ?? 0;

  return (
    <a
      href="/tickets"
      className="glass-card"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        padding: '14px 18px',
        marginBottom: 8,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div className="spine" aria-hidden="true">
        <span className="s-add">+{added}</span>
        <span className="s-del">−{deleted}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          {ticket.title}
        </div>
        <div
          className="mono"
          style={{ fontSize: 10.5, color: 'var(--text-muted)' }}
        >
          {ticket.sourceName} · {ticket.recommendedActions?.length || 0} actions ·{' '}
          {ticket.ownerSuggestion || 'unassigned'}
        </div>
      </div>

      <div
        className="mono"
        style={{
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: '-0.05em',
          color: riskColor(ticket.riskScore),
          alignSelf: 'center',
          paddingLeft: 16,
        }}
      >
        {ticket.riskScore?.toFixed(1)}
      </div>
    </a>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then((r) => r.json()),
      fetch('/api/tickets').then((r) => r.json()),
      fetch('/api/changes').then((r) => r.json()),
    ])
      .then(([s, t, c]) => {
        setStats(s);
        setTickets(Array.isArray(t) ? t : []);
        setChanges(Array.isArray(c) ? c : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <Sidebar />
        <div
          className="main-content"
          style={{ display: 'grid', placeItems: 'center', height: '100vh' }}
        >
          <div className="eyebrow">Reading the change surface…</div>
        </div>
      </>
    );
  }

  const byId = new Map(changes.map((c) => [c.id, c]));
  const lead = tickets[0];
  const leadChange = lead ? byId.get(lead.changeId) : null;
  const criticalCount = tickets.filter((t) => t.priority === 'critical').length;
  const escalated = stats?.escalated || 0;

  return (
    <>
      <Sidebar />
      <div className="main-content">
        {/* ── Hero: the change that mattered most, as a diff ── */}
        {lead && (
          <section className="hero">
            <div className="hero-eyebrow">
              <span className="live-dot" />
              <span>Watching {stats?.sources || 0} feeds</span>
              <span style={{ color: 'var(--border-hover)' }}>/</span>
              <span>{stats?.totalChanges || 0} changes detected</span>
              <span style={{ color: 'var(--border-hover)' }}>/</span>
              <span style={{ color: escalated ? 'var(--del)' : 'inherit' }}>
                {escalated} escalated
              </span>
            </div>

            {leadChange ? (
              <DiffBlock change={leadChange} maxLines={5} />
            ) : (
              <div className="diff">
                <div className="diff-gutter" aria-hidden="true">
                  <span className="g-id">—</span>
                </div>
                <div className="diff-body">
                  <span className="diff-line" style={{ color: 'var(--text-muted)' }}>
                    Source diff for this ticket is not in the current window.
                  </span>
                </div>
              </div>
            )}

            <h1 className="hero-title">{lead.title}</h1>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 26,
                flexWrap: 'wrap',
                marginTop: 16,
              }}
            >
              <div>
                <div
                  className="strip-label"
                  style={{ marginBottom: 6 }}
                >
                  Risk
                </div>
                <div className="hero-risk">
                  {lead.riskScore?.toFixed(1)}
                  <span className="hero-risk-unit"> / 10</span>
                </div>
              </div>

              <div className="hero-meta" style={{ paddingBottom: 6 }}>
                <span>{lead.sourceName}</span>
                <span style={{ color: 'var(--border-hover)' }}>/</span>
                <span>detected {relativeTime(leadChange?.created_at || lead.createdAt)}</span>
                <span style={{ color: 'var(--border-hover)' }}>/</span>
                <span>{lead.recommendedActions?.length || 0} actions queued</span>
                <span style={{ color: 'var(--border-hover)' }}>/</span>
                <span>{lead.ownerSuggestion}</span>
              </div>
            </div>
          </section>
        )}

        {/* ── Counts, compressed ── */}
        <div className="strip">
          <div className="strip-cell">
            <span className="strip-label">Sources</span>
            <div className="strip-value">{stats?.sources || 0}</div>
            <div className="strip-sub">feeds under watch</div>
          </div>
          <div className="strip-cell">
            <span className="strip-label">Changes</span>
            <div className="strip-value">{stats?.totalChanges || 0}</div>
            <div className="strip-sub">{stats?.pending || 0} awaiting triage</div>
          </div>
          <div className="strip-cell">
            <span className="strip-label">Tickets</span>
            <div className="strip-value">{stats?.actionTickets || 0}</div>
            <div className="strip-sub" style={{ color: criticalCount ? 'var(--del)' : undefined }}>
              {criticalCount} critical
            </div>
          </div>
          <div className="strip-cell">
            <span className="strip-label">Agent events</span>
            <div className="strip-value">{stats?.agentEvents || 0}</div>
            <div className="strip-sub">sentinel · coordinator</div>
          </div>
        </div>

        <LivePipeline />

        {/* ── Ranked tickets ── */}
        <div className="sec">
          <h2>Action tickets</h2>
          <div className="sec-rule" />
          <span className="sec-count">ranked by risk</span>
        </div>

        {tickets.slice(0, 6).map((t) => (
          <TicketRow key={t.id} ticket={t} change={byId.get(t.changeId)} />
        ))}

        <a
          href="/tickets"
          className="mono"
          style={{
            display: 'inline-block',
            marginTop: 10,
            fontSize: 11,
            color: 'var(--signal)',
            textDecoration: 'none',
          }}
        >
          All {tickets.length} tickets →
        </a>
      </div>
    </>
  );
}
