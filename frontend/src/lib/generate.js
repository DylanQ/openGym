// The workout generator (fitbod-experience.md B4): composeSession(S, date, mods) → plan.
// A pure function of state — the same design religion as lib/progression.js. The plan is
// DERIVED, never a stored routine: composing reads the profile (lib/profile.js), the
// active gym (lib/gyms.js), recovery (lib/freshness.js), the week's set counts
// (lib/targets.js), exercise preferences (lib/ex-pref.js) and history, and builds each
// entry through the session builder the app already trusts (lib/session-start.js), so a
// generated session opens with exactly the rows a planned one would.
//
// Every entry carries its reason (B0.2): the progression policy's own `why`, or one of
// this file's strings for the cases the policies don't cover — a seed weight, a
// calibration start, a re-entry. Knee flags appear in the score as a −0.25 nudge and in
// the flags as a stamp; they never remove a lift (B0.1).
import { EXIDX } from './exercises.js'
import { isAssisted } from './exercises.js'
import { musclesOf } from './muscles.js'
import { exAvailable } from './equipment.js'
import { modeOf } from './history.js'
import { buildPlannedEntry } from './session-start.js'
import { sessionsFor, weightIncrement, snapWeight } from './progression.js'
import { progressionGuidance } from './progression-copy.js'
import { best1RM } from './onerm.js'
import { ownedWeightsFor, ownedDown } from './dumbbells.js'
import { convertWeight } from './units.js'
import { todayISO } from './format.js'
import { workoutAt } from './history.js'
import { profileOf, goalRow, splitDays, durationOf } from './profile.js'
import { activeGym, stateForGym } from './gyms.js'
import { freshnessOf } from './freshness.js'
import { weekTargets, weekSets } from './targets.js'
import { prefOf } from './ex-pref.js'
import { kneeStatus, myGymSet, MY_GYM_SEED } from './my-gym.js'
import { reentryDue, plateauOf, provingDue, lastTrainedAt, REENTRY_FACTOR } from './progression-polish.js'
import { isWarmupRow } from './workout-model.js'

const SEED_BY_ID = new Map(MY_GYM_SEED.map(e => [e.id, e]))
const SKIP_CATS = new Set(['stretching', 'mobility', 'yoga', 'pilates', 'rehab', 'cardio', 'combat', 'isometric'])
const NOT_A_LIFT = /stretch|yoga|\bpose\b|mobility|warm-?up|toe touch|\bplank\b/i
const COMPOUND_NAME = /squat|deadlift|bench press|overhead press|shoulder press|barbell row|bent-over row|pull-up|chin-up|\bdip\b|lunge|hip thrust|leg press/i

/** The primary muscle(s) of an exercise: the slugs musclesOf weights at 1. */
export function primariesOf(ex) {
  const w = musclesOf(ex)
  const max = Math.max(0, ...Object.values(w))
  return Object.keys(w).filter(s => w[s] > 0 && w[s] >= max)
}

export const isCompound = ex => {
  const w = musclesOf(ex)
  return Object.values(w).filter(v => v > 0).length >= 3 || COMPOUND_NAME.test(ex?.n || '')
}

/* ---------------------------------------------------------- day picking -- */

/** The split day the most recent logged session most resembled (overlap of primaries). */
function classifyDay(S, days, beforeIso) {
  const past = [...(S?.workouts || [])]
    .filter(w => w?.d && w.d <= beforeIso && (w.entries || []).some(e => (e.sets || []).some(s => s?.done)))
    .sort((a, b) => String(b.d).localeCompare(String(a.d)))
  if (!past.length) return -1
  const trained = new Set()
  for (const e of past[0].entries || []) {
    const ex = EXIDX[e.id]
    if (ex) primariesOf(ex).forEach(m => trained.add(m))
  }
  let best = -1, bestScore = 0
  days.forEach((d, i) => {
    const score = d.muscles.filter(m => trained.has(m)).length
    if (score > bestScore) { bestScore = score; best = i }
  })
  return best
}

const dayAvgFresh = (day, fresh) =>
  day.muscles.length ? day.muscles.reduce((n, m) => n + (fresh[m] ?? 100), 0) / day.muscles.length : 100

/** Fresh mode's day: the best-recovered muscles, target gaps breaking ties (B4 Step 2). */
function freshDay(fresh, gaps) {
  const muscles = Object.keys(fresh)
    .sort((a, b) => (fresh[b] - fresh[a]) || ((gaps[b] || 0) - (gaps[a] || 0)))
    .filter(m => fresh[m] >= 40)
    .slice(0, 5)
  const picked = muscles.length >= 2 ? muscles
    : Object.keys(fresh).sort((a, b) => fresh[b] - fresh[a]).slice(0, 3)
  return { key: 'fresh', name: 'Fresh Muscles', muscles: picked, fresh: true }
}

/**
 * Today's target day. Rotation advances the split by history (the day after the one the
 * last session resembled); Fresh mode — or a mods.focus — decides by recovery instead.
 * A split day whose muscles are all under 50% still composes (inform, never block,
 * B0.1) but carries lowRecovery and the freshest alternative as a one-tap suggestion.
 */
export function pickDay(S, profile, fresh, mods = {}, date = todayISO(), gaps = {}) {
  const days = splitDays(profile)
  if (mods.focus === 'fresh' || profile.split === 'fresh') return freshDay(fresh, gaps)
  if (mods.focus) {
    const forced = days.find(d => d.key === mods.focus)
    if (forced) return { ...forced }
  }
  if (!days.length) return freshDay(fresh, gaps)
  const last = classifyDay(S, days, date)
  const day = days[last < 0 ? 0 : (last + 1) % days.length]
  const out = { ...day }
  if (day.muscles.every(m => (fresh[m] ?? 100) < 50)) {
    const alt = days.filter(d => d.key !== day.key).sort((a, b) => dayAvgFresh(b, fresh) - dayAvgFresh(a, fresh))[0]
    if (alt && dayAvgFresh(alt, fresh) - dayAvgFresh(day, fresh) >= 15) {
      out.lowRecovery = true
      out.suggestedDayKey = alt.key
    }
  }
  return out
}

/* ------------------------------------------------------------- scoring -- */

/**
 * Score one exercise for one primary muscle (B4 Step 3), or null when it is not a
 * candidate at all — wrong mode, a stretch, equipment the active gym doesn't have
 * (a HARD filter), or a standing 'never'. Everything else is a nudge up or down,
 * knee-caution included: information, never a gate.
 */
export function scoreCandidate(S, view, profile, ex, muscle, fresh, gaps = {}, cache = null) {
  if (!ex || SKIP_CATS.has(ex.cat) || NOT_A_LIFT.test(ex.n || '')) return null
  if (modeOf({ id: ex.id }) !== 'reps') return null
  const primaries = primariesOf(ex)
  if (!primaries.includes(muscle)) return null
  if (!exAvailable(view, ex)) return null
  const pref = prefOf(S, ex.id)
  if (pref === 'never') return null
  const goalFit = isCompound(ex) ? 1 : 0.4
  let score = 3.0 * ((fresh[muscle] ?? 100) / 100)
    + 1.0 * goalFit
    + (pref === 'more' ? 1.5 : pref === 'less' ? -1.5 : 0)
    + ((cache?.myGym || myGymSet(S)).has(ex.id) ? 0.75 : 0)
    + 0.5 * Math.max(0, Math.min(1, (gaps[muscle] || 0) / 8))
  // Experience gates complexity, Fitbod's first question (A1): a beginner is not handed
  // the Olympic lifts; an intermediate meets them late in the list, not never.
  if (ex.cat === 'olympic' || ex.cat === 'plyometrics') {
    if (profile.experience === 'beginner') return null
    score -= 0.5
  }
  // The same exercise as the last session's is yesterday's answer, not variety.
  if ((cache?.lastIds || lastSessionIds(S)).has(ex.id)) score -= 1.0
  if (kneeStatus(ex) === 'caution') score -= 0.25
  // A plateaued anchor rotates out for a session (B7.4): the variant gets its turn.
  const plateau = cache?.plateau ? cache.plateau(ex.id) : plateauOf(S, ex.id)
  if (plateau) score -= 0.5
  return score
}

function lastSessionIds(S, now = Date.now()) {
  const ws = [...(S?.workouts || [])].sort((a, b) => String(b?.d || '').localeCompare(String(a?.d || '')))
  // Only a recent last session counts against variety: the same lift a fortnight ago is
  // not yesterday's answer, and penalising it would push anchors out of their own
  // rotation (and fight the re-entry ramp, which exists for exactly that gap).
  if (!ws.length || (workoutAt(ws[0]) || 0) < now - 2 * 24 * 3600 * 1000) return new Set()
  return new Set((ws[0]?.entries || []).map(e => e.id))
}

/** Candidates per muscle for a day: [{ ex, muscle, score }] sorted best first. */
export function candidatesFor(S, view, profile, day, fresh, gaps = {}, now = Date.now()) {
  // The expensive reads (My Gym membership, last session, plateau per exercise) are
  // computed once per compose, not once per exercise per muscle.
  const plateauCache = new Map()
  const cache = {
    myGym: myGymSet(S),
    lastIds: lastSessionIds(S, now),
    plateau: id => {
      if (!plateauCache.has(id)) plateauCache.set(id, plateauOf(S, id))
      return plateauCache.get(id)
    },
  }
  const out = {}
  for (const muscle of day.muscles) {
    const list = []
    for (const ex of Object.values(EXIDX)) {
      const score = scoreCandidate(S, view, profile, ex, muscle, fresh, gaps, cache)
      if (score != null) list.push({ ex, muscle, score })
    }
    out[muscle] = list.sort((a, b) => b.score - a.score || (a.ex.id < b.ex.id ? -1 : 1))
  }
  return out
}

/* ------------------------------------------------------------ allocation -- */

const estSecOf = (sets, compound, row) =>
  sets * ((compound ? 40 : 30) + (compound ? row.restCompound : row.restIsolation))

function allocate(cands, day, profile, done, targets, mods) {
  const row = goalRow(profile.goal)
  const budgetSec = durationOf(profile, mods) * 60
  const gaps = {}
  for (const m of day.muscles) gaps[m] = Math.max(0, (targets[m] || 0) - (done[m] || 0))
  const muscles = [...day.muscles].sort((a, b) => (gaps[b] - gaps[a]) || a.localeCompare(b))
  const picks = []
  const taken = new Set()
  const perMuscle = {}
  let estSec = 0
  const take = (cand, sets) => {
    picks.push({ ...cand, sets })
    taken.add(cand.ex.id)
    perMuscle[cand.muscle] = (perMuscle[cand.muscle] || 0) + 1
    estSec += estSecOf(sets, isCompound(cand.ex), row)
  }
  // First round: one anchor per muscle, sets sized to the week's gap for it.
  for (const m of muscles) {
    const cand = (cands[m] || []).find(c => !taken.has(c.ex.id))
    if (!cand) continue
    take(cand, gaps[m] >= 6 ? 4 : 3)
  }
  // Second round: an accessory per muscle (Fitbod's cap is two) while the hour has room.
  for (const m of muscles) {
    if (estSec >= budgetSec || picks.length >= 9) break
    if ((perMuscle[m] || 0) >= 2) continue
    const cand = (cands[m] || []).find(c => !taken.has(c.ex.id))
    if (!cand) continue
    take(cand, gaps[m] > 2 ? 3 : 2)
  }
  return picks
}

/* --------------------------------------------------------- entry building -- */

/** The lightest sensible first load for an exercise nobody has ever logged here. */
function calibrationWeight(S, ex) {
  const unit = S?.unit || 'kg'
  if (ex.eq === 'dumbbell') {
    const owned = [...(S?.dumbbells?.[unit]?.weights || [])].filter(w => w > 0)
    return owned.length ? Math.min(...owned) : convertWeight(5, 'lb', unit)
  }
  if (ex.eq === 'body weight' || ex.eq === 'assisted') return 0
  return convertWeight(20, 'lb', unit)
}

/** Rest for a generated entry, scaled by how heavy the prescription sits vs the e1RM. */
function restFor(row, compound, topW, e1rm) {
  if (e1rm > 0 && topW > 0 && topW / e1rm >= 0.85) return compound ? 180 : 120
  return compound ? row.restCompound : row.restIsolation
}

function buildEntry(view, S, profile, pick, pseudo, ctx) {
  const { ex, muscle } = pick
  const unit = S.unit || 'kg'
  const row = goalRow(profile.goal)
  const seed = S.exWeights?.[ex.id] || null
  const hasHistory = lastTrainedAt(S, ex.id) != null
  const seeded = !hasHistory && !!seed
  const calibration = !hasHistory && !seed
  const compound = isCompound(ex)
  const cfg = {
    id: ex.id, sets: pick.sets, reps: row.reps[1], repsMin: row.reps[0],
    weight: seeded ? seed.w : calibration ? calibrationWeight(view, ex) : 0,
    prog: 'double', restSec: compound ? row.restCompound : row.restIsolation, warmupSets: 0,
  }
  let built = buildPlannedEntry(view, cfg, pseudo)
  const workRows = () => built.sets.filter(s => !isWarmupRow(s))
  let topW = Math.max(0, ...workRows().map(s => Number(s.w) || 0))
  // Warm-up ramp rows (B4 Step 7): eligible = profile asks, loaded, not assisted, not a
  // calibration guess, and a working weight worth ramping to (40 lb). The rows are the
  // app's own warm-ups, so a mid-session weight edit re-ramps them the usual way.
  const warmEligible = profile.warmupSets && !isAssisted(ex) && ex.eq !== 'body weight' && !calibration &&
    topW >= convertWeight(40, 'lb', unit)
  if (warmEligible) {
    built = buildPlannedEntry(view, { ...cfg, warmupSets: 3 }, pseudo)
    topW = Math.max(0, ...workRows().map(s => Number(s.w) || 0))
  }
  // Re-entry ramp (B7.3): 90% for one session after a break, snapped to the exercise's
  // own grid — or down the owned-bell list, never to a bell the gym doesn't have.
  let why = progressionGuidance(built.plan)?.why || built.plan?.why || null
  const days = reentryDue(S, ex.id, ctx.now)
  let reentry = null
  if (days != null && topW > 0) {
    const step = weightIncrement(cfg, unit)
    const owned = ownedWeightsFor(view, cfg)
    const scale = w => {
      const target = (Number(w) || 0) * REENTRY_FACTOR
      if (!owned) return snapWeight(target, step)
      return ownedDown(owned, Math.max(target, Math.min(...owned))) ?? Math.min(...owned)
    }
    built = {
      ...built,
      sets: built.sets.map(s => (isWarmupRow(s) ? s : { ...s, w: scale(s.w) })),
      target: { ...built.target, weight: scale(built.target.weight ?? topW) },
    }
    reentry = days
    why = ['Back after {0} days away — re-entry at 90% for today.', days]
    topW = Math.max(0, ...workRows().map(s => Number(s.w) || 0))
  }
  if (seeded) {
    why = ['Seed weight from your log — {0} {1}, confirmed {2}.', seed.w, unit, seed.d || '']
  }
  if (calibration) why = ['Starting estimate — log your reps and RiR and it calibrates.']
  // Intensity-scaled rest (B6.1): a heavy day rests longer than a light one.
  const e1 = best1RM(view, ex.id)?.est || 0
  const restSec = restFor(row, compound, topW, e1)
  built = { ...built, target: { ...built.target, restSec } }
  // Proving set (B7.2): every 5th session of an anchor, ≤1 per muscle per session,
  // never a knee-caution lift (provingDue enforces it), never inside a superset (the
  // pairing below skips proving entries).
  let proving = false
  if (!ctx.provingMuscles.has(muscle) && provingDue(view, ex.id, { seedIds: new Set(SEED_BY_ID.keys()) })) {
    proving = true
    ctx.provingMuscles.add(muscle)
  }
  return {
    id: ex.id, target: built.target, plan: built.plan, sets: built.sets, planned: built.planned,
    why, muscle, score: pick.score,
    flags: {
      seeded, calibration, reentry, proving, compound,
      knee: kneeStatus(ex), plateau: !!plateauOf(S, ex.id),
    },
  }
}

/* -------------------------------------------------------------- compose -- */

export const profileKeyOf = profile => JSON.stringify(profile || {})

/**
 * Compose today's session. Returns the plan object Today's Entry renders and Start
 * locks in (B5): entries built by the session builder, each with its reason and flags,
 * plus the day metadata the header needs. Nothing is written to the store here — the
 * caller caches the result into S.todayPlan and keeps the old one as the Undo.
 */
export function composeSession(S, { date = todayISO(), now = Date.now(), mods = {} } = {}) {
  const profile = profileOf(S)
  const gym = activeGym(S)
  const view = stateForGym(S, gym)
  const fresh = freshnessOf(S, now)
  const targets = weekTargets(profile)
  const done = weekSets(S, date)
  const gaps = {}
  for (const m of Object.keys(targets)) gaps[m] = Math.max(0, targets[m] - (done[m] || 0))
  const day = pickDay(S, profile, fresh, mods, date, gaps)
  const cands = candidatesFor(S, view, profile, day, fresh, gaps, now)
  const picks = allocate(cands, day, profile, done, targets, mods)
  const pseudo = { id: 'today-plan', name: day.name, ex: [] }
  const ctx = { now, provingMuscles: new Set() }
  const entries = []
  for (const pick of picks) {
    const entry = buildEntry(view, S, profile, pick, pseudo, ctx)
    if (entry) entries.push(entry)
  }
  // Supersets (profile opt-in): the two lowest-conflict accessories pair at the end —
  // never a proving entry, never a compound anchor.
  if (profile.supersets) {
    const pair = entries.filter(e => !e.flags.compound && !e.flags.proving).slice(-2)
    if (pair.length === 2) pair.forEach(e => { e.sg = 'gen-ss' })
  }
  return {
    date, gymId: gym?.id || null, dayKey: day.key, dayName: day.name,
    lowRecovery: !!day.lowRecovery, suggestedDayKey: day.suggestedDayKey || null,
    mods: { ...mods }, entries, composedAt: now, profileKey: profileKeyOf(profile),
  }
}

/** Whether a cached plan no longer matches the state it was composed from (B4). */
export function planStale(S, plan, date = todayISO()) {
  if (!plan || plan.date !== date) return true
  if ((plan.gymId || null) !== (activeGym(S)?.id || null)) return true
  if (plan.profileKey !== profileKeyOf(profileOf(S))) return true
  return (S?.workouts || []).some(w => (workoutAt(w) || 0) > (plan.composedAt || 0))
}

/** Plan-level swap (B5): replace one entry with the best alternative for its muscle. */
export function swapPlanEntry(S, plan, index, { now = Date.now() } = {}) {
  const old = plan?.entries?.[index]
  if (!old) return null
  const profile = profileOf(S)
  const gym = activeGym(S)
  const view = stateForGym(S, gym)
  const fresh = freshnessOf(S, now)
  const day = { key: plan.dayKey, name: plan.dayName, muscles: [old.muscle] }
  const cands = (candidatesFor(S, view, profile, day, fresh, {})[old.muscle] || [])
    .filter(c => c.ex.id !== old.id && !plan.entries.some(e => e.id === c.ex.id))
  if (!cands.length) return null
  const workSets = old.sets.filter(s => !isWarmupRow(s)).length || 3
  const pseudo = { id: 'today-plan', name: plan.dayName, ex: [] }
  const entry = buildEntry(view, S, profile, { ...cands[0], sets: workSets }, pseudo, { now, provingMuscles: new Set(plan.entries.filter(e => e.flags?.proving).map(e => e.muscle)) })
  if (!entry) return null
  const entries = plan.entries.slice()
  entries[index] = entry
  return { ...plan, entries }
}

/**
 * Stepper edits on the preview (the mockup's Sets/Reps/Weight steppers): pure — returns
 * a new plan with the one entry adjusted. Weight steps ride the exercise's own
 * increment grid, the way the workout screen steps it.
 */
export function adjustPlanEntry(plan, index, unit, { setsDelta = 0, repsDelta = 0, weightDelta = 0 } = {}) {
  const entry = plan?.entries?.[index]
  if (!entry) return plan
  const entries = plan.entries.slice()
  let sets = entry.sets.slice()
  let target = { ...entry.target }
  if (setsDelta) {
    const work = sets.filter(s => !isWarmupRow(s))
    if (setsDelta > 0 && work.length) sets = [...sets, { ...work[work.length - 1], done: false }]
    else if (setsDelta < 0 && work.length > 1) {
      const lastWork = sets.map((s, i) => (isWarmupRow(s) ? -1 : i)).filter(i => i >= 0).pop()
      sets = sets.filter((_, i) => i !== lastWork)
    }
    target = { ...target, sets: sets.filter(s => !isWarmupRow(s)).length }
  }
  if (repsDelta) {
    sets = sets.map(s => (isWarmupRow(s) ? s : { ...s, r: Math.max(1, (Number(s.r) || 0) + repsDelta) }))
    if (target.reps != null) target = { ...target, reps: Math.max(1, (Number(target.reps) || 0) + repsDelta) }
  }
  if (weightDelta) {
    const step = weightIncrement(target, unit || 'kg')
    sets = sets.map(s => (isWarmupRow(s) ? s : { ...s, w: Math.max(0, snapWeight((Number(s.w) || 0) + weightDelta * step, step)) }))
    if (target.weight != null) target = { ...target, weight: Math.max(0, snapWeight((Number(target.weight) || 0) + weightDelta * step, step)) }
  }
  entries[index] = { ...entry, sets, target }
  return { ...plan, entries }
}

/* One exercise added to an existing plan by hand (the preview's "+ Add exercise"): the
   same build path as a composed entry, at the plan's own goal and rest, so a manual add
   and a generated pick are indistinguishable once they land in the session. */
export function entryForExercise(S, plan, exId, { sets = 3, now = Date.now() } = {}) {
  const view = viewFor(S, plan?.gymId)
  const profile = profileOf(S)
  const ex = exOr(exId)
  if (!ex || !exAvailable(view, ex)) return null
  const muscle = primariesOf(ex)[0]
  if (!muscle) return null
  const pick = { ex, muscle, score: 0 }
  const built = buildEntry(S, view, profile, { id: 'today-plan' }, pick, sets, now, { profiles: null, provingMuscles: new Set() })
  return built ? { ...built, sg: undefined } : null
}

/** Totals for the preview header and the muscle-share chips, derived from the entries. */
export function planTotals(plan) {
  const entries = plan?.entries || []
  let workSets = 0, estSec = 0
  const perMuscle = {}
  for (const e of entries) {
    const n = e.sets.filter(s => !isWarmupRow(s)).length
    workSets += n
    perMuscle[e.muscle] = (perMuscle[e.muscle] || 0) + n
    estSec += n * ((e.flags?.compound ? 40 : 30) + (Number(e.target?.restSec) || 90))
  }
  const shares = Object.entries(perMuscle)
    .map(([slug, sets]) => ({ slug, sets, pct: workSets ? Math.round((sets / workSets) * 100) : 0 }))
    .sort((a, b) => b.sets - a.sets)
  return { exercises: entries.length, workSets, estMin: Math.max(1, Math.round(estSec / 60)), shares }
}
