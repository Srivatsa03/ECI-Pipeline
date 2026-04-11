"""Seed the source registry with monitoring targets."""
from utils.db import get_session, Source
from config.settings import SOURCES


def seed_sources():
    """Insert or update sources using idempotent upsert on URL."""
    session = get_session()
    added, updated = 0, 0

    for name, url, fetch_type, category in SOURCES:
        existing = session.query(Source).filter_by(url=url).first()
        if existing:
            existing.name = name
            existing.fetch_type = fetch_type
            existing.category = category
            existing.active = True
            updated += 1
        else:
            session.add(Source(
                name=name, url=url, fetch_type=fetch_type,
                category=category, active=True,
            ))
            added += 1

    session.commit()
    session.close()
    print(f"[SEED] {added} added, {updated} updated. Total: {len(SOURCES)} sources.")


if __name__ == "__main__":
    from utils.db import init_db
    init_db()
    seed_sources()
