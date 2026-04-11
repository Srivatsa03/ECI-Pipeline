"""Knowledge Graph for Graph-RAG cross-source intelligence.

Constructs and queries a directed graph linking entities across change events:
  - Nodes: CVE IDs, API levels, permissions, components, policy clauses, change events
  - Edges: affects, deprecates, co_occurs, references, supersedes, patches

Persistence: JSON serialization to data/knowledge_graph.json
"""
import json
from pathlib import Path
from dataclasses import dataclass
from config.settings import DATA_DIR

try:
    import networkx as nx
except ImportError:
    raise ImportError("networkx is required: pip install networkx")

GRAPH_FILE = DATA_DIR / "knowledge_graph.json"


class KnowledgeGraph:
    """In-memory directed knowledge graph with persistence."""

    # Valid node types
    NODE_TYPES = {
        "cve", "api_level", "permission", "kernel_version",
        "sdk_version", "component", "policy_clause", "change_event",
    }

    # Valid edge types
    EDGE_TYPES = {
        "affects", "deprecates", "co_occurs", "references",
        "supersedes", "patches", "part_of",
    }

    def __init__(self):
        self.graph = nx.DiGraph()

    # ── Node Management ───────────────────────────────────────

    def add_node(self, node_id: str, node_type: str, **attrs):
        """Add a typed node to the graph.

        Args:
            node_id: Unique identifier (e.g., 'CVE-2025-0096', 'android_14')
            node_type: One of NODE_TYPES
            **attrs: Additional attributes (source_id, change_id, etc.)
        """
        self.graph.add_node(node_id, node_type=node_type, **attrs)

    def add_edge(self, source: str, target: str, relation: str, **attrs):
        """Add a typed edge between nodes.

        Creates nodes if they don't exist (with type='unknown').
        """
        if source not in self.graph:
            self.graph.add_node(source, node_type="unknown")
        if target not in self.graph:
            self.graph.add_node(target, node_type="unknown")
        self.graph.add_edge(source, target, relation=relation, **attrs)

    # ── Entity Population ─────────────────────────────────────

    def add_change_entities(self, change_id: int, source_id: int,
                            entity_set, source_category: str = ""):
        """Populate graph from an EntitySet extracted from a change.

        Args:
            change_id: Database ID of the change
            source_id: Database ID of the source
            entity_set: EntitySet from entity_extractor
            source_category: Category string for the source
        """
        # Add change event node
        change_node = f"change_{change_id}"
        self.add_node(change_node, "change_event",
                      source_id=source_id, source_category=source_category)

        # Add all entities and link to change
        for entity in entity_set.entities:
            self.add_node(entity.value, entity.entity_type)
            self.add_edge(change_node, entity.value, "references",
                          source_category=source_category)

        # Add extracted relationships
        for rel in entity_set.relationships:
            self.add_edge(rel.source, rel.target, rel.relation)

    # ── Graph Traversal ───────────────────────────────────────

    def traverse(self, start_node: str, max_hops: int = 2) -> list[str]:
        """BFS traversal from a node, returning all reachable nodes within max_hops.

        Args:
            start_node: Node ID to start from
            max_hops: Maximum traversal depth

        Returns:
            List of node IDs reachable within max_hops (excluding start).
        """
        if start_node not in self.graph:
            return []

        visited = set()
        queue = [(start_node, 0)]
        result = []

        while queue:
            node, depth = queue.pop(0)
            if node in visited:
                continue
            visited.add(node)

            if node != start_node:
                result.append(node)

            if depth < max_hops:
                # Follow both outgoing and incoming edges
                for neighbor in self.graph.successors(node):
                    if neighbor not in visited:
                        queue.append((neighbor, depth + 1))
                for neighbor in self.graph.predecessors(node):
                    if neighbor not in visited:
                        queue.append((neighbor, depth + 1))

        return result

    def get_related_change_ids(self, entity_ids: list[str],
                               max_hops: int = 2) -> list[int]:
        """Find change event IDs connected to any of the given entities.

        This is the core Graph-RAG primitive: given entities from a query,
        find all related change events through the knowledge graph.

        Args:
            entity_ids: List of entity values to start traversal from
            max_hops: Maximum graph traversal depth

        Returns:
            Sorted list of unique change IDs connected to the entities.
        """
        change_ids = set()

        for entity_id in entity_ids:
            connected = self.traverse(entity_id, max_hops)
            for node_id in connected:
                node_data = self.graph.nodes.get(node_id, {})
                if node_data.get("node_type") == "change_event":
                    # Extract numeric ID from "change_123" format
                    try:
                        cid = int(node_id.split("_", 1)[1])
                        change_ids.add(cid)
                    except (IndexError, ValueError):
                        pass

        return sorted(change_ids)

    def get_connected_entities(self, entity_id: str,
                               max_hops: int = 2) -> list[dict]:
        """Get entities connected to a node with their types and paths.

        Returns:
            List of {node_id, node_type, hop_distance} dicts.
        """
        if entity_id not in self.graph:
            return []

        results = []
        visited = set()
        queue = [(entity_id, 0)]

        while queue:
            node, depth = queue.pop(0)
            if node in visited:
                continue
            visited.add(node)

            if node != entity_id:
                node_data = self.graph.nodes.get(node, {})
                results.append({
                    "node_id": node,
                    "node_type": node_data.get("node_type", "unknown"),
                    "hop_distance": depth,
                })

            if depth < max_hops:
                for neighbor in self.graph.successors(node):
                    if neighbor not in visited:
                        queue.append((neighbor, depth + 1))
                for neighbor in self.graph.predecessors(node):
                    if neighbor not in visited:
                        queue.append((neighbor, depth + 1))

        return results

    # ── Statistics ─────────────────────────────────────────────

    def stats(self) -> dict:
        """Return graph statistics."""
        node_types = {}
        for _, data in self.graph.nodes(data=True):
            ntype = data.get("node_type", "unknown")
            node_types[ntype] = node_types.get(ntype, 0) + 1

        edge_types = {}
        for _, _, data in self.graph.edges(data=True):
            etype = data.get("relation", "unknown")
            edge_types[etype] = edge_types.get(etype, 0) + 1

        return {
            "total_nodes": self.graph.number_of_nodes(),
            "total_edges": self.graph.number_of_edges(),
            "node_types": node_types,
            "edge_types": edge_types,
        }

    # ── Persistence ───────────────────────────────────────────

    def save(self, path: Path = GRAPH_FILE):
        """Serialize graph to JSON file AND Supabase."""
        data = nx.node_link_data(self.graph)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)

        # Also save to Supabase for remote dashboard access
        try:
            from config.settings import USE_SUPABASE
            if USE_SUPABASE:
                from sqlalchemy import text
                from utils.db import engine
                graph_json = json.dumps(data, default=str)
                with engine.connect() as conn:
                    conn.execute(text("""
                        INSERT INTO knowledge_graph_data (id, graph_json, updated_at)
                        VALUES (1, CAST(:graph_json AS jsonb), now())
                        ON CONFLICT (id) DO UPDATE SET graph_json = CAST(:graph_json AS jsonb), updated_at = now()
                    """), {"graph_json": graph_json})
                    conn.commit()
                print(f"[GRAPH] Saved to Supabase + {path}")
        except Exception as e:
            print(f"[GRAPH] Saved to {path} (Supabase write failed: {e})")

        return path

    @classmethod
    def load(cls, path: Path = GRAPH_FILE) -> "KnowledgeGraph":
        """Deserialize graph from JSON."""
        kg = cls()
        if path.exists():
            with open(path) as f:
                data = json.load(f)
            kg.graph = nx.node_link_graph(data)
        return kg

    @classmethod
    def load_or_create(cls, path: Path = GRAPH_FILE) -> "KnowledgeGraph":
        """Load existing graph or create empty one."""
        if path.exists():
            return cls.load(path)
        return cls()

