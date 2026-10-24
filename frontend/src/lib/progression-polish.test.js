// Progression polish (fitbod-experience.md B7): the re-entry ramp's threshold, the
// plateau flag's flatness, and the proving set's gates — including the fork's own:
// a knee-caution lift is never assigned one (B0.1).
import { describe, expect, it } from 'vitest'
import { reentryDue, daysSinceTrained, plateauOf, provingDue } from './progression-polish.js'

const DAY = 24 * 3600 * 1000
const NOW = Date.parse('2026-10-23T12:00:00')
const session = (id, w, r, daysAgo, sets = 3) => ({
  id: `w-${id}-${daysAgo}`, d: new Date(NOW - daysAgo * DAY).toISOString().slice(0, 10),
  start: NOW - daysAgo * DAY,
  entries: [{ id, target: { sets, reps: r, weight: w }, sets: Array.from({ length: sets }, () => ({ w, r, done: true })) }],
})
const S = (workouts) => ({ unit: 'lb', workouts, exWeights: {}, customEx: [] })

describe('re-entry', () => {
  it('is due at ten days away, not at nine', () => {
    expect(reentryDue(S([session('0576', 65, 10, 9)]), '0576', NOW)).toBeNull()
    expect(reentryDue(S([session('0576', 65, 10, 10)]), '0576', NOW)).toBe(10)
    expect(reentryDue(S([session('0576', 65, 10, 21)]), '0576', NOW)).toBe(21)
  })
  it('never fires for an exercise with no history', () => {
    expect(daysSinceTrained(S([]), '0576', NOW)).toBeNull()
    expect(reentryDue(S([]), '0576', NOW)).toBeNull()
  })
})

describe('plateau', () => {
  it('flags four flat exposures and leaves a climbing lift alone', () => {
    const flat = S([3, 10, 17, 24].map(d => session('0576', 65, 10, d)))
    expect(plateauOf(flat, '0576')).not.toBeNull()
    const climbing = S([3, 10, 17, 24].map((d, i) => session('0576', 55 + i * 5, 10, d)))
    expect(plateauOf(climbing, '0576')).toBeNull()
  })
  it('needs four exposures before it says anything', () => {
    const three = S([3, 10, 17].map(d => session('0576', 65, 10, d)))
    expect(plateauOf(three, '0576')).toBeNull()
  })
})

describe('proving sets', () => {
  it('falls due on every fifth session of an anchor lift', () => {
    const four = S([3, 6, 9, 12].map(d => session('0576', 65, 10, d)))
    expect(provingDue(four, '0576', { seedIds: new Set(['0576']) })).toBe(true)
    const three = S([3, 6, 9].map(d => session('0576', 65, 10, d)))
    expect(provingDue(three, '0576', { seedIds: new Set(['0576']) })).toBe(false)
  })
  it('is never auto-assigned to a knee-caution lift, however many sessions it has', () => {
    const four = S([3, 6, 9, 12].map(d => session('2267', 65, 12, d)))
    expect(provingDue(four, '2267', { seedIds: new Set(['2267']) })).toBe(false)
  })
})
