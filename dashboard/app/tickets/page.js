'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';

function TicketDetail({ ticket, onClose }) {
  const [evidence, setEvidence] = useState([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  useEffect(() => {
    if (!ticket?.evidenceCitations?.length) return;
    setLoadingEvidence(true);
    const ids = ticket.evidenceCitations.join(',');
    fetch(`/api/evidence?ids=${encodeURIComponent(ids)}`)
      .then(r => r.json())
      .then(d => { setEvidence(Array.isArray(d) ? d : []); setLoadingEvidence(false); })
      .catch(() => setLoadingEvidence(false));
  }, [ticket]);

  if (!ticket) return null;

  const badgeClass = ticket.priority === 'critical' ? 'badge-critical'
    : ticket.priority === 'high' ? 'badge-high'
    : ticket.priority === 'medium' ? 'badge-medium' : 'badge-low';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <span className={`badge ${badgeClass}`} style={{ marginBottom: 12, display: 'inline-flex' }}>
              {ticket.priority} — Risk {ticket.riskScore}
            </span>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>{ticket.title}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 24, cursor: 'pointer', padding: '0 4px' }}>×</button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Summary</div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{ticket.summary}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div className="glass-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Owner</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{ticket.ownerSuggestion || '—'}</div>
          </div>
          <div className="glass-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Source</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {ticket.sourceName || '—'}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
            Recommended Actions ({ticket.recommendedActions?.length || 0})
          </div>
          {ticket.recommendedActions?.map((a, i) => (
            <div key={i} className="glass-card" style={{ padding: '14px 16px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {a.action}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Owner: {a.owner}
                  </div>
                </div>
                <span className={`badge ${a.urgency === 'immediate' ? 'badge-critical' : a.urgency === 'this_week' ? 'badge-high' : 'badge-medium'}`}>
                  {a.urgency}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
            Supporting Evidence ({evidence.length} sources)
          </div>
          {loadingEvidence ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Loading evidence...
            </div>
          ) : evidence.length > 0 ? (
            evidence.map((ev, i) => (
              <div key={i} className="glass-card" style={{ padding: '14px 16px', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className={`category-tag cat-${ev.sourceCategory || ''}`}>
                    {ev.sourceCategory?.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {ev.sourceName}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    +{ev.addedCount} / -{ev.deletedCount} lines
                  </span>
                </div>
                <pre style={{
                  fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 12,
                  maxHeight: 200, overflowY: 'auto', margin: 0,
                  fontFamily: "'Inter', sans-serif",
                }}>
                  {ev.evidenceText}
                </pre>
              </div>
            ))
          ) : (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No evidence data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch('/api/tickets').then(r => r.json()).then(d => setTickets(Array.isArray(d) ? d : []));
  }, []);

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.priority === filter);

  return (
    <>
      <Sidebar />
      <div className="main-content">
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Action Tickets</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Evidence-backed recommendations from the Coordinator Agent</p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {['all', 'critical', 'high', 'medium', 'low'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid',
              borderColor: filter === f ? 'var(--accent-blue)' : 'var(--border)',
              background: filter === f ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              color: filter === f ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize',
            }}>{f} {f !== 'all' ? `(${tickets.filter(t => t.priority === f).length})` : `(${tickets.length})`}</button>
          ))}
        </div>

        {/* Tickets List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(t => {
            const badgeClass = t.priority === 'critical' ? 'badge-critical' : t.priority === 'high' ? 'badge-high' : 'badge-medium';
            const riskClass = t.riskScore >= 9 ? 'risk-critical' : t.riskScore >= 7 ? 'risk-high' : 'risk-medium';

            return (
              <div key={t.id} className="glass-card" style={{ padding: '20px 24px', cursor: 'pointer' }} onClick={() => setSelected(t)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div className={`risk-meter ${riskClass} ${t.riskScore >= 9 ? 'pulse-critical' : ''}`}>
                    {t.riskScore}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span className={`badge ${badgeClass}`}>{t.priority}</span>
                      <span className={`category-tag cat-${t.sourceCategory || ''}`}>
                        {t.sourceCategory?.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {t.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {t.summary?.substring(0, 180)}...
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 80 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {t.recommendedActions?.length || 0} actions
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {t.ownerSuggestion || '—'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selected && <TicketDetail ticket={selected} onClose={() => setSelected(null)} />}
      </div>
    </>
  );
}
