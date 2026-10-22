let ctx = null

function tone(freq, start, duration, gain, type = 'sine') {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
  g.gain.setValueAtTime(gain, ctx.currentTime + start)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration)
  osc.connect(g).connect(ctx.destination)
  osc.start(ctx.currentTime + start)
  osc.stop(ctx.currentTime + start + duration + 0.02)
}

// A soft wooden "tock" for a move; a lower double knock for a capture.
export function playMoveSound(captures = 0) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    tone(520, 0, 0.09, 0.18, 'triangle')
    tone(260, 0, 0.12, 0.12)
    if (captures > 0) {
      tone(180, 0.09, 0.18, 0.22, 'triangle')
      tone(140, 0.17, 0.2, 0.18, 'triangle')
    }
  } catch {
    // Audio is optional.
  }
}
