'use client';
import { useState, useEffect, useRef } from 'react';

export default function PipelineRunner() {
  const [job, setJob] = useState(null);
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);
  const intervalRef = useRef(null);
  const userScrolledRef = useRef(false);
  const logBoxRef = useRef(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');

  const triggerPipeline = async () => {
    setTriggering(true);
    setTriggerMsg('');
    try {
      const res = await fetch('/api/pipeline', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTriggerMsg('Pipeline triggered! Logs will appear in ~10 seconds.');
        // Start polling immediately
        intervalRef.current = setInterval(fetchStatus, 3000);
      } else {
        setTriggerMsg(`Error: ${data.error}`);
      }
    } catch (e) {
      setTriggerMsg(`Error: ${e.message}`);
    }
    setTriggering(false);
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/pipeline', { cache: 'no-store' });
      const data = await res.json();
      if (data.job) {
        setJob(data.job);
        if (data.logs?.length) setLogs(data.logs);
        if (data.job.status === 'completed' || data.job.status === 'failed') {
          clearInterval(intervalRef.current);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 3000);
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (!userScrolledRef.current && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [logs]);

  const handleScroll = () => {
    if (!logBoxRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logBoxRef.current;
    userScrolledRef.current = scrollHeight - scrollTop - clientHeight > 40;
  };

  const isActive = job?.status === 'running' || job?.status === 'pending';
  const statusColor = isActive ? '#38bdf8' : job?.status === 'completed' ? '#10b981' : job?.status === 'failed' ? '#ef4444' : '#64748b';

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          onClick={triggerPipeline}
          disabled={triggering || isActive}
          style={{
            padding: '12px 24px',
            background: (triggering || isActive) ? 'rgba(56,189,248,0.1)' : 'var(--accent-blue)',
            color: (triggering || isActive) ? 'var(--accent-blue)' : '#fff',
            fontWeight: 700,
            borderRadius: 8,
            border: (triggering || isActive) ? '1px solid rgba(56,189,248,0.3)' : 'none',
            cursor: (triggering || isActive) ? 'not-allowed' : 'pointer',
            boxShadow: (triggering || isActive) ? 'none' : '0 4px 12px rgba(56,189,248,0.2)',
          }}
        >
          {triggering ? 'Triggering...' : isActive ? 'Pipeline Running...' : '▶ Trigger Pipeline Run'}
        </button>
        {triggerMsg && (
          <span style={{ fontSize: 13, color: triggerMsg.startsWith('Error') ? '#ef4444' : '#10b981' }}>
            {triggerMsg}
          </span>
        )}
        {job && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: statusColor }}>
            <div style={{ width: 8, height: 8, background: statusColor, borderRadius: '50%',
              animation: isActive ? 'pulse 1.5s infinite' : 'none' }} />
            Job #{job.id}: <strong>{job.status}</strong>
            {job.finished_at && (
              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                · finished {new Date(job.finished_at).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Auto-runs every 3 days · logs stream here when active
        </span>
      </div>

      {job && (
        <div
          ref={logBoxRef}
          onScroll={handleScroll}
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: 8,
            padding: 16,
            height: 360,
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#cbd5e1',
            boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ color: '#475569', marginBottom: 8 }}>
            ── ECI Pipeline Job #{job.id} · {job.status} ──
          </div>
          {logs.length === 0 && isActive && (
            <div style={{ color: '#475569' }}>Waiting for logs...</div>
          )}
          {logs.length === 0 && !isActive && (
            <div style={{ color: '#475569' }}>No logs yet. Trigger a run to see output here.</div>
          )}
          {logs.map((line, i) => {
            const isErr = /error|traceback|failed/i.test(line);
            const isWarn = /warn/i.test(line);
            const isStage = /=== stage/i.test(line);
            const isSuccess = /✓|success|completed/i.test(line);
            return (
              <div key={i} style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                lineHeight: 1.6,
                marginTop: isStage ? 8 : 0,
                color: isErr ? '#ef4444' : isWarn ? '#f59e0b' : isStage ? '#c084fc' : isSuccess ? '#10b981' : '#cbd5e1',
                fontWeight: isStage ? 700 : 400,
              }}>
                {line}
              </div>
            );
          })}
          {isActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: '#475569' }}>
              <div style={{ width: 6, height: 6, background: '#38bdf8', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
              streaming...
            </div>
          )}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
}
