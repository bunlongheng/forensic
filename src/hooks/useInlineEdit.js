import { useEffect, useRef, useState } from 'react'
import { useEditZoom } from '../lib/useEditZoom.js'

// Shared inline-edit state behind every text-editable node (NoteNode, TextNode,
// CalloutNode, ClipNode, ContainerNode, ProfileNode, ImageNode): a draft buffer,
// the focus(+select)-on-open effect, and the zoom-in/zoom-out around an edit.
// Each node still owns its own markup (textarea vs input, field name, what
// commit actually writes) - it wires startEdit()/commit()/cancel() into its
// own onDoubleClick/onKeyDown.
//
// React Flow focuses its own node wrapper (.react-flow__node), not anything a
// node renders inside it, so Enter-to-edit on a focused-but-not-editing node
// has to be caught on that wrapper directly - found via rootRef, which every
// node puts on its own outermost element.
export function useInlineEdit(id, initialValue, onCommit, { editable = true, select = true } = {}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialValue || '')
  const ref = useRef(null)
  const rootRef = useRef(null)
  const { focus, restore } = useEditZoom(id)

  // Mirrored into refs (in an effect, not during render) so the wrapper
  // keydown listener below - attached once - always reads the latest values.
  const editingRef = useRef(editing)
  const editableRef = useRef(editable)
  useEffect(() => { editingRef.current = editing })
  useEffect(() => { editableRef.current = editable })

  useEffect(() => {
    if (editing) { ref.current?.focus(); if (select) ref.current?.select() }
  }, [editing, select])

  function startEdit(value = initialValue) {
    setDraft(value || '')
    setEditing(true)
    focus()
  }
  const startEditRef = useRef(startEdit)
  useEffect(() => { startEditRef.current = startEdit })

  function commit() {
    setEditing(false)
    onCommit(draft)
    restore()
  }
  function cancel() {
    setEditing(false)
    restore()
  }

  // Enter opens edit mode on a focused node (Escape leaving it is handled
  // locally, on the field itself, once editing is open).
  useEffect(() => {
    const wrapper = rootRef.current?.closest('.react-flow__node')
    if (!wrapper) return
    const onKeyDown = (e) => {
      if (e.key !== 'Enter' || editingRef.current || !editableRef.current) return
      e.preventDefault()
      startEditRef.current()
    }
    wrapper.addEventListener('keydown', onKeyDown)
    return () => wrapper.removeEventListener('keydown', onKeyDown)
  }, [])

  return { editing, draft, setDraft, ref, rootRef, startEdit, commit, cancel }
}
