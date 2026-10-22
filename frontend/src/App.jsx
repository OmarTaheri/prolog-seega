import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as api from './api'
import { positionKey, sideName } from './api'
import Board from './components/Board'
import CoachPanel from './components/CoachPanel'
import SearchTree from './components/SearchTree'
import { InfoPanel, LEVELS, MovesPanel, SettingsPanel, StatsPanel } from './components/Panels'
import {
  IconArrowLeft, IconBulb, IconCoach, IconFlip, IconGame, IconInfo, IconMoves, IconMute,
  IconNew, IconNext, IconPause, IconPlay, IconPrev, IconSettings, IconStats, IconStop,
  IconTree, IconVolume,
} from './icons'
import { playMoveSound } from './sound'
import './App.css'

const DEFAULTS = {
  mode: 'hvai', humanSide: 'w', depth: 3, showDepth: 3, coach: true,
  anim: 'normal', theme: 'sandstone', sound: true, coords: true, showLegal: true,
}
const THEMES = ['sandstone', 'acacia', 'basalt']
const ANIM_MS = { off: 0, fast: 160, normal: 300, slow: 560 }

const PANELS = [
  { id: 'tree', label: 'Tree', title: 'Search tree', Icon: IconTree, wide: true },
  { id: 'coach', label: 'Coach', title: 'Coach', Icon: IconCoach },
  { id: 'moves', label: 'Moves', title: 'Moves', Icon: IconMoves },
  { id: 'stats', label: 'Stat.', title: 'Statistics', Icon: IconStats },
  { id: 'info', label: 'Info', title: 'How to play', Icon: IconInfo },
  { id: 'settings', label: 'Settings', title: 'Settings', Icon: IconSettings },
]

function loadSettings() {
  try {
    const saved = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('seega-settings') || '{}') }
    if (!THEMES.includes(saved.theme)) saved.theme = DEFAULTS.theme
    return saved
  } catch {
    return DEFAULTS
  }
}

const other = (s) => (s === 'w' ? 'b' : 'w')
const fmtClock = (ms) => {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [tl, setTl] = useState({ list: [], ptr: -1, fresh: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // Trees: every AI move keeps the tree that chose it (in the timeline);
  // `treeView` is the move index whose tree is shown, or 'hint'.
  const [hintSearch, setHintSearch] = useState(null)
  const [treeView, setTreeView] = useState(null)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [searches, setSearches] = useState([])
  const [treeUnseen, setTreeUnseen] = useState(false)
  const [hintMove, setHintMove] = useState(null)
  const [coach, setCoach] = useState(null)
  const [toast, setToast] = useState(null)
  const [panel, setPanel] = useState(null)
  const [flipped, setFlipped] = useState(false)
  const [autoPlay, setAutoPlay] = useState(true)
  const [clock, setClock] = useState({ w: 0, b: 0, side: 'w', since: Date.now() })
  const [now, setNow] = useState(Date.now())
  const [boardSize, setBoardSize] = useState(480)
  const stageRef = useRef(null)
  const gameId = useRef(0)

  const { mode, humanSide, depth, showDepth } = settings
  const animMs = ANIM_MS[settings.anim] ?? 300
  const cur = tl.list[tl.ptr]
  const s = cur?.state
  const atEnd = tl.ptr === tl.list.length - 1

  const set = (patch) => setSettings((old) => {
    const next = { ...old, ...patch }
    try { localStorage.setItem('seega-settings', JSON.stringify(next)) } catch { /* optional */ }
    return next
  })

  const isAI = useCallback(
    (side) => mode === 'aivai' || (mode === 'hvai' && side !== humanSide),
    [mode, humanSide],
  )

  // ---------- board sizing: as large as the stage allows ----------
  const hasGame = !!tl.list.length
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      const size = Math.floor(Math.min(width - 100, height - 2 * 62 - 96))
      setBoardSize(Math.max(240, Math.min(size, 900)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasGame])

  // ---------- clocks ----------
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (!s) return
    setClock((c) => {
      if (c.side === s.turn) return c
      const t = Date.now()
      return { ...c, [c.side]: c[c.side] + (t - c.since), side: s.turn, since: t }
    })
  }, [s])
  const running = s && s.phase !== 'over' && !(mode === 'aivai' && !autoPlay)
  const clockOf = (side) => clock[side] + (running && clock.side === side ? Math.max(0, now - clock.since) : 0)

  // ---------- game lifecycle ----------
  const newGame = useCallback(async () => {
    const id = ++gameId.current
    setError(null)
    try {
      const res = await api.newGame()
      if (id !== gameId.current) return
      setTl({ list: [{ state: res.state, legal: res.legal, lastMove: null, entry: null }], ptr: 0, fresh: false })
      setHintSearch(null)
      setTreeView(null)
      setSearches([])
      setTreeUnseen(false)
      setHintMove(null)
      setCoach(null)
      setToast(null)
      setBusy(false)
      setAutoPlay(true)
      setClock({ w: 0, b: 0, side: 'w', since: Date.now() })
    } catch (e) {
      setError(`Cannot reach the game server (${e.message}). Start the Python API on port 8000.`)
    }
  }, [])

  useEffect(() => { newGame() }, [newGame])

  // Positions already played up to timeline index `upto` (movement phase only).
  const historyKeys = (upto = tl.ptr) =>
    tl.list.slice(0, upto + 1).filter((e) => e.state.phase === 'move').map((e) => positionKey(e.state))

  function push(res, entry, search = null) {
    const index = tl.ptr + 1
    setTl(({ list, ptr }) => ({
      list: [...list.slice(0, ptr + 1), {
        state: res.state, legal: res.legal,
        lastMove: { move: res.move, captured: res.captured }, entry, search,
      }],
      ptr: ptr + 1,
      fresh: true,
    }))
    if (settings.sound) playMoveSound(res.captured.length)
    setHintMove(null)
    setTreeView(index)
    return index
  }

  // Ask the engine what it thinks of the position before move `index`
  // (used for moves made by people, which have no stored tree).
  const reviewMove = useCallback(async (index) => {
    const item = tl.list[index]
    const prev = tl.list[index - 1]
    if (!item || !prev || item.search || prev.state.phase === 'over') return
    const id = gameId.current
    setReviewBusy(true)
    try {
      const res = await api.hint(prev.state, depth, showDepth, historyKeys(index - 1))
      if (id !== gameId.current) return
      const search = {
        tree: res.tree, stats: res.stats, side: prev.state.turn, by: 'review', label: res.label,
        played: item.lastMove?.move, playedLabel: item.entry?.label, key: `review-${index}-${res.tree.id}`,
      }
      setTl((t) => ({
        ...t,
        list: t.list.map((e, i) => (i === index && e === item ? { ...e, search } : e)),
      }))
    } catch (e) {
      setError(e.message)
    } finally {
      setReviewBusy(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tl, depth, showDepth])

  function showToast(t) {
    setToast({ ...t, key: Date.now() })
  }
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4200)
    return () => clearTimeout(t)
  }, [toast])

  async function humanMove(move) {
    if (busy || !s) return
    const id = gameId.current
    const before = s
    setBusy(true)
    setError(null)
    try {
      const hist = historyKeys()
      const res = await api.play(before, move, hist)
      if (id !== gameId.current) return
      push(res, { side: before.turn, label: res.label, captured: res.captured.length, by: 'human' })
      if (settings.coach && move.type !== 'stop') {
        setCoach({ loading: true })
        api.analyze(before, move, Math.min(depth, 3), hist)
          .then((a) => {
            if (id !== gameId.current) return
            setCoach({ ...a, title: `${sideName(before.turn)} played ${res.label}` })
            showToast({ verdict: a.verdict, text: a.notes?.[0] || `${res.label}` })
          })
          .catch(() => setCoach({ title: res.label, notes: res.notes }))
      } else {
        setCoach({ title: `${sideName(before.turn)} played ${res.label}`, notes: res.notes })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const runEngine = useCallback(async (by) => {
    if (!s) return
    const id = gameId.current
    const before = s
    setBusy(true)
    try {
      const res = await api.aiMove(before, depth, showDepth, historyKeys())
      if (id !== gameId.current) return
      const search = { tree: res.tree, stats: res.stats, side: before.turn, by: 'ai', label: res.label, key: `${res.tree.id}-${Date.now()}` }
      push(res, { side: before.turn, label: res.label, captured: res.captured.length, by, score: res.score }, search)
      setSearches((l) => [...l, { ...res.stats, side: before.turn, label: res.label }])
      setTreeUnseen(panel !== 'tree')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
    // push/panel are read at call time on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, tl, depth, showDepth, panel, settings.sound])

  // AI plays whenever it is its turn (pairs of drops, capture chains, extra turns).
  useEffect(() => {
    if (!s || busy || error || !atEnd) return
    if (s.phase === 'over' || !isAI(s.turn)) return
    if (mode === 'aivai' && !autoPlay) return
    const t = setTimeout(() => runEngine('ai'), Math.max(380, animMs + 180))
    return () => clearTimeout(t)
  }, [s, busy, error, atEnd, isAI, mode, autoPlay, runEngine, animMs])

  async function askHint() {
    if (!s || busy) return
    setBusy(true)
    setCoach({ loading: true })
    try {
      const res = await api.hint(s, depth, showDepth, historyKeys())
      setHintMove(res.move)
      setHintSearch({ tree: res.tree, stats: res.stats, side: s.turn, by: 'hint', label: res.label, key: `${res.tree.id}-${Date.now()}` })
      setTreeView('hint')
      setSearches((l) => [...l, { ...res.stats, side: s.turn, label: `hint ${res.label}` }])
      setCoach({ title: `Hint: ${res.label}`, notes: res.notes })
      showToast({ verdict: 'hint', text: `Try ${res.label}: open the search tree to see why.`, panel: 'tree' })
      setTreeUnseen(panel !== 'tree')
    } catch (e) {
      setError(e.message)
      setCoach(null)
    } finally {
      setBusy(false)
    }
  }

  // ---------- timeline navigation ----------
  function jump(ptr) {
    if (busy) return
    gameId.current++
    setTl((t) => ({ ...t, ptr: Math.max(0, Math.min(t.list.length - 1, ptr)), fresh: false }))
    setHintMove(null)
    if (mode === 'aivai') setAutoPlay(false)
  }
  function undo() {
    if (mode === 'hvai') {
      for (let j = tl.ptr - 1; j >= 0; j--) {
        if (!isAI(tl.list[j].state.turn)) return jump(j)
      }
      return
    }
    jump(tl.ptr - 1)
  }
  function redo() {
    if (mode === 'hvai') {
      for (let j = tl.ptr + 1; j < tl.list.length; j++) {
        if (!isAI(tl.list[j].state.turn) || j === tl.list.length - 1) return jump(j)
      }
      return
    }
    jump(tl.ptr + 1)
  }

  function openPanel(id) {
    setPanel((p) => (p === id ? null : id))
    if (id === 'tree') setTreeUnseen(false)
  }

  function showTreeOf(index) {
    setTreeView(index)
    setPanel('tree')
    setTreeUnseen(false)
  }

  // Which tree the Tree panel shows; fetch an engine review for a person's move.
  const lastIndex = tl.list.length - 1
  const viewIndex = treeView === 'hint' ? null : (treeView ?? (lastIndex > 0 ? lastIndex : null))
  const shownSearch = treeView === 'hint' ? hintSearch : (viewIndex != null ? tl.list[viewIndex]?.search : null)
  useEffect(() => {
    if (panel !== 'tree' || viewIndex == null || busy || reviewBusy || error) return
    if (!tl.list[viewIndex]?.search) reviewMove(viewIndex)
  }, [panel, viewIndex, tl, busy, reviewBusy, error, reviewMove])

  if (!s) {
    return (
      <div className="shell loading">
        <div className="logo big">SG</div>
        <p>{error || 'Connecting to the Prolog engine…'}</p>
        {error && <button className="btn primary" onClick={newGame}>Retry</button>}
      </div>
    )
  }

  const history = tl.list.slice(1, tl.ptr + 1).map((e) => e.entry)
  const fullHistory = tl.list.slice(1).map((e) => e.entry)
  const humanTurn = s.phase !== 'over' && !isAI(s.turn)
  const canAct = !busy && humanTurn
  const canStop = canAct && cur.legal.some((m) => m.type === 'stop')
  const baseBottom = mode === 'hvai' ? humanSide : 'w'
  const bottom = flipped ? other(baseBottom) : baseBottom
  const top = other(bottom)
  const boardFlipped = bottom === 'b'
  const active = PANELS.find((p) => p.id === panel)
  const level = LEVELS.find((l) => l.depth === depth)?.label || `depth ${depth}`

  const playerName = (side) => {
    if (isAI(side)) return `Prolog AI · ${level}`
    if (mode === 'hvh') return side === 'w' ? 'Player 1' : 'Player 2'
    return 'You'
  }
  const playerSub = (side) => {
    const parts = [sideName(side)]
    if (s.phase === 'drop') parts.push(`${s.hand[side]} to place`)
    else parts.push(`${s.counts[side]} on board`)
    return parts.join(' · ')
  }
  const statusOf = (side) => {
    if (s.phase === 'over' || s.turn !== side) return null
    if (busy && isAI(side)) return 'thinking…'
    if (s.phase === 'drop') return `placing · ${s.drops_left} left`
    if (s.chain != null) return 'capture again or stop'
    if (s.extra_turn) return 'extra turn'
    return 'to move'
  }
  const capturedBy = (side) => 12 - s.counts[other(side)] - s.hand[other(side)]

  const playerBar = (side) => (
    <div className={`player-bar ${s.turn === side && running ? 'active' : ''}`}>
      <div className={`avatar ${side} ${isAI(side) ? 'ai' : ''}`}>{isAI(side) ? 'AI' : side === 'w' ? 'W' : 'B'}</div>
      <div className="pname">
        <div className="pname-main">{playerName(side)}</div>
        <div className="pname-sub">
          {playerSub(side)}
          {statusOf(side) && <span className={`pstatus ${busy && isAI(side) ? 'busy' : ''}`}>{statusOf(side)}</span>}
        </div>
      </div>
      <div className="captures" title={`${capturedBy(side)} captured`}>
        {capturedBy(side) > 0 && <span className="cap-count">+{capturedBy(side)}</span>}
        <span className="cap-discs">
          {Array.from({ length: Math.min(capturedBy(side), 12) }).map((_, i) => <i key={i} className={other(side)} />)}
        </span>
      </div>
      <div className={`clock ${s.turn === side && running ? 'on' : ''}`}>{fmtClock(clockOf(side))}</div>
    </div>
  )

  const result = s.phase === 'over' && (
    <div className="overlay">
      <div className="overlay-card">
        <div className="overlay-title">
          {s.winner === 'draw' ? 'Draw' : `${playerName(s.winner)} wins`}
        </div>
        <div className="overlay-sub">
          White {s.counts.w} · Black {s.counts.b} · {fullHistory.length} moves
        </div>
        <div className="overlay-actions">
          <button className="btn primary" onClick={newGame}>Play again</button>
          <button className="btn" onClick={() => openPanel('stats')}>Game stats</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="logo" title="Seega">SG</div>
        <div className="nav">
          <button className={`nav-item ${panel === null ? 'on' : ''}`} onClick={() => setPanel(null)}>
            <IconGame /><span>Game</span>
          </button>
          {PANELS.map(({ id, label, Icon }) => (
            <button key={id} className={`nav-item ${panel === id ? 'on' : ''}`} onClick={() => openPanel(id)}>
              <Icon />
              <span>{label}</span>
              {id === 'tree' && treeUnseen && <i className="badge-dot" />}
            </button>
          ))}
          <button className="nav-item" onClick={() => set({ sound: !settings.sound })}>
            {settings.sound ? <IconVolume /> : <IconMute />}<span>Vol.</span>
          </button>
        </div>
        <button className="collapse" onClick={() => setPanel(null)} disabled={!panel} title="Close panel">
          <IconArrowLeft size={18} />
        </button>
      </nav>

      <aside className={`drawer ${panel ? 'open' : ''} ${active?.wide ? 'wide' : ''}`} aria-hidden={!panel}>
        {active && (
          <div className="drawer-inner">
            <header className="drawer-head">
              <h2>{active.title}</h2>
              <button className="icon-btn" onClick={() => setPanel(null)} title="Close"><IconArrowLeft size={18} /></button>
            </header>
            {panel === 'tree' && (
              <>
                {(fullHistory.length > 0 || hintSearch) && (
                  <div className="tree-nav">
                    <button className="icon-btn" title="Previous move"
                      disabled={viewIndex == null ? !fullHistory.length : viewIndex <= 1}
                      onClick={() => setTreeView(viewIndex == null ? lastIndex : viewIndex - 1)}><IconPrev /></button>
                    <select value={treeView === 'hint' ? 'hint' : String(viewIndex ?? '')}
                      onChange={(e) => setTreeView(e.target.value === 'hint' ? 'hint' : Number(e.target.value))}>
                      {fullHistory.map((h, i) => (
                        <option key={i} value={i + 1}>
                          {`Move ${i + 1} · ${sideName(h.side)} ${h.label}${h.by === 'human' ? '' : ' (AI)'}`}
                        </option>
                      ))}
                      {hintSearch && <option value="hint">{`Hint for the current position: ${hintSearch.label}`}</option>}
                    </select>
                    <button className="icon-btn" title="Next move"
                      disabled={viewIndex == null || viewIndex >= lastIndex}
                      onClick={() => setTreeView(viewIndex + 1)}><IconNext /></button>
                  </div>
                )}
                {shownSearch
                  ? <SearchTree key={shownSearch.key} data={shownSearch} />
                  : <div className="panel-empty">
                      {viewIndex != null
                        ? 'Asking the Prolog engine how it saw this position…'
                        : <>The engine's minimax search tree appears here after a move. Press the <b>hint</b> bulb
                          under the board to search your own position.</>}
                    </div>}
              </>
            )}
            {panel === 'coach' && <div className="panel-scroll"><CoachPanel coach={coach} /></div>}
            {panel === 'moves' && <MovesPanel history={fullHistory} ptr={tl.ptr} onJump={jump} onTree={showTreeOf} />}
            {panel === 'stats' && <StatsPanel state={s} searches={searches} history={history} />}
            {panel === 'info' && <InfoPanel />}
            {panel === 'settings' && <SettingsPanel settings={settings} set={set} onNewGame={() => { newGame(); setPanel(null) }} />}
          </div>
        )}
      </aside>

      <main className="stage" ref={stageRef}>
        <div className="board-card" style={{ width: boardSize + 36 }}>
          {playerBar(top)}
          <Board state={s} legal={cur.legal} canAct={canAct} onMove={humanMove}
            lastMove={cur.lastMove} fresh={tl.fresh} hint={hintMove} flipped={boardFlipped}
            theme={settings.theme} showCoords={settings.coords} showLegal={settings.showLegal}
            animMs={animMs} size={boardSize} overlay={result} />
          <div className={`player-bar bottom ${s.turn === bottom && running ? 'active' : ''}`}>
            <div className="controls">
              {mode === 'aivai' ? (
                <button className="icon-btn" title={autoPlay ? 'Pause' : 'Resume AI vs AI'}
                  onClick={() => { if (!atEnd) jump(tl.list.length - 1); setAutoPlay(!autoPlay) }}>
                  {autoPlay ? <IconPause /> : <IconPlay />}
                </button>
              ) : (
                <button className="icon-btn" title="Let the engine play this move" disabled={!canAct}
                  onClick={() => runEngine('engine')}><IconPlay /></button>
              )}
              <button className="icon-btn" title="Undo" disabled={busy || tl.ptr === 0} onClick={undo}><IconPrev /></button>
              <button className="icon-btn" title="Redo" disabled={busy || atEnd} onClick={redo}><IconNext /></button>
              <button className="icon-btn" title="Hint" disabled={!canAct} onClick={askHint}><IconBulb /></button>
              <button className="icon-btn" title="Flip board" onClick={() => setFlipped(!flipped)}><IconFlip /></button>
              <button className="icon-btn" title="New game" onClick={newGame}><IconNew /></button>
              {canStop && (
                <button className="btn stop" onClick={() => humanMove({ type: 'stop' })}>
                  <IconStop size={14} /> Stop capturing
                </button>
              )}
            </div>
            <div className="spacer" />
            <div className="pname right">
              <div className="pname-main">{playerName(bottom)}</div>
              <div className="pname-sub">
                {statusOf(bottom) && <span className={`pstatus ${busy && isAI(bottom) ? 'busy' : ''}`}>{statusOf(bottom)}</span>}
                {playerSub(bottom)}
              </div>
            </div>
            <div className="captures">
              {capturedBy(bottom) > 0 && <span className="cap-count">+{capturedBy(bottom)}</span>}
              <span className="cap-discs">
                {Array.from({ length: Math.min(capturedBy(bottom), 12) }).map((_, i) => <i key={i} className={other(bottom)} />)}
              </span>
            </div>
            <div className={`clock ${s.turn === bottom && running ? 'on' : ''}`}>{fmtClock(clockOf(bottom))}</div>
          </div>
        </div>

        <div className="phase-chip">
          {s.phase === 'drop' ? 'Placement phase' : s.phase === 'move' ? 'Movement phase' : 'Game over'}
          {s.phase === 'drop' && <span> · {24 - s.hand.w - s.hand.b}/24 placed</span>}
          {s.phase === 'move' && <span> · {s.nocap}/50 quiet</span>}
          {!atEnd && <span className="review"> · reviewing move {tl.ptr}</span>}
        </div>

        {toast && (
          <button key={toast.key} className={`toast ${toast.verdict}`} onClick={() => openPanel(toast.panel || 'coach')}>
            <span className="toast-tag">{toast.verdict === 'hint' ? 'Hint' : toast.verdict}</span>
            <span>{toast.text}</span>
          </button>
        )}
        {error && (
          <div className="toast error" role="alert">
            <span>{error}</span>
            <button className="btn" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
      </main>
    </div>
  )
}
