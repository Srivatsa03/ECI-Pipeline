"""ECI Ablation Study Runner.

Runs all five retrieval variants against the 110-query benchmark and produces
a comparison table covering every metric the professor specified.

Variants evaluated:
  V1  standard_rag        — full-document chunks, no graph (naive baseline)
  V2  delta_rag           — delta chunks only (added/deleted), no graph
  V3  graph_rag_only      — entity extraction + 2-hop graph traversal, no delta filter
  V4  delta_rag_graph_rag — DeltaRAG + Graph-RAG (current production strategy)
  V5  full_system         — alias for V4; agent-layer decision metrics noted separately

Usage:
  # From the project root:
  python -m evaluation.ablation
  python -m evaluation.ablation --top-k 10
  python -m evaluation.ablation --query-types exact_change multi_hop
  python -m evaluation.ablation --variants standard_rag delta_rag delta_rag_graph_rag
  python -m evaluation.ablation --output results/ablation_results.json
"""
import argparse
import json
import sys
import time
from pathlib import Path

from evaluation.benchmark import (
    BENCHMARK_QUERIES,
    BenchmarkQuery,
    FALSE_ALARM,
    ALL_QUERY_TYPES,
    benchmark_summary,
)
from evaluation.metrics import (
    AggregateMetrics,
    QueryMetrics,
    aggregate_metrics,
    compute_query_metrics,
)
from rag.retriever import retrieve_by_variant, RETRIEVAL_VARIANTS
from rag.embedder import get_collection_stats

# Ordered list for table display
VARIANT_DISPLAY_ORDER = [
    "standard_rag",
    "delta_rag",
    "graph_rag_only",
    "delta_rag_graph_rag",
    "full_system",
]

VARIANT_LABELS = {
    "standard_rag":        "V1 Standard RAG        ",
    "delta_rag":           "V2 DeltaRAG            ",
    "graph_rag_only":      "V3 Graph-RAG Only      ",
    "delta_rag_graph_rag": "V4 DeltaRAG + Graph-RAG",
    "full_system":         "V5 Full System         ",
}


# ── Core Runner ───────────────────────────────────────────────────────────────

def run_variant(
    variant: str,
    queries: list[BenchmarkQuery],
    top_k: int = 5,
    verbose: bool = False,
) -> tuple[list[QueryMetrics], list[dict]]:
    """Run a single retrieval variant over all benchmark queries.

    Returns:
        per_query_metrics  — one QueryMetrics per query
        false_alarm_raw    — raw retrieval dicts for false-alarm queries (for FA rate)
    """
    per_query: list[QueryMetrics] = []
    false_alarm_raw: list[dict] = []

    for i, query in enumerate(queries):
        if verbose:
            print(f"    [{i+1}/{len(queries)}] {query.query_text[:70]}...")

        try:
            result = retrieve_by_variant(
                query=query.query_text,
                source_id=0,
                top_k=top_k,
                variant=variant,
            )
            chunks = result.get("chunks", [])
        except Exception as e:
            print(f"    [WARN] Retrieval error on query {i+1}: {e}")
            chunks = []
            result = {"chunks": [], "variant": variant}

        if query.query_type == FALSE_ALARM:
            false_alarm_raw.append(result)

        qm = compute_query_metrics(query, chunks, variant, k=top_k)
        per_query.append(qm)

    return per_query, false_alarm_raw


def run_ablation(
    variants: list[str] = None,
    query_types: list[str] = None,
    top_k: int = 5,
    verbose: bool = False,
) -> dict[str, AggregateMetrics]:
    """Run the full ablation study and return per-variant AggregateMetrics.

    Args:
        variants:    Subset of variants to run (default: all five).
        query_types: Subset of query types to include (default: all).
        top_k:       Number of results to retrieve per query.
        verbose:     Print per-query progress.

    Returns:
        Dict mapping variant name → AggregateMetrics.
    """
    variants = variants or list(VARIANT_DISPLAY_ORDER)
    queries = BENCHMARK_QUERIES

    if query_types:
        queries = [q for q in queries if q.query_type in query_types]

    print(f"\n{'='*70}")
    print("  ECI ABLATION STUDY")
    print(f"{'='*70}")
    print(f"  Variants : {', '.join(variants)}")
    print(f"  Queries  : {len(queries)} total")
    print(f"  Top-K    : {top_k}")
    print(f"{'='*70}\n")

    stats = get_collection_stats()
    if stats["total_chunks"] == 0:
        print("[ERROR] Vector store is empty. Run the pipeline first:")
        print("        python main.py --stage all")
        print("        (or: python -m evaluation.test_data  to seed test data)")
        sys.exit(1)

    print(f"  Vector store: {stats['total_chunks']} chunks ({stats['backend']})\n")

    results: dict[str, AggregateMetrics] = {}

    for variant in variants:
        if variant not in RETRIEVAL_VARIANTS:
            print(f"  [SKIP] Unknown variant '{variant}'")
            continue

        print(f"  Running {VARIANT_LABELS.get(variant, variant)} ...")
        t0 = time.time()

        per_query, false_alarm_raw = run_variant(variant, queries, top_k, verbose)

        elapsed = time.time() - t0
        agg = aggregate_metrics(per_query, false_alarm_raw, variant)
        results[variant] = agg

        print(
            f"    Done in {elapsed:.1f}s — "
            f"P@1={agg.mean_p_at_1:.3f}  "
            f"nDCG@{top_k}={agg.mean_ndcg_at_5:.3f}  "
            f"MRR={agg.mrr:.3f}"
        )

    return results


# ── Display ───────────────────────────────────────────────────────────────────

def _fmt(value: float, width: int = 6) -> str:
    return f"{value:.3f}".rjust(width)


def _fmt_ci(ci: tuple[float, float]) -> str:
    return f"[{ci[0]:.3f}, {ci[1]:.3f}]"


def print_results(
    results: dict[str, AggregateMetrics],
    top_k: int = 5,
) -> None:
    """Print a formatted comparison table to stdout."""

    ordered = [v for v in VARIANT_DISPLAY_ORDER if v in results]

    print(f"\n{'='*100}")
    print("  ABLATION RESULTS — RETRIEVAL METRICS")
    print(f"{'='*100}")
    header = (
        f"{'Variant':<27}  "
        f"{'P@1':>6}  "
        f"{'P@'+str(top_k):>6}  "
        f"{'R@'+str(top_k):>6}  "
        f"{'nDCG@'+str(top_k):>8}  "
        f"{'MRR':>6}  "
        f"{'MAP':>6}  "
        f"{'Fresh':>6}  "
        f"{'Stale':>6}  "
        f"{'FA-Rej':>7}"
    )
    print(f"\n  {header}")
    print(f"  {'-'*96}")

    for v in ordered:
        m = results[v]
        fa_rej = f"{(1.0 - m.false_alarm_rate):.3f}"
        row = (
            f"  {VARIANT_LABELS.get(v, v):<27}  "
            f"{_fmt(m.mean_p_at_1)}  "
            f"{_fmt(m.mean_p_at_5)}  "
            f"{_fmt(m.mean_r_at_5)}  "
            f"{_fmt(m.mean_ndcg_at_5, 8)}  "
            f"{_fmt(m.mrr)}  "
            f"{_fmt(m.map_score)}  "
            f"{_fmt(m.mean_freshness)}  "
            f"{_fmt(m.mean_stale_rate)}  "
            f"{fa_rej:>7}"
        )
        print(row)

    # Confidence intervals
    print(f"\n  {'─'*70}")
    print("  95% Bootstrap Confidence Intervals (P@1 | nDCG@5 | MRR)")
    print(f"  {'─'*70}")
    for v in ordered:
        m = results[v]
        print(
            f"  {VARIANT_LABELS.get(v, v):<27}  "
            f"P@1: {_fmt_ci(m.ci_p_at_1)}   "
            f"nDCG: {_fmt_ci(m.ci_ndcg_at_5)}   "
            f"MRR: {_fmt_ci(m.ci_mrr)}"
        )

    # Per query-type breakdown
    print(f"\n{'='*100}")
    print("  PER QUERY-TYPE BREAKDOWN  (P@1 | nDCG@5 | MRR)")
    print(f"{'='*100}")
    type_labels = {
        "exact_change":        "Exact Change Detection",
        "multi_hop":           "Multi-Hop Linkage     ",
        "policy_security":     "Policy-Security Inter.",
        "action_recommendation":"Action Recommendation ",
        "false_alarm":         "False Alarm Rejection ",
    }
    for qt in ALL_QUERY_TYPES:
        print(f"\n  [{type_labels.get(qt, qt)}]")
        print(f"  {'Variant':<27}  {'P@1':>6}  {'nDCG@5':>8}  {'MRR':>6}")
        print(f"  {'-'*54}")
        for v in ordered:
            m = results[v]
            bt = m.by_type.get(qt)
            if bt:
                print(
                    f"  {VARIANT_LABELS.get(v, v):<27}  "
                    f"{_fmt(bt['mean_p_at_1'])}  "
                    f"{_fmt(bt['mean_ndcg_at_5'], 8)}  "
                    f"{_fmt(bt['mrr'])}"
                )

    print(f"\n{'='*100}\n")


# ── Serialization ─────────────────────────────────────────────────────────────

def _metrics_to_dict(m: AggregateMetrics) -> dict:
    """Serialize AggregateMetrics to a JSON-serializable dict."""
    return {
        "variant": m.variant,
        "num_queries": m.num_queries,
        "mean_p_at_1": round(m.mean_p_at_1, 4),
        "mean_p_at_5": round(m.mean_p_at_5, 4),
        "mean_r_at_5": round(m.mean_r_at_5, 4),
        "mean_ndcg_at_5": round(m.mean_ndcg_at_5, 4),
        "mrr": round(m.mrr, 4),
        "map_score": round(m.map_score, 4),
        "mean_freshness": round(m.mean_freshness, 4),
        "mean_stale_rate": round(m.mean_stale_rate, 4),
        "false_alarm_rate": round(m.false_alarm_rate, 4),
        "false_alarm_rejection_rate": round(1.0 - m.false_alarm_rate, 4),
        "ci_p_at_1": [round(m.ci_p_at_1[0], 4), round(m.ci_p_at_1[1], 4)],
        "ci_ndcg_at_5": [round(m.ci_ndcg_at_5[0], 4), round(m.ci_ndcg_at_5[1], 4)],
        "ci_mrr": [round(m.ci_mrr[0], 4), round(m.ci_mrr[1], 4)],
        "by_type": {
            qt: {k: round(v, 4) if isinstance(v, float) else v for k, v in vals.items()}
            for qt, vals in m.by_type.items()
        },
    }


def save_results(
    results: dict[str, AggregateMetrics],
    output_path: str,
    top_k: int = 5,
) -> None:
    """Save ablation results to a JSON file."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    summary = benchmark_summary()
    payload = {
        "metadata": {
            "top_k": top_k,
            "total_benchmark_queries": summary["total"],
            "query_type_counts": summary,
        },
        "results": {v: _metrics_to_dict(m) for v, m in results.items()},
    }

    with open(path, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"  Results saved to: {path}")


# ── Entrypoint ────────────────────────────────────────────────────────────────

def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Run ECI ablation study across retrieval variants."
    )
    p.add_argument(
        "--top-k", type=int, default=5,
        help="Number of chunks to retrieve per query (default: 5).",
    )
    p.add_argument(
        "--variants", nargs="+", default=None,
        choices=list(RETRIEVAL_VARIANTS),
        metavar="VARIANT",
        help="Variants to run (default: all five).",
    )
    p.add_argument(
        "--query-types", nargs="+", default=None,
        choices=list(ALL_QUERY_TYPES),
        metavar="TYPE",
        help="Query types to include (default: all).",
    )
    p.add_argument(
        "--output", type=str, default=None,
        help="Path to save JSON results (default: data/ablation_results.json).",
    )
    p.add_argument(
        "--verbose", action="store_true",
        help="Print per-query progress during retrieval.",
    )
    p.add_argument(
        "--summary-only", action="store_true",
        help="Print benchmark summary and exit without running retrieval.",
    )
    return p


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    if args.summary_only:
        s = benchmark_summary()
        print("\nECI Benchmark Dataset")
        print("=" * 40)
        for qt, count in s.items():
            print(f"  {qt:<30} {count}")
        return

    results = run_ablation(
        variants=args.variants,
        query_types=args.query_types,
        top_k=args.top_k,
        verbose=args.verbose,
    )

    print_results(results, top_k=args.top_k)

    output_path = args.output or "data/ablation_results.json"
    save_results(results, output_path, top_k=args.top_k)


if __name__ == "__main__":
    main()
