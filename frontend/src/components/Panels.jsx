import { useState } from 'react'
import { sideName } from '../api'
import { IconTree } from '../icons'

export const LEVELS = [
  { depth: 1, label: 'Easy' },
  { depth: 2, label: 'Medium' },
  { depth: 3, label: 'Hard' },
  { depth: 5, label: 'Expert' },
]

function Segmented({ value, options, onChange }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  )
}

export function SettingsPanel({ settings, set, onNewGame }) {
  return (
    <div className="panel-scroll">
      <h4 className="group-title">Game</h4>
      <Field label="Opponent">
        <Segmented value={settings.mode} onChange={(v) => set({ mode: v })} options={[
          { value: 'hvai', label: 'Me vs AI' },
          { value: 'hvh', label: 'Me vs friend' },
          { value: 'aivai', label: 'AI vs AI' },
        ]} />
      </Field>
      {settings.mode === 'hvai' && (
        <Field label="I play" hint="White places first; Black makes the first move of the movement phase.">
          <Segmented value={settings.humanSide} onChange={(v) => set({ humanSide: v })} options={[
            { value: 'w', label: 'White' },
            { value: 'b', label: 'Black' },
          ]} />
        </Field>
      )}
      <Field label="AI strength" hint={`Searches ${settings.depth} move${settings.depth > 1 ? 's' : ''} ahead with alpha-beta pruning.`}>
        <Segmented value={settings.depth} onChange={(v) => set({ depth: v })}
          options={LEVELS.map((l) => ({ value: l.depth, label: l.label }))} />
      </Field>
      <button className="btn primary wide" onClick={onNewGame}>Start a new game</button>

      <h4 className="group-title">Learning</h4>
      <Toggle label="Coach" hint="Grade every move against the engine." checked={settings.coach} onChange={(v) => set({ coach: v })} />
      <Toggle label="Show legal moves" checked={settings.showLegal} onChange={(v) => set({ showLegal: v })} />
      <Field label="Search tree levels drawn" hint="Deeper trees show more pruned (red) branches.">
        <Segmented value={settings.showDepth} onChange={(v) => set({ showDepth: v })}
          options={[1, 2, 3].map((d) => ({ value: d, label: String(d) }))} />
      </Field>

      <h4 className="group-title">Board</h4>
      <Field label="Theme">
        <Segmented value={settings.theme} onChange={(v) => set({ theme: v })} options={[
          { value: 'sandstone', label: 'Sandstone' },
          { value: 'acacia', label: 'Acacia wood' },
          { value: 'basalt', label: 'Basalt' },
        ]} />
      </Field>
      <Field label="Animation">
        <Segmented value={settings.anim} onChange={(v) => set({ anim: v })} options={[
          { value: 'off', label: 'Off' },
          { value: 'fast', label: 'Fast' },
          { value: 'normal', label: 'Normal' },
          { value: 'slow', label: 'Slow' },
        ]} />
      </Field>
      <Toggle label="Coordinates" checked={settings.coords} onChange={(v) => set({ coords: v })} />
      <Toggle label="Sound" checked={settings.sound} onChange={(v) => set({ sound: v })} />
    </div>
  )
}

export function MovesPanel({ history, ptr, onJump, onTree }) {
  if (!history.length) return <div className="panel-empty">No moves yet. Place a piece to begin.</div>
  return (
    <div className="panel-scroll">
      <ol className="moves">
        {history.map((h, i) => (
          <li key={i} className={i + 1 === ptr ? 'current' : i + 1 > ptr ? 'future' : ''}>
            <button className="mv-main" onClick={() => onJump(i + 1)} title="Show the board after this move">
              <span className="mv-num">{i + 1}</span>
              <span className={`dot ${h.side}`} />
              <span className="mv-label">{h.label}</span>
              {h.captured > 0 && <span className="mv-cap">×{h.captured}</span>}
              <span className="mv-by">{h.by === 'ai' ? `AI ${h.score >= 0 ? '+' : ''}${h.score}` : h.by === 'engine' ? 'engine' : 'player'}</span>
            </button>
            <button className="mv-tree" onClick={() => onTree(i + 1)} title="Open the search tree for this move">
              <IconTree size={17} />
            </button>
          </li>
        ))}
      </ol>
      <div className="field-hint">
        Click a move to see the board after it. The tree button shows the engine's search for that move;
        for a player's move it shows what the engine would have played instead.
      </div>
    </div>
  )
}

function NodesChart({ searches }) {
  const [hover, setHover] = useState(null)
  const data = searches.slice(-24)
  const max = Math.max(1, ...data.map((s) => s.nodes))
  const shown = hover ?? data.length - 1
  const cur = data[shown]
  return (
    <div className="chart">
      <div className="chart-title">Positions searched per AI move</div>
      <div className="chart-readout">
        {cur ? <><b>{cur.nodes.toLocaleString()}</b> nodes · {cur.pruned.toLocaleString()} pruned · {cur.label} ({sideName(cur.side)})</> : '—'}
      </div>
      <div className="bars" onMouseLeave={() => setHover(null)}>
        {data.map((s, i) => (
          <div key={i} className={`bar-hit ${i === shown ? 'on' : ''}`} onMouseEnter={() => setHover(i)}>
            <div className="bar" style={{ height: `${Math.max(3, (s.nodes / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="chart-axis"><span>earlier</span><span>latest</span></div>
    </div>
  )
}

export function StatsPanel({ state, searches, history }) {
  const capBy = (s) => {
    const o = s === 'w' ? 'b' : 'w'
    return 12 - state.counts[o] - state.hand[o]
  }
  const nodes = searches.reduce((a, s) => a + s.nodes, 0)
  const pruned = searches.reduce((a, s) => a + s.pruned, 0)
  const ms = searches.reduce((a, s) => a + s.time_ms, 0)
  return (
    <div className="panel-scroll">
      <div className="tiles">
        <div className="tile"><span>White pieces</span><b>{state.counts.w + state.hand.w}</b></div>
        <div className="tile"><span>Black pieces</span><b>{state.counts.b + state.hand.b}</b></div>
        <div className="tile"><span>Captured by White</span><b>{capBy('w')}</b></div>
        <div className="tile"><span>Captured by Black</span><b>{capBy('b')}</b></div>
        <div className="tile"><span>Moves played</span><b>{history.length}</b></div>
        <div className="tile"><span>Quiet moves</span><b>{state.nocap}/50</b></div>
      </div>
      <h4 className="group-title">Prolog engine</h4>
      <div className="tiles">
        <div className="tile"><span>Searches</span><b>{searches.length}</b></div>
        <div className="tile"><span>Positions searched</span><b>{nodes.toLocaleString()}</b></div>
        <div className="tile"><span>Branches pruned</span><b>{pruned.toLocaleString()}</b></div>
        <div className="tile"><span>Avg. think time</span><b>{searches.length ? Math.round(ms / searches.length) : 0} ms</b></div>
      </div>
      {searches.length > 0
        ? <NodesChart searches={searches} />
        : <div className="panel-empty small">Engine statistics appear after the AI moves or you ask for a hint.</div>}
    </div>
  )
}

export function InfoPanel() {
  return (
    <div className="panel-scroll prose">
      <p className="lead">Seega is a two-player strategy game from ancient Egypt. This app is a learning tool:
        the rules and the opponent are written in <b>SWI-Prolog</b>, and you can watch how it thinks.</p>
      <h4>1 · Placement</h4>
      <p>Each side has 12 pieces. Players take turns placing <b>two pieces per turn</b> on any empty square,
        except the <b>centre</b>, which stays empty. White places first.</p>
      <h4>2 · Movement</h4>
      <p>When the board is full, Black moves first. Slide one piece one square up, down, left or right into an
        empty square.</p>
      <h4>3 · Capturing</h4>
      <p>Trap an enemy piece between the piece you moved and another of yours in a straight line to remove it.
        One move can capture in several directions. If the same piece can capture again, you may keep going.</p>
      <ul>
        <li>A piece on the centre square cannot be captured.</li>
        <li>Moving between two enemy pieces is safe.</li>
        <li>Corner pieces can never be captured.</li>
        <li>If you cannot move, your opponent moves again until you can.</li>
      </ul>
      <h4>Winning</h4>
      <p>Capture every enemy piece. After 50 moves without a capture, the side with more pieces wins.</p>
      <h4>How the AI decides</h4>
      <p>The engine runs <b>minimax with alpha-beta pruning</b>: it tries moves depth-first, scores the
        positions it reaches, and backtracks out of branches that can't change its decision. Open the
        <b> Search tree</b> panel to see every position it looked at. Red boards were pruned, and the green line is the play it expects.</p>
      <div className="arch">
        <div><b>React</b><span>board, panels, tree</span></div>
        <div className="arrow">→</div>
        <div><b>Python</b><span>FastAPI</span></div>
        <div className="arrow">→</div>
        <div><b>Prolog</b><span>rules · minimax · α-β</span></div>
      </div>
    </div>
  )
}
