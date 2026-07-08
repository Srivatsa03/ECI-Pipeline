// lib/db.js — Offline data access layer for the SENTINEL console.
//
// Previously this connected to Supabase/Postgres. It now serves every panel
// from an in-process dataset (lib/data.js) so the dashboard runs live with no
// database, no credentials, and no network — ideal for a laptop demo and for
// developing this fork independently.

import {
  SOURCES,
  CHANGES,
  RECOMMENDATIONS,
  AGENT_EVENT_COUNT,
  GRAPH_RAW,
} from './data';

// Kept as a harmless no-op so any legacy `query()` import keeps compiling.
export async function query() {
  return [];
}

export async function getStats() {
  const byStatus = (s) => CHANGES.filter((c) => c.status === s).length;
  return {
    sources: SOURCES.length,
    totalChanges: CHANGES.length,
    pending: byStatus('pending'),
    escalated: byStatus('escalated'),
    triaged: byStatus('triaged'),
    closed: byStatus('closed'),
    agentEvents: AGENT_EVENT_COUNT,
    actionTickets: RECOMMENDATIONS.length,
  };
}

export async function getTickets() {
  return [...RECOMMENDATIONS]
    .sort((a, b) => b.risk_score - a.risk_score)
    .map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      priority: r.priority,
      riskScore: r.risk_score,
      sourceName: r.source_name,
      sourceCategory: r.source_category,
      changeId: r.change_id,
      recommendedActions: r.recommended_actions,
      ownerSuggestion: r.owner_suggestion,
      evidenceCitations: r.evidence_citations,
      createdAt: r.created_at,
    }));
}

export async function getSources() {
  return [...SOURCES]
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
    .map((s) => ({
      ...s,
      change_count: CHANGES.filter((c) => c.source_id === s.id).length,
    }));
}

export async function getChanges() {
  return [...CHANGES].sort((a, b) => b.id - a.id);
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
    const row = CHANGES.find((c) => c.id === changeId);
    if (!row) continue;
    const addedLines = row.diff_json?.added_lines || [];
    const deletedLines = row.diff_json?.deleted_lines || [];

    let evidenceText = '';
    if (addedLines.length > 0) {
      evidenceText += addedLines.slice(0, 8).join('\n');
      if (addedLines.length > 8) evidenceText += `\n... (+${addedLines.length - 8} more lines)`;
    }

    results.push({
      changeId: row.id,
      sourceName: row.source_name,
      sourceCategory: row.source_category,
      evidenceText: evidenceText || row.diff_text?.substring(0, 500) || 'No content available',
      addedCount: addedLines.length,
      deletedCount: deletedLines.length,
    });
  }
  return results;
}

export async function getGraphData() {
  const colorMap = {
    source: '#94a3b8', cve: '#ff5c5c', component: '#5e9bff', change_event: '#34d399',
    policy_clause: '#f5b544', api_level: '#a78bfa', permission: '#f472b6',
    kernel_version: '#22d3ee', sdk_version: '#a3e635', unknown: '#8b8b9a',
  };
  const sizeMap = {
    source: 11, change_event: 8, cve: 12, component: 10, policy_clause: 9,
    api_level: 7, permission: 7, kernel_version: 7, sdk_version: 7, unknown: 5,
  };

  const raw = GRAPH_RAW;
  if (!raw) return { nodes: [], links: [] };

  const nodes = (raw.nodes || []).map((n) => ({
    id: n.id,
    type: n.node_type || 'unknown',
    color: colorMap[n.node_type] || colorMap.unknown,
    size: sizeMap[n.node_type] || 5,
    label: n.id,
  }));

  const links = (raw.edges || raw.links || []).map((l) => ({
    source: l.source,
    target: l.target,
    relation: l.relation || 'unknown',
  }));

  return { nodes, links };
}

// Context builder for the Threat Assistant (Groq) — pure in-process, no SQL.
export async function getChatContext() {
  const stats = await getStats();
  const statsText = `Active Sources Monitored: ${SOURCES.filter((s) => s.active).length}
Total Changes Detected: ${stats.totalChanges}
Pending Changes: ${stats.pending} | Escalated Changes: ${stats.escalated}
Agent Events: ${stats.agentEvents} | Action Tickets: ${stats.actionTickets}`;

  const tickets = [...RECOMMENDATIONS].sort((a, b) => b.risk_score - a.risk_score).slice(0, 10);
  const ticketsText = tickets.length
    ? tickets.map((t) => `Ticket: [${t.priority?.toUpperCase()}] ${t.title} (Risk: ${t.risk_score}, Source: ${t.source_name})\nSummary: ${t.summary}`).join('\n\n')
    : 'No action tickets found.';

  const changes = [...CHANGES].sort((a, b) => b.id - a.id).slice(0, 12);
  const changesText = changes.length
    ? changes.map((c) => `[change_${c.id}] (${c.source_name}, ${c.source_category}, status: ${c.status})\n${c.diff_text?.substring(0, 300) || 'No diff text'}`).join('\n\n')
    : 'No recent changes found.';

  return { stats: statsText, ticketsText, changesText };
}
