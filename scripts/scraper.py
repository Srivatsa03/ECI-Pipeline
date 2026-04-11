"""Fetch and store snapshots from monitored sources."""
import json
import requests
from bs4 import BeautifulSoup
from utils.db import get_session, Source, Snapshot
from config.settings import REQUEST_TIMEOUT, USER_AGENT


def clean_html(raw_html: str) -> str:
    """Strip navigation, scripts, styles — keep body text."""
    soup = BeautifulSoup(raw_html, "lxml")

    # Remove non-content elements
    for tag in soup.find_all(["nav", "header", "footer", "script", "style",
                              "noscript", "aside", "iframe", "form"]):
        tag.decompose()

    # Remove common boilerplate classes/ids
    for selector in [".nav", ".header", ".footer", ".sidebar", ".menu",
                     "#nav", "#header", "#footer", "#sidebar", "#cookie"]:
        for el in soup.select(selector):
            el.decompose()

    text = soup.get_text(separator="\n", strip=True)

    # Clean up excessive whitespace
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def fetch_source(source: Source) -> dict:
    """Fetch content from a single source. Returns {raw, clean, error}."""
    headers = {"User-Agent": USER_AGENT}
    try:
        resp = requests.get(source.url, headers=headers, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()

        if source.fetch_type == "json":
            raw = resp.text
            # For JSON feeds, pretty-print for readability
            data = json.loads(raw)
            clean = json.dumps(data, indent=2)
        else:
            raw = resp.text
            clean = clean_html(raw)

        return {"raw": raw, "clean": clean, "error": None}

    except requests.RequestException as e:
        return {"raw": None, "clean": None, "error": str(e)}


def scrape_all():
    """Fetch snapshots for all active sources."""
    session = get_session()
    sources = session.query(Source).filter_by(active=True).all()
    results = {"success": 0, "failed": 0, "unchanged": 0}

    for source in sources:
        print(f"  Fetching: {source.name}...", end=" ")
        result = fetch_source(source)

        if result["error"]:
            print(f"FAILED ({result['error'][:60]})")
            results["failed"] += 1
            continue

        # Create snapshot
        snapshot = Snapshot(
            source_id=source.id,
            raw_text=result["raw"],
            clean_text=result["clean"],
        )
        snapshot.compute_hash()

        # Check if content actually changed from last snapshot
        last_snap = (
            session.query(Snapshot)
            .filter_by(source_id=source.id)
            .order_by(Snapshot.fetched_at.desc())
            .first()
        )

        if last_snap and last_snap.content_hash == snapshot.content_hash:
            print("UNCHANGED")
            results["unchanged"] += 1
            continue

        session.add(snapshot)
        session.commit()
        print(f"OK (hash: {snapshot.content_hash[:12]}...)")
        results["success"] += 1

    session.close()
    print(f"[SCRAPE] {results['success']} new, {results['unchanged']} unchanged, {results['failed']} failed.")
    return results


if __name__ == "__main__":
    scrape_all()
