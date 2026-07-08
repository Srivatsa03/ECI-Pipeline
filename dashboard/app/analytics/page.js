'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Cell,
} from 'recharts';

const AXIS = 'rgba(164,167,180,0.7)';
const GRID = 'rgba(255,255,255,0.06)';
const TOOLTIP = {
  contentStyle: { background: '#14161c', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 },
  labelStyle: { color: '#f4f5f7' },
  itemStyle: { color: '#a4a7b4' },
};

function Metric({ label, value, accent }) {
  return (
    <div className="glass-card reticle" style={{ padding: '18px 20px' }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>{label}</div>
      <div className="metric" style={{ fontSize: 30, fontWeight: 700, color: accent || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/benchmarks').then(r => r.json()).then(setData).catch(() => setData({ variants: [], byType: [] }));
  }, []);

  if (!data) {
    return (
      <>
        <Sidebar />
        <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div className="eyebrow">Loading benchmark suite…</div>
        </div>
      </>
    );
  }

  const variants = data.variants || [];
  const byType = data.byType || [];
  const full = variants.find(v => v.key === 'full_system') || variants[variants.length - 1] || {};
  const pct = (x) => x == null ? '—' : `${(x * 100).toFixed(1)}%`;

  const variantChart = variants.map(v => ({
    name: v.label,
    'P@1': +(v.p_at_1 * 100).toFixed(1),
    'nDCG@5': +(v.ndcg_at_5 * 100).toFixed(1),
    'MRR': +(v.mrr * 100).toFixed(1),
  }));

  const radarData = byType.map(t => ({ type: t.type, score: +(t.ndcg_at_5 * 100).toFixed(1) }));
  const typeColors = ['#f5b544', '#34d399', '#5e9bff', '#a78bfa', '#ff5c5c'];

  return (
    <>
      <Sidebar />
      <div className="main-content">
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Retrieval Evaluation · DeltaRAG + Graph-RAG</div>
          <h1 style={{ fontSize: 30, fontWeight: 800 }}>Benchmarks</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
            Ablation study over {data.metadata?.total_benchmark_queries || 110} gold queries · top-k {data.metadata?.top_k || 5} · {variants.length} system variants
          </p>
        </div>

        {/* Headline metrics for the full system */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
          <Metric label="Precision @1" value={pct(full.p_at_1)} accent="var(--accent-amber)" />
          <Metric label="nDCG @5" value={pct(full.ndcg_at_5)} accent="var(--accent-teal)" />
          <Metric label="Mean Recip. Rank" value={pct(full.mrr)} accent="var(--accent-blue)" />
          <Metric label="MAP" value={pct(full.map)} accent="var(--accent-purple)" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          <Metric label="Recall @5" value={pct(full.recall_at_5)} />
          <Metric label="Freshness" value={pct(full.freshness)} accent="var(--accent-teal)" />
          <Metric label="Stale Rate" value={pct(full.stale_rate)} />
        </div>

        {/* Variant comparison */}
        <div className="glass-card" style={{ padding: '22px 24px 12px', marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Retrieval quality by system variant</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
            Higher is better · scores as % · isolating DeltaRAG vs Graph-RAG contributions
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={variantChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="name" stroke={AXIS} tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }} />
              <YAxis stroke={AXIS} domain={[60, 100]} tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }} />
              <Tooltip {...TOOLTIP} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' }} />
              <Bar dataKey="P@1" fill="#f5b544" radius={[3, 3, 0, 0]} />
              <Bar dataKey="nDCG@5" fill="#34d399" radius={[3, 3, 0, 0]} />
              <Bar dataKey="MRR" fill="#5e9bff" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* By query type — radar */}
          <div className="glass-card" style={{ padding: '22px 24px' }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Full system · nDCG@5 by query type</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Where multi-hop Graph-RAG pays off</div>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData} outerRadius={100}>
                <PolarGrid stroke={GRID} />
                <PolarAngleAxis dataKey="type" tick={{ fontSize: 10.5, fill: AXIS, fontFamily: 'IBM Plex Mono, monospace' }} />
                <PolarRadiusAxis domain={[70, 100]} tick={{ fontSize: 9, fill: 'rgba(164,167,180,0.5)' }} stroke={GRID} />
                <Radar dataKey="score" stroke="#f5b544" fill="#f5b544" fillOpacity={0.35} />
                <Tooltip {...TOOLTIP} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* By query type — bar with counts */}
          <div className="glass-card" style={{ padding: '22px 24px' }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Precision@1 by query type</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Bar height = P@1 · label = query count</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byType.map(t => ({ type: t.type, p1: +(t.p_at_1 * 100).toFixed(1), count: t.count }))} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="type" stroke={AXIS} tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' }} interval={0} angle={-12} textAnchor="end" height={54} />
                <YAxis stroke={AXIS} domain={[0, 100]} tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }} />
                <Tooltip {...TOOLTIP} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="p1" radius={[3, 3, 0, 0]}>
                  {byType.map((_, i) => <Cell key={i} fill={typeColors[i % typeColors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Variant table */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginTop: 24 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
            <div className="eyebrow" style={{ fontSize: 10 }}>Full ablation matrix</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Variant</th><th>P@1</th><th>nDCG@5</th><th>MRR</th><th>MAP</th><th>Recall@5</th><th>Queries</th>
                </tr>
              </thead>
              <tbody>
                {variants.map(v => (
                  <tr key={v.key}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{v.label}</td>
                    <td className="mono">{pct(v.p_at_1)}</td>
                    <td className="mono">{pct(v.ndcg_at_5)}</td>
                    <td className="mono">{pct(v.mrr)}</td>
                    <td className="mono">{pct(v.map)}</td>
                    <td className="mono">{pct(v.recall_at_5)}</td>
                    <td className="mono" style={{ color: 'var(--text-muted)' }}>{v.num_queries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
