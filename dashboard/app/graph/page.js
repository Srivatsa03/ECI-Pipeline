'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const legendItems = [
  { type: 'CVE', color: '#ff5c5c', icon: '🕷️' },
  { type: 'Component', color: '#5e9bff', icon: '⚙️' },
  { type: 'Change Event', color: '#34d399', icon: '📡' },
  { type: 'Policy Clause', color: '#f5b544', icon: '📜' },
  { type: 'API Level', color: '#a78bfa', icon: '🔢' },
  { type: 'Permission', color: '#f472b6', icon: '🔐' },
  { type: 'Kernel', color: '#22d3ee', icon: '🐧' },
];

const getTypeIcon = (type) => {
  if (type === 'cve') return '🕷️';
  if (type === 'component') return '⚙️';
  if (type === 'change_event') return '📡';
  if (type === 'policy_clause') return '📜';
  if (type === 'api_level') return '🔢';
  if (type === 'permission') return '🔐';
  if (type === 'kernel_version') return '🐧';
  return '⏺';
};

export default function GraphPage() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [dim, setDim] = useState({ width: 0, height: 0 });
  const graphRef = useRef();
  const containerRef = useRef(null);

  // Measure the graph container so the canvas fills it exactly.
  // (react-force-graph defaults to full-window size otherwise — which makes
  // the graph render off-centre and clipped behind the sidebar.)
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const measure = () => setDim({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedNode]);

  useEffect(() => {
    fetch('/api/graph').then(r => r.json()).then(d => {
      // Calculate node centrality to size hubs dynamically
      const degrees = {};
      d.links.forEach(l => {
        const src = typeof l.source === 'object' ? l.source.id : l.source;
        const tgt = typeof l.target === 'object' ? l.target.id : l.target;
        degrees[src] = (degrees[src] || 0) + 1;
        degrees[tgt] = (degrees[tgt] || 0) + 1;
      });

      d.nodes.forEach(n => {
        n.degree = degrees[n.id] || 0;
        // Base size 6. Hub nodes grow logarithmically up to 24px
        n.val = Math.min(24, Math.max(6, 6 + (Math.log(n.degree + 1) * 3)));
      });

      setGraphData(d);
    });

    if (typeof window !== 'undefined') {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      setTheme(current);

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          if (m.attributeName === 'data-theme') {
            setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
          }
        });
      });
      observer.observe(document.documentElement, { attributes: true });
      return () => observer.disconnect();
    }
  }, []);

  const handleNodeHover = useCallback(node => {
    document.body.style.cursor = node ? 'pointer' : 'default';
    setHoveredNode(node);
  }, []);

  const handleNodeClick = useCallback(node => {
    setSelectedNode(node);
    if (graphRef.current && node) {
      graphRef.current.centerAt(node.x, node.y, 800);
      graphRef.current.zoom(3, 800);
    }
  }, []);

  const getThemeColors = useCallback(() => {
    const isLight = theme === 'light';
    return {
      text: isLight ? '#0f172a' : 'rgba(255, 255, 255, 0.9)',
      link: isLight ? 'rgba(0, 0, 0, 0.14)' : 'rgba(255, 255, 255, 0.14)',
      linkHighlight: '#f5b544',
      cardHover: isLight ? '#ffffff' : '#1a1c22',
      bgNode: isLight ? '#ffffff' : '#14161c',
    };
  }, [theme]);

  const paintNode = useCallback((node, ctx, globalScale) => {
    const size = node.val || 6;
    const colors = getThemeColors();
    const isHighlighted = hoveredNode?.id === node.id || selectedNode?.id === node.id;

    // Glowing hub effect for important nodes
    ctx.shadowColor = node.color;
    ctx.shadowBlur = isHighlighted ? 25 : node.degree > 5 ? 12 : 0;

    // Inner circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = colors.bgNode;
    ctx.fill();

    // Colored rim
    ctx.lineWidth = isHighlighted ? 2.5 : 1.5;
    ctx.strokeStyle = node.color;
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Draw Emoji Icon
    const icon = getTypeIcon(node.type);
    const fontSize = size * 1.2;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, node.x, node.y + (size * 0.05));

    // Label Text
    if (globalScale > 1.2 || isHighlighted || node.degree > 8) {
      const labelFontSize = Math.max(10 / globalScale, 2.5);
      ctx.font = `${(isHighlighted || node.degree > 5) ? 'bold ' : ''}${labelFontSize}px "IBM Plex Mono", monospace`;
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(node.label || node.id, node.x, node.y + size + 4);
    }
  }, [hoveredNode, selectedNode, getThemeColors]);

  const paintLink = useCallback((link, ctx, globalScale) => {
    const colors = getThemeColors();
    const start = link.source;
    const end = link.target;

    if (!start || !end || typeof start.x !== 'number' || typeof end.x !== 'number') return;

    const isHighlighted = (hoveredNode && (start.id === hoveredNode.id || end.id === hoveredNode.id)) ||
                          (selectedNode && (start.id === selectedNode.id || end.id === selectedNode.id));

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = isHighlighted ? colors.linkHighlight : colors.link;
    ctx.lineWidth = isHighlighted ? Math.max(1.5, 2 / globalScale) : Math.max(0.5, 1 / globalScale);
    ctx.stroke();

    if (isHighlighted || globalScale > 2.5) {
      const midX = start.x + (end.x - start.x) / 2;
      const midY = start.y + (end.y - start.y) / 2;
      const angle = Math.atan2(end.y - start.y, end.x - start.x);

      ctx.save();
      ctx.translate(midX, midY);
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
        ctx.rotate(angle + Math.PI);
      } else {
        ctx.rotate(angle);
      }

      const fontSize = Math.max(6 / globalScale, 1.5);
      ctx.font = `${isHighlighted ? '700 ' : '500 '}${fontSize}px "IBM Plex Mono", monospace`;
      ctx.fillStyle = isHighlighted ? colors.linkHighlight : colors.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(link.relation || 'unknown', 0, -1);
      ctx.restore();
    }
  }, [hoveredNode, selectedNode, getThemeColors]);

  const getSelectedEdgesData = () => {
    if (!selectedNode) return { sources: [], infrastructure: [], vulnerabilities: [], other: [], summary: "", total: 0 };

    const edges = graphData.links.filter(l => {
      const srcId = typeof l.source === 'object' ? l.source.id : l.source;
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
      return srcId === selectedNode.id || tgtId === selectedNode.id;
    });

    const sources = [];
    const infrastructure = [];
    const vulnerabilities = [];
    const other = [];

    edges.forEach(edge => {
      const isSource = typeof edge.source === 'object' ? edge.source.id === selectedNode.id : edge.source === selectedNode.id;
      const counterpart = isSource ? edge.target : edge.source;
      const counterpartType = typeof counterpart === 'object' ? counterpart.type : 'unknown';

      const edgeData = { edge, counterpart, isSource };

      if (counterpartType === 'change_event') {
        sources.push(edgeData);
      } else if (['component', 'permission', 'api_level', 'kernel_version'].includes(counterpartType)) {
        infrastructure.push(edgeData);
      } else if (counterpartType === 'cve') {
        vulnerabilities.push(edgeData);
      } else {
        other.push(edgeData);
      }
    });

    let summary = "";
    if (selectedNode.type === 'cve') {
      summary = `This vulnerability was detected across ${sources.length} recent security update${sources.length === 1 ? '' : 's'}. `;
      if (infrastructure.length > 0) {
        summary += `It directly impacts ${infrastructure.length} system component${infrastructure.length === 1 ? '' : 's'} (${infrastructure.map(i => (typeof i.counterpart === 'object' ? i.counterpart.id : i.counterpart)).slice(0, 2).join(', ')}${infrastructure.length > 2 ? ', etc' : ''}). `;
      }
      if (vulnerabilities.length > 0) {
        summary += `It was patched alongside an ecosystem cluster of ${vulnerabilities.length} other vulnerabilities.`;
      }
    } else if (['component', 'permission', 'api_level', 'kernel_version'].includes(selectedNode.type)) {
      summary = `This infrastructure component was modified in ${sources.length} security update${sources.length === 1 ? '' : 's'}. `;
      if (vulnerabilities.length > 0) {
        summary += `It is currently impacted by ${vulnerabilities.length} active vulnerabilities reported across the ecosystem.`;
      }
    } else if (selectedNode.type === 'change_event') {
      summary = `This security update targets ${vulnerabilities.length} vulnerabilities across ${infrastructure.length} different system components.`;
    } else {
      summary = `This entity is connected to ${edges.length} other items in the knowledge graph.`;
    }

    return { sources, infrastructure, vulnerabilities, other, summary, total: edges.length };
  };

  const renderBucket = (title, items) => {
    if (items.length === 0) return null;
    return (
      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          {title} ({items.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((data, i) => {
            const { counterpart } = data;
            const counterpartId = typeof counterpart === 'object' ? counterpart.id : counterpart;
            const counterpartType = typeof counterpart === 'object' ? counterpart.type : 'Unknown';
            const icon = getTypeIcon(counterpartType);

            return (
              <div key={i} style={{
                padding: '12px 14px', background: getThemeColors().cardHover, border: `1px solid var(--border)`,
                borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                transition: 'all 0.2s',
              }} onClick={() => handleNodeClick(typeof counterpart === 'object' ? counterpart : graphData.nodes.find(n => n.id === counterpartId))}>

                <div style={{ fontSize: 20, flexShrink: 0, width: 28, textAlign: 'center' }}>
                  {icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, wordBreak: 'break-all', marginBottom: 2 }}>{counterpartId}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{counterpartType.replace('_', ' ')}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const edgeData = getSelectedEdgesData();

  return (
    <>
      <Sidebar />
      <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Cross-Source Entity Correlation</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Knowledge Graph</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            <span className="mono">{graphData.nodes.length}</span> entities ·{' '}
            <span className="mono">{graphData.links.length}</span> relations — CVEs, components, changes &amp; policy, linked
          </p>
        </div>

        <div className="glass-card" style={{ padding: '12px 20px', marginBottom: 16, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div className="graph-legend" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {legendItems.map(l => (
              <div key={l.type} className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="legend-dot" style={{ background: l.color }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{l.type}</span>
              </div>
            ))}
          </div>
          <button className="btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }}
            onClick={() => graphRef.current?.zoomToFit(500, 60)}>
            ⛶ Zoom to fit
          </button>
        </div>

        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

          <div ref={containerRef} className="glass-card reticle" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {graphData.nodes.length > 0 && dim.width > 0 ? (
              <ForceGraph2D
                ref={graphRef}
                width={dim.width}
                height={dim.height}
                graphData={graphData}
                nodeVal="val"
                nodeRelSize={1}
                nodeCanvasObject={paintNode}
                linkCanvasObject={paintLink}
                backgroundColor="rgba(0,0,0,0)"
                onNodeHover={handleNodeHover}
                onNodeClick={handleNodeClick}
                cooldownTicks={120}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
                onEngineStop={() => graphRef.current?.zoomToFit(500, 60)}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <span className="eyebrow">Rendering graph…</span>
              </div>
            )}
          </div>

          {selectedNode && (
            <div className="glass-card" style={{
              width: 380,
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              animation: 'fade-in 0.2s ease-out',
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="eyebrow">Threat Intelligence Summary</h3>
                <button onClick={() => setSelectedNode(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 22, padding: '0 4px', lineHeight: 1 }}>&times;</button>
              </div>

              <div style={{ padding: '24px 20px', overflowY: 'auto', flex: 1 }}>

                {/* Node Header */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 40, background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: '8px 12px', flexShrink: 0, boxShadow: `0 0 16px ${selectedNode.color}40`, border: `1px solid ${selectedNode.color}80` }}>
                    {getTypeIcon(selectedNode.type)}
                  </div>
                  <div>
                    <div className="eyebrow" style={{ color: selectedNode.color, marginBottom: 4 }}>{selectedNode.type.replace('_', ' ')}</div>
                    <div className="mono" style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-all', lineHeight: 1.2 }}>{selectedNode.label || selectedNode.id}</div>
                  </div>
                </div>

                {/* Blast Radius Summary */}
                <div style={{ padding: '16px', background: 'rgba(245, 181, 68, 0.06)', border: '1px solid rgba(245, 181, 68, 0.22)', borderRadius: 12, marginBottom: 28 }}>
                  <div className="eyebrow" style={{ color: 'var(--accent-amber)', marginBottom: 8 }}>
                    Blast Radius
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    {edgeData.summary}
                  </div>
                </div>

                {/* Categorized Edges */}
                {edgeData.total === 0 ? (
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No direct connections found.</div>
                ) : (
                  <>
                    {renderBucket('📡 Intelligence Sources', edgeData.sources)}
                    {renderBucket('🎯 Impacted Infrastructure', edgeData.infrastructure)}
                    {renderBucket('🦠 Related Vulnerabilities', edgeData.vulnerabilities)}
                    {renderBucket('🔗 Other Connections', edgeData.other)}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
