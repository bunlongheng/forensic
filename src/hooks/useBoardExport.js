import { useCallback } from 'react'

// The two ways a board leaves the app: a PNG of the whole corkboard, and a link
// to it on the clipboard.
export function useBoardExport({ boardId, title, wrapRef, canvasColor, showToast, fitView, getViewport, setViewport }) {
  const exportPng = useCallback(() => {
    // Capture the whole board window - frame, lamps and all - minus the UI chrome.
    const el = wrapRef.current
    if (!el) return
    const hide = (n) => {
      const c = n.classList
      return !c || (!c.contains('react-flow__minimap') && !c.contains('react-flow__controls') && !c.contains('fx-noexport'))
    }
    // Export should capture the WHOLE board, not just whatever's currently in the
    // viewport - so fit everything into view first, wait for it to paint, capture,
    // then put the viewport back exactly where the owner had it.
    const prevVp = getViewport()
    fitView({ padding: 0.1, duration: 0 })
    requestAnimationFrame(() => requestAnimationFrame(() => {
      import('html-to-image')
        .then(({ toPng }) => toPng(el, { backgroundColor: canvasColor, pixelRatio: 2, filter: hide }))
        .then((url) => { const a = document.createElement('a'); a.href = url; a.download = `${(title || 'board').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`; a.click() })
        .catch(() => showToast('Export failed'))
        .finally(() => setViewport(prevVp, { duration: 0 }))
    }))
  }, [wrapRef, canvasColor, title, showToast, fitView, getViewport, setViewport])

  const share = useCallback(() => {
    const url = `${window.location.origin}/?id=${boardId}`
    navigator.clipboard.writeText(url).then(() => showToast('Share link copied')).catch(() => showToast('Copy failed'))
  }, [boardId, showToast])

  return { exportPng, share }
}
