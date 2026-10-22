import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hierarchy, tree as d3tree } from 'd3-hierarchy'
import { select } from 'd3-selection'
import 'd3-transition'
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom'
import { sameMove, sideName } from '../api'

const CELL = 11
const BOARD = CELL * 5
const NODE_W = BOARD + 8
const NODE_H = BOARD + 30
const GAP_X = 14
const GAP_Y = 48

const STATUS = {
  root: { label: 'Current position', fill: '#ffffff', text: 'The position the engine is thinking about. Every child is one legal move.' },
  explored: { label: 'Searched (intermediate)', fill: '#bcd3ef', text: 'Searched: its value is backed up from its children — MAX nodes take the highest child score, MIN nodes the lowest.' },
  leaf: { label: 'Evaluated leaf', fill: '#e2ebf6', text: 'Search depth reached (or the game ended): this position is scored by the heuristic evaluation function.' },
  pruned: { label: 'Pruned (α ≥ β)', fill: '#f3a9a9', text: 'Cut off by alpha-beta: a sibling already proved this branch cannot change the decision, so the engine backtracks without searching it.' },
  repeat: { label: 'Repeats a position', fill: '#ddd0f2', text: 'This position was already played. The side that repeats it is penalised, which stops the players shuffling back and forth forever.' },
  best: { label: 'Chosen line', fill: '#2f9a48', text: 'On the principal variation: the line the engine expects if both sides play their best.' },
}

const INF = 1000000

function fmt(v) {
  if (v === null || v === undefined) return '?'
  if (v >= INF) return '+∞'
  if (v <= -INF) return '−∞'
  if (v >= 9000) return `win (${v})`
  if (v <= -9000) return `loss (${v})`
  return String(v)
}

function walk(node, fn) {
  fn(node)
  node.children.forEach((c) => walk(c, fn))
}

function defaultOpen(root) {
  let count = 0
  walk(root, () => count++)
  if (count <= 160) {
    const open = new Set()
    walk(root, (n) => n.children.length && open.add(n.id))
    return open
  }
  // Large trees: show the root's options and the principal variation.
  return pvOpen(root)
}

function pvOpen(root) {
  const open = new Set([root.id])
  let n = root
  while (n && n.best >= 0 && n.children[n.best]) {
    n = n.children[n.best]
    if (n.children.length) open.add(n.id)
  }
  return open
}

function MiniBoard({ node }) {
  const fill = STATUS[node.status]?.fill || '#fff'
  const dark = node.status === 'best'
  const to = node.move?.to
  const from = node.move?.from
  const caps = new Set(node.captured || [])
  return (
    <g>
      {[...node.board].map((c, i) => {
        const x = (i % 5) * CELL
        const y = Math.floor(i / 5) * CELL
        return (
          <g key={i}>
            <rect x={x} y={y} width={CELL} height={CELL} fill={fill}
              stroke={dark ? '#1d5f2c' : '#7d8794'} strokeWidth={0.6} />
            {i === 12 && <path d={`M${x + 3} ${y + 3}l5 5m0 -5l-5 5`} stroke={dark ? '#d9f2df' : '#8d95a1'} strokeWidth={0.7} />}
            {(i === to || i === from) && (
              <rect x={x + 0.8} y={y + 0.8} width={CELL - 1.6} height={CELL - 1.6}
                fill="none" stroke="#f2b705" strokeWidth={1.6} strokeDasharray={i === from ? '2 1.5' : undefined} />
            )}
            {c !== 'e' && (
              <circle cx={x + CELL / 2} cy={y + CELL / 2} r={3.7}
                fill={c === 'w' ? '#ffffff' : '#1f1f24'} stroke={c === 'w' ? '#333' : '#000'} strokeWidth={0.8} />
            )}
            {c === 'e' && caps.has(i) && (
              <text x={x + CELL / 2} y={y + CELL / 2 + 3} textAnchor="middle" fontSize={9} fill="#c0392b" fontWeight="700">×</text>
            )}
          </g>
        )
      })}
      <rect width={BOARD} height={BOARD} fill="none" stroke={dark ? '#1d5f2c' : '#4a5563'} strokeWidth={1.2} />
    </g>
  )
}

export default function SearchTree({ data }) {
  const { tree, stats, side, by, label, played, playedLabel } = data
  const [open, setOpen] = useState(() => defaultOpen(tree))
  const [step, setStep] = useState(null)
  const svgRef = useRef(null)
  const gRef = useRef(null)
  const zoomRef = useRef(null)
  const userMoved = useRef(false)

  // The node the player actually chose (when reviewing a past move).
  const playedId = useMemo(
    () => (played ? tree.children.find((c) => sameMove(c.move, played))?.id : undefined),
    [tree, played],
  )
  const bestChild = tree.children[tree.best]
  const [selectedId, setSelectedId] = useState(playedId ?? bestChild?.id ?? tree.id)

  const byId = useMemo(() => {
    const m = new Map()
    walk(tree, (n) => m.set(n.id, n))
    return m
  }, [tree])
  const maxId = useMemo(() => Math.max(...byId.keys()), [byId])

  const layout = useMemo(() => {
    const h = hierarchy(tree, (d) =>
      open.has(d.id) ? d.children.filter((c) => step === null || c.id <= step) : null,
    )
    d3tree()
      .nodeSize([NODE_W + GAP_X, NODE_H + GAP_Y])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.25))(h)
    return h
  }, [tree, open, step])

  const nodes = layout.descendants()
  const links = layout.links()

  const apply = useCallback((t, animate) => {
    const sel = select(svgRef.current)
    if (animate) sel.transition().duration(450).call(zoomRef.current.transform, t)
    else sel.call(zoomRef.current.transform, t)
  }, [])

  // Show the whole tree.
  const fit = useCallback((animate = true) => {
    const svg = svgRef.current
    if (!svg || !zoomRef.current) return
    const { width, height } = svg.getBoundingClientRect()
    if (!width) return
    let x0 = Infinity, x1 = -Infinity, y1 = 0
    layout.each((n) => {
      x0 = Math.min(x0, n.x - NODE_W / 2)
      x1 = Math.max(x1, n.x + NODE_W / 2)
      y1 = Math.max(y1, n.y + NODE_H)
    })
    const k = Math.max(0.12, Math.min(1.4, width / (x1 - x0 + 40), height / (y1 + 40)))
    apply(zoomIdentity.translate(width / 2 - ((x0 + x1) / 2) * k, 20).scale(k), animate)
  }, [layout, apply])

  // Zoom onto the chosen move: the root and the selected child, readable size.
  const focusChosen = useCallback((animate = true) => {
    const svg = svgRef.current
    if (!svg || !zoomRef.current) return
    const { width, height } = svg.getBoundingClientRect()
    if (!width) return
    const target = layout.descendants().find((n) => n.data.id === (playedId ?? bestChild?.id)) || layout
    const k = Math.min(1.25, Math.max(0.85, (height - 40) / (layout.height * (NODE_H + GAP_Y) + NODE_H + 40)))
    const span = Math.abs(target.x - layout.x) * k
    const cx = span < width - 2 * NODE_W * k ? (target.x + layout.x) / 2 : target.x
    apply(zoomIdentity.translate(width / 2 - cx * k, 24).scale(k), animate)
  }, [layout, playedId, bestChild, apply])

  // Centre a node, keeping the current zoom (at least readable).
  const centreOn = useCallback((id) => {
    const svg = svgRef.current
    const n = layout.descendants().find((d) => d.data.id === id)
    if (!svg || !n) return
    const { width, height } = svg.getBoundingClientRect()
    const k = Math.max(0.85, zoomTransform(svg).k)
    apply(zoomIdentity.translate(width / 2 - n.x * k, height / 2 - (n.y + NODE_H / 2) * k).scale(k), true)
  }, [layout, apply])

  useEffect(() => {
    const z = zoom()
      .scaleExtent([0.08, 4])
      .on('zoom', (e) => {
        if (e.sourceEvent) userMoved.current = true
        gRef.current?.setAttribute('transform', e.transform)
      })
    zoomRef.current = z
    select(svgRef.current).call(z).on('dblclick.zoom', null)
  }, [])

  // Keep focused on the chosen move while the panel slides open or resizes,
  // until the user pans or zooms themselves.
  const focusRef = useRef(focusChosen)
  useEffect(() => {
    focusRef.current = focusChosen
  }, [focusChosen])
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (!userMoved.current) focusRef.current(false)
    })
    ro.observe(svgRef.current)
    return () => ro.disconnect()
  }, [])

  // Replay: reveal nodes in the order the search visited them.
  useEffect(() => {
    if (step === null || step >= maxId) return
    const t = setTimeout(() => setStep((s) => (s === null ? null : s + 1)), 90)
    return () => clearTimeout(t)
  }, [step, maxId])

  function clickNode(n) {
    setSelectedId(n.id)
    userMoved.current = true
    if (n.children.length) {
      setOpen((prev) => {
        const next = new Set(prev)
        if (next.has(n.id)) next.delete(n.id)
        else next.add(n.id)
        return next
      })
    }
    // Centre after the layout has updated.
    requestAnimationFrame(() => centreOnRef.current(n.id))
  }
  const centreOnRef = useRef(centreOn)
  useEffect(() => {
    centreOnRef.current = centreOn
  }, [centreOn])

  function expandAll() {
    const all = new Set()
    walk(tree, (n) => n.children.length && all.add(n.id))
    setOpen(all)
  }

  function replay() {
    expandAll()
    setStep(0)
    userMoved.current = true
    requestAnimationFrame(() => fit())
  }

  const sel = byId.get(selectedId) || tree
  const rootPlayer = sideName(side)
  const title = by === 'review'
    ? <>Engine's view before {rootPlayer} played <b>{playedLabel}</b>: it preferred <b>{label}</b></>
    : by === 'hint'
      ? <>Hint search for {rootPlayer} — suggests <b>{label}</b></>
      : <>AI search for {rootPlayer} — chose <b>{label}</b></>

  return (
    <div className="tree-panel">
      <div className="tree-head">
        <div>
          <div className="tree-title">{title}</div>
          <div className="stats">
            <span><b>{stats.nodes}</b> nodes searched</span>
            <span><b>{stats.leaves}</b> leaves evaluated</span>
            <span><b>{stats.pruned}</b> branches pruned</span>
            <span>depth <b>{stats.depth}</b> (drawn: {stats.show_depth})</span>
            <span><b>{stats.time_ms}</b> ms</span>
          </div>
        </div>
        <div className="tree-buttons">
          <button onClick={() => { userMoved.current = false; focusChosen() }}>◎ Chosen move</button>
          <button onClick={() => fit()}>Whole tree</button>
          <button onClick={replay} disabled={step !== null && step < maxId}>▶ Replay search</button>
          {step !== null && <button onClick={() => setStep(null)}>Show all</button>}
          <button onClick={expandAll}>Expand all</button>
          <button onClick={() => setOpen(pvOpen(tree))}>Collapse</button>
        </div>
      </div>

      <div className="tree-body">
        <svg ref={svgRef} className="tree-svg">
          <g ref={gRef}>
            {links.map((l) => {
              const st = l.target.data.status
              const best = st === 'best'
              return (
                <line key={`${l.source.data.id}-${l.target.data.id}`}
                  x1={l.source.x} y1={l.source.y + BOARD + 26}
                  x2={l.target.x} y2={l.target.y - 2}
                  stroke={best ? '#2f9a48' : st === 'pruned' ? '#d98b8b' : st === 'repeat' ? '#a58bd0' : '#2b2f36'}
                  strokeWidth={best ? 3 : 1.3}
                  strokeDasharray={st === 'pruned' || st === 'repeat' ? '4 3' : undefined} />
              )
            })}
            {nodes.map((n) => {
              const d = n.data
              const hidden = d.children.length && !open.has(d.id)
              const below = !d.children.length && d.subtree > 1
              const isSel = d.id === selectedId
              const isPlayed = d.id === playedId
              return (
                <g key={d.id} transform={`translate(${n.x - BOARD / 2},${n.y})`}
                  className="tnode" onClick={() => clickNode(d)}>
                  {isPlayed && <rect x={-7} y={-7} width={BOARD + 14} height={NODE_H + 8} rx={8}
                    fill="none" stroke="#e0762f" strokeWidth={2} strokeDasharray="5 3" />}
                  {isSel && <rect x={-4} y={-4} width={BOARD + 8} height={NODE_H + 2} rx={6}
                    fill="none" stroke="#3b6ef5" strokeWidth={2.5} />}
                  <MiniBoard node={d} />
                  <text x={BOARD / 2} y={BOARD + 11} textAnchor="middle" className="tlabel">{d.label}</text>
                  <text x={BOARD / 2} y={BOARD + 22} textAnchor="middle" className="tscore">
                    {d.status === 'pruned' ? 'cut' : d.status === 'repeat' ? `repeat ${fmt(d.score)}` : fmt(d.score)}
                  </text>
                  {isPlayed && <text x={BOARD / 2} y={-11} textAnchor="middle" className="tplayed">played</text>}
                  {(hidden || below) ? (
                    <g transform={`translate(${BOARD - 6},-6)`}>
                      <rect width={hidden ? 24 : 30} height={12} rx={6} fill={hidden ? '#2b2f36' : '#8a94a3'} />
                      <text x={hidden ? 12 : 15} y={9} textAnchor="middle" className="tbadge">
                        {hidden ? `+${d.children.length}` : `${d.subtree - 1}…`}
                      </text>
                    </g>
                  ) : null}
                </g>
              )
            })}
          </g>
        </svg>

        <div className="legend">
          {Object.entries(STATUS).map(([k, v]) => (
            <div key={k} className="legend-row">
              <span className="swatch" style={{ background: v.fill }} />{v.label}
            </div>
          ))}
          {played && (
            <div className="legend-row"><span className="swatch played" />Move actually played</div>
          )}
          <div className="legend-note">Scores are from {rootPlayer}'s point of view. Scroll to zoom, drag to pan, click a node to centre and expand it.</div>
        </div>
      </div>

      <div className="node-detail">
        <div className="detail-main">
          <span className="swatch big" style={{ background: STATUS[sel.status]?.fill }} />
          <div>
            <div><b>{sel.status === 'root' ? 'Root position' : `Move ${sel.label}`}</b> · ply {sel.ply} · {STATUS[sel.status]?.label}</div>
            <div className="muted">{STATUS[sel.status]?.text}</div>
          </div>
        </div>
        <div className="detail-grid">
          <span>To move</span><b>{sideName(sel.turn)}{sel.max === null ? '' : sel.max ? ' (MAX)' : ' (MIN)'}</b>
          <span>α / β</span><b>{fmt(sel.alpha)} / {fmt(sel.beta)}</b>
          <span>Value</span><b>{sel.status === 'pruned' ? 'not searched' : fmt(sel.score)}</b>
          <span>Positions below</span><b>{Math.max(0, sel.subtree - 1)}</b>
        </div>
        {sel.status === 'pruned' && (
          <div className="muted">
            Here α = {fmt(sel.alpha)} ≥ β = {fmt(sel.beta)}: the side choosing at the parent already has a result
            the opponent will never allow, so this move is skipped. Skipping it is the backtracking saving.
          </div>
        )}
      </div>
    </div>
  )
}
