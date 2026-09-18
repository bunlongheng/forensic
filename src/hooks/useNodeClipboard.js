import { useEffect } from 'react'
import { NODE_COPY_MARKER, cloneSubgraph, withDescendants } from '../lib/boardGraph.js'
import { writeClip, readClip } from '../lib/nodeClipboard.js'
import { parseLink } from '../lib/attach.js'

const typing = () => /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')

// SVG copied as TEXT - Figma's "Copy as SVG", any code editor - is still a picture.
// Wrap the markup as a File so it rides the ordinary image path and pins as a photo.
const SVG_TEXT = /^\s*(?:<\?xml[^>]*>\s*)?(?:<!DOCTYPE[^>]*>\s*)?<svg[\s>][\s\S]*<\/svg>\s*$/i
export const svgTextToFile = (text) =>
  SVG_TEXT.test(text || '') ? new File([text], 'pasted.svg', { type: 'image/svg+xml' }) : null

// Cmd/Ctrl+C copies the selection, Cmd/Ctrl+X cuts it, Cmd/Ctrl+V pastes it - on
// THIS board or any other, because the clipboard itself lives outside React (see
// lib/nodeClipboard.js). Cutting evidence off one board to pin it on another is
// the whole reason cut exists, so the clipboard must outlive the board component.
//
// Paste order is deliberate: a FILE on the system clipboard always wins (a
// screenshot, a PDF, an audio clip), then pasted SVG markup, then a URL, and only
// then the copied nodes - so copying a node earlier can never block pasting real
// evidence. We write a marker to the system clipboard on copy/cut so a paste event
// still fires even when nothing else is on it.
export function useNodeClipboard({
  canEdit, readOnly, nodes, setNodes, edges, setEdges,
  addFiles, addLink, pastePos, showToast,
}) {
  useEffect(() => {
    if (!canEdit) return
    const onKey = (e) => {
      if (typing() || !(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key !== 'c' && key !== 'x') return
      // Everything selected, not just the one node the inspector is showing - the
      // multi-select bar is on screen for exactly this case.
      const picked = nodes.filter((n) => n.selected)
      if (!picked.length) return
      const travelling = withDescendants(nodes, picked.map((n) => n.id))
      const ids = new Set(travelling.map((n) => n.id))
      const internal = (edges || []).filter((x) => ids.has(x.source) && ids.has(x.target))

      e.preventDefault()
      writeClip(travelling, internal)
      // Wrapped: writeText is absent on a non-secure origin and returns undefined
      // in some polyfills, and an unhandled throw here would abort the cut itself.
      try { Promise.resolve(navigator.clipboard?.writeText?.(NODE_COPY_MARKER)).catch(() => {}) } catch { /* no clipboard API */ }

      if (key === 'x') {
        setNodes((nds) => nds.filter((n) => !ids.has(n.id)))
        // An edge with one end cut away would render as a thread to nowhere.
        setEdges?.((eds) => eds.filter((x) => !ids.has(x.source) && !ids.has(x.target)))
      }
      const what = travelling.length > 1 ? `${travelling.length} items` : '1 item'
      showToast(key === 'x' ? `Cut ${what}` : `Copied ${what}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit, nodes, edges, setNodes, setEdges, showToast])

  // Read-only board: a paste that carried real evidence has to SAY it was
  // refused. Silence here is what reads as 'paste is broken' - most often it is
  // just an expired session on a shared ?id= link.
  useEffect(() => {
    if (canEdit || !readOnly) return
    const onBlocked = (e) => {
      if (typing()) return
      const items = [...(e.clipboardData?.items || [])]
      const carried = items.some((it) => it.kind === 'file') ||
        Boolean(parseLink(e.clipboardData?.getData('text') || '')) || Boolean(readClip())
      if (carried) showToast(readOnly === 'auth' ? 'Sign in to edit this board' : 'Read-only on this device')
    }
    window.addEventListener('paste', onBlocked)
    return () => window.removeEventListener('paste', onBlocked)
  }, [canEdit, readOnly, showToast])

  useEffect(() => {
    if (!canEdit) return
    const onPaste = (e) => {
      if (typing()) return // let a paste into a note/title be a normal text paste
      const items = [...(e.clipboardData?.items || [])]
      const files = items.filter((it) => it.kind === 'file').map((it) => it.getAsFile()).filter(Boolean)
      if (files.length) { e.preventDefault(); addFiles(files, pastePos()); return }
      const text = e.clipboardData?.getData('text') || ''
      const svg = svgTextToFile(text)
      if (svg) { e.preventDefault(); addFiles([svg], pastePos()); return }
      const link = parseLink(text)
      if (link) { e.preventDefault(); addLink(link, pastePos()); return }

      const clip = readClip()
      if (clip && (text === NODE_COPY_MARKER || text === '')) {
        e.preventDefault()
        // Land on the cursor. The source position is meaningless on another board -
        // it could be thousands of units outside the current view.
        const { nodes: copies, edges: wires } = cloneSubgraph(clip.nodes, clip.edges, pastePos())
        setNodes((nds) => nds.concat(copies))
        if (wires.length) setEdges?.((eds) => eds.concat(wires))
        showToast(copies.length > 1 ? `Pasted ${copies.length} items` : 'Pasted 1 item')
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [canEdit, addFiles, addLink, pastePos, setNodes, setEdges, showToast])
}
