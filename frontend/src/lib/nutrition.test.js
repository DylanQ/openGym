import { describe, expect, it } from 'vitest'
import {
  STARTER_FOODS, addEntryFromFoodIn, addEntryIn, addFoodIn, daySummaries, dayTotals,
  entriesForDay, importStarterFoodsIn, makeEntry, makeFood, proteinRemaining,
  removeEntryIn, removeFoodIn, updateEntryIn, updateFoodIn, weekRollup,
} from './nutrition.js'

const NOW = 1_700_000_000_000
const D = '2026-10-23'

const draft = (patch = {}) => ({ foods: [], foodLog: [], nutritionTargets: { proteinG: 180, calories: null }, ...patch })

describe('makeFood / makeEntry', () => {
  it('fills the whole per-serving shape with nulls, never zeros', () => {
    const f = makeFood({ name: 'Powder', perServing: { calories: 130, proteinG: 25 } }, NOW)
    expect(f.perServing.calories).toBe(130)
    expect(f.perServing.fatG).toBeNull()
    expect(f.perServing.sodiumMg).toBeNull()
    expect(f.src).toBe('manual')
    expect(f._ts).toBe(NOW)
  })
  it('falls back to manual for an unknown src', () => {
    expect(makeFood({ name: 'X', src: 'verified!!' }, NOW).src).toBe('manual')
    expect(makeEntry({ name: 'X', src: 'label' }, NOW).src).toBe('label')
  })
})

describe('logging from a food snapshots it', () => {
  it('later edits to the food do not rewrite the entry', () => {
    const s = draft()
    const food = addFoodIn(s, { name: 'Powder', perServing: { calories: 130, proteinG: 25 }, src: 'label' }, NOW)
    const entry = addEntryFromFoodIn(s, food.id, 2, { d: D }, NOW)
    expect(entry.perServing.proteinG).toBe(25)
    expect(entry.src).toBe('label')
    updateFoodIn(s, food.id, { perServing: { proteinG: 99 } }, NOW + 1)
    expect(s.foodLog[0].perServing.proteinG).toBe(25)
  })
})

describe('entry edits keep provenance immutable', () => {
  it('updateEntryIn ignores src and foodId in the patch', () => {
    const s = draft()
    const e = addEntryIn(s, { name: 'Guess', perServing: { calories: 400 }, src: 'estimate', d: D }, NOW)
    const out = updateEntryIn(s, e.id, { src: 'label', foodId: 'f1', servings: 0.5, note: 'half' }, NOW + 5)
    expect(out.src).toBe('estimate')
    expect(out.foodId).toBeNull()
    expect(out.servings).toBe(0.5)
    expect(out.note).toBe('half')
    expect(out._ts).toBe(NOW + 5)
  })
  it('removeEntryIn / removeFoodIn report what they did', () => {
    const s = draft()
    const e = addEntryIn(s, { name: 'A', d: D }, NOW)
    expect(removeEntryIn(s, e.id)).toBe(true)
    expect(removeEntryIn(s, e.id)).toBe(false)
    const f = addFoodIn(s, { name: 'B' }, NOW)
    expect(removeFoodIn(s, f.id)).toBe(true)
    expect(s.foods).toHaveLength(0)
  })
})

describe('food edits and the one promotion path', () => {
  it('editing an import food promotes it to manual; a label food stays label', () => {
    const s = draft()
    const imp = addFoodIn(s, { name: 'Shared', src: 'import', perServing: { calories: 10 } }, NOW)
    updateFoodIn(s, imp.id, { name: 'Shared, checked' }, NOW + 1)
    expect(s.foods[0].src).toBe('manual')
    const lab = addFoodIn(s, { name: 'Scanned', src: 'label', perServing: { calories: 10 } }, NOW)
    updateFoodIn(s, lab.id, { perServing: { calories: 12 } }, NOW + 2)
    expect(s.foods.find(f => f.id === lab.id).src).toBe('label')
  })
})

describe('dayTotals', () => {
  const log = [
    makeEntry({ name: 'Powder x2', d: D, t: 1, servings: 2, perServing: { calories: 130, proteinG: 25, carbsG: 3, fatG: 1, sodiumMg: 130 }, src: 'label' }, NOW),
    makeEntry({ name: 'Milk', d: D, t: 2, servings: 1, perServing: { calories: 80, proteinG: 13, carbsG: null, fatG: 2, sodiumMg: null }, src: 'manual' }, NOW),
    makeEntry({ name: 'Burger guess', d: D, t: 3, servings: 1, perServing: { calories: 700, proteinG: 30 }, src: 'estimate' }, NOW),
    makeEntry({ name: 'Other day', d: '2026-10-22', t: 4, servings: 1, perServing: { calories: 500, proteinG: 50 }, src: 'label' }, NOW),
  ]
  const totals = dayTotals(log, D)
  it('sums scaled values for the day only', () => {
    expect(totals.entries).toBe(3)
    expect(totals.calories).toBe(260 + 80 + 700)
    expect(totals.proteinG).toBe(50 + 13 + 30)
    expect(totals.sodiumMg).toBe(260)
  })
  it('treats a missing field as not-counted and names it partial', () => {
    expect(totals.partial).toContain('carbsG')
    expect(totals.partial).toContain('sodiumMg')
    expect(totals.partial).not.toContain('calories')
  })
  it('breaks the day down by provenance — verified and estimated never blend', () => {
    expect(totals.bySrc.label.proteinG).toBe(50)
    expect(totals.bySrc.manual.proteinG).toBe(13)
    expect(totals.bySrc.estimate.proteinG).toBe(30)
    expect(totals.bySrc.estimate.calories).toBe(700)
  })
  it('an empty day is zeros with no entries', () => {
    const t0 = dayTotals([], D)
    expect(t0.entries).toBe(0)
    expect(t0.proteinG).toBe(0)
    expect(t0.bySrc).toEqual({})
  })
})

describe('selectors', () => {
  it('entriesForDay sorts by time eaten', () => {
    const log = [makeEntry({ name: 'B', d: D, t: 20 }, NOW), makeEntry({ name: 'A', d: D, t: 10 }, NOW)]
    expect(entriesForDay(log, D).map(e => e.name)).toEqual(['A', 'B'])
  })
  it('proteinRemaining clamps at zero and is null without a target', () => {
    expect(proteinRemaining({ proteinG: 180 }, { proteinG: 142 })).toBe(38)
    expect(proteinRemaining({ proteinG: 180 }, { proteinG: 200 })).toBe(0)
    expect(proteinRemaining({ proteinG: null }, { proteinG: 10 })).toBeNull()
  })
  it('daySummaries lists only days with entries, newest first', () => {
    const log = [makeEntry({ name: 'A', d: '2026-10-20' }, NOW), makeEntry({ name: 'B', d: D }, NOW)]
    expect(daySummaries(log).map(x => x.d)).toEqual([D, '2026-10-20'])
  })
  it('weekRollup averages over logged days only and counts target hits', () => {
    const log = [
      makeEntry({ name: 'A', d: '2026-10-22', perServing: { calories: 2000, proteinG: 190 } }, NOW),
      makeEntry({ name: 'B', d: D, perServing: { calories: 1000, proteinG: 170 } }, NOW),
    ]
    const r = weekRollup(log, { proteinG: 180 }, D)
    expect(r.days).toBe(2)
    expect(r.avgProteinG).toBe(180)
    expect(r.avgCalories).toBe(1500)
    expect(r.daysAtTarget).toBe(1)
  })
})

describe('the starter library', () => {
  it('carries only label/manual provenance and verified calories+protein', () => {
    expect(STARTER_FOODS.length).toBe(13)
    for (const f of STARTER_FOODS) {
      expect(['label', 'manual']).toContain(f.src)
      expect(f.perServing.calories).toBeGreaterThan(0)
      expect(f.perServing.proteinG).toBeGreaterThan(0)
    }
    const kirk = STARTER_FOODS.find(f => f.name.includes('Kirkland'))
    expect(kirk.perServing).toMatchObject({ calories: 130, proteinG: 25 })
    expect(kirk.src).toBe('label')
  })
  it('seeds once — a second import adds nothing', () => {
    const s = draft()
    expect(importStarterFoodsIn(s, NOW)).toBe(13)
    expect(importStarterFoodsIn(s, NOW)).toBe(0)
    expect(s.foods).toHaveLength(13)
  })
})
