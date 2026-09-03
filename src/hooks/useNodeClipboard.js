import { useEffect, useRef } from 'react'
import { NODE_COPY_MARKER, duplicateNode } from '../lib/boardGraph.js'

const typing = () => /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')

// Cmd/Ctrl+C copies the selected node; the single 'paste' listener duplicates it.
// An image on the clipboard ALWAYS wins - so copying a node earlier can never
// block pasting a screenshot. We write a marker to the clipboard on copy so a
// paste event still fires even when nothing else is on the clipboard.
export function useNodeClipboard({ canEdit, sel, nodes, setNodes, addImageFiles, centerPos, showToast }) {
  const clipRef = useRef(null) // copied node for Cmd/Ctrl+C -> +V duplicate

  useEffect(() => {
    if (!canEdit) return
    const onKey = (e) => {
      if (typing() || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'c') return
      if (!sel || sel.kind === 'edge') return
      const n = nodes.find((x) => x.id === sel.id)
      if (n) { clipRef.current = n; navigator.clipboard?.writeText?.(NODE_COPY_MARKER).catch(() => {}) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit, sel, nodes])

  useEffect(() => {
    if (!canEdit) return
    const onPaste = (e) => {
      const items = [...(e.clipboardData?.items || [])]
      const files = items.filter((it) => it.kind === 'file' && it.type.startsWith('image/')).map((it) => it.getAsFile()).filter(Boolean)
      if (files.length) { e.preventDefault(); addImageFiles(files, centerPos()); return }
      const text = e.clipboardData?.getData('text') || ''
      if (clipRef.current && (text === NODE_COPY_MARKER || text === '')) {
        e.preventDefault()
        const copy = duplicateNode(clipRef.current)
        setNodes((nds) => nds.concat(copy))
        showToast('Pasted a copy')
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [canEdit, addImageFiles, centerPos, setNodes, showToast])
}
