// Nutrition exports (nutrition-spec.md §4.1): the food-log CSV that bridges to Pip's
// food logs, a daily-summary CSV, and the saved-foods JSON for moving a label library
// between installs. Pure string builders — the view hands the result to the share sheet
// (MOBILE, lib/mobile.js shareExport) or a browser download, as the other exports do.

// One row per foodLog entry:
//   date,name,servings,calories,protein_g,carbs_g,fat_g,sodium_mg,source,note
// Macro columns are the SCALED totals (per-serving × servings) at full precision — Pip's
// logs want what was eaten, not what a serving holds. A field the label never gave is an
// empty cell, never a 0: unknown is not zero anywhere in this section.
import { entriesForDay } from './nutrition.js'
import { scalePerServing } from './nutrition-math.js'

const cell = v => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
const num = v => (v === null || v === undefined || !Number.isFinite(Number(v)) ? '' : String(Math.round(Number(v) * 100) / 100))

export const FOODLOG_CSV_HEADER = 'date,name,servings,calories,protein_g,carbs_g,fat_g,sodium_mg,source,note'

export function foodLogCsv(foodLog, days = null) {
  const entries = (Array.isArray(foodLog) ? foodLog : [])
    .filter(e => e && (!days || days.includes(e.d)))
    .slice()
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : (a.t || 0) - (b.t || 0)))
  const rows = entries.map(e => {
    const scaled = scalePerServing(e.perServing, e.servings)
    return [
      e.d, e.name, num(e.servings), num(scaled.calories), num(scaled.proteinG),
      num(scaled.carbsG), num(scaled.fatG), num(scaled.sodiumMg), e.src || 'manual', e.note || '',
    ].map(cell).join(',')
  })
  return [FOODLOG_CSV_HEADER, ...rows].join('\n') + '\n'
}

export const DAILY_CSV_HEADER = 'date,calories,protein_g,carbs_g,fat_g,sodium_mg,entries'

/** One row per day that has entries, newest last: the shape a weekly review wants. */
export function dailyCsv(foodLog) {
  const days = [...new Set((Array.isArray(foodLog) ? foodLog : []).map(e => e?.d).filter(Boolean))].sort()
  const rows = days.map(d => {
    let calories = 0, proteinG = 0, carbsG = 0, fatG = 0, sodiumMg = 0, n = 0
    for (const e of entriesForDay(foodLog, d)) {
      const scaled = scalePerServing(e.perServing, e.servings)
      n++
      calories += scaled.calories || 0; proteinG += scaled.proteinG || 0
      carbsG += scaled.carbsG || 0; fatG += scaled.fatG || 0; sodiumMg += scaled.sodiumMg || 0
    }
    return [d, num(calories), num(proteinG), num(carbsG), num(fatG), num(sodiumMg), String(n)].join(',')
  })
  return [DAILY_CSV_HEADER, ...rows].join('\n') + '\n'
}

/** The saved-foods library as JSON (§4.1.3): the exact shape nutrition-import.js reads. */
export function foodsJson(foods) {
  return JSON.stringify({ foods: Array.isArray(foods) ? foods : [] }, null, 2)
}
