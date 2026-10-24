// Nutrition domain logic (nutrition-spec.md §3–§5): the saved-food library, the day log,
// and the totals the home screen reads. Pure functions over plain state shapes, in the house
// style (lib/bodyweight.js, lib/my-gym.js): creators return new records, mutators marked
// `In` write into a store draft (the `update` mutator's argument).
//
// Provenance is the load-bearing idea. Every food and every log entry carries
// src: 'label' | 'manual' | 'estimate' | 'import', set at creation and never changed by an
// edit — verified label numbers and best guesses are never silently mixed, and the day
// totals report the split (dayTotals' bySrc) so the UI can always show it.

import { isoOf, todayISO, uid } from './format.js'
import { numOrNull, scalePerServing } from './nutrition-math.js'

export const FOOD_SRCS = ['label', 'manual', 'estimate', 'import']
export const DEFAULT_TARGETS = { proteinG: 180, calories: null }

// The per-serving shape, in one place: every field a number or null (unknown — never 0).
export const PER_SERVING_FIELDS = [
  'calories', 'proteinG', 'carbsG', 'fatG', 'sugarsG', 'addedSugarsG',
  'saturatedFatG', 'fiberG', 'sodiumMg', 'cholesterolMg',
]

/** A per-serving record with every field present: numbers kept, anything else null. */
export function blankPerServing(patch = {}) {
  const out = {}
  for (const f of PER_SERVING_FIELDS) out[f] = numOrNull(patch?.[f])
  return out
}

const srcOf = (src, fallback) => (FOOD_SRCS.includes(src) ? src : fallback)

/**
 * A saved food (§3.1). `src` is the provenance of its per-serving numbers and is NOT
 * editable after the fact: re-scanning a label makes a new 'label' food rather than
 * quietly upgrading this one.
 */
export function makeFood(fields = {}, now = Date.now()) {
  return {
    id: fields.id || uid(),
    name: String(fields.name || '').trim(),
    brand: String(fields.brand || '').trim(),
    barcode: String(fields.barcode || '').trim(),
    servingSizeText: String(fields.servingSizeText || '').trim(),
    servingsPerContainer: numOrNull(fields.servingsPerContainer),
    servingWeightG: numOrNull(fields.servingWeightG),
    perServing: blankPerServing(fields.perServing),
    src: srcOf(fields.src, 'manual'),
    createdAt: fields.createdAt || now,
    _ts: now,
  }
}

/**
 * A log entry (§3.2): a SNAPSHOT. It copies the food's name and per-serving numbers at log
 * time, so correcting the saved food later never rewrites what was actually eaten.
 * `foodId` is null for one-off entries (quick add, estimate, manual one-off).
 */
export function makeEntry(fields = {}, now = Date.now()) {
  const servings = Number(fields.servings)
  return {
    id: fields.id || uid(),
    d: fields.d || todayISO(),
    t: fields.t || now,
    foodId: fields.foodId || null,
    name: String(fields.name || '').trim(),
    servings: Number.isFinite(servings) && servings > 0 ? servings : 1,
    perServing: blankPerServing(fields.perServing),
    src: srcOf(fields.src, 'manual'),
    note: String(fields.note || ''),
    _ts: now,
  }
}

/** An entry logged from a saved food: snapshot + inherited provenance. */
export function entryFromFood(food, servings, { d, t, note } = {}, now = Date.now()) {
  return makeEntry({
    foodId: food.id, name: food.name, servings,
    perServing: food.perServing, src: food.src, d, t, note,
  }, now)
}

/* ------------------------------------------------------------- draft mutators
   Each takes the store draft `s` (update's mutator argument), guards the slices into
   existence (an old profile's DEF overlay normally provides them), and returns what it
   made or changed, or null when there was nothing to do. */

export function addFoodIn(s, fields, now = Date.now()) {
  if (!Array.isArray(s.foods)) s.foods = []
  const food = makeFood(fields, now)
  if (!food.name) return null
  s.foods.push(food)
  return food
}

export function addEntryIn(s, fields, now = Date.now()) {
  if (!Array.isArray(s.foodLog)) s.foodLog = []
  const entry = makeEntry(fields, now)
  if (!entry.name) return null
  s.foodLog.push(entry)
  return entry
}

export function addEntryFromFoodIn(s, foodId, servings, opts = {}, now = Date.now()) {
  const food = (s.foods || []).find(f => f.id === foodId)
  if (!food) return null
  if (!Array.isArray(s.foodLog)) s.foodLog = []
  const entry = entryFromFood(food, servings, opts, now)
  s.foodLog.push(entry)
  return entry
}

/**
 * Edit an entry: servings / name / note / per-serving numbers / day+time may change.
 * `src` and `foodId` may NOT — provenance is immutable (§5); the patch keys are ignored
 * on purpose, with a test pinning that.
 */
export function updateEntryIn(s, id, patch = {}, now = Date.now()) {
  const entry = (s.foodLog || []).find(e => e.id === id)
  if (!entry) return null
  if (patch.name !== undefined) entry.name = String(patch.name).trim()
  if (patch.note !== undefined) entry.note = String(patch.note)
  if (patch.d !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(patch.d)) entry.d = patch.d
  if (patch.t !== undefined && Number(patch.t) > 0) entry.t = Number(patch.t)
  if (patch.servings !== undefined) {
    const v = Number(patch.servings)
    if (Number.isFinite(v) && v > 0) entry.servings = v
  }
  if (patch.perServing) entry.perServing = blankPerServing({ ...entry.perServing, ...patch.perServing })
  entry._ts = now
  return entry
}

export function removeEntryIn(s, id) {
  if (!Array.isArray(s.foodLog)) return false
  const before = s.foodLog.length
  s.foodLog = s.foodLog.filter(e => e.id !== id)
  return s.foodLog.length !== before
}

/**
 * Edit a saved food. Editing an 'import' food is the one promotion path (§4.3): a food
 * Dylan has looked at and confirmed becomes 'manual'. Every other src is untouched —
 * a 'label' food stays 'label' (its numbers came from a label, edits and all), an
 * 'estimate' stays an estimate.
 */
export function updateFoodIn(s, id, patch = {}, now = Date.now()) {
  const food = (s.foods || []).find(f => f.id === id)
  if (!food) return null
  if (patch.name !== undefined) food.name = String(patch.name).trim()
  if (patch.brand !== undefined) food.brand = String(patch.brand).trim()
  if (patch.barcode !== undefined) food.barcode = String(patch.barcode).trim()
  if (patch.servingSizeText !== undefined) food.servingSizeText = String(patch.servingSizeText).trim()
  if (patch.servingsPerContainer !== undefined) food.servingsPerContainer = numOrNull(patch.servingsPerContainer)
  if (patch.servingWeightG !== undefined) food.servingWeightG = numOrNull(patch.servingWeightG)
  if (patch.perServing) food.perServing = blankPerServing({ ...food.perServing, ...patch.perServing })
  if (food.src === 'import') food.src = 'manual'
  food._ts = now
  return food
}

export function removeFoodIn(s, id) {
  if (!Array.isArray(s.foods)) return false
  const before = s.foods.length
  s.foods = s.foods.filter(f => f.id !== id)
  return s.foods.length !== before
}

/* ------------------------------------------------------------- derived data (§3.4) */

const zeroTotals = () => ({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, sodiumMg: 0 })

/**
 * A day's totals from its log entries. Null fields are "not counted" — a label that never
 * listed sodium contributes nothing to the sodium total rather than a silent 0 (§8) — and
 * `partial` names the fields at least one entry was missing. `bySrc` breaks protein and
 * calories down by provenance so verified and estimated numbers are never blended invisibly.
 */
export function dayTotals(foodLog, d) {
  const totals = { ...zeroTotals(), entries: 0, partial: [], bySrc: {} }
  const partial = new Set()
  for (const e of Array.isArray(foodLog) ? foodLog : []) {
    if (!e || e.d !== d) continue
    totals.entries++
    const scaled = scalePerServing(e.perServing, e.servings)
    for (const f of ['calories', 'proteinG', 'carbsG', 'fatG', 'sodiumMg']) {
      if (scaled[f] === null) { partial.add(f); continue }
      totals[f] += scaled[f]
    }
    const src = srcOf(e.src, 'manual')
    if (!totals.bySrc[src]) totals.bySrc[src] = { calories: 0, proteinG: 0 }
    if (scaled.calories !== null) totals.bySrc[src].calories += scaled.calories
    if (scaled.proteinG !== null) totals.bySrc[src].proteinG += scaled.proteinG
  }
  totals.partial = [...partial]
  return totals
}

/** Entries of one day, in the order they were eaten. */
export const entriesForDay = (foodLog, d) =>
  (Array.isArray(foodLog) ? foodLog : []).filter(e => e?.d === d).slice().sort((a, b) => (a.t || 0) - (b.t || 0))

/** Protein still to go today; never negative, and null when no target is set. */
export function proteinRemaining(targets, totals) {
  const goal = numOrNull(targets?.proteinG)
  if (goal === null) return null
  return Math.max(0, goal - (totals?.proteinG || 0))
}

/** Per-day roll-up for the history view: one row per day that has entries, newest first. */
export function daySummaries(foodLog) {
  const days = [...new Set((Array.isArray(foodLog) ? foodLog : []).map(e => e?.d).filter(Boolean))].sort().reverse()
  return days.map(d => ({ d, ...dayTotals(foodLog, d) }))
}

/**
 * The last 7 days ending at `endD` (inclusive): averages over days WITH entries (sparse
 * history renders gaps as gaps, §6) plus how many days hit the protein target.
 */
export function weekRollup(foodLog, targets, endD = todayISO()) {
  const days = []
  const end = new Date(endD + 'T12:00:00')
  for (let i = 6; i >= 0; i--) {
    const day = new Date(end)
    day.setDate(day.getDate() - i)
    days.push(isoOf(day))
  }
  const withEntries = days.map(d => dayTotals(foodLog, d)).filter(t => t.entries > 0)
  const goal = numOrNull(targets?.proteinG)
  const n = withEntries.length
  return {
    days: n,
    avgProteinG: n ? withEntries.reduce((s, t) => s + t.proteinG, 0) / n : null,
    avgCalories: n ? withEntries.reduce((s, t) => s + t.calories, 0) / n : null,
    daysAtTarget: goal === null ? null : withEntries.filter(t => t.proteinG >= goal).length,
  }
}

/* ------------------------------------------------------------- starter library (§4.2)
   Dylan's known-macros table (~/workspace/workouts/daily-activity/known-macros.md) as an
   optional seed. Only calories and protein were ever verified for these, so the rest of
   perServing stays null. Source mapping per the spec: label / label (photo) → 'label';
   reported / known / USDA standard → 'manual'. Estimates are never seeded. */
export const STARTER_FOODS = [
  { name: 'Kirkland Chocolate Protein Powder', brand: 'Kirkland', servingSizeText: '1 scoop', perServing: { calories: 130, proteinG: 25 }, src: 'label' },
  { name: 'RYSE Jet-Puffed Marshmallow Protein', brand: 'RYSE', servingSizeText: '1 scoop', perServing: { calories: 130, proteinG: 25 }, src: 'label' },
  { name: 'CarbMaster Milk', brand: 'CarbMaster', servingSizeText: '1 serving', perServing: { calories: 80, proteinG: 13 }, src: 'manual' },
  { name: 'Amylu Andouille Chicken Sausage', brand: 'Amylu', servingSizeText: '1 link', perServing: { calories: 110, proteinG: 13 }, src: 'label' },
  { name: 'High-Protein Bread', brand: '', servingSizeText: '1 slice', perServing: { calories: 45, proteinG: 3 }, src: 'label' },
  { name: 'Mighty Spark Chicken Meat Stick', brand: 'Mighty Spark', servingSizeText: '1 stick', perServing: { calories: 50, proteinG: 7 }, src: 'manual' },
  { name: 'Pretzel Bagel', brand: 'Costco', servingSizeText: '1 bagel', perServing: { calories: 310, proteinG: 11 }, src: 'manual' },
  { name: 'Nonfat Cottage Cheese', brand: '', servingSizeText: '1 serving', perServing: { calories: 110, proteinG: 12 }, src: 'manual' },
  { name: 'Egg, Whole', brand: '', servingSizeText: '1 egg', perServing: { calories: 70, proteinG: 6 }, src: 'manual' },
  { name: 'Swiss Cheese', brand: '', servingSizeText: '1 slice (28g)', servingWeightG: 28, perServing: { calories: 100, proteinG: 8 }, src: 'manual' },
  { name: 'Simms Buffalo Style Chicken Stick', brand: 'Simms (Aldi)', servingSizeText: '1 stick (33g)', servingWeightG: 33, perServing: { calories: 80, proteinG: 11 }, src: 'label' },
  { name: 'Friendly Farms Nonfat Greek Yogurt', brand: 'Aldi Friendly Farms', servingSizeText: '170g (3/4 cup)', servingWeightG: 170, perServing: { calories: 90, proteinG: 18 }, src: 'label' },
  // known-macros lists the protein as "<1g": 0.5 is the midpoint the label's own bound allows.
  { name: 'Chocolate Pieces', brand: '', servingSizeText: '2 pieces (26g)', servingWeightG: 26, perServing: { calories: 130, proteinG: 0.5 }, src: 'label' },
]

/** Seed the starter library into a draft: only foods whose name isn't already there. */
export function importStarterFoodsIn(s, now = Date.now()) {
  if (!Array.isArray(s.foods)) s.foods = []
  const have = new Set(s.foods.map(f => f.name.toLowerCase()))
  let added = 0
  for (const f of STARTER_FOODS) {
    if (have.has(f.name.toLowerCase())) continue
    s.foods.push(makeFood(f, now))
    added++
  }
  return added
}
