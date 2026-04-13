'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const legendItems = [
  { type: 'CVE', color: '#ef4444' },
  { type: 'Component', color: '#3b82f6' },
  { type: 'Change Event', color: '#10b981' },
  { type: 'Policy Clause', color: '#f59e0b' },
  { type: 'API Level', color: '#8b5cf6' },
  { type: 'Permission', color: '#ec4899' },
];

export default function GraphPage() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [hoveredNode, setHoveredNode] = useState(null);
  const graphRef = useRef();

  useEffect(() => {
    fetch('/api/graph').then(r => r.json()).then(d => {
      setGraphData(d);
    });
  }, []);

  const handleNodeHover = useCallback(node => {
    setHoveredNode(node);
  }, []);

  const paintNode = useCallback((node, ctx, globalScale) => {
    const size = node.size || 6;
    const fontSize = Math.max(10 / globalScale, 2);

    // Glow effect
    ctx.shadowColor = node.color;
    ctx.shadowBlur = hoveredNode?.id === node.id ? 20 : 8;

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();

    ctx.shadowBlur = 0;

    // Label
    if (globalScale > 1.5 || hoveredNode?.id === node.id) {
      ctx.font = `${hoveredNode?.id === node.id ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(node.label || node.id, node.x, node.y + size + 3);
    }
  }, [hoveredNode]);

  return (
    <>
      <Sidebar />
      <div className="main-content">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Knowledge Graph</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Cross-source entity relationships — {graphData.nodes.length} nodes, {graphData.links.length} edges
          </p>
        </div>

        {/* Legend */}
        <div className="glass-card" style={{ padding: '16px 24px', marginBottom: 16 }}>
          <div className="graph-legend">
            {legendItems.map(l => (
              <div key={l.type} className="legend-item">
                <div className="legend-dot" style={{ background: l.color }} />
                {l.type}
              </div>
            ))}
          </div>
        </div>

        {/* Graph */}
        <div className="glass-card" style={{ overflow: 'hidden', height: 'calc(100vh - 260px)', position: 'relative' }}>
          {graphData.nodes.length > 0 ? (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              nodeCanvasObject={paintNode}
              nodePointerAreaPaint={(node, color, ctx) => {
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.size || 6, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
              }}
              linkColor={() => 'rgba(255,255,255,0.06)'}
              linkWidth={1}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={0.9}
              backgroundColor="transparent"
              onNodeHover={handleNodeHover}
              cooldownTicks={100}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              No graph data. Run: uv run main.py --stage graph
            </div>
          )}

          {hoveredNode && (
            <div style={{
              position: 'absolute', bottom: 20, left: 20,
              background: 'rgba(18,18,26,0.95)', backdropFilter: 'blur(10px)',
              border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{hoveredNode.id}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Type: {hoveredNode.type}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
