// Thin fetch wrappers for the boards API. Every call returns parsed JSON or
// throws on a non-2xx so callers can `.catch` into a toast.
async function j(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
