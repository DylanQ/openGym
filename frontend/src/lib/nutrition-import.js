// Saved-food import (nutrition-spec.md §4.3), in the defensive culture of lib/import-csv.js:
// a pure parser that never throws, reports row-level errors and skips the bad rows — never a
// whole-file failure, never a silent coercion.
//
// Two shapes are read: the foods JSON ({ "foods": [ … ] }, what nutrition-export.js writes)
// and a CSV with the saved-foods header below. However a food arrives, it lands with
// src: 'import' (§4.3) — imported numbers are unverified until Dylan edits/confirms the
// food, which promotes it to 'manual' (lib/nutrition.js updateFoodIn). A claimed src in the
// file is deliberately ignored: a shared library cannot mint 'label' foods.
//
// Hostile-input rules, each pinned by a test:
//   - numbers: negative, NaN, '1e9'-style magnitudes are rejected per field (the field
//     becomes null; a food with no valid calories AND no valid protein is skipped)
//   - servings: 0 / negative / absurd (> 10000) servingsPerContainer → null, not a crash
//   - names: HTML/script markup is kept as inert text (React escapes it), length-capped
//   - duplicate ids: the first food with an id wins; later ones are re-id'd
//   - a file that is neither JSON nor the foods CSV → one top-level error, zero foods

import { blankPerServing, makeFood } from './nutrition.js'

export const FOODS_CSV_HEADER = 'name,brand,barcode,serving_size,servings_per_container,serving_weight_g,calories,protein_g,carbs_g,fat_g,sugars_g,added_sugars_g,saturated_fat_g,fiber_g,sodium_mg,cholesterol_mg'

const MAX_NAME = 200
const CAPS = { calories: 10000, proteinG: 1000, carbsG: 1000, fatG: 1000, sugarsG: 1000, addedSugarsG: 1000, saturatedFatG: 1000, fiberG: 1000, sodiumMg: 100000, cholesterolMg: 10000 }

/** A sane macro value or null: finite, in [0, cap]. Text like '12g' is refused, not parsed. */
function sane(v, cap) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > cap) return null
  return n
}

const cleanText = v => String(v ?? '').trim().slice(0, MAX_NAME)

function foodFromRow(row, seenIds) {
  const name = cleanText(row.name)
  if (!name) return { error: 'missing name' }
  const perServing = blankPerServing({})
  let any = false
  for (const f of Object.keys(CAPS)) {
    perServing[f] = sane(row[f], CAPS[f])
    if (perServing[f] !== null) any = true
  }
  if (!any) return { error: `no usable numbers for "${name}"` }
  let id = typeof row.id === 'string' && row.id ? row.id : null
  if (id && seenIds.has(id)) id = null           // duplicate id: re-id below, first one wins
  const food = makeFood({
    id: id || undefined,
    name,
    brand: cleanText(row.brand),
    barcode: cleanText(row.barcode),
    servingSizeText: cleanText(row.servingSizeText),
    servingsPerContainer: sane(row.servingsPerContainer, 10000),
    servingWeightG: sane(row.servingWeightG, 10000),
    perServing,
    src: 'import',
    createdAt: Number(row.createdAt) > 0 ? Number(row.createdAt) : undefined,
  })
  seenIds.add(food.id)
  return { food }
}

function fromJson(text) {
  const data = JSON.parse(text)
  const list = Array.isArray(data) ? data : data?.foods
  if (!Array.isArray(list)) throw new Error('not a foods file')
  return list.map(r => (r && typeof r === 'object' ? {
    id: r.id, name: r.name, brand: r.brand, barcode: r.barcode,
    servingSizeText: r.servingSizeText, servingsPerContainer: r.servingsPerContainer,
    servingWeightG: r.servingWeightG,
    calories: r.perServing?.calories, proteinG: r.perServing?.proteinG, carbsG: r.perServing?.carbsG,
    fatG: r.perServing?.fatG, sugarsG: r.perServing?.sugarsG, addedSugarsG: r.perServing?.addedSugarsG,
    saturatedFatG: r.perServing?.saturatedFatG, fiberG: r.perServing?.fiberG,
    sodiumMg: r.perServing?.sodiumMg, cholesterolMg: r.perServing?.cholesterolMg,
    createdAt: r.createdAt,
  } : { name: '' }))
}

/** Minimal CSV reader: quoted cells, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text) {
  const rows = []
  let row = [], cur = '', quoted = false
  const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++ } else quoted = false }
      else cur += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
    else cur += c
  }
  row.push(cur)
  if (row.length > 1 || row[0] !== '') rows.push(row)
  return rows
}

const CSV_COLS = {
  name: 'name', brand: 'brand', barcode: 'barcode', serving_size: 'servingSizeText',
  servings_per_container: 'servingsPerContainer', serving_weight_g: 'servingWeightG',
  calories: 'calories', protein_g: 'proteinG', carbs_g: 'carbsG', fat_g: 'fatG',
  sugars_g: 'sugarsG', added_sugars_g: 'addedSugarsG', saturated_fat_g: 'saturatedFatG',
  fiber_g: 'fiberG', sodium_mg: 'sodiumMg', cholesterol_mg: 'cholesterolMg',
}

function fromCsv(text) {
  const rows = parseCsv(text).filter(r => r.some(c => String(c).trim() !== ''))
  if (!rows.length) throw new Error('empty file')
  const header = rows[0].map(h => String(h).trim().toLowerCase())
  if (!header.includes('name') || !header.includes('calories')) throw new Error('not a foods CSV')
  return rows.slice(1).map(cells => {
    const row = {}
    header.forEach((h, i) => { if (CSV_COLS[h]) row[CSV_COLS[h]] = cells[i] })
    return row
  })
}

/**
 * Parse a saved-foods file (JSON or CSV) → { foods, errors }.
 * `errors` names the rows that were skipped and why; `foods` are ready to append.
 */
export function parseFoodsImport(text) {
  const errors = []
  let rawRows
  try {
    const trimmed = String(text || '').trim()
    if (!trimmed) return { foods: [], errors: ['The file is empty'] }
    rawRows = trimmed.startsWith('{') || trimmed.startsWith('[') ? fromJson(trimmed) : fromCsv(trimmed)
  } catch (e) {
    return { foods: [], errors: ['That file is not a foods JSON or CSV export'] }
  }
  const foods = []
  const seenIds = new Set()
  rawRows.forEach((row, i) => {
    const { food, error } = foodFromRow(row || {}, seenIds)
    if (error) errors.push(`Row ${i + 1}: ${error}`)
    else foods.push(food)
  })
  return { foods, errors }
}

/** Append imported foods to a draft, skipping names the library already holds. */
export function importFoodsIn(s, foods) {
  if (!Array.isArray(s.foods)) s.foods = []
  const have = new Set(s.foods.map(f => f.name.toLowerCase()))
  let added = 0
  for (const f of foods || []) {
    if (!f || have.has(String(f.name || '').toLowerCase())) continue
    s.foods.push(f)
    have.add(f.name.toLowerCase())
    added++
  }
  return added
}
