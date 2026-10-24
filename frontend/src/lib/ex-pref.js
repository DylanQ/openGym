// Exercise preferences (fitbod-experience.md B5.3): the standing Recommend More / Less /
// Never signal, plus the passive learning underneath it. Fitbod's shape, our storage:
//   S.exPref    = { [exerciseId]: 'more' | 'less' | 'never' }   ('normal' is absence)
//   S.swapStats = { [fromId]: { [toId]: { n, last } } }          (swaps away, counted)
// The generator reads prefOf; three surfaces write it — the exercise detail's
// Recommendations control, the in-workout menu, and Settings → Training Profile →
// Manage Exercises, where the status is reviewable and undoable. A swap is data, never
// a verdict: swapStats only ever *suggests* 'less' (swapSuggestion), it never applies it.
export const PREFS = ['more', 'normal', 'less', 'never']
export const prefOf = (S, id) => (PREFS.includes(S?.exPref?.[id]) ? S.exPref[id] : 'normal')

/** Set a standing preference (a store mutator). 'normal' removes the entry. */
export function setPref(s, id, pref) {
  if (!id || !PREFS.includes(pref)) return
  const next = { ...(s.exPref || {}) }
  if (pref === 'normal') delete next[id]
  else next[id] = pref
  s.exPref = next
}

/** Record one swap away from an exercise (a store mutator): what replaced what, when. */
export function recordSwap(s, fromId, toId, now = Date.now()) {
  if (!fromId || !toId || fromId === toId) return
  const mine = { ...((s.swapStats || {})[fromId] || {}) }
  mine[toId] = { n: (Number(mine[toId]?.n) || 0) + 1, last: now }
  s.swapStats = { ...(s.swapStats || {}), [fromId]: mine }
}

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

/** Swaps away from one exercise inside the learning window (30 days). */
export function swapsAway(S, id, now = Date.now()) {
  let n = 0
  for (const v of Object.values(S?.swapStats?.[id] || {})) {
    if (Number(v?.last) > now - THIRTY_DAYS) n += Number(v?.n) || 0
  }
  return n
}

/**
 * The passive-learning suggestion (B5.3): swapped away from 3+ times in 30 days while
 * still 'normal' → worth offering 'less' in Manage Exercises. A suggestion is all it
 * ever is — applying it stays a tap Dylan makes.
 */
export const swapSuggestion = (S, id, now = Date.now()) =>
  prefOf(S, id) === 'normal' && swapsAway(S, id, now) >= 3
