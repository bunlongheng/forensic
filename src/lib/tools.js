// The board's add-tools, as plain data, shared by the two ways in: the toolbar +
// and holding CMD on the canvas, both of which render the same CursorTools ring.
import { STAMP_LABELS } from './constants.js'

export const TOOL_ITEMS = [
  { key: 'clip', icon: 'clip', label: 'Quick note' },
  { key: 'note', icon: 'note', label: 'Sticky' },
  { key: 'text', icon: 'text', label: 'Text' },
  { key: 'callout', icon: 'callout', label: 'Callout' },
  { key: 'annotation', icon: 'circle', label: 'Circle' },
  { key: 'person', icon: 'person', label: 'Person', choices: [
    { label: 'Profile card', key: 'profile' },
    { label: 'Photo', action: 'image' },
  ] },
  { key: 'stamp', icon: 'stamp', label: 'Stamp', choices: STAMP_LABELS.map((l) => ({ label: l, key: 'stamp', extra: { label: l } })) },
  { key: 'redaction', icon: 'redact', label: 'Redact' },
  { key: 'crosshair', icon: 'crosshair', label: 'Crosshair' },
  { key: 'drawing', glyph: '✎', label: 'Draw' },
  { key: 'container', icon: 'group', label: 'Group' },
]
