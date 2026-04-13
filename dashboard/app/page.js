'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import PipelineRunner from '../components/PipelineRunner';

function StatCard({ label, value, sub, variant }) {
  return (
    <div className={`glass-card stat-card ${variant}`} style={{ padding: '24px' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function TicketRow({ ticket }) {
  const badgeClass = ticket.priority === 'critical' ? 'badge-critical'
    : ticket.priority === 'high' ? 'badge-high'
    : ticket.priority === 'medium' ? 'badge-medium' : 'badge-low';

  const riskClass = ticket.riskScore >= 9 ? 'risk-critical'
    : ticket.riskScore >= 7 ? 'risk-high' : 'risk-medium';

  return (
    <tr>
      <td>
        <div className={`risk-meter ${riskClass} ${ticket.riskScore >= 9 ? 'pulse-critical' : ''}`}>
          {ticket.riskScore}
        </div>
      </td>
      <td>
        <span className={`badge ${badgeClass}`}>{ticket.priority}</span>
      </td>
      <td>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, maxWidth: 400 }}>
          {ticket.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 500 }}>
          {ticket.summary?.substring(0, 120)}...
        </div>
      </td>
      <td>
        <span className={`category-tag cat-${ticket.sourceCategory || ''}`}>
          {ticket.sourceCategory?.replace('_', ' ') || '—'}
        </span>
      </td>
      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
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
          <div style={{ color: 'var(--text-muted)', fontSize: 16 }}>Loading pipeline data...</div>
        </div>
      </>
    );
  }

  const criticalCount = tickets.filter(t => t.priority === 'critical').length;
  const highCount = tickets.filter(t => t.priority === 'high').length;

  return (
    <>
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            Pipeline Overview
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Ecosystem Change Intelligence — real-time monitoring & triage
          </p>
        </div>

        {/* Pipeline Runner */}
        <PipelineRunner />

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <StatCard label="Monitored Sources" value={stats?.sources || 0} sub="Active feeds" variant="blue" />
          <StatCard label="Changes Detected" value={stats?.totalChanges || 0} sub={`${stats?.pending || 0} pending`} variant="green" />
          <StatCard label="Action Tickets" value={stats?.actionTickets || 0} sub={`${criticalCount} critical`} variant="amber" />
          <StatCard label="Agent Events" value={stats?.agentEvents || 0} sub="Triage + coordination" variant="purple" />
        </div>

        {/* Pipeline Status Bar */}
        <div className="glass-card" style={{ padding: '20px 28px', marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            Pipeline Status
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {[
              { label: 'Pending', count: stats?.pending || 0, color: 'var(--accent-amber)' },
              { label: 'Triaged', count: stats?.triaged || 0, color: 'var(--accent-blue)' },
              { label: 'Escalated', count: stats?.escalated || 0, color: 'var(--accent-red)' },
              { label: 'Closed', count: stats?.closed || 0, color: 'var(--accent-emerald)' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.label}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Tickets */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Action Tickets</h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {criticalCount} critical · {highCount} high priority
              </span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Risk</th>
                  <th style={{ width: 100 }}>Priority</th>
                  <th>Details</th>
                  <th style={{ width: 140 }}>Source</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.slice(0, 8).map(t => <TicketRow key={t.id} ticket={t} />)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
