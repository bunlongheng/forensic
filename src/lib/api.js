// Thin fetch wrappers for the boards API. Every call returns parsed JSON or
// throws on a non-2xx so callers can `.catch` into a toast.
async function j(res) {
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}
const JSON_HEADERS = { 'Content-Type': 'application/json' }

export const listBoards = () => fetch('/api/boards').then(j)
export const getBoard = (id) => fetch(`/api/boards/${id}`).then(j)
export const createBoard = (body) =>
  fetch('/api/boards', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }).then(j)
export const updateBoard = (id, body) =>
  fetch(`/api/boards/${id}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(body) }).then(j)
export const deleteBoard = (id) =>
  fetch(`/api/boards/${id}`, { method: 'DELETE' }).then(j)
// Upload ONE image and get back the URL a node stores instead of the bytes.
// Its own request on purpose: a board with 50 photos never builds a single body
// big enough for Vercel to reject (it caps a function request at 4.5 MB).
export const uploadImage = (src) =>
  fetch('/api/images', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ src }) }).then(j)

export const listTrash = () => fetch('/api/boards?trash=1').then(j)
export const restoreBoard = (id) =>
  fetch(`/api/boards/${id}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ restore: true }) }).then(j)
export const purgeBoard = (id) =>
  fetch(`/api/boards/${id}?purge=1`, { method: 'DELETE' }).then(j)
