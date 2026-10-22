async function post(path, body = {}) {
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    throw new Error(detail || `Request failed (${res.status})`)
  }
  return data
}

// `history` lists the positions already played (board + side to move) so the
// engine can avoid, and the rules can detect, repeated positions.
export const newGame = () => post('new')
export const play = (state, move, history = []) => post('play', { state, move, history })
export const aiMove = (state, depth, showDepth, history = []) =>
  post('ai', { state, depth, show_depth: showDepth, history })
export const hint = (state, depth, showDepth, history = []) =>
  post('hint', { state, depth, show_depth: showDepth, history })
export const analyze = (state, move, depth, history = []) =>
  post('analyze', { state, move, depth, history })

export const positionKey = (state) => state.board + state.turn

export const squareName = (i) => 'abcde'[i % 5] + (5 - Math.floor(i / 5))
export const sideName = (s) => (s === 'w' ? 'White' : 'Black')

export function moveSquares(move) {
  if (!move) return []
  if (move.type === 'drop') return [move.to]
  if (move.type === 'move') return [move.from, move.to]
  return []
}

export function sameMove(a, b) {
  return !!a && !!b && a.type === b.type && a.to === b.to && a.from === b.from
}
