import { useEffect, useRef } from 'react'
import { NODE_COPY_MARKER, duplicateNode } from '../lib/boardGraph.js'
import { parseLink } from '../lib/attach.js'

const typing = () => /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')

// SVG copied as TEXT - Figma's "Copy as SVG", any code editor - is still a picture.
// Wrap the markup as a File so it rides the ordinary image path and pins as a photo.
const SVG_TEXT = /^\s*(?:<\?xml[^>]*>\s*)?(?:<!DOCTYPE[^>]*>\s*)?<svg[\s>][\s\S]*<\/svg>\s*$/i
export const svgTextToFile = (text) =>
  SVG_TEXT.test(text || '') ? new File([text], 'pasted.svg', { type: 'image/svg+xml' }) : null

// Cmd/Ctrl+C copies the selected node; the single 'paste' listener duplicates it.
// A FILE on the clipboard always wins (a screenshot, a PDF, an audio clip), then a
// pasted URL, and only then the node-duplicate - so copying a node earlier can
// never block pasting real evidence. We write a marker to the clipboard on copy so
// a paste event still fires even when nothing else is on the clipboard.
export function useNodeClipboard({ canEdit, readOnly, sel, nodes, setNodes, addFiles, addLink, pastePos, showToast }) {
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

  // Read-only board: a paste that carried real evidence has to SAY it was
  // refused. Silence here is what reads as 'paste is broken' - most often it is
  // just an expired session on a shared ?id= link.
  useEffect(() => {
    if (canEdit || !readOnly) return
    const onBlocked = (e) => {
      if (typing()) return
      const items = [...(e.clipboardData?.items || [])]
      const carried = items.some((it) => it.kind === 'file') || Boolean(parseLink(e.clipboardData?.getData('text') || ''))
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
      if (clipRef.current && (text === NODE_COPY_MARKER || text === '')) {
        e.preventDefault()
        const copy = duplicateNode(clipRef.current)
        setNodes((nds) => nds.concat(copy))
        showToast('Pasted a copy')
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [canEdit, addFiles, addLink, pastePos, setNodes, showToast])
}
