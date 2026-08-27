import { useRef } from 'react'
import { useReactFlow } from '@xyflow/react'

// When you start editing a node's text, smoothly zoom in and center it so the
// text is big enough to read/type - then restore the exact previous view when you
// finish. Keeps you from losing your place on a zoomed-out board.
export function useEditZoom(id) {
  const { fitView, getViewport, setViewport } = useReactFlow()
  const prev = useRef(null)

  const focus = () => {
    prev.current = getViewport()
    fitView({ nodes: [{ id }], duration: 350, maxZoom: 1.8, padding: 0.55 })
  }
  const restore = () => {
    if (prev.current) { setViewport(prev.current, { duration: 350 }); prev.current = null }
  }
  return { focus, restore }
}
