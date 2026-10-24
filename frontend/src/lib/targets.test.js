// Weekly set targets and the streak (fitbod-experience.md B7): the counting rule is
// the spec's — 1.0 to a primary muscle, 0.5 to a secondary, warm-ups never — and the
// streak is derived from history alone, so it can be pinned exactly.
import { describe, expect, it } from 'vitest'
import { weekTargets, entrySetCounts, weekSets, weekStreak, targetsProgress } from './targets.js'
import { profileOf } from './profile.js'

const S = (over = {}) => ({
  unit: 'lb', weekStart: 1, workouts: [], profile: null, exWeights: {}, ...over,
})
const done = (id, sets, d) => ({
  id: 'w-' + d + '-' + id, d, start: Date.parse(d + 'T12:00:00'),
  entries: [{ id, sets: Array.from({ length: sets }, () => ({ w: 50, r: 10, done: true })) }],
})

describe('weekTargets', () => {
  it('reads the goal table: recomp chest is a large-muscle 14 at 3 days, intermediate', () => {
    const t = weekTargets(profileOf(S({ exWeights: { '0576': { w: 65, d: '2026-10-23' } } })))
    expect(t.chest).toBe(14)
    expect(t.triceps).toBe(10)   // small-muscle middle of 8–12
    expect(t.calves).toBe(10)
  })
  it('scales with frequency and experience', () => {
    const base = weekTargets({ goal: 'recomp', experience: 'intermediate', daysPerWeek: 3 })
    const more = weekTargets({ goal: 'recomp', experience: 'advanced', daysPerWeek: 4 })
    expect(more.chest).toBeGreaterThan(base.chest)
  })
})

describe('the counting rule', () => {
  it('counts a set 1.0 to the primary and 0.5 to secondaries', () => {
    // Machine Chest Press: chest primary, triceps a secondary.
    const counts = entrySetCounts({ id: '0576', sets: [{ w: 65, r: 10, done: true }, { w: 65, r: 10, done: true }, { w: 65, r: 10, done: true }] })
    expect(counts.chest).toBe(3)
    expect(counts.triceps).toBe(1.5)
  })
  it('never counts warm-ups or unfinished sets', () => {
    const counts = entrySetCounts({
      id: '0576',
      sets: [
        { w: 35, r: 8, done: true, warmup: true, phase: 'warmup' },
        { w: 65, r: 10, done: true },
        { w: 65, r: 10, done: false },
      ],
    })
    expect(counts.chest).toBe(1)
  })
})

describe('weekSets', () => {
  it('counts only the week asked about', () => {
    const s = S({ workouts: [done('0576', 3, '2026-10-19'), done('0576', 3, '2026-10-12')] })
    expect(weekSets(s, '2026-10-21').chest).toBe(3)
    expect(weekSets(s, '2026-10-14').chest).toBe(3)
  })
})

describe('weekStreak', () => {
  // Weeks of Mon 2026-09-28, 10-05, 10-12, and the current week of Mon 10-19.
  const threeAWeek = (...mondays) => mondays.flatMap(m => {
    const base = Date.parse(m + 'T12:00:00')
    return [0, 2, 4].map(off => {
      const d = new Date(base + off * 86400000)
      const iso = d.toISOString().slice(0, 10)
      return done('0576', 3, iso)
    })
  })
  it('counts consecutive hit weeks, the current one included once hit', () => {
    const s = S({ workouts: threeAWeek('2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19') })
    expect(weekStreak(s, '2026-10-23')).toBe(4)
  })
  it('an open current week breaks nothing yet; last week’s run stands', () => {
    const s = S({ workouts: threeAWeek('2026-10-05', '2026-10-12') })
    expect(weekStreak(s, '2026-10-23')).toBe(2)
  })
  it('a missed week resets the run to zero', () => {
    const s = S({ workouts: threeAWeek('2026-09-28', '2026-10-12', '2026-10-19') })
    expect(weekStreak(s, '2026-10-23')).toBe(2)
  })
})

describe('targetsProgress', () => {
  it('sorts the biggest gap first', () => {
    const s = S({ workouts: [done('0576', 3, '2026-10-19')] })
    const rows = targetsProgress(s, '2026-10-21')
    expect(rows[rows.length - 1].slug).toBe('chest')   // the only muscle with any sets reads last (least gap)
    expect(rows.find(r => r.slug === 'chest').done).toBe(3)
  })
})
