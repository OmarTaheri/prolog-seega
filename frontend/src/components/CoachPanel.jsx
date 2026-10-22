const VERDICT_TEXT = {
  best: 'Best move',
  good: 'Good move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}

export default function CoachPanel({ coach }) {
  if (!coach) {
    return (
      <div className="coach empty">
        Make a move and the coach will grade it against the engine, or press <b>Hint</b>.
      </div>
    )
  }
  if (coach.loading) return <div className="coach empty">Thinking…</div>
  return (
    <div className="coach">
      {coach.title && <div className="coach-title">{coach.title}</div>}
      {coach.verdict && (
        <div className="verdict-row">
          <span className={`verdict ${coach.verdict}`}>{VERDICT_TEXT[coach.verdict]}</span>
          <span className="muted">
            You played <b>{coach.played}</b> ({coach.played_score}); engine best <b>{coach.best}</b> ({coach.best_score})
          </span>
        </div>
      )}
      <ul className="notes">
        {(coach.notes || []).map((n, i) => <li key={i}>{n}</li>)}
      </ul>
      {coach.ranking && coach.ranking.length > 1 && (
        <details>
          <summary>Engine ranking of all {coach.ranking.length} moves</summary>
          <ol className="ranking">
            {coach.ranking.slice(0, 10).map((r, i) => (
              <li key={i} className={r.label === coach.played ? 'played' : ''}>
                <span>{r.label}</span><span>{r.score}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}
