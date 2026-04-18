'use client';
import { useState, useEffect } from 'react';

export default function PipelineRunner() {
  const [job, setJob] = useState(null);

  useEffect(() => {
    fetch('/api/pipeline', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => { if (data.job) setJob(data.job); })
      .catch(() => {});
  }, []);

  const isActive = job?.status === 'pending' || job?.status === 'running';
  const statusColor = isActive ? '#38bdf8' : job?.status === 'completed' ? '#10b981' : job?.status === 'failed' ? '#ef4444' : '#64748b';

  return (
    <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <a
        href="https://github.com/Srivatsa03/ECI-Pipeline/actions"
        target="_blank"
        rel="noopener noreferrer"
        className="glass-card"
        style={{
          padding: '12px 24px',
          background: 'var(--accent-blue)',
          color: '#fff',
          fontWeight: 700,
          border: 'none',
          cursor: 'pointer',
          borderRadius: 8,
          textDecoration: 'none',
          display: 'inline-block',
          boxShadow: '0 4px 12px rgba(56, 189, 248, 0.2)',
        }}
      >
        ▶ View Pipeline Runs on GitHub
      </a>

      {job && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: statusColor }}>
          <div style={{ width: 8, height: 8, background: statusColor, borderRadius: '50%' }} />
          Last job #{job.id}: <strong>{job.status}</strong>
        </div>
      )}

      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Pipeline runs automatically every 3 days via GitHub Actions
      </span>
    </div>
  );
}
