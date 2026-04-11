"""Entity extraction from change text for Knowledge Graph population.

Extracts structured entities using regex patterns:
  - CVE IDs (CVE-YYYY-NNNNN)
  - Android API levels / version numbers
  - Android permissions
  - Kernel versions
  - SDK versions
  - Policy clause identifiers

Optional LLM-based extraction for unstructured relationships.
"""
import re
from dataclasses import dataclass, field


@dataclass
class Entity:
    """A single extracted entity."""
    entity_type: str   # cve, api_level, permission, kernel_version, sdk_version, policy_clause, component
    value: str         # normalized identifier
    raw_match: str     # original text that matched
    context: str = ""  # surrounding text for relationship inference


@dataclass
class Relationship:
    """A relationship between two entities."""
    source: str        # entity value
    target: str        # entity value
    relation: str      # affects, deprecates, co_occurs, references, supersedes, patches


@dataclass
class EntitySet:
    """Collection of entities and relationships extracted from text."""
    entities: list[Entity] = field(default_factory=list)
    relationships: list[Relationship] = field(default_factory=list)

    def add_entity(self, entity_type: str, value: str, raw_match: str, context: str = ""):
        """Add entity if not duplicate."""
        for existing in self.entities:
            if existing.entity_type == entity_type and existing.value == value:
                return
        self.entities.append(Entity(entity_type, value, raw_match, context))

    def add_relationship(self, source: str, target: str, relation: str):
        """Add relationship if not duplicate."""
        for existing in self.relationships:
            if (existing.source == source and existing.target == target
                    and existing.relation == relation):
                return
        self.relationships.append(Relationship(source, target, relation))

    @property
    def entity_count(self) -> int:
        return len(self.entities)

    @property
    def entity_density(self) -> float:
        """Entities per 1000 characters — used by adaptive retrieval."""
        return self.entity_count  # normalized externally


# ── Regex Patterns ────────────────────────────────────────────────

CVE_PATTERN = re.compile(r'CVE-\d{4}-\d{4,7}', re.IGNORECASE)
API_LEVEL_PATTERN = re.compile(r'(?:API\s*level\s*|API\s*)(\d{2,3})', re.IGNORECASE)
ANDROID_VERSION_PATTERN = re.compile(r'Android\s+(\d{1,2}(?:\.\d+)?)', re.IGNORECASE)
KERNEL_VERSION_PATTERN = re.compile(r'(?:kernel\s+(?:version\s+)?|kernel\s+)(\d+\.\d+(?:\.\d+)?)', re.IGNORECASE)
PERMISSION_PATTERN = re.compile(r'(?:android\.permission\.)?([A-Z][A-Z_]{3,}(?:_PERMISSION|_ACCESS|_IMAGES|_VIDEO|_AUDIO|_CONTACTS|_LOCATION|_SMS|_PHONE|_STORAGE|_CAMERA|_MICROPHONE))', re.IGNORECASE)
SVE_PATTERN = re.compile(r'SVE-\d{4}-\d{3,}', re.IGNORECASE)
SDK_VERSION_PATTERN = re.compile(r'(?:SDK|targetSdk|minSdk)\s*(?:version\s*)?(\d{2,3})', re.IGNORECASE)

# Components commonly referenced in bulletins
COMPONENT_PATTERN = re.compile(
    r'\b(ActivityManagerService|PackageManagerService|Bluetooth|Wi-Fi\s*(?:HAL|subsystem)?|'
    r'binder\s*driver|GPU\s*driver|Mali|Titan\s*M2|Camera\s*HAL|TrustZone|Knox|'
    r'Secure\s*Folder|Media\s*Framework|Baseband|Modem)\b',
    re.IGNORECASE
)

# Policy-related patterns
POLICY_CLAUSE_PATTERN = re.compile(
    r'\b(Data\s*Safety|Device\s*and\s*Network\s*Abuse|Financial\s*Services|'
    r'Permissions?\s*Policy|AI-Generated\s*Content|Photo\s*Picker|'
    r'Play\s*Integrity\s*API|MEETS_\w+_INTEGRITY|MEETS_\w+)\b',
    re.IGNORECASE
)


def _get_context(text: str, match_start: int, match_end: int, window: int = 100) -> str:
    """Get surrounding text for context."""
    start = max(0, match_start - window)
    end = min(len(text), match_end + window)
    return text[start:end].strip()


def extract_entities(text: str) -> EntitySet:
    """Extract all entities from text using regex patterns.

    Args:
        text: Raw text (change content, diff text, etc.)

    Returns:
        EntitySet with extracted entities and inferred relationships.
    """
    if not text:
        return EntitySet()

    result = EntitySet()

    # CVE IDs
    for match in CVE_PATTERN.finditer(text):
        cve_id = match.group(0).upper()
        ctx = _get_context(text, match.start(), match.end())
        result.add_entity("cve", cve_id, match.group(0), ctx)

    # SVE IDs (Samsung)
    for match in SVE_PATTERN.finditer(text):
        sve_id = match.group(0).upper()
        ctx = _get_context(text, match.start(), match.end())
        result.add_entity("cve", sve_id, match.group(0), ctx)  # treat as CVE-like

    # Android versions → API levels
    for match in ANDROID_VERSION_PATTERN.finditer(text):
        version = match.group(1)
        ctx = _get_context(text, match.start(), match.end())
        result.add_entity("api_level", f"android_{version}", match.group(0), ctx)

    # Explicit API levels
    for match in API_LEVEL_PATTERN.finditer(text):
        level = match.group(1)
        ctx = _get_context(text, match.start(), match.end())
        result.add_entity("api_level", f"api_{level}", match.group(0), ctx)

    # Kernel versions
    for match in KERNEL_VERSION_PATTERN.finditer(text):
        version = match.group(1)
        ctx = _get_context(text, match.start(), match.end())
        result.add_entity("kernel_version", f"kernel_{version}", match.group(0), ctx)

    # SDK versions
    for match in SDK_VERSION_PATTERN.finditer(text):
        version = match.group(1)
        ctx = _get_context(text, match.start(), match.end())
        result.add_entity("sdk_version", f"sdk_{version}", match.group(0), ctx)

    # Permissions
    for match in PERMISSION_PATTERN.finditer(text):
        perm = match.group(1).upper()
        ctx = _get_context(text, match.start(), match.end())
        result.add_entity("permission", perm, match.group(0), ctx)

    # Components
    for match in COMPONENT_PATTERN.finditer(text):
        component = match.group(1).strip()
        ctx = _get_context(text, match.start(), match.end())
        result.add_entity("component", component.lower().replace(" ", "_"), match.group(0), ctx)

    # Policy clauses
    for match in POLICY_CLAUSE_PATTERN.finditer(text):
        clause = match.group(1).strip()
        ctx = _get_context(text, match.start(), match.end())
        result.add_entity("policy_clause", clause.lower().replace(" ", "_"), match.group(0), ctx)

    # ── Infer relationships from context ──────────────────────
    _infer_relationships(text, result)

    return result


def _infer_relationships(text: str, entity_set: EntitySet):
    """Infer relationships between extracted entities using co-occurrence and keyword proximity."""

    cves = [e for e in entity_set.entities if e.entity_type == "cve"]
    components = [e for e in entity_set.entities if e.entity_type == "component"]
    api_levels = [e for e in entity_set.entities if e.entity_type == "api_level"]
    permissions = [e for e in entity_set.entities if e.entity_type == "permission"]
    policy_clauses = [e for e in entity_set.entities if e.entity_type == "policy_clause"]

    # CVE → component (affects)
    for cve in cves:
        for comp in components:
            # Check if they appear near each other in the text
            if comp.raw_match.lower() in cve.context.lower():
                entity_set.add_relationship(cve.value, comp.value, "affects")

    # CVE → API level (affects)
    for cve in cves:
        for api in api_levels:
            if api.raw_match.lower() in cve.context.lower():
                entity_set.add_relationship(cve.value, api.value, "affects")

    # Policy → permission (deprecates/restricts)
    deprecation_keywords = ["deprecated", "restricted", "sunset", "removed", "migrate", "no longer"]
    for clause in policy_clauses:
        for perm in permissions:
            if perm.raw_match in clause.context:
                # Check for deprecation language
                ctx_lower = clause.context.lower()
                if any(kw in ctx_lower for kw in deprecation_keywords):
                    entity_set.add_relationship(clause.value, perm.value, "deprecates")
                else:
                    entity_set.add_relationship(clause.value, perm.value, "references")

    # Co-occurrence: CVEs that appear in the same change
    for i, cve1 in enumerate(cves):
        for cve2 in cves[i + 1:]:
            entity_set.add_relationship(cve1.value, cve2.value, "co_occurs")


def extract_from_change(change) -> EntitySet:
    """Extract entities from a Change ORM object.

    Combines diff_text and diff_json content for extraction.
    """
    texts = []
    if change.diff_text:
        texts.append(change.diff_text)
    if change.diff_json:
        added = change.diff_json.get("added", [])
        if added:
            texts.append("\n".join(added))
    return extract_entities("\n".join(texts))
