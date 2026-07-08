import { NextResponse } from 'next/server';
import { ABLATION } from '@/lib/data';

// Serves the real RAG evaluation ablation study (DeltaRAG + Graph-RAG) so the
// Analytics page can chart retrieval quality across system variants.
const VARIANT_LABELS = {
  standard_rag: 'Standard RAG',
  delta_rag: 'DeltaRAG',
  graph_rag_only: 'Graph-RAG',
  delta_rag_graph_rag: 'DeltaRAG + Graph',
  full_system: 'Full System',
};

export async function GET() {
  try {
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
    const byType = Object.entries(full.by_type || {}).map(([type, m]) => ({
      type: type.replace(/_/g, ' '),
      p_at_1: m.mean_p_at_1,
      ndcg_at_5: m.mean_ndcg_at_5,
      mrr: m.mrr,
      count: m.count,
    }));

    return NextResponse.json({
      metadata: ABLATION.metadata || {},
      variants,
      byType,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message, variants: [], byType: [] }, { status: 500 });
  }
}
