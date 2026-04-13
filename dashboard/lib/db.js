import pg from 'pg';
import path from 'path';
import fs from 'fs';

const { Pool } = pg;

// Supabase PostgreSQL connection — configure via environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

export async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getStats() {
  const [sources] = await query('SELECT COUNT(*) as count FROM sources');
  const [changes] = await query('SELECT COUNT(*) as count FROM changes');
  const [pending] = await query("SELECT COUNT(*) as count FROM changes WHERE status = 'pending'");
  const [escalated] = await query("SELECT COUNT(*) as count FROM changes WHERE status = 'escalated'");
  const [triaged] = await query("SELECT COUNT(*) as count FROM changes WHERE status = 'triaged'");
  const [closed] = await query("SELECT COUNT(*) as count FROM changes WHERE status = 'closed'");
  const [events] = await query('SELECT COUNT(*) as count FROM agent_events');
  const [recommendations] = await query('SELECT COUNT(*) as count FROM recommendations');

  return {
    sources: parseInt(sources.count),
    totalChanges: parseInt(changes.count),
    pending: parseInt(pending.count),
    escalated: parseInt(escalated.count),
    triaged: parseInt(triaged.count),
    closed: parseInt(closed.count),
    agentEvents: parseInt(events.count),
    actionTickets: parseInt(recommendations.count),
  };
}

export async function getTickets() {
  const rows = await query(`
    SELECT r.*, s.name as source_name, s.category as source_category
    FROM recommendations r
    LEFT JOIN changes c ON r.change_id = c.id
    LEFT JOIN sources s ON c.source_id = s.id
    ORDER BY r.risk_score DESC
  `);

  return rows.map(r => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    priority: r.priority,
    riskScore: r.risk_score,
    sourceName: r.source_name,
    sourceCategory: r.source_category,
    changeId: r.change_id,
    recommendedActions: typeof r.recommended_actions === 'string'
      ? JSON.parse(r.recommended_actions) : (r.recommended_actions || []),
    ownerSuggestion: r.owner_suggestion,
    evidenceCitations: typeof r.evidence_citations === 'string'
      ? JSON.parse(r.evidence_citations) : (r.evidence_citations || []),
    createdAt: r.created_at,
  }));
}

export async function getSources() {
  return await query(`
    SELECT s.*,
      (SELECT COUNT(*) FROM changes c WHERE c.source_id = s.id) as change_count,
      (SELECT COUNT(*) FROM snapshots sn WHERE sn.source_id = s.id) as snapshot_count
    FROM sources s
    ORDER BY s.priority, s.name
  `);
}

export async function getChanges() {
  const rows = await query(`
    SELECT c.*, s.name as source_name, s.category as source_category,
      ae.title as triage_title, ae.summary as triage_summary,
      ae.relevance_score, ae.local_risk_score, ae.risk_domain, ae.confidence
    FROM changes c
    LEFT JOIN sources s ON c.source_id = s.id
    LEFT JOIN agent_events ae ON ae.change_id = c.id AND ae.agent_name = 'sentinel'
    ORDER BY c.id DESC
  `);

  return rows.map(r => ({
    ...r,
    diff_json: typeof r.diff_json === 'string' ? JSON.parse(r.diff_json) : r.diff_json,
    tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || []),
  }));
}

export async function getEvidence(chunkIds) {
  const changeIdSet = new Set();
  for (const cid of chunkIds) {
    const match = cid.match(/^change_(\d+)_chunk_\d+_(added|deleted)$/);
    if (match) changeIdSet.add(parseInt(match[1]));
  }

  if (changeIdSet.size === 0) return [];

  const results = [];
  for (const changeId of changeIdSet) {
    const rows = await query(`
      SELECT c.id, c.diff_text, c.diff_json, s.name as source_name, s.category
      FROM changes c
      LEFT JOIN sources s ON c.source_id = s.id
      WHERE c.id = $1
    `, [changeId]);

    if (rows.length > 0) {
      const row = rows[0];
      const diffJson = typeof row.diff_json === 'string' ? JSON.parse(row.diff_json) : row.diff_json;
      const addedLines = diffJson?.added_lines || [];
      const deletedLines = diffJson?.deleted_lines || [];

      let evidenceText = '';
      if (addedLines.length > 0) {
        evidenceText += addedLines.slice(0, 8).join('\n');
        if (addedLines.length > 8) evidenceText += `\n... (+${addedLines.length - 8} more lines)`;
      }

      results.push({
        changeId: row.id,
        sourceName: row.source_name,
        sourceCategory: row.category,
        evidenceText: evidenceText || row.diff_text?.substring(0, 500) || 'No content available',
        addedCount: addedLines.length,
        deletedCount: deletedLines.length,
      });
    }
  }

  return results;
}

export async function getGraphData() {
  const colorMap = {
    cve: '#ef4444', component: '#3b82f6', change_event: '#10b981',
    policy_clause: '#f59e0b', api_level: '#8b5cf6', permission: '#ec4899',
    kernel_version: '#06b6d4', sdk_version: '#84cc16', unknown: '#6b7280',
  };
  const sizeMap = {
    change_event: 8, cve: 12, component: 10, policy_clause: 9,
    api_level: 7, permission: 7, kernel_version: 7, sdk_version: 7, unknown: 5,
  };

  let raw = null;

  // Try Supabase first
  try {
    const rows = await query('SELECT graph_json FROM knowledge_graph_data WHERE id = 1');
    if (rows.length > 0 && rows[0].graph_json) {
      raw = typeof rows[0].graph_json === 'string'
        ? JSON.parse(rows[0].graph_json)
        : rows[0].graph_json;
    }
  } catch (e) {
    console.error('[getGraphData] Supabase query failed:', e.message);
    // Fall back to local file
  }

  // Fallback to local file
  if (!raw) {
    const graphPath = path.join(process.cwd(), '..', 'data', 'knowledge_graph.json');
    if (fs.existsSync(graphPath)) {
      raw = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
    }
  }

  if (!raw) return { nodes: [], links: [] };

  const nodes = (raw.nodes || []).map(n => ({
    id: n.id, type: n.node_type || 'unknown',
    color: colorMap[n.node_type] || colorMap.unknown,
    size: sizeMap[n.node_type] || 5, label: n.id,
  }));

  const links = (raw.edges || raw.links || []).map(l => ({
    source: l.source, target: l.target, relation: l.relation || 'unknown',
  }));

  return { nodes, links };
}
