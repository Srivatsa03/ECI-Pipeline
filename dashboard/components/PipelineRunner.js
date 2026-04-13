'use client';
import { useState, useEffect, useRef } from 'react';

export default function PipelineRunner() {
  const [job, setJob] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const logsEndRef = useRef(null);

  useEffect(() => {
    let interval;
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/pipeline', { cache: 'no-store' });
        const data = await res.json();
        if (data.job) {
          setJob(data.job);
          if (data.logs && Array.isArray(data.logs)) {
            setLogs(data.logs);
          }
          
          if (data.job.status === 'completed' || data.job.status === 'failed') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    checkStatus();
    interval = setInterval(checkStatus, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const runPipeline = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pipeline', { method: 'POST' });
      const data = await res.json();
      if (data.job) {
        setJob(data.job);
        setLogs([]);
        // Force an immediate reload of the page after 5 seconds to show new tickets
        setTimeout(() => window.location.reload(), 30000); // 30s is roughly a pipeline run length, optional fallback
      }
    } catch (err) {
      alert("Failed to start pipeline");
    }
    setLoading(false);
  };

  const isActive = job?.status === 'pending' || job?.status === 'running';

  return (
    <div style={{ marginBottom: 32 }}>
      <button 
        onClick={runPipeline} 
        disabled={isActive || loading}
        className="glass-card"
        style={{
          padding: '12px 24px', 
          background: isActive ? 'rgba(56, 189, 248, 0.1)' : 'var(--accent-blue)', 
          color: isActive ? 'var(--accent-blue)' : '#fff',
          fontWeight: 700,
          border: isActive ? '1px solid rgba(56, 189, 248, 0.3)' : 'none',
          cursor: isActive ? 'not-allowed' : 'pointer',
          borderRadius: 8,
          transition: 'all 0.2s ease',
          boxShadow: isActive ? 'none' : '0 4px 12px rgba(56, 189, 248, 0.2)'
        }}
      >
        {isActive ? `Pipeline ${job.status}...` : "▶ Trigger Pipeline Run"}
      </button>

      {(job && (isActive || job.status === 'completed' || job.status === 'failed')) && (
        <div style={{
          marginTop: 16,
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 8,
          padding: 16,
          height: 350,
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: 13,
          color: '#38bdf8',
          boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <div style={{ color: '#94a3b8', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>--- ECI Pipeline Job #{job.id} ({job.status}) ---</span>
            {job.status === 'completed' && (
              <button 
                onClick={() => window.location.reload()} 
                style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', textDecoration: 'underline' }}>
                Refresh Dashboard
              </button>
            )}
          </div>
          {logs.map((log, i) => {
            const isErr = log.includes('ERROR') || log.includes('Traceback') || log.includes('failed');
            const isWarn = log.includes('WARN');
            const isStage = log.includes('=== STAGE');
            const isSys = log.startsWith('[');
            return (
              <div key={i} style={{ 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-all',
                color: isErr ? '#ef4444' : isWarn ? '#f59e0b' : isStage ? '#c084fc' : isSys ? '#38bdf8' : '#cbd5e1',
                fontWeight: isStage ? 'bold' : 'normal',
                marginTop: isStage ? 8 : 0
              }}>
                {log}
              </div>
            );
          })}
          {isActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, color: '#94a3b8' }}>
              <div style={{ width: 8, height: 8, background: '#38bdf8', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}></div>
              Streaming from Backend...
            </div>
          )}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
}
