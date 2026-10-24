// Exercise preferences and passive swap learning (fitbod-experience.md B5.3): a swap is
// data, never a verdict — the suggestion appears at three swaps and applying it stays
// a decision.
import { describe, expect, it } from 'vitest'
import { prefOf, setPref, recordSwap, swapsAway, swapSuggestion } from './ex-pref.js'

const NOW = Date.parse('2026-10-23T12:00:00')

describe('prefOf / setPref', () => {
  it('reads normal by default and round-trips the standing values', () => {
    const s = {}
    expect(prefOf(s, '0576')).toBe('normal')
    setPref(s, '0576', 'less')
    expect(prefOf(s, '0576')).toBe('less')
    setPref(s, '0576', 'never')
    expect(prefOf(s, '0576')).toBe('never')
    setPref(s, '0576', 'normal')
    expect(prefOf(s, '0576')).toBe('normal')
    expect(s.exPref).toEqual({})
  })
})

describe('swap learning', () => {
  it('counts swaps away inside 30 days, and only those', () => {
    const s = {}
    recordSwap(s, '1459', '0599', NOW - 1000)
    recordSwap(s, '1459', '0599', NOW - 2000)
    recordSwap(s, '1459', '2267', NOW - 31 * 24 * 3600 * 1000)
    expect(swapsAway(s, '1459', NOW)).toBe(2)
  })

  it('suggests less at three swaps, and stops once a preference exists', () => {
    const s = {}
    recordSwap(s, '1459', '0599', NOW)
    recordSwap(s, '1459', '0599', NOW)
    expect(swapSuggestion(s, '1459', NOW)).toBe(false)
    recordSwap(s, '1459', '2267', NOW)
    expect(swapSuggestion(s, '1459', NOW)).toBe(true)
    setPref(s, '1459', 'less')
    expect(swapSuggestion(s, '1459', NOW)).toBe(false)
  })

  it('ignores a swap recorded as its own replacement', () => {
    const s = {}
    recordSwap(s, '1459', '1459', NOW)
    expect(s.swapStats).toBeUndefined()
  })
})
