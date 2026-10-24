import { describe, expect, it } from 'vitest'
import { FOODS_CSV_HEADER, importFoodsIn, parseCsv, parseFoodsImport } from './nutrition-import.js'
import { foodsJson, foodLogCsv, dailyCsv } from './nutrition-export.js'
import { makeEntry, makeFood } from './nutrition.js'

const NOW = 1_700_000_000_000

describe('parseFoodsImport — JSON', () => {
  it('reads the exported shape and lands every food as import', () => {
    const json = foodsJson([makeFood({ name: 'Powder', perServing: { calories: 130, proteinG: 25 }, src: 'label' }, NOW)])
    const { foods, errors } = parseFoodsImport(json)
    expect(errors).toEqual([])
    expect(foods).toHaveLength(1)
    expect(foods[0].name).toBe('Powder')
    expect(foods[0].src).toBe('import')          // a shared file cannot mint 'label' foods
    expect(foods[0].perServing.proteinG).toBe(25)
  })
  it('keeps the first of duplicate ids and re-ids the rest', () => {
    const a = makeFood({ name: 'A', perServing: { calories: 1 } }, NOW)
    const { foods } = parseFoodsImport(JSON.stringify({ foods: [a, { ...a, name: 'A clone' }] }))
    expect(foods).toHaveLength(2)
    expect(foods[0].id).toBe(a.id)
    expect(foods[1].id).not.toBe(a.id)
  })
})

describe('parseFoodsImport — CSV', () => {
  it('reads the foods CSV, quotes and all', () => {
    const csv = FOODS_CSV_HEADER + '\n' + '"Soup, tomato",BrandX,,1 cup,2,240,150,8,20,4,,,,,300,\n'
    const { foods, errors } = parseFoodsImport(csv)
    expect(errors).toEqual([])
    expect(foods[0].name).toBe('Soup, tomato')
    expect(foods[0].servingsPerContainer).toBe(2)
    expect(foods[0].perServing.sodiumMg).toBe(300)
    expect(foods[0].src).toBe('import')
  })
})

describe('parseFoodsImport — hostile input', () => {
  it('negative and absurd numbers are rejected per field, not coerced', () => {
    const { foods } = parseFoodsImport(JSON.stringify({
      foods: [{ name: 'Bad', perServing: { calories: -50, proteinG: 1e9, carbsG: 'lots', fatG: 10 } }],
    }))
    expect(foods).toHaveLength(1)
    expect(foods[0].perServing.calories).toBeNull()
    expect(foods[0].perServing.proteinG).toBeNull()
    expect(foods[0].perServing.carbsG).toBeNull()
    expect(foods[0].perServing.fatG).toBe(10)
  })
  it('a food with no usable numbers at all is skipped with a row error', () => {
    const { foods, errors } = parseFoodsImport(JSON.stringify({
      foods: [{ name: 'Empty' }, { name: 'Fine', perServing: { calories: 90 } }],
    }))
    expect(foods.map(f => f.name)).toEqual(['Fine'])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 1/)
  })
  it('HTML in a name is inert text, capped in length', () => {
    const evil = '<script>alert(1)</script>' + 'x'.repeat(500)
    const { foods } = parseFoodsImport(JSON.stringify({ foods: [{ name: evil, perServing: { calories: 1 } }] }))
    expect(foods[0].name.startsWith('<script>')).toBe(true)
    expect(foods[0].name.length).toBeLessThanOrEqual(200)
  })
  it('absurd servingsPerContainer becomes null', () => {
    const { foods } = parseFoodsImport(JSON.stringify({
      foods: [{ name: 'Vat', servingsPerContainer: 1e9, perServing: { calories: 5 } }],
    }))
    expect(foods[0].servingsPerContainer).toBeNull()
  })
  it('a file that is neither shape is one error and no foods, never a throw', () => {
    expect(parseFoodsImport('hello world')).toEqual({ foods: [], errors: [expect.any(String)] })
    expect(parseFoodsImport('')).toEqual({ foods: [], errors: ['The file is empty'] })
    expect(parseFoodsImport('{"nope": true}').foods).toEqual([])
    expect(parseFoodsImport('{broken json').errors).toHaveLength(1)
  })
})

describe('importFoodsIn', () => {
  it('skips names the library already holds, case-insensitively', () => {
    const s = { foods: [makeFood({ name: 'Powder' }, NOW)] }
    const { foods } = parseFoodsImport(JSON.stringify({
      foods: [{ name: 'powder', perServing: { calories: 1 } }, { name: 'New', perServing: { calories: 2 } }],
    }))
    expect(importFoodsIn(s, foods)).toBe(1)
    expect(s.foods.map(f => f.name)).toEqual(['Powder', 'New'])
  })
})

describe('parseCsv', () => {
  it('handles quoted commas, doubled quotes and embedded newlines', () => {
    expect(parseCsv('a,"b,c","d""e"\n1,2,3')).toEqual([['a', 'b,c', 'd"e'], ['1', '2', '3']])
    expect(parseCsv('"line1\nline2",x')).toEqual([['line1\nline2', 'x']])
  })
})

describe('the export bridge (Pip\'s logs)', () => {
  const log = [
    makeEntry({ name: 'Powder', d: '2026-10-23', t: 1, servings: 2, perServing: { calories: 130, proteinG: 25, carbsG: 3, fatG: 1, sodiumMg: 130 }, src: 'label' }, NOW),
    makeEntry({ name: 'Burger, big', d: '2026-10-23', t: 2, servings: 1, perServing: { calories: 700, proteinG: 30 }, src: 'estimate', note: 'drive-thru' }, NOW),
  ]
  it('foodLogCsv scales totals and keeps the source column honest', () => {
    const csv = foodLogCsv(log)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('date,name,servings,calories,protein_g,carbs_g,fat_g,sodium_mg,source,note')
    expect(lines[1]).toBe('2026-10-23,Powder,2,260,50,6,2,260,label,')
    expect(lines[2]).toBe('2026-10-23,"Burger, big",1,700,30,,,,estimate,drive-thru')
  })
  it('dailyCsv rolls days up', () => {
    const csv = dailyCsv(log)
    expect(csv.trim().split('\n')[1]).toBe('2026-10-23,960,80,6,2,260,2')
  })
  it('round-trips: the foods JSON export imports back', () => {
    const foods = [makeFood({ name: 'Powder', perServing: { calories: 130, proteinG: 25 }, src: 'label' }, NOW)]
    const { foods: back, errors } = parseFoodsImport(foodsJson(foods))
    expect(errors).toEqual([])
    expect(back[0].perServing).toEqual(foods[0].perServing)
  })
})
