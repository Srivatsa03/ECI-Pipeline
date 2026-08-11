// graph-style.js — turn a raw knowledge graph into a renderable one.
//
// Shared by both data sources so the graph looks identical whether the nodes
// came from the offline dataset or the API. Colour and size are presentation,
// so they stay here rather than in the backend payload.

const COLOR = {
  source: '#94a3b8',
  cve: '#ff5c5c',
  component: '#5e9bff',
  change_event: '#34d399',
  policy_clause: '#f5b544',
  api_level: '#a78bfa',
  permission: '#f472b6',
  kernel_version: '#22d3ee',
  sdk_version: '#a3e635',
  unknown: '#8b8b9a',
};

const SIZE = {
  source: 11,
  change_event: 8,
  cve: 12,
  component: 10,
  policy_clause: 9,
  api_level: 7,
  permission: 7,
  kernel_version: 7,
  sdk_version: 7,
  unknown: 5,
};

/**
 * @param {{nodes?: Array, edges?: Array, links?: Array}} raw
 * @returns {{nodes: Array, links: Array}}
 */
export function styleGraph(raw) {
  if (!raw) return { nodes: [], links: [] };

  const nodes = (raw.nodes || []).map((n) => ({
    id: n.id,
    type: n.node_type || 'unknown',
    color: COLOR[n.node_type] || COLOR.unknown,
    size: SIZE[n.node_type] || SIZE.unknown,
    label: n.id,
  }));

  const links = (raw.edges || raw.links || []).map((l) => ({
    source: l.source,
    target: l.target,
    relation: l.relation || 'unknown',
  }));

  return { nodes, links };
}
