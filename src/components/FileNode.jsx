import { memo, useState } from 'react'
import { NodeHandles } from './nodeHandles.jsx'
import { Pin } from './Pin.jsx'
import { Icon } from './Icon.jsx'
import { KIND_COLOR, KIND_ICON, KIND_LABEL, prettySize, openAttachment } from '../lib/attach.js'

// A non-photo exhibit: a pasted link, a PDF, an audio or video file, a document.
// Drawn as a manila case-file docket pinned to the board - kraft paper, a coloured
// tab across the head, a stamped icon tile. Click the tile (or double-click the
// card) to open it in a new tab: links go to their URL, embedded files are handed
// to the browser as a blob so a PDF opens in the reader and audio in the player.
function FileNode({ data }) {
  const [hover, setHover] = useState(false)
  const kind = data.kind || 'file'
  const ink = KIND_COLOR[kind] || KIND_COLOR.file
  const name = data.label || data.name || KIND_LABEL[kind]
  const open = () => openAttachment(data)

  // Second line: the weight for an embedded file, the host for a link.
  let meta = ''
  if (data.size) meta = prettySize(data.size)
  else if (data.url) { try { meta = new URL(data.url).hostname.replace(/^www\./, '') } catch { meta = 'link' } }

  return (
    <div style={{ position: 'relative', width: '100%' }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <NodeHandles className="fx-handle-hidden" />
      <Pin size={17} color={data.pinColor || ink} />
      <div
        onDoubleClick={open}
        title={data.url || data.name || ''}
        style={{
          width: '100%', boxSizing: 'border-box', overflow: 'hidden',
          // Manila folder stock: warm kraft with a faint fibre gradient.
          background: 'linear-gradient(158deg, #fdf8ec 0%, #f6efdc 55%, #eee3c8 100%)',
          border: '1px solid rgba(60,42,18,.34)', borderRadius: 3,
          filter: hover ? 'drop-shadow(0 10px 18px rgba(0,0,0,.38))' : 'drop-shadow(0 6px 12px rgba(0,0,0,.3))',
          transform: hover ? 'translateY(-1.5px)' : 'none', transition: 'transform .13s ease, filter .13s ease',
        }}
      >
        {/* Head tab - the kind of exhibit, typed on the folder. */}
        <div className="mono" style={{
          background: ink, color: '#fff7e8', padding: '4px 9px 3.5px',
          fontSize: 9.5, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase',
          display: 'flex', justifyContent: 'space-between', gap: 8,
        }}>
          <span>{KIND_LABEL[kind] || 'File'}</span>
          {meta && <span style={{ opacity: .82, letterSpacing: '.08em' }}>{meta}</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 11px 12px' }}>
          {/* The icon IS the open button. */}
          <button
            className="nodrag" onClick={open} aria-label={`Open ${name} in a new tab`}
            style={{
              flexShrink: 0, width: 44, height: 44, display: 'grid', placeItems: 'center', cursor: 'pointer',
              background: hover ? ink : 'rgba(255,253,246,.72)',
              color: hover ? '#fff7e8' : ink,
              border: `1.5px solid ${ink}`, borderRadius: 2, padding: 0,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5)',
              transition: 'background .13s ease, color .13s ease',
            }}
          >
            <Icon name={hover ? 'external' : (KIND_ICON[kind] || 'file')} size={23} />
          </button>

          <div style={{ minWidth: 0, color: '#2a2113' }}>
            <div style={{
              fontSize: 13.5, fontWeight: 700, lineHeight: 1.22, wordBreak: 'break-word',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{name}</div>
            <div className="mono" style={{
              marginTop: 4, fontSize: 9.5, fontWeight: 700, letterSpacing: '.13em',
              textTransform: 'uppercase', color: hover ? ink : 'rgba(42,33,19,.55)',
            }}>Open in new tab</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(FileNode)
