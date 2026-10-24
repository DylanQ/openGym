// The label parser against synthetic OCR dumps in ML Kit's shape. The fixtures are built
// from rows of [text, x] segments sharing a y band — the two-column panel as the camera
// sees it: name left, value middle, % Daily Value far right as its own line on the row.
import { describe, expect, it } from 'vitest'
import { parseLabel } from './label-parse.js'

function ocr(rows) {
  let y = 0
  const blocks = rows.map(row => {
    const top = y; y += 30
    return {
      lines: row.map(([text, x = 0]) => ({
        text,
        elements: [{ text, boundingBox: { left: x, top, right: x + Math.max(10, text.length * 9), bottom: top + 20 } }],
      })),
    }
  })
  return { text: rows.map(r => r.map(([t]) => t).join(' ')).join('\n'), blocks }
}

const POWDER = ocr([
  [['Serving size', 0], ['1 scoop (31g)', 210]],
  [['Servings per container', 0], ['about 30', 320]],
  [['Calories', 0], ['130', 210]],
  [['Total Fat', 0], ['1g', 320], ['2%', 440]],
  [['Saturated Fat', 0], ['0.5g', 320], ['3%', 440]],
  [['Trans Fat', 0], ['0g', 320]],
  [['Cholesterol', 0], ['15mg', 320], ['5%', 440]],
  [['Sodium', 0], ['130mg', 320], ['6%', 440]],
  [['Total Carbohydrate', 0], ['3g', 320], ['1%', 440]],
  [['Dietary Fiber', 0], ['1g', 320], ['4%', 440]],
  [['Total Sugars', 0], ['1g', 320]],
  [['Includes', 0], ['0g', 110], ['Added Sugars', 160], ['0%', 440]],
  [['Protein', 0], ['25g', 320], ['50%', 440]],
])

describe('parseLabel — a clean panel with boxes', () => {
  const p = parseLabel(POWDER)
  it('reads every field', () => {
    expect(p.servingSizeText).toBe('1 scoop (31g)')
    expect(p.servingWeightG).toBe(31)
    expect(p.servingsPerContainer).toBe(30)
    expect(p.servingsApprox).toBe(true)
    expect(p.perServing).toEqual({
      calories: 130, proteinG: 25, carbsG: 3, fatG: 1, sugarsG: 1, addedSugarsG: 0,
      saturatedFatG: 0.5, fiberG: 1, sodiumMg: 130, cholesterolMg: 15,
    })
  })
  it('is confident about clean reads', () => {
    for (const f of ['calories', 'proteinG', 'carbsG', 'fatG', 'sodiumMg']) expect(p.confidence[f]).toBe('high')
  })
  it('never takes the %DV column as a value', () => {
    // Protein's row carries 25g and 50%: the gram value wins.
    expect(p.perServing.proteinG).toBe(25)
    expect(p.perServing.fatG).toBe(1)
  })
  it('reads added sugars from before the anchor words ("Includes 0g Added Sugars")', () => {
    expect(p.perServing.addedSugarsG).toBe(0)
  })
})

describe('parseLabel — flat text, no boxes', () => {
  const p = parseLabel({
    text: [
      'Nutrition Facts', 'Serving Size 1 cup (240g)', 'Servings Per Container 4',
      'Calories 150', 'Total Fat 8g', 'Saturated Fat 5g', 'Cholesterol 35mg',
      'Sodium 120mg', 'Total Carbohydrate 12g', 'Dietary Fiber 0g', 'Total Sugars 12g',
      'Includes 10g Added Sugars', 'Protein 8g',
    ].join('\n'),
  })
  it('reads the panel', () => {
    expect(p.servingSizeText).toBe('1 cup (240g)')
    expect(p.servingWeightG).toBe(240)
    expect(p.servingsPerContainer).toBe(4)
    expect(p.perServing.calories).toBe(150)
    expect(p.perServing.fatG).toBe(8)
    expect(p.perServing.saturatedFatG).toBe(5)
    expect(p.perServing.carbsG).toBe(12)
    expect(p.perServing.sugarsG).toBe(12)
    expect(p.perServing.addedSugarsG).toBe(10)
    expect(p.perServing.proteinG).toBe(8)
    expect(p.perServing.sodiumMg).toBe(120)
    expect(p.perServing.cholesterolMg).toBe(35)
  })
})

describe('parseLabel — the %DV trap', () => {
  it('a row whose only number is a % is missing, never guessed', () => {
    const p = parseLabel(ocr([
      [['Calories', 0], ['200', 210]],
      [['Total Fat', 0], ['10%', 440]],
      [['Protein', 0], ['50%', 440]],
    ]))
    expect(p.perServing.fatG).toBeNull()
    expect(p.confidence.fatG).toBe('missing')
    expect(p.perServing.proteinG).toBeNull()
    expect(p.confidence.proteinG).toBe('missing')
    expect(p.perServing.calories).toBe(200)
  })
})

describe('parseLabel — OCR digit confusions', () => {
  const p = parseLabel(ocr([
    [['Calories', 0], ['1S0', 210]],
    [['Total Fat', 0], ['O.5g', 320]],
    [['Protein', 0], ['2Sg', 320]],
    [['Total Carbohydrate', 0], ['3g', 320]],
  ]))
  it('normalizes numeric-shaped tokens only', () => {
    expect(p.perServing.calories).toBe(150)
    expect(p.perServing.fatG).toBe(0.5)
    expect(p.perServing.proteinG).toBe(25)
  })
  it('marks normalized reads as check, not high', () => {
    expect(p.confidence.calories).toBe('check')
    expect(p.confidence.fatG).toBe('check')
    expect(p.confidence.proteinG).toBe('check')
    expect(p.confidence.carbsG).toBe('high')
  })
  it('tolerates a garbled anchor word, at check confidence', () => {
    const q = parseLabel(ocr([[['Totai Fat', 0], ['8g', 320]]]))
    expect(q.perServing.fatG).toBe(8)
    expect(q.confidence.fatG).toBe('check')
  })
})

describe('parseLabel — units and ranges', () => {
  it('converts sodium printed in grams, with a note', () => {
    const p = parseLabel(ocr([[['Sodium', 0], ['0.45g', 320]]]))
    expect(p.perServing.sodiumMg).toBe(450)
    expect(p.notes).toContain('sodiumMg-in-grams')
  })
  it('reads thousands separators', () => {
    const p = parseLabel(ocr([[['Sodium', 0], ['1,200mg', 320]]]))
    expect(p.perServing.sodiumMg).toBe(1200)
  })
  it('flags an out-of-range value as check, value unchanged', () => {
    const p = parseLabel(ocr([[['Protein', 0], ['250g', 320]]]))
    expect(p.perServing.proteinG).toBe(250)
    expect(p.confidence.proteinG).toBe('check')
    expect(p.notes).toContain('proteinG-out-of-range')
  })
  it('picks up the unit from the next token', () => {
    const p = parseLabel(ocr([[['Protein', 0], ['25', 320], ['g', 350], ['50%', 440]]]))
    expect(p.perServing.proteinG).toBe(25)
  })
})

describe('parseLabel — lookalike rows', () => {
  it('"calories from fat" is not the calorie row', () => {
    const p = parseLabel(ocr([
      [['Calories from Fat', 0], ['90', 210]],
      [['Calories', 0], ['250', 210]],
    ]))
    expect(p.perServing.calories).toBe(250)
  })
  it('saturated fat alone does not become total fat', () => {
    const p = parseLabel(ocr([[['Saturated Fat', 0], ['5g', 320]]]))
    expect(p.perServing.fatG).toBeNull()
    expect(p.perServing.saturatedFatG).toBe(5)
  })
  it('the "% daily value" footnote never reads as protein', () => {
    const p = parseLabel({ text: '* The % Daily Value (DV) tells you how much a nutrient contributes.\nProtein 20g' })
    expect(p.perServing.proteinG).toBe(20)
  })
})

describe('parseLabel — the calorie cross-check', () => {
  it('flags a panel whose macros cannot make its calories, without changing a number', () => {
    const p = parseLabel(ocr([
      [['Calories', 0], ['500', 210]],
      [['Total Fat', 0], ['1g', 320]],
      [['Total Carbohydrate', 0], ['1g', 320]],
      [['Protein', 0], ['1g', 320]],
    ]))
    expect(p.notes).toContain('calorie-cross-check')
    expect(p.perServing.calories).toBe(500)
    expect(p.confidence.calories).toBe('check')
    expect(p.confidence.proteinG).toBe('check')
  })
  it('stays quiet when the macros roughly make the calories', () => {
    expect(parseLabel(POWDER).notes).not.toContain('calorie-cross-check')
  })
})

describe('parseLabel — servings lines', () => {
  it('reads "about N servings per container" written as one line', () => {
    const p = parseLabel({ text: 'About 8 servings per container\nServing size 2 tbsp (30g)\nCalories 90' })
    expect(p.servingsPerContainer).toBe(8)
    expect(p.servingsApprox).toBe(true)
    expect(p.servingWeightG).toBe(30)
  })
  it('an absent servings-per-container is missing, not zero', () => {
    const p = parseLabel({ text: 'Calories 90' })
    expect(p.servingsPerContainer).toBeNull()
    expect(p.confidence.servingsPerContainer).toBe('missing')
  })
})

describe('parseLabel — junk in, nothing out', () => {
  it('empty input parses to an all-missing label', () => {
    const p = parseLabel({})
    expect(p.perServing.calories).toBeNull()
    expect(p.confidence.calories).toBe('missing')
    expect(p.servingSizeText).toBeNull()
  })
  it('unrelated text finds nothing', () => {
    const p = parseLabel({ text: 'Shake well before use. Refrigerate after opening.' })
    expect(p.perServing.proteinG).toBeNull()
    expect(p.perServing.sodiumMg).toBeNull()
  })
})
