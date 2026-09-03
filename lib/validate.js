// Shared board field validation used by both create-board.js (full body,
// defaults already applied - partial:false) and board-by-id.js's PUT (only the
// fields the caller sent - partial:true, so an undefined field is skipped).
// Returns { error } on the first invalid field, or {} when everything present
// is valid.
export function validateBoardFields(fields, { partial = false } = {}) {
  const { title, nodes, edges, tags, type } = fields;

  if (!partial || title !== undefined) {
    if (typeof title !== "string" || !title.trim()) return { error: "title must be a non-empty string." };
    if (title.length > 200) return { error: "title too long (max 200 characters)." };
  }

  if (!partial || nodes !== undefined) {
    if (!Array.isArray(nodes)) return { error: "nodes must be an array." };
    if (nodes.length > 1000) return { error: "too many nodes (max 1000)." };
    for (const n of nodes) {
      if (!n || typeof n !== "object" || typeof n.id !== "string") {
        return { error: "Every node must be an object with a string id." };
      }
    }
    if (JSON.stringify(nodes).length > 4_000_000) {
      return { error: "Board too large (max 4 MB of nodes)." };
    }
  }

  if (!partial || edges !== undefined) {
    if (!Array.isArray(edges)) return { error: "edges must be an array." };
    if (edges.length > 2000) return { error: "too many edges (max 2000)." };
    for (const e of edges) {
      if (!e || typeof e.source !== "string" || typeof e.target !== "string") {
        return { error: 'Every edge must have string "source" and "target" node ids.' };
      }
    }
  }

  if (!partial || tags !== undefined) {
    if (!Array.isArray(tags)) return { error: "tags must be an array." };
    if (tags.length > 50) return { error: "too many tags (max 50)." };
    for (const t of tags) {
      if (typeof t !== "string" || t.length > 64) {
        return { error: "Every tag must be a string (max 64 characters)." };
      }
    }
  }

  if (!partial || type !== undefined) {
    if (typeof type !== "string" || type.length > 40) {
      return { error: "type must be a string (max 40 characters)." };
    }
  }

  return {};
}
