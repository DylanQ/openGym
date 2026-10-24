import { describe, expect, it } from 'vitest'
import { fmtMacro, parseServings, roundForDisplay, scalePerServing, stepServings } from './nutrition-math.js'

describe('parseServings', () => {
  it('reads decimals, fractions and decimal commas', () => {
    expect(parseServings('1.5')).toBe(1.5)
    expect(parseServings('0.33')).toBe(0.33)
    expect(parseServings('1/2')).toBe(0.5)
    expect(parseServings('1,5')).toBe(1.5)
    expect(parseServings(2)).toBe(2)
  })
  it('refuses zero, negatives and nonsense rather than guessing', () => {
    expect(parseServings('0')).toBeNull()
    expect(parseServings('-1')).toBeNull()
    expect(parseServings('')).toBeNull()
    expect(parseServings('abc')).toBeNull()
    expect(parseServings('1/0')).toBeNull()
    expect(parseServings(null)).toBeNull()
  })
})

describe('stepServings', () => {
  it('moves in exact quarter steps and never reaches zero', () => {
    expect(stepServings(1, 1)).toBe(1.25)
    expect(stepServings(1, -1)).toBe(0.75)
    expect(stepServings(0.25, -1)).toBe(0.25)
    expect(stepServings(0.1 + 0.2, 1)).toBe(0.55)
  })
})

describe('scalePerServing', () => {
  const per = { calories: 130, proteinG: 25, carbsG: 3, fatG: 1, sodiumMg: 130, fiberG: null }
  it('scales exactly, at full precision', () => {
    const s = scalePerServing(per, 1.5)
    expect(s.calories).toBe(195)
    expect(s.proteinG).toBe(37.5)
    expect(s.sodiumMg).toBe(195)
    expect(scalePerServing(per, 0.33).proteinG).toBeCloseTo(8.25)
  })
  it('keeps unknown fields unknown at any servings count', () => {
    expect(scalePerServing(per, 3).fiberG).toBeNull()
    expect(scalePerServing(null, 2).calories).toBeNull()
  })
  it('covers every per-serving field', () => {
    const full = Object.fromEntries(Object.keys(scalePerServing({}, 1)).map(k => [k, 1]))
    expect(Object.keys(full)).toHaveLength(10)
  })
})

describe('display rounding', () => {
  it('calories and milligrams whole, grams to a tenth', () => {
    expect(roundForDisplay('calories', 195.4)).toBe(195)
    expect(roundForDisplay('calories', 195.5)).toBe(196)
    expect(roundForDisplay('proteinG', 37.55)).toBe(37.6)
    expect(roundForDisplay('sodiumMg', 195.4)).toBe(195)
    expect(roundForDisplay('proteinG', null)).toBeNull()
    expect(fmtMacro('proteinG', null)).toBeNull()
    expect(fmtMacro('calories', 200)).toBe('200')
  })
})
