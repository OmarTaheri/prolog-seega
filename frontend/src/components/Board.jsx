import { useEffect, useMemo, useState } from 'react'
import { squareName } from '../api'

let pieceSeq = 0

// Match the new board against the pieces on screen so each piece keeps its
// identity: a slid piece keeps its id (and animates), new pieces drop in,
// pieces that disappeared are kept briefly as "dying" to fade out.
function reconcile(prev, board, move) {
  const alive = prev.filter((p) => !p.dying)
  const bySq = new Map(alive.map((p) => [p.sq, p]))
  const used = new Set()
  const out = []
  for (let i = 0; i < 25; i++) {
    const c = board[i]
    if (c === 'e') continue
    let p = null
    if (move?.type === 'move' && move.to === i) {
      const q = bySq.get(move.from)
      if (q && q.side === c && board[move.from] === 'e') p = q
    }
    if (!p) {
      const q = bySq.get(i)
      if (q && q.side === c && !used.has(q.id)) p = q
    }
    if (p && !used.has(p.id)) {
      used.add(p.id)
      out.push({ ...p, sq: i, isNew: false })
    } else {
      out.push({ id: ++pieceSeq, side: c, sq: i, isNew: prev.length > 0 })
    }
  }
  for (const p of alive) if (!used.has(p.id)) out.push({ ...p, dying: true })
  return out
}

export default function Board({
  state, legal, canAct, onMove, lastMove, fresh, hint, flipped,
  theme, showCoords, showLegal, animMs, size, overlay,
}) {
  const [picked, setPicked] = useState(null)
  const [pcs, setPcs] = useState({ board: null, list: [] })

  // Derive piece layout from the board during render (no flash of stale pieces).
  if (pcs.board !== state.board) {
    setPcs({ board: state.board, list: reconcile(pcs.list, state.board, fresh ? lastMove?.move : null) })
    setPicked(null)
  }

  const hasDying = pcs.list.some((p) => p.dying)
  useEffect(() => {
    if (!hasDying) return
    const t = setTimeout(
      () => setPcs((s) => ({ ...s, list: s.list.filter((p) => !p.dying) })),
      animMs + 450,
    )
    return () => clearTimeout(t)
  }, [hasDying, animMs])

  const { drops, slides } = useMemo(() => {
    const drops = new Set()
    const slides = new Map()
    for (const m of legal || []) {
      if (m.type === 'drop') drops.add(m.to)
      if (m.type === 'move') {
        if (!slides.has(m.from)) slides.set(m.from, [])
        slides.get(m.from).push(m.to)
      }
    }
    return { drops, slides }
  }, [legal])

  const selected = state.chain ?? picked
  const targets = new Set(canAct && selected != null ? slides.get(selected) || [] : [])
  const captured = new Set(fresh ? lastMove?.captured || [] : [])
  const lm = lastMove?.move
  const vis = (i) => (flipped ? 24 - i : i)

  function click(i) {
    if (!canAct) return
    if (state.phase === 'drop') {
      if (drops.has(i)) onMove({ type: 'drop', to: i })
      return
    }
    if (targets.has(i)) {
      onMove({ type: 'move', from: selected, to: i })
      return
    }
    if (state.chain == null && slides.has(i)) setPicked(i === picked ? null : i)
  }


  // The rim of the board carries the coordinates; the playing grid sits inside it.
  const rim = Math.round(size * 0.055)
  const inner = size - 2 * rim
  const cell = inner / 5

  const squares = []
  for (let v = 0; v < 25; v++) {
    const i = flipped ? 24 - v : v
    const cls = ['sq']
    if (i === 12) cls.push('centre')
    const isTarget = canAct && ((state.phase === 'drop' && drops.has(i)) || targets.has(i))
    if (isTarget) cls.push('target')
    if (isTarget && showLegal) cls.push(state.phase === 'drop' ? 'hover-dot' : 'show-dot')
    if (canAct && state.phase === 'move' && slides.has(i)) cls.push('movable')
    if (i === selected) cls.push('selected')
    if (lm && (i === lm.from || i === lm.to)) cls.push('last')
    if (hint && (i === hint.from || i === hint.to)) cls.push('hint')
    squares.push(
      <button key={i} className={cls.join(' ')} onClick={() => click(i)}
        aria-label={`${squareName(i)} ${state.board[i] === 'e' ? 'empty' : state.board[i] === 'w' ? 'white' : 'black'}`}>
        <span className="cell" />
        {i === 12 && (
          <svg className="centre-mark" viewBox="0 0 100 100" aria-hidden="true">
            <path d="M22 22 78 78M78 22 22 78" />
            <circle cx="50" cy="50" r="17" />
          </svg>
        )}
        {captured.has(i) && <span className="cap-mark" key={`${state.board}-${i}`}>×</span>}
      </button>,
    )
  }

  const files = 'abcde'.split('')
  const ranks = [5, 4, 3, 2, 1]
  if (flipped) {
    files.reverse()
    ranks.reverse()
  }

  return (
    <div className={`board theme-${theme}`}
      style={{ width: size, height: size, padding: rim, '--move-ms': `${animMs}ms`, '--cell': `${cell}px` }}>
      {showCoords && (
        <div className="coords" aria-hidden="true">
          {files.map((f, k) => (
            <span key={f} className="file" style={{ left: rim + cell * (k + 0.5), top: size - rim / 2 }}>{f}</span>
          ))}
          {ranks.map((r, k) => (
            <span key={r} className="rank" style={{ top: rim + cell * (k + 0.5), left: rim / 2 }}>{r}</span>
          ))}
        </div>
      )}
      <div className="board-inner">
        <div className="grid">{squares}</div>
        <div className="pieces">
          {pcs.list.map((p) => {
            const v = vis(p.sq)
            const cls = ['pc', p.side, `v${p.id % 4}`]
            if (p.isNew && !p.dying) cls.push('enter')
            if (p.dying) cls.push('dying')
            if (lm?.to === p.sq && !p.dying) cls.push('moving')
            if (p.sq === selected && !p.dying) cls.push('lifted')
            return (
              <div key={p.id} className={cls.join(' ')}
                style={{ transform: `translate(${(v % 5) * 100}%, ${Math.floor(v / 5) * 100}%)` }}>
                <span className="disc" />
              </div>
            )
          })}
        </div>
        {overlay}
      </div>
    </div>
  )
}