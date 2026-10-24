// My Gym — this fork's personal layer over the 5,632-exercise catalogue (game plan Phase 3).
//
// The catalogue is a dataset; Dylan trains a handful of lifts at one gym. My Gym scopes the
// Library and the exercise picker down to that world: a seeded core rotation (his Planet
// Fitness machines + dumbbell work), his favourites, and what he has trained recently. The
// rest of the catalogue stays one tap away — the filter narrows the list, it never removes
// exercises from the app.
//
// Nothing here invents storage: the seed writes into the fields the app already has —
// S.favEx (lib/favourites.js), S.exWeights (the confirmed working weight a session falls
// back to, lib/history.js), S.exNotes (standing per-exercise notes) and ordinary routines.
// Everything it writes is therefore synced, exported and editable like anything else, and
// deleting it is just editing those fields back.
//
// Ids below were resolved against the renamed catalogue on 2026-10-23 (exercise-name-map.json);
// my-gym.test.js pins each id to its display name, so a future dataset refresh that renumbers
// the catalogue fails loudly here instead of silently seeding the wrong lifts.

import { EXIDX } from './exercises.js'
import { favIds } from './favourites.js'
import { convertWeight } from './units.js'
import { uid } from './format.js'

// The date the seed's numbers were confirmed in Dylan's own training log (his working weights
// as of October 2026). exWeights entries are { w, d } — a weight and the day it was confirmed.
export const MY_GYM_SEED_DATE = '2026-10-23'

// His core rotation. `lb` is the working weight in pounds — the unit his log keeps — converted
// to the profile's unit when the seed is applied (lib/units.js). A null `lb` means "no seeded
// weight": calf raises are in his rotation, but his log carries no load for them, so the seed
// does not invent one. `day` groups the lift into his push/legs rotation for the starter
// routines below. There is deliberately no pull routine: his log seeds no pull lifts, and the
// seed does not invent exercises for him.
export const MY_GYM_SEED = [
  { id: '0576', day: 'push', sets: 3, reps: 10, lb: 65 },   // Machine Chest Press
  { id: '1030', day: 'push', sets: 3, reps: 12, lb: 55 },   // Machine Pec Deck Fly
  { id: '0334', day: 'push', sets: 3, reps: 12, lb: 15 },   // Dumbbell Lateral Raise
  { id: '0201', day: 'push', sets: 3, reps: 12, lb: 80 },   // Cable Pushdown (triceps)
  { id: '2267', day: 'legs', sets: 3, reps: 12, lb: 65 },   // Machine Seated Leg Press
  { id: '0599', day: 'legs', sets: 3, reps: 12, lb: 60 },   // Machine Seated Leg Curl
  { id: '1459', day: 'legs', sets: 3, reps: 10, lb: 20 },   // Dumbbell Romanian Deadlift (per hand)
  { id: '0417', day: 'legs', sets: 3, reps: 15, lb: null }, // Dumbbell Standing Calf Raise
]

export const MY_GYM_IDS = MY_GYM_SEED.map(e => e.id)
const SEED_SET = new Set(MY_GYM_IDS)

// Standing notes the seed files with the lifts they belong to. The leg-press note is his
// injury history in one line (dislocated both knees as a kid; the press builds up gradually):
// it informs the session, it never blocks one — the restraint rule from the game plan.
export const MY_GYM_NOTES = {
  '2267': 'Knees: build up gradually — 65 lb × 12 felt fine, 75 lb felt off.',
}

/* Knee flags. Dylan dislocated both knees as a kid, so leg work carries a marker: `caution`
 * for movements that load the knee heavily through flexion under load, `safe` for the
 * hip-dominant / hamstring / calf work his history says does not bother them. Driven by a
 * small pattern list over the exercise's names (display name and dataset name alike — the
 * rename must not change a flag), never by a stored field, so a dataset refresh re-derives
 * them. Stretches and mobility work are never flagged: a lunge stretch is not a lunge.
 * A flag is information on the row, nothing more — selection is never blocked. */
const KNEE_CAUTION = [/leg press/i, /leg extension/i, /\bsquat/i, /\blunge/i]
const KNEE_SAFE = [/leg curl/i, /romanian deadlift/i, /stiff[ -]leg deadlift/i, /calf raise/i, /hip thrust/i, /glute bridge/i]
const NO_FLAG_CATS = new Set(['stretching', 'mobility', 'yoga'])

export function kneeStatus(ex) {
  if (!ex || typeof ex !== 'object' || NO_FLAG_CATS.has(ex.cat)) return null
  const names = [ex.n, ex.nOrig].filter(Boolean).join(' ')
  if (!names || /stretch/i.test(names)) return null
  if (KNEE_CAUTION.some(p => p.test(names))) return 'caution'
  if (KNEE_SAFE.some(p => p.test(names))) return 'safe'
  return null
}

export const kneeStatusOf = id => kneeStatus(EXIDX[id])

/** Exercise ids trained most recently, newest first, each once. */
export function recentIds(S, limit = 12) {
  const out = [], seen = new Set()
  const workouts = [...(S?.workouts || [])].sort((a, b) => String(b?.d || '').localeCompare(String(a?.d || '')))
  for (const w of workouts) {
    for (const e of w?.entries || []) {
      if (e?.id && !seen.has(e.id)) { seen.add(e.id); out.push(e.id) }
    }
    if (out.length >= limit) break
  }
  return out.slice(0, limit)
}

/**
 * The My Gym scope as an ordered id list: the seeded rotation first, then favourites, then
 * recents — each exercise once, in the order it should be read on a gym floor. Custom
 * exercises favourite or train their way in exactly like catalogue ones.
 */
export function myGymIds(S) {
  const out = [], seen = new Set()
  const add = id => { if (id && !seen.has(id)) { seen.add(id); out.push(id) } }
  MY_GYM_IDS.forEach(add)
  favIds(S).forEach(add)
  recentIds(S).forEach(add)
  return out
}

export const myGymSet = S => new Set(myGymIds(S))

/** Has the seed been applied to this profile? Its mark is a seeded working weight. */
export const myGymSeeded = S => MY_GYM_IDS.some(id => (S?.exWeights || {})[id])

/**
 * Apply the seed to a state draft (the `update` mutator's argument — same contract as
 * toggleFav). Conservative by construction: favourites are only added, a confirmed working
 * weight or a standing note that already exists is never overwritten, and a starter routine
 * is only created when no routine carries its name. Running it twice changes nothing the
 * second time. Weights are converted from pounds into the profile's own unit.
 */
export function applyMyGymSeed(s) {
  const unit = s.unit || 'kg'
  const fav = favIds(s)
  s.favEx = [...fav, ...MY_GYM_IDS.filter(id => !fav.includes(id))]
  s.exWeights = { ...(s.exWeights || {}) }
  for (const e of MY_GYM_SEED) {
    if (e.lb != null && !s.exWeights[e.id]) {
      s.exWeights[e.id] = { w: convertWeight(e.lb, 'lb', unit), d: MY_GYM_SEED_DATE }
    }
  }
  s.exNotes = { ...(s.exNotes || {}) }
  for (const [id, note] of Object.entries(MY_GYM_NOTES)) {
    if (!s.exNotes[id]) s.exNotes[id] = note
  }
  const routines = [...(s.routines || [])]
  for (const [day, name, emoji] of [['push', 'Push Day', 'barbell'], ['legs', 'Leg Day', 'legs']]) {
    if (routines.some(r => r.name === name)) continue
    routines.push({
      id: uid(), name, emoji,
      ex: MY_GYM_SEED.filter(e => e.day === day).map(e => ({
        id: e.id, sets: e.sets, reps: e.reps,
        weight: e.lb != null ? convertWeight(e.lb, 'lb', unit) : 0,
      })),
    })
  }
  s.routines = routines
  return s
}
