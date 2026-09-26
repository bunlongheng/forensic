import { useCallback, useEffect, useRef, useState } from 'react'
import { fileToImage, isImageFile } from '../lib/image.js'
import { uploadImage } from '../lib/api.js'
import { fileToAttachment, parseLink, ATTACH_MAX, prettySize } from '../lib/attach.js'
import { addNode, uid } from '../lib/boardGraph.js'
import { RING_SAFE } from '../components/CursorTools.jsx'
import {
  IMAGE_MAX, CASCADE_PX, DOUBLE_TAP_MS, DROP_DEBOUNCE_MS, FILE_CARD_W,
  VIEWPORT_FALLBACK_W, VIEWPORT_FALLBACK_H,
} from '../lib/constants.js'

// Everything that puts something NEW on the board: dropped/pasted/picked files,
// dragged links, the tool ring, and double-tap-to-note. Lifted out of Board.jsx
// whole - same handlers, same dependencies - so the view is wiring and JSX.

// An exhibit pins exactly where you pasted it - unless another one is already
// sitting on that spot, in which case it steps down the page (a card is ~96px
// tall) so the one underneath keeps its Open button. That covers both a second
// paste at the same point and several files arriving in one paste. Capped, so a
// pile never walks off the board.
const EXHIBIT_STEP = 108
function freeSpot(at, nds) {
  const p = { ...at }
  for (let i = 0; i < 6; i++) {
    const taken = nds.some((n) => n.type === 'file' && !n.parentId
      && Math.abs(n.position.x - p.x) < 8 && Math.abs(n.position.y - p.y) < 8)
    if (!taken) break
    p.x += 24
    p.y += EXHIBIT_STEP
  }
  return p
}

export function useAddContent({ canEdit, readOnly, setNodes, showToast, screenToFlowPosition, wrapRef, fabRef, fileRef }) {
  const cursorRef = useRef(null) // last pointer position, screen coords (null until the mouse moves)

  const addImageFiles = useCallback(async (files, at) => {
    const imgs = [...files].filter(isImageFile)
    if (!imgs.length) return
    let i = 0
    for (const file of imgs) {
      try {
        // Only an oversized GIF reports progress - it is being re-encoded in a worker.
        // Each toast call restarts the auto-hide, so the message stays up until done.
        const onProgress = (p) => showToast(`Shrinking ${file.name}${p.passes > 1 && p.pass > 1 ? ` - pass ${p.pass}` : ''} - ${p.pct}%`)
        const { src, width, height } = await fileToImage(file, onProgress)
        // The bytes go to their own row and the node keeps a URL. Inline base64
        // is what put a hard ~4 MB ceiling on a whole board and made every
        // autosave re-send every photo on it.
        //
        // If the upload fails - offline, signed out, a 413 - fall back to the
        // inline data URL. A photo that saves the old way beats a photo that
        // never lands, and the board renders either shape identically.
        let stored = src
        try {
          const up = await uploadImage(src)
          if (up?.url) stored = up.url
        } catch { /* keep the data URL; a node's src is just a string */ }
        const w = FILE_CARD_W, h = Math.max(60, Math.round((FILE_CARD_W * height) / width))
        const pos = { x: at.x + i * CASCADE_PX, y: at.y + i * CASCADE_PX }
        setNodes((nds) => nds.concat({
          id: uid('img'), type: 'image', position: pos,
          style: { width: w, height: h },
          data: { src: stored, editable: true },
        }))
        i++
      } catch (err) {
        showToast(err?.code === 'too-large'
          ? `${file.name} is still over ${prettySize(IMAGE_MAX)} after shrinking - pin a link to it instead`
          : err?.code === 'no-shrink'
            ? `${file.name} is over ${prettySize(IMAGE_MAX)} and this browser cannot shrink GIFs - use Chrome, or pin a link`
            : 'Could not read an image')
      }
    }
    if (i) showToast(`Pinned ${i} image${i > 1 ? 's' : ''}`)
  }, [setNodes, showToast])

  // Everything that is NOT a photo - a PDF, an audio or video file, a document -
  // becomes one exhibit card you click to open. The bytes ride in the board JSON,
  // so an oversized file is refused up front with the reason, not a failed save.
  const addAttachFiles = useCallback(async (files, at) => {
    let i = 0
    for (const file of files) {
      try {
        const data = await fileToAttachment(file)
        setNodes((nds) => nds.concat({
          id: uid('file'), type: 'file', position: freeSpot(at, nds), style: { width: FILE_CARD_W },
          data: { ...data, editable: true },
        }))
        i++
      } catch (err) {
        showToast(err?.code === 'too-large'
          ? `${file.name} is over ${prettySize(ATTACH_MAX)} - pin a link to it instead`
          : `Could not read ${file.name}`)
      }
    }
    if (i) showToast(`Pinned ${i} file${i > 1 ? 's' : ''}`)
  }, [setNodes, showToast])

  // One entry point for dropped/pasted/picked files: photos pin as photos,
  // everything else pins as an exhibit card.
  const addFiles = useCallback((files, at) => {
    const list = [...files]
    const imgs = list.filter(isImageFile)
    const rest = list.filter((f) => !isImageFile(f))
    if (imgs.length) addImageFiles(imgs, at)
    if (rest.length) addAttachFiles(rest, imgs.length ? { x: at.x + 40, y: at.y + 40 } : at)
  }, [addImageFiles, addAttachFiles])

  // A pasted (or dragged) URL lands as a link card - click its icon to open it.
  const addLink = useCallback((link, at) => {
    setNodes((nds) => nds.concat({
      id: uid('file'), type: 'file', position: freeSpot(at, nds), style: { width: FILE_CARD_W },
      data: { ...link, editable: true },
    }))
    showToast('Pinned a link')
  }, [setNodes, showToast])

  const addNodeOfType = useCallback((type, at, extra, exact) => setNodes((nds) => addNode(nds, type, at, extra, exact)), [setNodes])

  const centerPos = useCallback(() => {
    const r = wrapRef.current?.getBoundingClientRect()
    return screenToFlowPosition({
      x: (r?.left || 0) + (r?.width || VIEWPORT_FALLBACK_W) / 2,
      y: (r?.top || 0) + (r?.height || VIEWPORT_FALLBACK_H) / 2,
    })
  }, [screenToFlowPosition, wrapRef])

  // Where a paste lands: on the pointer, so what you paste appears where you are
  // looking. Falls back to the middle of the view when the mouse has not moved
  // yet, has left the canvas, or is parked over the chrome (toolbar, inspector,
  // minimap) - dropping a card under a panel would look like nothing happened.
  const pastePos = useCallback(() => {
    const c = cursorRef.current
    const r = wrapRef.current?.getBoundingClientRect()
    const inside = c && r && c.x >= r.left && c.x <= r.right && c.y >= r.top && c.y <= r.bottom
    if (!inside) return centerPos()
    if (document.elementFromPoint(c.x, c.y)?.closest('.fx-noexport')) return centerPos()
    return screenToFlowPosition(c)
  }, [centerPos, screenToFlowPosition, wrapRef])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    if (!canEdit) {
      if (readOnly) showToast(readOnly === 'auth' ? 'Sign in to edit this board' : 'Read-only on this device')
      return
    }
    const at = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    if (e.dataTransfer.files?.length) { addFiles(e.dataTransfer.files, at); return }
    // A link dragged in from another tab/app.
    const link = parseLink(e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text'))
    if (link) addLink(link, at)
  }, [canEdit, readOnly, showToast, screenToFlowPosition, addFiles, addLink])

  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }, [])

  // DOUBLE-click/tap empty canvas to drop a note, already open for typing, exactly
  // where you tapped. Two paths on purpose, both funnelling through dropNote,
  // which de-dupes so they can never both add:
  //  - MOUSE: the real dblclick. React Flow runs selectionOnDrag and intermittently
  //    swallows one of the two pane clicks, so tap-counting alone dropped roughly
  //    one double-click in three. Listened for on the CAPTURE phase: d3-zoom stops
  //    the event propagating, so a plain bubbling onDoubleClick never sees it.
  //  - TOUCH: tap counting, because dblclick and e.detail are both unreliable there.
  const paneTaps = useRef([])
  const lastDrop = useRef(-Infinity)
  const dropNote = useCallback((clientX, clientY, t) => {
    if (!canEdit || t - lastDrop.current < DROP_DEBOUNCE_MS) return
    lastDrop.current = t
    paneTaps.current = []
    addNodeOfType('clip', screenToFlowPosition({ x: clientX, y: clientY }), { autoEdit: true }, true)
  }, [canEdit, addNodeOfType, screenToFlowPosition])

  const onPaneClick = useCallback((e) => {
    if (!canEdit) return
    const t = e.timeStamp
    paneTaps.current = paneTaps.current.filter((x) => t - x < DOUBLE_TAP_MS)
    paneTaps.current.push(t)
    if (paneTaps.current.length >= 2) dropNote(e.clientX, e.clientY, t)
  }, [canEdit, dropNote])

  // Only the bare canvas: a dblclick on a node is that node's own business.
  const onPaneDoubleClick = useCallback((e) => {
    if (!e.target?.classList?.contains('react-flow__pane')) return
    dropNote(e.clientX, e.clientY, e.timeStamp)
  }, [dropNote])

  // ─── Tool ring ────────────────────────────────────────────────────────────
  // Opened by the toolbar + or the corner +, never by a held key. The hold-CMD
  // summon was removed: its dwell timer raced CMD-drag line-up and every CMD
  // shortcut, so the ring bloomed when nobody asked for it. CMD on the canvas
  // now means nothing; CMD on a node still means line up.
  const [ring, setRing] = useState(null) // {x,y} in screen coords, or null
  const summonRef = useRef(0)            // bumped per summon so the ring remounts
  // The pointer is tracked for one reason: a paste lands ON THE CURSOR.
  useEffect(() => {
    if (!canEdit) return
    const track = (e) => { cursorRef.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('pointermove', track)
    return () => window.removeEventListener('pointermove', track)
  }, [canEdit])

  // Drop the picked tool on the exact spot the ring's crosshair marked.
  const pickRingTool = useCallback((it) => {
    const at = screenToFlowPosition(ring)
    // Do NOT clear `ring` here - the ring plays its own retract and calls
    // onClose when the sweep lands. Nulling it here unmounted it mid-animation.
    if (it.action === 'image' || it.key === 'image') { fileRef.current?.click(); return }
    addNodeOfType(it.key, at, it.extra, true)
  }, [ring, screenToFlowPosition, addNodeOfType, fileRef])

  // The toolbar's + summons the ring over the middle of the canvas, so the
  // pointer path is short and there is only ever ONE tool UI to learn.
  const closeRing = useCallback(() => setRing(null), [])
  // Every summon lands here, clamped so no tool ends up off-screen.
  const openRingAt = useCallback((x, y) => {
    const clamp = (v, max) => Math.min(Math.max(v, RING_SAFE), max - RING_SAFE)
    setRing({ x: clamp(x, window.innerWidth), y: clamp(y, window.innerHeight), n: ++summonRef.current })
  }, [])
  const openRingAtCenter = useCallback(() => {
    const r = wrapRef.current?.getBoundingClientRect()
    openRingAt(
      (r?.left || 0) + (r?.width || VIEWPORT_FALLBACK_W) / 2,
      (r?.top || 0) + (r?.height || VIEWPORT_FALLBACK_H) / 2,
    )
  }, [openRingAt, wrapRef])
  // The bottom-left summon blooms the ring over itself, so the tools appear
  // under the thumb that asked for them.
  const openRingAtFab = useCallback(() => {
    const r = fabRef.current?.getBoundingClientRect()
    if (!r) return openRingAtCenter()
    openRingAt(r.left + r.width / 2, r.top + r.height / 2)
  }, [openRingAt, openRingAtCenter, fabRef])

  return {
    addFiles, addLink, addNodeOfType, centerPos, pastePos,
    onDrop, onDragOver, onPaneClick, onPaneDoubleClick,
    ring, pickRingTool, closeRing, openRingAtCenter, openRingAtFab,
  }
}
