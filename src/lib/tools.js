// The board's add-tools, as plain data, shared by both ways in: the toolbar +
// and the bottom-left summon - both render the same CursorTools ring.
//
// The list is DERIVED from the node registry (one `tool` per type, in registry
// order), so a new type shows up in the ring by declaring it there and nowhere
// else.

export { REGISTRY_TOOLS as TOOL_ITEMS } from './nodeRegistry.js'
