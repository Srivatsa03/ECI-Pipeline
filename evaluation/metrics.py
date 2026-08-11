"""Retrieval and decision-layer evaluation metrics for ECI ablation study.

Retrieval-layer metrics (per professor's requirements):
  precision_at_k       — fraction of top-k retrieved chunks from expected categories
  recall_at_k          — fraction of expected categories covered in top-k
  ndcg_at_k            — Normalized Discounted Cumulative Gain at k
  reciprocal_rank      — reciprocal of the rank of the first relevant result (for MRR)
  average_precision    — area under the precision-recall curve (for MAP)

Temporal / freshness metrics:
  freshness_score      — fraction of retrieved chunks that are delta chunks (kind=added/deleted)
  stale_evidence_rate  — fraction of retrieved chunks from full-document (kind=initial) content

False-alarm metrics:
  false_alarm_rate     — fraction of false-alarm queries where top-1 result looks relevant

Aggregation helpers:
  mean_reciprocal_rank  — MRR across a list of query results
  mean_average_precision — MAP across a list of query results
  bootstrap_ci          — 95% bootstrap confidence interval for any metric list
  compute_all_metrics   — full metric suite for one (query, retrieved_chunks) pair
  aggregate_metrics     — aggregate metric suite across all queries in a variant run
"""
import math
import random
from dataclasses import dataclass, field
from evaluation.benchmark import BenchmarkQuery, FALSE_ALARM


# ── Relevance Helper ─────────────────────────────────────────────────────────

def _is_relevant(chunk: dict, expected_categories: list[str]) -> int:
    """Return 1 if the chunk's source_category is in expected_categories, else 0."""
    cat = chunk.get("metadata", {}).get("source_category", "")
    return 1 if cat in expected_categories else 0


# ── Retrieval-Layer Metrics ───────────────────────────────────────────────────

def precision_at_k(chunks: list[dict], expected_categories: list[str], k: int) -> float:
    """Fraction of top-k retrieved chunks that come from an expected source category.

    P@k = (# relevant in top-k) / k
    """
    if not expected_categories:
        return 0.0
    top = chunks[:k]
    if not top:
        return 0.0
    hits = sum(_is_relevant(c, expected_categories) for c in top)
    return hits / len(top)


def recall_at_k(chunks: list[dict], expected_categories: list[str], k: int) -> float:
    """Fraction of expected source categories that appear at least once in top-k.

    Measures coverage rather than concentration — important for multi-hop queries
    where the answer must span multiple sources.

    R@k = (# expected categories covered in top-k) / (# expected categories)
    """
    if not expected_categories:
        return 0.0
    top = chunks[:k]
    covered = {
        c.get("metadata", {}).get("source_category", "")
        for c in top
    }
    hits = sum(1 for cat in expected_categories if cat in covered)
    return hits / len(expected_categories)


def dcg_at_k(chunks: list[dict], expected_categories: list[str], k: int) -> float:
    """Discounted Cumulative Gain at k.

    DCG@k = sum_{i=1}^{k} rel_i / log2(i + 1)
    """
    top = chunks[:k]
    return sum(
        _is_relevant(c, expected_categories) / math.log2(i + 2)
        for i, c in enumerate(top)
    )


def ndcg_at_k(chunks: list[dict], expected_categories: list[str], k: int) -> float:
    """Normalized DCG at k.

    Normalizes by the ideal DCG — the best possible ordering of the retrieved items.
    IDCG is computed by sorting the binary relevance labels in descending order.
    This ensures nDCG ∈ [0, 1] and is comparable across queries and variants.
    """
    if not expected_categories:
        return 0.0
    top = chunks[:k]
    if not top:
        return 0.0

    relevances = [_is_relevant(c, expected_categories) for c in top]
    dcg = sum(rel / math.log2(i + 2) for i, rel in enumerate(relevances))

    # Ideal: sort relevances descending — best possible ordering of the same retrieved set
    ideal = sorted(relevances, reverse=True)
    idcg = sum(rel / math.log2(i + 2) for i, rel in enumerate(ideal))

    return dcg / idcg if idcg > 0.0 else 0.0


def reciprocal_rank(chunks: list[dict], expected_categories: list[str]) -> float:
    """Reciprocal rank — 1/rank of first relevant result.

    RR = 1/r where r is the 1-indexed position of the first relevant chunk.
    Returns 0.0 if no relevant result is found.
    """
    if not expected_categories:
        return 0.0
    for i, chunk in enumerate(chunks, 1):
        if _is_relevant(chunk, expected_categories):
            return 1.0 / i
    return 0.0


def average_precision(chunks: list[dict], expected_categories: list[str]) -> float:
    """Average Precision (AP) for a single query.

    AP = (1/R) * sum_{k: rel(k)=1} P@k
    where R = total relevant documents retrieved (approximation when corpus size unknown).
    Returns 0.0 if no relevant results retrieved.
    """
    if not expected_categories:
        return 0.0
    num_relevant = 0
    sum_precision = 0.0
    for i, chunk in enumerate(chunks, 1):
        if _is_relevant(chunk, expected_categories):
            num_relevant += 1
            sum_precision += num_relevant / i
    if num_relevant == 0:
        return 0.0
    return sum_precision / num_relevant


# ── Temporal / Freshness Metrics ─────────────────────────────────────────────

def freshness_score(chunks: list[dict]) -> float:
    """Fraction of retrieved chunks that are delta chunks (kind = 'added' or 'deleted').

    A high freshness score means the system preferentially retrieves change-local
    content rather than stale full-document snapshots.
    """
    if not chunks:
        return 0.0
    fresh = sum(
        1 for c in chunks
        if c.get("metadata", {}).get("kind", "") in ("added", "deleted")
    )
    return fresh / len(chunks)


def stale_evidence_rate(chunks: list[dict]) -> float:
    """Fraction of retrieved chunks that are from full-document (initial) snapshots.

    High stale rate indicates the system is retrieving non-delta content,
    which may contain outdated or superseded information.
    """
    if not chunks:
        return 0.0
    stale = sum(
        1 for c in chunks
        if c.get("metadata", {}).get("kind", "") == "initial"
    )
    return stale / len(chunks)


# ── False-Alarm Metrics ───────────────────────────────────────────────────────

def false_alarm_rate(results_list: list[dict]) -> float:
    """Fraction of false-alarm queries where the top-1 result looks relevant.

    Expects a list of result dicts from retrieve_by_variant, each paired with a
    BenchmarkQuery where is_relevant=False.

    A result is considered a "false alarm hit" if:
      - at least one chunk was retrieved, AND
      - the top-1 chunk has a cosine distance < 0.5 (i.e., the system is confident)
    """
    if not results_list:
        return 0.0
    false_alarms = 0
    for result in results_list:
        chunks = result.get("chunks", [])
        if chunks:
            top_dist = chunks[0].get("distance")
            if top_dist is not None and top_dist < 0.5:
                false_alarms += 1
    return false_alarms / len(results_list)


# ── Aggregation Helpers ───────────────────────────────────────────────────────

def bootstrap_ci(
    values: list[float],
    n_bootstrap: int = 1000,
    alpha: float = 0.95,
) -> tuple[float, float]:
    """Bootstrap confidence interval for a list of per-query metric values.

    Args:
        values: Per-query metric scores.
        n_bootstrap: Number of bootstrap resamples.
        alpha: Confidence level (default 95%).

    Returns:
        (lower_bound, upper_bound) of the confidence interval.
    """
    if not values:
        return (0.0, 0.0)
    n = len(values)
    rng = random.Random(42)  # fixed seed for reproducibility
    means = sorted(
        sum(rng.choice(values) for _ in range(n)) / n
        for _ in range(n_bootstrap)
    )
    lo = int((1.0 - alpha) / 2.0 * n_bootstrap)
    hi = int((1.0 + alpha) / 2.0 * n_bootstrap)
    return means[lo], means[min(hi, len(means) - 1)]


@dataclass
class QueryMetrics:
    """Per-query metric snapshot."""
    query_text: str
    query_type: str
    variant: str
    p_at_1: float = 0.0
    p_at_5: float = 0.0
    r_at_5: float = 0.0
    ndcg_at_5: float = 0.0
    rr: float = 0.0
    ap: float = 0.0
    freshness: float = 0.0
    stale_rate: float = 0.0
    num_chunks_returned: int = 0


@dataclass
class AggregateMetrics:
    """Aggregated metrics across all queries for one variant."""
    variant: str
    num_queries: int = 0
    mean_p_at_1: float = 0.0
    mean_p_at_5: float = 0.0
    mean_r_at_5: float = 0.0
    mean_ndcg_at_5: float = 0.0
    mrr: float = 0.0
    map_score: float = 0.0
    mean_freshness: float = 0.0
    mean_stale_rate: float = 0.0
    false_alarm_rate: float = 0.0
    # 95% bootstrap confidence intervals
    ci_p_at_1: tuple[float, float] = field(default_factory=lambda: (0.0, 0.0))
    ci_ndcg_at_5: tuple[float, float] = field(default_factory=lambda: (0.0, 0.0))
    ci_mrr: tuple[float, float] = field(default_factory=lambda: (0.0, 0.0))
    # Per query-type breakdown
    by_type: dict = field(default_factory=dict)


def compute_query_metrics(
    query: BenchmarkQuery,
    chunks: list[dict],
    variant: str,
    k: int = 5,
) -> QueryMetrics:
    """Compute all retrieval metrics for a single (query, retrieved_chunks) pair."""
    cats = query.expected_source_categories
    return QueryMetrics(
        query_text=query.query_text,
        query_type=query.query_type,
        variant=variant,
        p_at_1=precision_at_k(chunks, cats, 1),
        p_at_5=precision_at_k(chunks, cats, k),
        r_at_5=recall_at_k(chunks, cats, k),
        ndcg_at_5=ndcg_at_k(chunks, cats, k),
        rr=reciprocal_rank(chunks, cats),
        ap=average_precision(chunks, cats),
        freshness=freshness_score(chunks),
        stale_rate=stale_evidence_rate(chunks),
        num_chunks_returned=len(chunks),
    )


def aggregate_metrics(
    per_query: list[QueryMetrics],
    false_alarm_results: list[dict],
    variant: str,
) -> AggregateMetrics:
    """Aggregate per-query metrics into a variant-level summary.

    Args:
        per_query: List of QueryMetrics, one per non-false-alarm query.
        false_alarm_results: List of raw retrieval dicts for false-alarm queries.
        variant: Variant name.

    Returns:
        AggregateMetrics with means, MRR, MAP, CIs, and per-type breakdown.
    """
    if not per_query:
        return AggregateMetrics(variant=variant)

    def _mean(vals: list[float]) -> float:
        return sum(vals) / len(vals) if vals else 0.0

    # Exclude false-alarm queries from standard retrieval metrics
    relevant_queries = [m for m in per_query if m.query_type != FALSE_ALARM]

    p1_vals = [m.p_at_1 for m in relevant_queries]
    p5_vals = [m.p_at_5 for m in relevant_queries]
    r5_vals = [m.r_at_5 for m in relevant_queries]
    ndcg_vals = [m.ndcg_at_5 for m in relevant_queries]
    rr_vals = [m.rr for m in relevant_queries]
    ap_vals = [m.ap for m in relevant_queries]
    fresh_vals = [m.freshness for m in relevant_queries]
    stale_vals = [m.stale_rate for m in relevant_queries]

    # Per query-type breakdown.
    #
    # FALSE_ALARM is deliberately excluded. Those queries carry
    # expected_source_categories=[] by definition — there is no correct
    # document to retrieve — and every retrieval metric here short-circuits
    # to 0.0 on an empty category list. Reporting P@1 for them produces a
    # hard 0.0 that looks like a catastrophic result but measures nothing.
    # The meaningful score for false-alarm queries is whether the system
    # declined to answer, which is false_alarm_rate / its rejection
    # complement, reported separately on AggregateMetrics.
    from evaluation.benchmark import ALL_QUERY_TYPES
    by_type: dict = {}
    for qt in ALL_QUERY_TYPES:
        if qt == FALSE_ALARM:
            continue
        qt_queries = [m for m in per_query if m.query_type == qt]
        if not qt_queries:
            continue
        qt_p1 = [m.p_at_1 for m in qt_queries]
        qt_ndcg = [m.ndcg_at_5 for m in qt_queries]
        qt_rr = [m.rr for m in qt_queries]
        by_type[qt] = {
            "count": len(qt_queries),
            "mean_p_at_1": _mean(qt_p1),
            "mean_ndcg_at_5": _mean(qt_ndcg),
            "mrr": _mean(qt_rr),
        }

    return AggregateMetrics(
        variant=variant,
        num_queries=len(relevant_queries),
        mean_p_at_1=_mean(p1_vals),
        mean_p_at_5=_mean(p5_vals),
        mean_r_at_5=_mean(r5_vals),
        mean_ndcg_at_5=_mean(ndcg_vals),
        mrr=_mean(rr_vals),
        map_score=_mean(ap_vals),
        mean_freshness=_mean(fresh_vals),
        mean_stale_rate=_mean(stale_vals),
        false_alarm_rate=false_alarm_rate(false_alarm_results),
        ci_p_at_1=bootstrap_ci(p1_vals),
        ci_ndcg_at_5=bootstrap_ci(ndcg_vals),
        ci_mrr=bootstrap_ci(rr_vals),
        by_type=by_type,
    )
