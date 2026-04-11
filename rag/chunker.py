"""Chunk change text using the 1600/200 rule with source-aware context."""
import json
from dataclasses import dataclass, field
from config.settings import CHUNK_SIZE, CHUNK_OVERLAP


@dataclass
class Chunk:
    text: str
    index: int
    source_id: int
    change_id: int
    kind: str  # "added" | "deleted" | "initial"
    source_category: str = ""
    source_name: str = ""

    @property
    def metadata(self) -> dict:
        return {
            "source_id": self.source_id,
            "change_id": self.change_id,
            "chunk_index": self.index,
            "kind": self.kind,
            "source_category": self.source_category,
            "source_name": self.source_name,
        }


def _source_header(source_name: str, source_category: str) -> str:
    """Build a source context header to prepend to chunk text."""
    if source_name and source_category:
        return f"[Source: {source_name} | Category: {source_category}]\n"
    return ""


def chunk_text(
    text: str,
    source_id: int,
    change_id: int,
    kind: str = "added",
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
    source_category: str = "",
    source_name: str = "",
) -> list[Chunk]:
    """Split text into overlapping chunks.

    Uses the 1600/200 rule:
    - 1600 character chunks for focused semantic content
    - 200 character overlap to preserve cross-chunk context
    """
    if not text or not text.strip():
        return []

    text = text.strip()
    header = _source_header(source_name, source_category)
    chunks = []
    start = 0
    idx = 0

    while start < len(text):
        end = start + chunk_size

        # Try to break at a paragraph or sentence boundary
        if end < len(text):
            # Look for paragraph break
            para_break = text.rfind("\n\n", start + chunk_size // 2, end)
            if para_break > start:
                end = para_break + 1
            else:
                # Look for sentence break
                for sep in [". ", ".\n", ";\n", "\n"]:
                    sent_break = text.rfind(sep, start + chunk_size // 2, end)
                    if sent_break > start:
                        end = sent_break + len(sep)
                        break

        chunk_text_content = text[start:end].strip()
        if chunk_text_content:
            chunks.append(Chunk(
                text=header + chunk_text_content,
                index=idx,
                source_id=source_id,
                change_id=change_id,
                kind=kind,
                source_category=source_category,
                source_name=source_name,
            ))
            idx += 1

        start = end - overlap
        if start >= len(text):
            break

    return chunks


def chunk_json_records(
    json_text: str,
    source_id: int,
    change_id: int,
    kind: str = "added",
    source_category: str = "",
    source_name: str = "",
) -> list[Chunk]:
    """Chunk structured JSON data into per-record chunks.

    Handles CISA KEV, NVD, and similar feeds by splitting on
    individual vulnerability/record entries.
    """
    try:
        data = json.loads(json_text)
    except (json.JSONDecodeError, TypeError):
        # Fall back to text chunking
        return chunk_text(
            json_text, source_id, change_id, kind,
            source_category=source_category, source_name=source_name,
        )

    records = []

    # CISA KEV format
    if isinstance(data, dict) and "vulnerabilities" in data:
        feed_title = data.get("title", "CVE Feed")
        catalog_ver = data.get("catalogVersion", "")
        for vuln in data["vulnerabilities"]:
            record_text = (
                f"Feed: {feed_title} (version {catalog_ver})\n"
                f"CVE: {vuln.get('cveID', 'N/A')}\n"
                f"Vendor: {vuln.get('vendorProject', 'N/A')}\n"
                f"Product: {vuln.get('product', 'N/A')}\n"
                f"Name: {vuln.get('vulnerabilityName', 'N/A')}\n"
                f"Date Added: {vuln.get('dateAdded', 'N/A')}\n"
                f"Description: {vuln.get('shortDescription', 'N/A')}\n"
                f"Required Action: {vuln.get('requiredAction', 'N/A')}\n"
                f"Due Date: {vuln.get('dueDate', 'N/A')}\n"
                f"Ransomware Use: {vuln.get('knownRansomwareCampaignUse', 'Unknown')}"
            )
            records.append(record_text)

    # NVD format
    elif isinstance(data, dict) and "vulnerabilities" in data:
        for item in data["vulnerabilities"]:
            cve = item.get("cve", {})
            record_text = (
                f"CVE: {cve.get('id', 'N/A')}\n"
                f"Published: {cve.get('published', 'N/A')}\n"
                f"Description: {_extract_nvd_description(cve)}\n"
                f"Severity: {_extract_nvd_severity(cve)}"
            )
            records.append(record_text)

    # Generic list of objects
    elif isinstance(data, list):
        for item in data:
            records.append(json.dumps(item, indent=2))

    if not records:
        # No recognized structure — fall back to text chunking
        return chunk_text(
            json_text, source_id, change_id, kind,
            source_category=source_category, source_name=source_name,
        )

    header = _source_header(source_name, source_category)
    chunks = []
    for idx, record in enumerate(records):
        chunks.append(Chunk(
            text=header + record,
            index=idx,
            source_id=source_id,
            change_id=change_id,
            kind=kind,
            source_category=source_category,
            source_name=source_name,
        ))

    return chunks


def _extract_nvd_description(cve: dict) -> str:
    """Extract English description from NVD CVE object."""
    descriptions = cve.get("descriptions", [])
    for desc in descriptions:
        if desc.get("lang") == "en":
            return desc.get("value", "N/A")
    return descriptions[0].get("value", "N/A") if descriptions else "N/A"


def _extract_nvd_severity(cve: dict) -> str:
    """Extract CVSS severity from NVD CVE object."""
    metrics = cve.get("metrics", {})
    for version in ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]:
        if version in metrics and metrics[version]:
            m = metrics[version][0]
            cvss = m.get("cvssData", {})
            return f"{cvss.get('baseSeverity', 'N/A')} ({cvss.get('baseScore', 'N/A')})"
    return "N/A"


def chunk_change(change, source_id: int,
                 source_category: str = "", source_name: str = "") -> list[Chunk]:
    """Chunk a Change object's diff text into embedable pieces."""
    diff = change.diff_json or {}
    all_chunks: list[Chunk] = []
    change_id: int = change.id

    # Detect if the diff content is JSON (for structured feeds)
    added_lines = diff.get("added", [])
    added_text = "\n".join(added_lines)

    is_json = False
    if added_text.strip():
        try:
            json.loads(added_text)
            is_json = True
        except (json.JSONDecodeError, ValueError):
            if added_text.strip().startswith("{") or added_text.strip().startswith("["):
                is_json = True

    if is_json and source_category == "cve_feed":
        all_chunks.extend(chunk_json_records(
            added_text, source_id, change_id, kind="added",
            source_category=source_category, source_name=source_name,
        ))
    else:
        if added_text.strip():
            all_chunks.extend(chunk_text(
                added_text, source_id, change_id, kind="added",
                source_category=source_category, source_name=source_name,
            ))

    # Chunk deleted content
    deleted_text = "\n".join(diff.get("deleted", []))
    if deleted_text.strip():
        all_chunks.extend(chunk_text(
            deleted_text, source_id, change_id, kind="deleted",
            source_category=source_category, source_name=source_name,
        ))

    # If no structured diff, use diff_text directly
    if not all_chunks and change.diff_text:
        all_chunks.extend(chunk_text(
            change.diff_text, source_id, change_id, kind="initial",
            source_category=source_category, source_name=source_name,
        ))

    return all_chunks

