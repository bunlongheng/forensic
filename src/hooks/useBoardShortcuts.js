import { useEffect } from 'react'

// Typing in a field owns the keyboard - a board shortcut must never fire there.
const typing = () => /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')

// The board's own keyboard shortcuts. Save, undo/redo and copy/cut/paste live in
// useBoardPersistence, useUndoRedo and useNodeClipboard; delete and escape are
// React Flow's. What is left is grouping, and it lives here.
//
// Cmd/Ctrl+G TOGGLES: with a group selected it ungroups, otherwise it groups.
// Hitting the same keys again to undo the grouping is the reflex, and having to
// remember a second Shift variant for it never was. Shift still forces ungroup.
export function useBoardShortcuts({ canEdit, nodes, groupSelected, ungroupSelected }) {
  useEffect(() => {
    if (!canEdit) return
    const onKey = (e) => {
      if (typing() || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'g') return
      e.preventDefault()
      const onGroup = nodes.some((n) => n.selected && (n.type === 'container' || n.parentId))
      if (e.shiftKey || onGroup) ungroupSelected(); else groupSelected()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit, nodes, groupSelected, ungroupSelected])
}
