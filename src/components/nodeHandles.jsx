import { Handle, Position } from '@xyflow/react'

// Four hover-revealed handles (one per side). connectionMode="loose" on the
// canvas lets any of them act as source OR target, so a single node can fan out
// to many others (1-to-many) or receive many - the whole point of Forensic.
const SIDES = [
  { position: Position.Top, id: 't' },
  { position: Position.Right, id: 'r' },
  { position: Position.Bottom, id: 'b' },
  { position: Position.Left, id: 'l' },
]

export function NodeHandles() {
  return SIDES.map((s) => (
    <Handle key={s.id} id={s.id} type="source" position={s.position} isConnectableStart isConnectableEnd />
  ))
}
