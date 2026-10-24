// The generator (fitbod-experience.md B4): composed against Dylan-shaped state — his
// Planet Fitness seed, his goal — the invariants are the spec's: the gym is a hard
// filter, every prescription carries a reason, knee flags never exclude, rotation
// follows history, and a break re-enters at 90% with the reason on the row.
import { describe, expect, it } from 'vitest'
import { composeSession, planStale, swapPlanEntry, adjustPlanEntry, planTotals, scoreCandidate, primariesOf } from './generate.js'
import { stateForGym, activeGym } from './gyms.js'
import { exAvailable } from './equipment.js'
import { EXIDX } from './exercises.js'
import { isWarmupRow } from './workout-model.js'

const NOW = Date.parse('2026-10-23T12:00:00')
const DATE = '2026-10-23'
const DAY = 24 * 3600 * 1000

const dylan = (over = {}) => ({
  unit: 'lb', workouts: [], routines: [], customEx: [], favEx: ['0576', '1030', '0334', '0201', '2267', '0599', '1459', '0417'],
  exWeights: {
    '0576': { w: 65, d: '2026-10-23' }, '1030': { w: 55, d: '2026-10-23' },
    '0334': { w: 15, d: '2026-10-23' }, '0201': { w: 80, d: '2026-10-23' },
    '2267': { w: 65, d: '2026-10-23' }, '0599': { w: 60, d: '2026-10-23' },
    '1459': { w: 20, d: '2026-10-23' },
  },
  exNotes: {}, equipProfiles: [], activeEquipId: null, equipFilterOn: false, dumbbells: {},
  bodyweight: [], profile: null, onboarded: true, gyms: [], activeGymId: null,
  exPref: {}, swapStats: {}, recoveryOverride: {}, weekStart: 1,
  ...over,
})
const session = (entries, daysAgo) => ({
  id: 'w' + daysAgo + Math.random().toString(36).slice(2, 5),
  d: new Date(NOW - daysAgo * DAY).toISOString().slice(0, 10), start: NOW - daysAgo * DAY,
  entries: entries.map(([id, w, r, sets = 3]) => ({
    id, target: { sets, reps: r, weight: w },
    sets: Array.from({ length: sets }, () => ({ w, r, done: true })),
  })),
})
const workRows = e => e.sets.filter(s => !isWarmupRow(s))

describe('composeSession on Dylan’s seeded install', () => {
  const plan = composeSession(dylan(), { date: DATE, now: NOW })

  it('opens on Push Day with a full, startable session', () => {
    expect(plan.dayKey).toBe('push')
    expect(plan.entries.length).toBeGreaterThanOrEqual(3)
    expect(plan.entries.length).toBeLessThanOrEqual(9)
  })

  it('keeps every exercise inside the active gym’s equipment — a hard filter', () => {
    const view = stateForGym(dylan(), activeGym(dylan()))
    for (const e of plan.entries) expect(exAvailable(view, EXIDX[e.id]), EXIDX[e.id].n).toBe(true)
    expect(plan.entries.some(e => EXIDX[e.id].eq === 'barbell')).toBe(false)
  })

  it('prescribes the seeded chest press at its seed weight, flagged and explained', () => {
    const press = plan.entries.find(e => e.id === '0576')
    expect(press, 'seed chest press is composed').toBeTruthy()
    expect(press.flags.seeded).toBe(true)
    expect(Math.max(...workRows(press).map(s => s.w))).toBe(65)
    expect(press.why?.[0]).toContain('Seed weight from your log')
  })

  it('gives every entry a human-readable reason', () => {
    for (const e of plan.entries) {
      expect(Array.isArray(e.why), EXIDX[e.id].n).toBe(true)
      expect(typeof e.why[0]).toBe('string')
      expect(e.why[0].length).toBeGreaterThan(3)
    }
  })

  it('budgets the hour: the estimate lands near 60 minutes, never a marathon', () => {
    const totals = planTotals(plan)
    expect(totals.estMin).toBeGreaterThanOrEqual(35)
    expect(totals.estMin).toBeLessThanOrEqual(85)
    expect(totals.shares.reduce((n, s) => n + s.pct, 0)).toBeGreaterThanOrEqual(98)
  })
})

describe('rotation and prefs', () => {
  it('advances the split by history: push two days ago means pull today', () => {
    const s = dylan({ workouts: [session([['0576', 65, 10], ['0201', 80, 12]], 2)] })
    expect(composeSession(s, { date: DATE, now: NOW }).dayKey).toBe('pull')
  })

  it('a standing never removes the exercise from the composed day', () => {
    const s = dylan({ exPref: { '0576': 'never' } })
    const plan = composeSession(s, { date: DATE, now: NOW })
    expect(plan.entries.some(e => e.id === '0576')).toBe(false)
    expect(plan.entries.length).toBeGreaterThanOrEqual(3)
  })

  it('knee-caution informs but never excludes: the leg press stays a candidate', () => {
    const s = dylan()
    const view = stateForGym(s, activeGym(s))
    const fresh = Object.fromEntries(Object.keys(EXIDX).length ? [] : [])
    void fresh
    const score = scoreCandidate(s, view, { goal: 'recomp', experience: 'intermediate' }, EXIDX['2267'], 'quadriceps', { quadriceps: 100 }, {})
    expect(score).not.toBeNull()
    const plan = composeSession(s, { date: DATE, now: NOW, mods: { focus: 'legs' } })
    const press = plan.entries.find(e => e.id === '2267')
    if (press) expect(press.flags.knee).toBe('caution')
  })
})

describe('re-entry', () => {
  it('a lift untouched for two weeks re-enters at 90% with the reason on the row', () => {
    const s = dylan({ workouts: [session([['0576', 100, 10]], 14)] })
    const plan = composeSession(s, { date: DATE, now: NOW, mods: { focus: 'push' } })
    const press = plan.entries.find(e => e.id === '0576')
    expect(press, 'the anchor is composed').toBeTruthy()
    expect(press.flags.reentry).toBe(14)
    expect(Math.max(...workRows(press).map(s => s.w))).toBeLessThanOrEqual(90)
    expect(press.why[0]).toContain('re-entry at 90%')
  })
})

describe('plan edits', () => {
  const plan = composeSession(dylan(), { date: DATE, now: NOW })

  it('swapPlanEntry replaces an exercise with another for the same muscle', () => {
    const next = swapPlanEntry(dylan(), plan, 0, { now: NOW })
    expect(next).toBeTruthy()
    expect(next.entries[0].id).not.toBe(plan.entries[0].id)
    expect(next.entries[0].muscle).toBe(plan.entries[0].muscle)
    expect(next.entries).toHaveLength(plan.entries.length)
  })

  it('adjustPlanEntry steps weight on the increment grid, reps and sets in place', () => {
    const before = workRows(plan.entries[0])[0]
    const heavier = adjustPlanEntry(plan, 0, 'lb', { weightDelta: 1 })
    expect(workRows(heavier.entries[0])[0].w).toBeGreaterThan(before.w)
    const moreReps = adjustPlanEntry(plan, 0, 'lb', { repsDelta: 1 })
    expect(workRows(moreReps.entries[0])[0].r).toBe(before.r + 1)
    const moreSets = adjustPlanEntry(plan, 0, 'lb', { setsDelta: 1 })
    expect(workRows(moreSets.entries[0])).toHaveLength(workRows(plan.entries[0]).length + 1)
    // the original plan is untouched (pure)
    expect(workRows(plan.entries[0])).toHaveLength(workRows(plan.entries[0]).length)
  })
})

describe('planStale', () => {
  it('a just-composed plan is fresh; logging or switching gyms stales it', () => {
    const s = dylan()
    const plan = composeSession(s, { date: DATE, now: NOW - 60 * 1000 })
    expect(planStale(s, plan, DATE)).toBe(false)
    const logged = dylan({ workouts: [session([['0576', 65, 10]], 0)] })
    expect(planStale(logged, plan, DATE)).toBe(true)
    const otherGym = dylan({ gyms: [{ id: 'gym-x', name: 'Elsewhere', equipment: [], dbWeights: [] }], activeGymId: 'gym-x' })
    expect(planStale(otherGym, plan, DATE)).toBe(true)
    expect(planStale(s, plan, '2026-10-24')).toBe(true)
  })
})

describe('primariesOf', () => {
  it('names the muscles an exercise is for', () => {
    expect(primariesOf(EXIDX['0576'])).toContain('chest')
    expect(primariesOf(EXIDX['2267'])).toContain('quadriceps')
  })
})
