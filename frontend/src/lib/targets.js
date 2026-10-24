// Weekly set targets and the weekly-goal streak (fitbod-experience.md B7 / A9).
//
// Targets come from the goal table (lib/profile.js) scaled by how often and how long
// Dylan trains and how experienced he is; counting follows the published rule the spec
// adopts — a working set counts 1.0 toward a primary muscle, 0.5 toward a secondary —
// over musclesOf()'s primary/secondary assignments. Warm-up rows never count.
//
// The streak is Fitbod's rule with the fork's one softening already inside it (B8): the
// weekly goal itself is the forgiving knob (Dylan sets 3, trains 3–4). Consecutive weeks
// at or over daysPerWeek logged workouts; a miss resets it to zero, no grace. Derived
// purely from history on every read — no stored counter exists to drift.
import { EXIDX } from './exercises.js'
import { musclesOf, MUSCLES } from './muscles.js'
import { isWarmupRow } from './workout-model.js'
import { goalRow, isLargeMuscle, profileOf } from './profile.js'
import { startOfWeek, weekStartOf, todayISO, isoOf } from './format.js'

const EXP_SCALE = { beginner: 0.8, intermediate: 1, advanced: 1.15 }

/**
 * Weekly set target per muscle slug for a profile: the goal table's range middle,
 * scaled by training frequency (against a 3-day baseline) and experience, rounded.
 * Every drawable muscle gets a target — the small ones are how the week stays honest
 * about arms and calves instead of only ever counting chest and legs.
 */
export function weekTargets(profile) {
  const row = goalRow(profile?.goal)
  const scale = Math.max(0.5, Math.min(1.5, (Number(profile?.daysPerWeek) || 3) / 3)) * (EXP_SCALE[profile?.experience] || 1)
  const out = {}
  for (const slug of MUSCLES) {
    const [lo, hi] = isLargeMuscle(slug) ? row.setsLarge : row.setsSmall
    out[slug] = Math.max(1, Math.round(((lo + hi) / 2) * scale))
  }
  return out
}

/** Working sets one finished entry gives each muscle: 1.0 primary, 0.5 secondary. */
export function entrySetCounts(entry) {
  const work = (entry?.sets || []).filter(s => s?.done && !isWarmupRow(s)).length
  if (!work) return {}
  const meta = { ...(EXIDX[entry.id] || {}), ...entry }
  const weights = musclesOf(meta)
  const out = {}
  for (const [slug, w] of Object.entries(weights)) {
    if (w > 0) out[slug] = work * (w >= 1 ? 1 : 0.5)
  }
  return out
}

/** Counted sets per muscle for the week containing `iso` (the profile's week start). */
export function weekSets(S, iso = todayISO()) {
  const ws = weekStartOf(S)
  const start = startOfWeek(iso, ws)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const lo = isoOf(start), hi = isoOf(end)
  const out = {}
  for (const w of S?.workouts || []) {
    if (!(w?.d >= lo && w.d < hi)) continue
    for (const e of w.entries || []) {
      for (const [slug, n] of Object.entries(entrySetCounts(e))) out[slug] = (out[slug] || 0) + n
    }
  }
  return out
}

/** Logged workouts in the week containing `iso`. */
export function weekWorkoutCount(S, iso = todayISO()) {
  const ws = weekStartOf(S)
  const start = startOfWeek(iso, ws)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const lo = isoOf(start), hi = isoOf(end)
  return (S?.workouts || []).filter(w => w?.d >= lo && w.d < hi).length
}

/**
 * Per-muscle progress for the week containing `iso`: done vs target, biggest gap first —
 * the order the generator allocates against and the Today card reads top-down.
 */
export function targetsProgress(S, iso = todayISO()) {
  const targets = weekTargets(profileOf(S))
  const done = weekSets(S, iso)
  return MUSCLES
    .map(slug => ({ slug, done: done[slug] || 0, target: targets[slug], pct: targets[slug] ? Math.min(1, (done[slug] || 0) / targets[slug]) : 1 }))
    .sort((a, b) => a.pct - b.pct || a.slug.localeCompare(b.slug))
}

/**
 * The weekly-goal streak: consecutive finished-or-current weeks with at least
 * daysPerWeek logged workouts. The current week counts as soon as it is hit (the streak
 * card updates after the workout that reaches it, A9); a past week short of the goal
 * ends the run. Purely derived — the same history always reads the same streak.
 */
export function weekStreak(S, iso = todayISO()) {
  const goal = Math.max(1, Number(profileOf(S).daysPerWeek) || 3)
  const ws = weekStartOf(S)
  const cursor = startOfWeek(iso, ws)
  // The current week joins the run as soon as its goal is hit; before that, the streak
  // is the run of hit weeks ending last week — an open week breaks nothing yet.
  let streak = weekWorkoutCount(S, isoOf(cursor)) >= goal ? 1 : 0
  for (let i = 0; i < 520; i++) {
    cursor.setDate(cursor.getDate() - 7)
    if (weekWorkoutCount(S, isoOf(cursor)) >= goal) streak++
    else break
  }
  return streak
}
