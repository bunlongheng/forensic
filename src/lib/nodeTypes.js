// React Flow's nodeTypes map - the ONLY src/lib module that imports renderers.
//
// It used to live in nodeRegistry.js, which meant the pure graph layer
// (boardGraph.js, the persistence/clipboard/snap hooks and their tests) dragged
// 15 JSX components in behind it. The registry stays pure data; this file is
// the one seam where the type keys meet their components, and only Board.jsx
// imports it.
//
// Keys are built FROM the registry, in registry order, so a new type cannot
// render without being declared there first (nodeTypes.test.js is the guard).
import { NODE_REGISTRY } from './nodeRegistry.js'
import ImageNode from '../components/ImageNode.jsx'
import NoteNode from '../components/NoteNode.jsx'
import TextNode from '../components/TextNode.jsx'
import ProfileNode from '../components/ProfileNode.jsx'
import StickerNode from '../components/StickerNode.jsx'
import ContainerNode from '../components/ContainerNode.jsx'
import AnnotationNode from '../components/AnnotationNode.jsx'
import DrawingNode from '../components/DrawingNode.jsx'
import CalloutNode from '../components/CalloutNode.jsx'
import ClipNode from '../components/ClipNode.jsx'
import StampNode from '../components/StampNode.jsx'
import RedactionNode from '../components/RedactionNode.jsx'
import CrosshairNode from '../components/CrosshairNode.jsx'
import WaxSealNode from '../components/WaxSealNode.jsx'
import FileNode from '../components/FileNode.jsx'

const COMPONENTS = {
  clip: ClipNode,
  note: NoteNode,
  text: TextNode,
  callout: CalloutNode,
  annotation: AnnotationNode,
  profile: ProfileNode,
  stamp: StampNode,
  wax: WaxSealNode,
  redaction: RedactionNode,
  crosshair: CrosshairNode,
  drawing: DrawingNode,
  container: ContainerNode,
  sticker: StickerNode,
  image: ImageNode,
  file: FileNode,
}

// Module-level so the object identity is stable across renders.
export const NODE_TYPES = Object.fromEntries(
  Object.keys(NODE_REGISTRY).map((type) => [type, COMPONENTS[type]]),
)
