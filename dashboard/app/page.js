'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import LivePipeline from '../components/LivePipeline';

function StatCard({ label, value, sub, variant, accent }) {
  return (
    <div className={`glass-card stat-card reticle ${variant}`} style={{ padding: '22px 22px 20px' }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>{label}</div>
      <div className="metric" style={{ fontSize: 40, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12.5, color: accent || 'var(--text-secondary)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function TicketRow({ ticket, onOpen }) {
  const badgeClass = ticket.priority === 'critical' ? 'badge-critical'
    : ticket.priority === 'high' ? 'badge-high'
    : ticket.priority === 'medium' ? 'badge-medium' : 'badge-low';
  const riskClass = ticket.riskScore >= 9 ? 'risk-critical'
    : ticket.riskScore >= 7 ? 'risk-high' : 'risk-medium';

  return (
    <tr style={{ cursor: 'pointer' }} onClick={() => onOpen?.(ticket)}>
      <td>
        <div className={`risk-meter ${riskClass} ${ticket.riskScore >= 9 ? 'pulse-critical' : ''}`}>
          {ticket.riskScore}
        </div>
      </td>
      <td><span className={`badge ${badgeClass}`}>{ticket.priority}</span></td>
      <td>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, maxWidth: 460 }}>
          {ticket.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 560 }}>
          {ticket.summary?.substring(0, 118)}…
        </div>
      </td>
      <td>
        <span className={`category-tag cat-${ticket.sourceCategory || ''}`}>
          {ticket.sourceCategory?.replace('_', ' ') || '—'}
        </span>
      </td>
      <td className="mono" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
        {ticket.recommendedActions?.length || 0} actions
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/tickets').then(r => r.json()),
    ]).then(([s, t]) => {
      setStats(s);
      setTickets(Array.isArray(t) ? t : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <Sidebar />
        <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div className="eyebrow">Booting SENTINEL console…</div>
        </div>
      </>
    );
  }

  const criticalCount = tickets.filter(t => t.priority === 'critical').length;
  const highCount = tickets.filter(t => t.priority === 'high').length;

  const posture = [
    { label: 'Pending', count: stats?.pending || 0, color: 'var(--accent-amber)' },
    { label: 'Triaged', count: stats?.triaged || 0, color: 'var(--accent-blue)' },
    { label: 'Escalated', count: stats?.escalated || 0, color: 'var(--accent-red)' },
    { label: 'Closed', count: stats?.closed || 0, color: 'var(--accent-teal)' },
  ];
  const postureTotal = posture.reduce((a, b) => a + b.count, 0) || 1;

  return (
    <>
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 28 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Ecosystem Change Intelligence</div>
            <h1 style={{ fontSize: 30, fontWeight: 800 }}>Command Overview</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
              Continuous watch over Android security, API &amp; policy surfaces — detect, triage, act.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="status-pill"><span className="live-dot" /> MONITORING</span>
            <span className="status-pill">◷ LAST RUN 08:42 UTC</span>
            <span className="status-pill" style={{ color: criticalCount ? '#ff8f8f' : 'var(--text-secondary)' }}>
              ⚠ {criticalCount} CRITICAL
            </span>
          </div>
        </div>

        {/* Live pipeline */}
        <LivePipeline />

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <StatCard label="Monitored Sources" value={stats?.sources || 0} sub="14 active feeds" variant="blue" />
          <StatCard label="Changes Detected" value={stats?.totalChanges || 0} sub={`${stats?.pending || 0} pending triage`} variant="green" accent="var(--accent-amber)" />
          <StatCard label="Action Tickets" value={stats?.actionTickets || 0} sub={`${criticalCount} critical · ${highCount} high`} variant="amber" accent="#ff8f8f" />
          <StatCard label="Agent Events" value={stats?.agentEvents || 0} sub="scout · sentinel · coordinator" variant="purple" />
        </div>

        {/* Threat posture bar */}
        <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="eyebrow">Pipeline Posture</div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{postureTotal} events tracked</div>
          </div>
          <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 14, background: 'var(--border)' }}>
            {posture.map(p => (
              <div key={p.label} style={{ width: `${(p.count / postureTotal) * 100}%`, background: p.color }} title={`${p.label}: ${p.count}`} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {posture.map(p => (
              <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 9, height: 9, borderRadius: 3, background: p.color }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.label}</span>
                <span className="metric" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{p.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tickets */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Priority Action Tickets</h2>
              <span className="eyebrow" style={{ fontSize: 10 }}>{criticalCount} critical · {highCount} high · ranked by risk</span>
            </div>
            <a href="/tickets" className="btn-ghost" style={{ padding: '7px 14px', fontSize: 12 }}>View all →</a>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Risk</th>
                  <th style={{ width: 96 }}>Priority</th>
                  <th>Recommendation</th>
                  <th style={{ width: 150 }}>Source</th>
                  <th style={{ width: 96 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.slice(0, 8).map(t => (
                  <TicketRow key={t.id} ticket={t} onOpen={() => { window.location.href = '/tickets'; }} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
