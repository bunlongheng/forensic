// Build a structured "case report" from a board - no AI, no tokens. Pulls the
// evidence (notes + photo captions), detects links (URLs) in the text, and maps
// the connections. The report modal renders this.
import { NODE_REGISTRY } from './nodeRegistry.js'

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s)]+|[a-z0-9][a-z0-9.-]*\.(?:com|net|org|io|dev|app|ai|co|gg|xyz|sh)(?:\/[^\s)]*)?)/gi

// Pull unique, normalized URLs out of any text.
export function detectLinks(text) {
  return [...new Set(((text || '').match(URL_RE) || []).map((u) => u.replace(/[.,;]+$/, '')))]
    .map((u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`))
}

// Both lists are DERIVED from the node registry, which owns every type's human
// name and says which data field carries its headline. Hand-listing them here
// is how the report came to call a container "Section" while the rest of the
// app called it "Group".
const NOTE_TYPES = Object.keys(NODE_REGISTRY).filter((t) => NODE_REGISTRY[t].report?.text)

function headline(node) {
  if (!node) return 'Unknown'
  const entry = NODE_REGISTRY[node.type]
  for (const f of entry?.report?.fields || []) {
    const v = node.data?.[f]
    if (v) return v
  }
  if (entry?.report?.fields) return entry.label
  const firstLine = (node.data?.text || '').split('\n')[0]
  if (firstLine) return firstLine
  if (entry) return entry.label
  return node.type ? node.type[0].toUpperCase() + node.type.slice(1) : 'Note'
}

export function buildReport(title, nodes, edges) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const notes = nodes.filter((n) => NOTE_TYPES.includes(n.type)).map((n) => ({ id: n.id, text: n.data?.text || '' }))
  const images = nodes.filter((n) => n.type === 'image').map((n) => ({ id: n.id, label: n.data?.label || '' }))
  // File/link exhibits: a pinned link carries data.url, an embedded file (PDF,
  // audio, video, doc) carries data.src instead and is labeled by its name.
  const files = nodes
    .filter((n) => n.type === 'file')
    .map((n) => ({ id: n.id, label: n.data?.label || n.data?.name || 'Attachment', url: n.data?.url || null }))
  const people = nodes.filter((n) => n.type === 'profile').map((n) => ({ id: n.id, name: n.data?.name || 'Person' }))

  const textPool = [...notes.map((n) => n.text), ...images.map((i) => i.label)].join('\n')
  const fileUrls = files.map((f) => f.url).filter(Boolean)
  const links = [...new Set([...detectLinks(textPool), ...fileUrls])]

  const connections = edges.map((e) => ({ from: headline(byId[e.source]), to: headline(byId[e.target]) }))

  return {
    title: title || 'Untitled Board',
    counts: {
      notes: notes.length, images: images.length, connections: edges.length, links: links.length,
      files: files.length, people: people.length,
    },
    notes, images, links, connections, files, people,
  }
}
