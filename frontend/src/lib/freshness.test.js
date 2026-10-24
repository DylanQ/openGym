// Recovery % (fitbod-experience.md B4 Step 1): the adapter over the fatigue model, and
// the manual override for the sessions no log knows about.
import { describe, expect, it } from 'vitest'
import { freshnessOf, recoveredPctOf, overrideOf, setRecoveryOverride, clearRecoveryOverride, freshnessBand } from './freshness.js'
import { MUSCLES } from './muscles.js'

const NOW = Date.parse('2026-10-23T12:00:00')
const S = (over = {}) => ({ unit: 'lb', workouts: [], bodyweight: [], recoveryOverride: {}, ...over })

describe('recoveredPctOf', () => {
  it('is 100 at no fatigue, 0 at full, clamped outside', () => {
    expect(recoveredPctOf(0)).toBe(100)
    expect(recoveredPctOf(1)).toBe(0)
    expect(recoveredPctOf(1.4)).toBe(0)
    expect(recoveredPctOf(-0.2)).toBe(100)
    expect(recoveredPctOf(0.25)).toBe(75)
  })
})

describe('freshnessOf', () => {
  it('reads every drawable muscle at 100 with no history', () => {
    const f = freshnessOf(S(), NOW)
    for (const slug of MUSCLES) expect(f[slug], slug).toBe(100)
  })

  it('drops the muscles a recent session trained', () => {
    const w = {
      id: 'w1', d: '2026-10-23', start: NOW - 2 * 3600 * 1000,
      entries: [{ id: '0576', sets: [{ w: 65, r: 10, done: true }, { w: 65, r: 10, done: true }, { w: 65, r: 10, done: true }] }],
    }
    const f = freshnessOf(S({ workouts: [w] }), NOW)
    expect(f.chest).toBeLessThan(100)
    expect(f.calves).toBe(100)
  })

  it('honours an override until it lapses, then the model speaks again', () => {
    const s = S()
    setRecoveryOverride(s, 'quadriceps', 35, NOW)
    expect(freshnessOf(s, NOW).quadriceps).toBe(35)
    expect(freshnessOf(s, NOW + 4 * 24 * 3600 * 1000).quadriceps).toBe(100)
    expect(overrideOf(s, 'quadriceps', NOW + 4 * 24 * 3600 * 1000)).toBeNull()
    clearRecoveryOverride(s, 'quadriceps')
    expect(freshnessOf(s, NOW).quadriceps).toBe(100)
  })
})

describe('freshnessBand', () => {
  it('splits at the legend’s lines', () => {
    expect(freshnessBand(70)).toBe('fresh')
    expect(freshnessBand(69)).toBe('recovering')
    expect(freshnessBand(40)).toBe('recovering')
    expect(freshnessBand(39)).toBe('fatigued')
  })
})
