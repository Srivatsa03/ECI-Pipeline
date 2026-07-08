'use client';
import { useState, useEffect, useRef } from 'react';

// Fully client-side, offline simulation of the ECI multi-agent run.
// Streams realistic Scout → Sentinel → Coordinator → Graph → Benchmark logs
// so the pipeline can be demonstrated live with no backend, token, or network.

const STAGES = ['Scout', 'Sentinel', 'Coordinator', 'Graph', 'Benchmark'];

// [stageIndex, delayMs, kind, text]
const SCRIPT = [
  [0, 250, 'stage', '▸ SCOUT · polling 14 monitored sources'],
  [0, 240, 'ok', '  200  Android Security Bulletin        snapshot #49'],
  [0, 190, 'ok', '  200  CISA Known Exploited Vulns        snapshot #64'],
  [0, 190, 'ok', '  200  NVD CVE Feed (Android)            snapshot #72'],
  [0, 190, 'ok', '  200  Google Play Developer Policy       snapshot #23'],
  [0, 240, 'warn', '  304  OWASP MASVS                       not-modified (skip)'],
  [0, 320, 'info', '  Δ  diff engine: 16 changed documents [change_101 … change_116]'],

  [1, 320, 'stage', '▸ SENTINEL · triaging 16 events (DeltaRAG retrieval)'],
  [1, 230, 'crit', '  change_101  CVE-2026-33634  rel 9  risk 9   → ESCALATE'],
  [1, 210, 'crit', '  change_113  CVE-2025-54068  rel 8  risk 9   → ESCALATE'],
  [1, 200, 'crit', '  change_102  Jul-2026 bulletin rel 9  risk 8   → ESCALATE'],
  [1, 200, 'info', '  change_115  CVE-2026-33099  rel 7  risk 7   → TRIAGE'],
  [1, 220, 'warn', '  change_111  CVE-2021-30952  out-of-scope    → REJECT (false-alarm gate)'],
  [1, 300, 'ok', '  triage complete: 4 escalated · 7 triaged · 3 pending · 2 closed'],

  [2, 330, 'stage', '▸ COORDINATOR · synthesizing tickets (Graph-RAG multi-hop)'],
  [2, 240, 'info', '  ticket #1  Contain Android System RCE          → Mobile Platform Security'],
  [2, 210, 'info', '  ticket #2  Purge vulnerable ad-SDK             → Application Security'],
  [2, 210, 'info', '  ticket #4  Play Integrity finance compliance   → Compliance & Risk'],
  [2, 300, 'ok', '  10 evidence-backed action tickets generated'],

  [3, 320, 'stage', '▸ GRAPH · rebuilding entity knowledge graph'],
  [3, 260, 'info', '  nodes 79 · edges 245 · relations: references, affects, mitigates'],
  [3, 260, 'ok', '  central hub: CVE-2026-33634 (degree 6)'],

  [4, 330, 'stage', '▸ BENCHMARK · retrieval eval over 110 gold queries'],
  [4, 260, 'info', '  Full System   P@1 0.916   nDCG@5 0.945   MRR 0.947'],
  [4, 260, 'ok', '  Recall@5 0.911  ·  MAP 0.919  ·  freshness 1.00'],
  [4, 360, 'done', '  ✓ pipeline run complete in 12.4s — 10 tickets ready for review'],
];

const KIND_COLOR = {
  stage: '#f5b544',
  ok: '#34d399',
  info: '#c9cdd6',
  warn: '#ffd27a',
  crit: '#ff8f8f',
  done: '#34d399',
};

export default function LivePipeline() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [lines, setLines] = useState([]);
  const [stage, setStage] = useState(-1);
  const consoleRef = useRef(null);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [lines]);

  const run = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLines([]);
    setStage(0);
    setRunning(true);
    setDone(false);

    let acc = 0;
    SCRIPT.forEach((entry, i) => {
      const [stageIdx, delay, kind, text] = entry;
      acc += delay;
      const id = setTimeout(() => {
        setStage(stageIdx);
        setLines((prev) => [...prev, { kind, text }]);
        if (i === SCRIPT.length - 1) {
          setRunning(false);
          setDone(true);
          setStage(STAGES.length);
        }
      }, acc);
      timers.current.push(id);
    });
  };

  const progress = stage < 0 ? 0 : Math.min(100, Math.round(((stage) / STAGES.length) * 100));

  return (
    <div className="panel reticle" style={{ padding: 22, marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Multi-Agent Pipeline · Local Run</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Scout → Sentinel → Coordinator → Graph → Benchmark
          </div>
        </div>
        <button className="btn-signal" onClick={run} disabled={running}>
          {running ? '● Running…' : done ? '↻ Run Again' : '▶ Run Pipeline'}
        </button>
      </div>

      {/* Stage stepper */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {STAGES.map((s, i) => {
          const state = stage > i || done ? 'done' : stage === i ? 'active' : 'idle';
          const color = state === 'done' ? 'var(--accent-teal)' : state === 'active' ? 'var(--accent-amber)' : 'var(--text-muted)';
          return (
            <div key={s} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '5px 12px', borderRadius: 8,
              border: `1px solid ${state === 'idle' ? 'var(--border)' : color}`,
              background: state === 'idle' ? 'transparent' : `color-mix(in srgb, ${color} 12%, transparent)`,
              fontFamily: 'var(--font-mono)', fontSize: 11, color,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: color,
                animation: state === 'active' ? 'pulse 1.2s infinite' : 'none',
              }} />
              {s}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', marginBottom: 14 }}>
        <div style={{
          height: '100%', width: `${done ? 100 : progress}%`,
          background: 'var(--gradient-1)', transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Console */}
      <div ref={consoleRef} className="console" style={{ height: 260, overflowY: 'auto', padding: 16 }}>
        <div style={{ color: '#5a5f6b', marginBottom: 6 }}>
          $ eci run --local --stream
        </div>
        {lines.length === 0 && !running && (
          <div style={{ color: '#5a5f6b' }}>
            Ready. Press “Run Pipeline” to execute the full agent chain locally.
          </div>
        )}
        {lines.map((l, i) => (
          <div key={i} style={{ color: KIND_COLOR[l.kind] || '#c9cdd6', whiteSpace: 'pre-wrap', fontWeight: l.kind === 'stage' ? 700 : 400, marginTop: l.kind === 'stage' ? 8 : 0 }}>
            {l.text}
          </div>
        ))}
        {running && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: '#5a5f6b' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f5b544', animation: 'pulse 1s infinite' }} />
            streaming…
          </div>
        )}
      </div>
    </div>
  );
}
