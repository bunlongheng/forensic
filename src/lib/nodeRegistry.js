// The one place a board object type is declared. Before this file the same 15
// types were spelled out in 4 lists that had to be kept in step by hand - the
// React Flow map in Board.jsx, the tool ring in tools.js, the default-spec
// switch in boardGraph.js and the branch chain in Inspector.jsx - so a type
// could render with no inspector, or sit in the ring with no defaults.
//
// PURE DATA, deliberately: this module is imported by the graph layer
// (boardGraph.js and its hooks), so it may not pull in a single .jsx renderer.
// The React Flow component map lives next door in nodeTypes.js, which is the
// only src/lib file allowed to import components.
//
// Per entry:
//   label      human name - the inspector's heading for the type, and the
//              fallback headline the case report prints for it
//   resizes    true when the node carries a NodeResizer (fixed-size otherwise)
//   inspector  key of the Inspector panel this type opens (null = no panel)
//   spec(nds)  default style + data for a NEW node, given the board's current
//              nodes (a few types cycle a name/colour/emoji off what is already
//              pinned). Omitted for types that are never created blank - an
//              image arrives with its own bytes and size.
//   report     how report.js treats the type. { text: true } means its
//              data.text is evidence (the report's "notes"). { fields: [...] }
//              names the data keys carrying its headline, first non-empty one
//              wins, falling back to `label`.
//   tool       this type's entry in the add-tool ring, or absent when it is not
//              offered there. THE KEY ORDER BELOW IS THE RING ORDER.

import {
  NOTE_TINTS, STICKER_EMOJIS, PROFILE_NAMES, PROFILE_COLORS, CONTAINER_TINTS, STAMP_LABELS,
} from './constants.js'

const count = (nds, t) => nds.filter((n) => n.type === t).length

export const NODE_REGISTRY = {
  clip: {
    label: 'Clip', resizes: false, inspector: 'clip', report: { text: true },
    // No height - a quick note auto-fits the text in it.
    spec: () => ({ style: { width: 210 }, data: { text: '', color: '#fbfaf6', editable: true } }),
    tool: { key: 'clip', icon: 'clip', label: 'Quick note' },
  },
  note: {
    label: 'Note', resizes: true, inspector: 'note', report: { text: true },
    spec: () => ({ style: { width: 200, height: 140 }, data: { text: '', color: NOTE_TINTS[0], editable: true } }),
    tool: { key: 'note', icon: 'note', label: 'Sticky' },
  },
  text: {
    label: 'Text', resizes: true, inspector: 'text', report: { text: true },
    spec: () => ({ style: { width: 180, height: 90 }, data: { text: '', editable: true } }),
    tool: { key: 'text', icon: 'text', label: 'Text' },
  },
  callout: {
    label: 'Callout', resizes: true, inspector: 'callout', report: { text: true },
    spec: () => ({ style: { width: 240, height: 120 }, data: { text: 'Important!!!', color: '#fff3bf', editable: true } }),
    tool: { key: 'callout', icon: 'callout', label: 'Callout' },
  },
  annotation: {
    label: 'Circle', resizes: true, inspector: 'annotation',
    spec: () => ({ style: { width: 190, height: 130 }, data: { color: '#e5231b', editable: true } }),
    tool: { key: 'annotation', icon: 'circle', label: 'Circle' },
  },
  profile: {
    label: 'Person', resizes: false, inspector: 'profile', report: { fields: ['name'] },
    spec: (nds) => {
      const i = count(nds, 'profile')
      return { style: { width: 96, height: 96 }, data: { name: PROFILE_NAMES[i % PROFILE_NAMES.length], color: PROFILE_COLORS[i % PROFILE_COLORS.length], editable: true } }
    },
    // The ring entry is a CHOOSER, not the node type: picking it re-blooms into
    // "Profile card" (this type) or "Photo" (the file picker).
    tool: { key: 'person', icon: 'person', label: 'Person', choices: [
      { label: 'Profile card', key: 'profile' },
      { label: 'Photo', action: 'image' },
    ] },
  },
  stamp: {
    label: 'Stamp', resizes: true, inspector: 'stamp', report: { fields: ['label'] },
    spec: () => ({ style: { width: 220, height: 60 }, data: { label: 'APPROVED', color: '#d0342c', editable: true } }),
    tool: { key: 'stamp', icon: 'stamp', label: 'Stamp', choices: STAMP_LABELS.map((l) => ({ label: l, key: 'stamp', extra: { label: l } })) },
  },
  wax: {
    label: 'Wax seal', resizes: true, inspector: 'wax',
    spec: () => ({ style: { width: 84, height: 84 }, data: { symbol: '★', color: '#8b1e3f', editable: true } }),
    tool: { key: 'wax', icon: 'wax', label: 'Wax seal' },
  },
  redaction: {
    label: 'Redact', resizes: true, inspector: 'redaction',
    spec: () => ({ style: { width: 170, height: 26 }, data: { color: '#111111', editable: true } }),
    tool: { key: 'redaction', icon: 'redact', label: 'Redact' },
  },
  crosshair: {
    label: 'Crosshair', resizes: true, inspector: 'crosshair',
    spec: () => ({ style: { width: 90, height: 90 }, data: { color: '#e5231b', editable: true } }),
    tool: { key: 'crosshair', icon: 'crosshair', label: 'Crosshair' },
  },
  drawing: {
    label: 'Drawing', resizes: true, inspector: 'drawing',
    spec: () => ({ style: { width: 220, height: 160 }, data: { paths: [], editable: true } }),
    tool: { key: 'drawing', glyph: '✎', label: 'Draw' },
  },
  container: {
    label: 'Group', resizes: true, inspector: 'container', report: { fields: ['title'] },
    spec: (nds) => ({ style: { width: 320, height: 240 }, data: { title: 'Section', color: CONTAINER_TINTS[count(nds, 'container') % CONTAINER_TINTS.length], editable: true } }),
    tool: { key: 'container', icon: 'group', label: 'Group' },
  },
  // Below: types that exist on the board but are not offered in the ring.
  sticker: {
    label: 'Sticker', resizes: true, inspector: 'sticker',
    spec: (nds) => ({ style: { width: 76, height: 76 }, data: { emoji: STICKER_EMOJIS[nds.length % STICKER_EMOJIS.length], editable: true } }),
  },
  // An image arrives from a drop/paste/upload with its own bytes and measured
  // size, so it has no blank default - addNode cannot create one.
  image: { label: 'Photo', resizes: true, inspector: 'image', report: { fields: ['label'] } },
  file: {
    label: 'File', resizes: false, inspector: 'file', report: { fields: ['label', 'name'] },
    // No height - an exhibit card fits its own two lines; the caller fills in
    // kind/name/url or src.
    spec: () => ({ style: { width: 240 }, data: { kind: 'link', name: 'Link', editable: true } }),
  },
}

// The add-tool ring, in registry order.
export const REGISTRY_TOOLS = Object.values(NODE_REGISTRY).map((e) => e.tool).filter(Boolean)

// Default style + data for a new node of `type`, or null when the type is
// unknown or is never created blank.
export const nodeSpec = (type, nds) => NODE_REGISTRY[type]?.spec?.(nds) ?? null
