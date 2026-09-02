// Note card tints (warm paper, a danger red, then soft pastels).
export const NOTE_TINTS = ['#fef3c7', '#fca5a5', '#dbeafe', '#dcfce7', '#fce7f3', '#e0e7ff', '#f3f0e8']

// Bright, distinct paper colors for the text quick-note - white + saturated hues
// (no washed-out pastels), a proper vivid yellow. Dark ink stays readable on all.
export const BRIGHT_TINTS = ['#ffffff', '#ffe600', '#ff9500', '#ff3b30', '#ff2d95', '#a259ff', '#0a84ff', '#30d158']

// Pushpin colors (glossy dome tints).
export const PIN_COLORS = ['#ff3b30', '#2f6fed', '#22c55e', '#f5a623', '#a45cff', '#111827']

// Evidence stamps - the imprint text and the four ink colors (black/red/green/blue).
export const STAMP_LABELS = ['APPROVED', 'CONFIDENTIAL', 'SECRET', 'TOP SECRET', 'HIDDEN', 'CLASSIFIED', 'PROJECT+', 'PROGRESS', 'BLOCKED']
export const STAMP_COLORS = ['#1a1a1a', '#d0342c', '#1f9d55', '#2563eb']

// Numbered evidence markers - crime-scene badge colors (maroon default).
export const MARKER_COLORS = ['#8b1e3f', '#b23a2e', '#1f5c8b', '#2f7d4f', '#1a1a1a', '#b8860b']

// Wax seal colors - deep sealing-wax reds plus a few classic tints.
export const WAX_COLORS = ['#8b1e3f', '#7a1220', '#a02c2c', '#5b3a1a', '#1f3a5c', '#2f5d3f']

// Crosshair reticle colors - red / white / black / amber.
export const CROSSHAIR_COLORS = ['#e5231b', '#ffffff', '#111111', '#f5c518']

// Red thread first, then alternates for edges.
export const THREAD_COLORS = ['#e5231b', '#111827', '#2f6fed', '#22c55e', '#f5a623', '#e7e0cf']

// Paper styles for a note.
export const PAPER_TYPES = [
  { key: 'torn', label: 'Rip' },
  { key: 'clean', label: 'Paper' },
  { key: 'sticky', label: 'Sticky' },
]

// Default names cycled onto new profile chips (no photo - initials on a color).
export const PROFILE_NAMES = ['Eric', 'Miguel', 'Rod', 'Philippe', 'Nadia', 'Sasha', 'Priya', 'Deon']
// Distinct avatar colors (kept to 7 so the swatches fit one row in the inspector).
export const PROFILE_COLORS = ['#2f6fed', '#e5231b', '#22c55e', '#a45cff', '#f5a623', '#0ea5e9', '#db2777']
// Sticker emojis (rendered on a white bordered chip).
export const STICKER_EMOJIS = ['⭐', '🔥', '❗', '✅', '❓', '💡', '📌', '🚩', '👀', '💰', '⚠️', '🎯']
// Soft tints for grouping containers (translucent panels behind other objects).
export const CONTAINER_TINTS = ['#e5231b', '#2f6fed', '#22c55e', '#f5a623', '#a45cff', '#6b7280']
