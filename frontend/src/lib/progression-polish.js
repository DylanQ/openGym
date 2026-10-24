// Progression polish (fitbod-experience.md B7.2–B7.4): the three behaviours that make
// the existing policies feel considered rather than mechanical — a proving set that
// keeps the e1RM honest, a 90% re-entry after a break, and a plateau flag that rotates
// the variant instead of grinding. Detection lives here as pure reads over history;
// applying them is the generator's job (lib/generate.js), and every application lands
// in the entry's reason string — a number never moves silently (B0.2).
import { sessionsFor } from './progression.js'
import { e1rmSeries } from './onerm.js'
import { workoutAt } from './history.js'
import { kneeStatusOf } from './my-gym.js'
import { EXIDX } from './exercises.js'

export const REENTRY_GAP_DAYS = 10
export const REENTRY_FACTOR = 0.9
const DAY_MS = 24 * 60 * 60 * 1000

/** When an exercise was last trained (ms), or null when it never was. */
export function lastTrainedAt(S, exId) {
  let last = null
  for (const w of S?.workouts || []) {
    if (!(w?.entries || []).some(e => e?.id === exId && (e.sets || []).some(s => s?.done))) continue
    const t = workoutAt(w)
    if (Number.isFinite(t) && (last == null || t > last)) last = t
  }
  return last
}

/** Days since the exercise was last trained, or null when it never was. */
export function daysSinceTrained(S, exId, now = Date.now()) {
  const last = lastTrainedAt(S, exId)
  return last == null ? null : Math.floor((now - last) / DAY_MS)
}

/**
 * The re-entry ramp (B7.3): an exercise untouched for REENTRY_GAP_DAYS or more re-enters
 * at 90% of its prescribed load for one session. An explicit rule with a stamp and a
 * reason — Fitbod eases you back in silently; the ledger says so on the row. It is a
 * default like every other here: Dylan can edit the weight and the session is his.
 */
export const reentryDue = (S, exId, now = Date.now()) => {
  const days = daysSinceTrained(S, exId, now)
  return days != null && days >= REENTRY_GAP_DAYS ? days : null
}

/**
 * The plateau flag (B7.4): the e1RM ensemble non-increasing across the last four
 * exposures of a trained exercise. Detection only — the response is variation (the
 * generator rotates the variant for a session), never an automatic deload (A8's
 * unverified claim is not implemented as fact).
 */
export function plateauOf(S, exId) {
  const pts = e1rmSeries(S, exId)
  if (pts.length < 4) return null
  const last4 = pts.slice(-4)
  for (let i = 1; i < last4.length; i++) if (last4[i].y > last4[i - 1].y + 1e-9) return null
  return { sessions: pts.length, since: last4[0].d }
}

/**
 * Proving-set eligibility (B7.2), Fitbod's Max Effort gating in our terms: the lift is
 * an anchor (a My Gym seed lift, or any exercise with 4+ logged sessions), this is every
 * 5th session of it, and it is never a knee-caution lift (B0.1 — Dylan may still flag
 * one by hand; the app never assigns one there). The one-per-muscle-per-session cap is
 * the composer's, which sees the whole session; this answers for one exercise.
 */
export function provingDue(S, exId, { seedIds = new Set() } = {}) {
  if (kneeStatusOf(exId) === 'caution') return false
  const ex = EXIDX[exId]
  if (!ex || ex.cat === 'cardio' || ex.cat === 'stretching' || ex.cat === 'mobility') return false
  const sessions = sessionsFor(S, exId, { id: exId })
  const n = sessions.length
  if (!seedIds.has(exId) && n < 4) return false
  return n > 0 && (n + 1) % 5 === 0
}
