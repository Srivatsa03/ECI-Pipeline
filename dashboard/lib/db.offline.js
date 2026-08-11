// lib/db.offline.js — offline data access layer for the SENTINEL console.
//
// Serves every panel from an in-process dataset (lib/data.js) so the dashboard
// runs live with no database, no credentials, and no network. This is the
// default source; set ECI_DATA_SOURCE=api to read the FastAPI service instead
// (see lib/db.js).

import {
  SOURCES,
  CHANGES,
  RECOMMENDATIONS,
  AGENT_EVENT_COUNT,
  GRAPH_RAW,
  ABLATION,
} from './data';
import { styleGraph } from './graph-style';

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
  return styleGraph(GRAPH_RAW);
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

// Benchmarks. Previously this reshaping lived inside app/api/benchmarks/route.js,
// which imported lib/data directly and so ignored ECI_DATA_SOURCE entirely —
// the analytics page served offline numbers even when everything else was live.
// It belongs here, behind the same switch as every other reader.
const VARIANT_LABELS = {
  standard_rag: 'Standard RAG',
  delta_rag: 'DeltaRAG',
  graph_rag_only: 'Graph-RAG',
  delta_rag_graph_rag: 'DeltaRAG + Graph',
  full_system: 'Full System',
};

export async function getBenchmarks() {
  const results = ABLATION.results || {};
  const variants = Object.entries(results).map(([key, v]) => ({
    key,
    label: VARIANT_LABELS[key] || key,
    p_at_1: v.mean_p_at_1,
    ndcg_at_5: v.mean_ndcg_at_5,
    mrr: v.mrr,
    map: v.map_score,
    recall_at_5: v.mean_r_at_5,
    freshness: v.mean_freshness,
    stale_rate: v.mean_stale_rate,
    false_alarm_rejection: v.false_alarm_rejection_rate,
    num_queries: v.num_queries,
  }));

  const full = results.full_system || results.delta_rag_graph_rag || {};
  // false_alarm queries have no expected source category, so every retrieval
  // metric short-circuits to 0.0 for them. Charting that reads as a total
  // failure when it actually measures nothing. Their real score is the
  // rejection rate, surfaced separately. (evaluation/metrics.py now drops
  // them at the source; this filter covers artifacts generated before that.)
  const byType = Object.entries(full.by_type || {})
    .filter(([type]) => type !== 'false_alarm')
    .map(([type, m]) => ({
      type: type.replace(/_/g, ' '),
      p_at_1: m.mean_p_at_1,
      ndcg_at_5: m.mean_ndcg_at_5,
      mrr: m.mrr,
      count: m.count,
    }));

  return { metadata: ABLATION.metadata || {}, variants, byType };
}
