// Servings arithmetic for the Nutrition section (nutrition-spec.md §2).
//
// One rule runs through everything here: totals are exact — `perServing × servings` at full
// precision — and rounding happens only where a number is shown. A stored entry keeps the
// per-serving snapshot it was logged with and the servings as typed; nothing in this module
// ever rounds a value that gets written back to state.

// The fields every per-serving record carries (lib/nutrition.js PER_SERVING_FIELDS). Scaling
// walks this list so a field added to the shape later is scaled without a second edit here.
export const SCALABLE_FIELDS = [
  'calories', 'proteinG', 'carbsG', 'fatG', 'sugarsG', 'addedSugarsG',
  'saturatedFatG', 'fiberG', 'sodiumMg', 'cholesterolMg',
]

/** A finite number or null — the only shapes a macro value may take. */
export const numOrNull = v => {
  const n = Number(v)
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n
}

/**
 * Parse what a person typed as servings: a positive decimal ('1.5', '0.33', '2'), a fraction
 * ('1/2'), or a decimal comma ('1,5'). Returns null for anything else — empty, zero, negative,
 * or not a number — so the caller can refuse rather than guess.
 */
export function parseServings(text) {
  if (typeof text === 'number') return Number.isFinite(text) && text > 0 ? text : null
  const s = String(text ?? '').trim().replace(',', '.')
  if (!s) return null
  const frac = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(s)
  if (frac) {
    const den = Number(frac[2])
    if (!(den > 0)) return null
    const v = Number(frac[1]) / den
    return v > 0 ? v : null
  }
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null
  const v = Number(s)
  return v > 0 ? v : null
}

/** The stepper's move: ±0.25, never to zero or below (a 0-serving entry is a deletion). */
export function stepServings(servings, dir) {
  const cur = Number(servings)
  if (!Number.isFinite(cur)) return 0.25
  const next = Math.round((cur + 0.25 * Math.sign(dir)) * 100) / 100
  return Math.max(0.25, next)
}

/**
 * perServing × servings, field by field. A field the label never gave (null) stays null at any
 * servings count — unknown is not zero, and the day totals read it that way (§3.4).
 */
export function scalePerServing(perServing, servings) {
  const s = Number(servings)
  const out = {}
  for (const f of SCALABLE_FIELDS) {
    const v = numOrNull(perServing?.[f])
    out[f] = v === null || !Number.isFinite(s) ? null : v * s
  }
  return out
}

/** Display rounding (spec §2): calories whole, grams to a tenth, sodium/cholesterol whole mg. */
export function roundForDisplay(field, v) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return null
  const n = Number(v)
  if (field === 'calories' || field === 'sodiumMg' || field === 'cholesterolMg') return Math.round(n)
  return Math.round(n * 10) / 10
}

/** A scaled total as shown: '240' kcal, '12.5' g. Null stays null so the view can print '–'. */
export function fmtMacro(field, v) {
  const r = roundForDisplay(field, v)
  return r === null ? null : String(r)
}
