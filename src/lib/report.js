// Build a structured "case report" from a board - no AI, no tokens. Pulls the
// evidence (notes + photo captions), detects links (URLs) in the text, and maps
// the connections. The report modal renders this.
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s)]+|[a-z0-9][a-z0-9.-]*\.(?:com|net|org|io|dev|app|ai|co|gg|xyz|sh)(?:\/[^\s)]*)?)/gi

function headline(node) {
  if (!node) return 'Unknown'
  if (node.type === 'image') return node.data?.label || 'Photo'
  return (node.data?.text || '').split('\n')[0] || 'Note'
}

export function buildReport(title, nodes, edges) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const notes = nodes.filter((n) => n.type === 'note').map((n) => ({ id: n.id, text: n.data?.text || '' }))
  const images = nodes.filter((n) => n.type === 'image').map((n) => ({ id: n.id, label: n.data?.label || '' }))

  const textPool = [...notes.map((n) => n.text), ...images.map((i) => i.label)].join('\n')
  const links = [...new Set((textPool.match(URL_RE) || []).map((u) => u.replace(/[.,;]+$/, '')))]
    .map((u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`))

  const connections = edges.map((e) => ({ from: headline(byId[e.source]), to: headline(byId[e.target]) }))

  return {
    title: title || 'Untitled Board',
    counts: { notes: notes.length, images: images.length, connections: edges.length, links: links.length },
    notes, images, links, connections,
  }
}
