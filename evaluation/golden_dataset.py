"""Evaluate retrieval precision using a golden dataset.

Tests DeltaRAG retrieval quality by checking if the top-K retrieved chunks
come from the expected source for each query.
"""
from rag.embedder import query_similar, get_collection_stats

# ── Golden Dataset ────────────────────────────────────────────────
# Each entry: (query, expected_source_category, description)
GOLDEN_QUERIES = [
    (
        "What kernel vulnerabilities were patched in the latest Android Security Bulletin?",
        "security_bulletin",
        "Should retrieve from security bulletin sources",
    ),
    (
        "Has the Play Integrity API changed its device attestation requirements?",
        "developer_docs",
        "Should retrieve from Play Integrity documentation",
    ),
    (
        "What CVEs were added to CISA's known exploited vulnerabilities catalog?",
        "cve_feed",
        "Should retrieve from CISA KEV feed",
    ),
    (
        "What changes were made to Google Play developer policies recently?",
        "policy_update",
        "Should retrieve from policy update sources",
    ),
    (
        "What privilege escalation bugs affect the Android framework?",
        "security_bulletin",
        "Should retrieve from security bulletins",
    ),
    (
        "How has the device integrity verdict classification changed?",
        "developer_docs",
        "Should retrieve from Play Integrity documentation",
    ),
    (
        "What remote code execution vulnerabilities were disclosed?",
        "security_bulletin",
        "Should retrieve from security bulletins or CVE feed",
    ),
    (
        "What app permissions are being deprecated or restricted?",
        "developer_docs",
        "Should retrieve from developer documentation",
    ),
    (
        "Which vulnerabilities in the CISA KEV feed are being used in ransomware campaigns?",
        "cve_feed",
        "Should retrieve from CISA KEV feed — tests ransomware-specific language",
    ),
    (
        "What enforcement changes affect monetization or content policies?",
        "policy_update",
        "Should retrieve from policy updates",
    ),
    # ── New source queries ──────────────────────────────────────
    (
        "What Samsung Knox attestation vulnerabilities were disclosed?",
        "oem_bulletin",
        "Should retrieve from Samsung OEM bulletin",
    ),
    (
        "What Pixel-specific security fixes were released this month?",
        "oem_bulletin",
        "Should retrieve from Pixel OEM bulletin",
    ),
    (
        "What CVSS scores were assigned to recent Android CVEs in the NVD?",
        "cve_feed",
        "Should retrieve from NVD CVE feed",
    ),
    (
        "Are there Samsung Secure Folder exploits being actively used?",
        "oem_bulletin",
        "Should retrieve from Samsung OEM bulletin",
    ),
    (
        "What Titan M2 firmware vulnerabilities affect Pixel devices?",
        "oem_bulletin",
        "Should retrieve from Pixel OEM bulletin",
    ),
]


def evaluate_retrieval(top_k: int = 5):
    """Run the golden dataset evaluation.

    Measures:
    - Rank-1 precision: Is the top result from the correct source category?
    - Top-K precision: What fraction of top-K results are from the correct category?
    """
    stats = get_collection_stats()
    if stats["total_chunks"] == 0:
        print("[EVAL] No chunks in vector store. Run embedding first.")
        return

    print(f"\n=== RETRIEVAL EVALUATION ===")
    print(f"Vector store: {stats['total_chunks']} chunks")
    print(f"Golden queries: {len(GOLDEN_QUERIES)}")
    print(f"Top-K: {top_k}\n")

    rank1_correct = 0
    topk_precisions = []

    for query, expected_category, description in GOLDEN_QUERIES:
        results = query_similar(query, top_k=top_k)

        if not results:
            print(f"  MISS | {query[:60]}...")
            print(f"         No results returned")
            topk_precisions.append(0.0)
            continue

        # Check Rank-1 — use source_category from chunk metadata first
        top_result = results[0]
        top_category = top_result["metadata"].get("source_category", "")

        # Fall back to DB lookup if metadata doesn't have category
        if not top_category:
            from utils.db import get_session, Source
            session = get_session()
            top_source = session.query(Source).filter_by(
                id=top_result["metadata"].get("source_id")
            ).first()
            top_category = top_source.category if top_source else "unknown"
            session.close()

        rank1_hit = top_category == expected_category
        if rank1_hit:
            rank1_correct += 1

        # Check Top-K precision — use metadata directly
        correct_in_k = 0
        for r in results:
            cat = r["metadata"].get("source_category", "")
            if not cat:
                from utils.db import get_session, Source
                session = get_session()
                src = session.query(Source).filter_by(id=r["metadata"].get("source_id")).first()
                cat = src.category if src else ""
                session.close()
            if cat == expected_category:
                correct_in_k += 1

        precision = correct_in_k / len(results)
        topk_precisions.append(precision)

        status = "HIT " if rank1_hit else "MISS"
        print(f"  {status} | {query[:60]}...")
        print(f"         Expected: {expected_category} | Got: {top_category} | "
              f"Top-{top_k} precision: {precision:.0%}")

    # Summary
    rank1_precision = rank1_correct / len(GOLDEN_QUERIES)
    avg_topk = sum(topk_precisions) / len(topk_precisions)

    print(f"\n{'='*50}")
    print(f"  Rank-1 Precision: {rank1_precision:.0%} ({rank1_correct}/{len(GOLDEN_QUERIES)})")
    print(f"  Avg Top-{top_k} Precision: {avg_topk:.0%}")
    print(f"{'='*50}")

    return {
        "rank1_precision": rank1_precision,
        "avg_topk_precision": avg_topk,
        "total_queries": len(GOLDEN_QUERIES),
    }


if __name__ == "__main__":
    evaluate_retrieval()
