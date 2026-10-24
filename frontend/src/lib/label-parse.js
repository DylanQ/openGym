// The Nutrition Facts parser (nutrition-spec.md §1.3): OCR output in, structured label out.
//
// Pure and deterministic — no model, no guessing. The parser either extracts a number
// verbatim (after the enumerated character normalizations below) or marks the field
// missing / check. Nothing is ever "corrected" into a different value, and a % Daily Value
// number is NEVER accepted as a gram value: if the only number on a nutrient row carries a
// %, the field is missing, not guessed.
//
// Input:  { text, blocks } — blocks as ML Kit returns them (blocks → lines → elements, each
//         with a boundingBox), or just { text } when no boxes exist (tests, web fallback).
// Output: {
//   servingSizeText, servingsPerContainer, servingsApprox, servingWeightG,
//   perServing: { calories, proteinG, carbsG, fatG, sugarsG, addedSugarsG, saturatedFatG,
//                 fiberG, sodiumMg, cholesterolMg },        // number | null each
//   confidence: { <field>: 'high' | 'check' | 'missing' },  // per field, spec §1.4
//   notes: [ 'calorie-cross-check' | 'sodium-in-grams' | … ] // flags for the confirm screen
// }

// ---------------------------------------------------------------- rows from boxes

const boxOf = el => {
  const b = el?.boundingBox || el?.frame || null
  if (b) {
    const left = Number(b.left ?? b.x) || 0
    const top = Number(b.top ?? b.y) || 0
    const right = Number(b.right ?? (left + (Number(b.width) || 0))) || left
    const bottom = Number(b.bottom ?? (top + (Number(b.height) || 0))) || top
    return { left, top, right, bottom }
  }
  if (Array.isArray(el?.cornerPoints) && el.cornerPoints.length) {
    const xs = el.cornerPoints.map(p => Number(p.x) || 0), ys = el.cornerPoints.map(p => Number(p.y) || 0)
    return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
  }
  return null
}

/**
 * Visual lines: ML Kit lines, or synthesized from flat text. Each line is a segment
 * { text, left, right, top, bottom }.
 */
function segmentsOf(input) {
  const segs = []
  for (const block of input?.blocks || []) {
    for (const line of block?.lines || []) {
      const els = (line?.elements || []).filter(e => e?.text)
      if (!els.length) continue
      const boxes = els.map(boxOf)
      if (boxes.every(Boolean)) {
        segs.push({
          text: els.map(e => e.text).join(' '),
          left: Math.min(...boxes.map(b => b.left)), right: Math.max(...boxes.map(b => b.right)),
          top: Math.min(...boxes.map(b => b.top)), bottom: Math.max(...boxes.map(b => b.bottom)),
        })
      } else if (line.text) {
        segs.push({ text: line.text, left: 0, right: 1000, top: 0, bottom: 0, synthetic: true })
      }
    }
  }
  if (segs.length && !segs.some(s => s.synthetic)) return segs
  // No usable boxes anywhere: fall back to the flat text, one segment per line, stacked.
  const text = String(input?.text || segs.map(s => s.text).join('\n') || '')
  return text.split(/\r?\n/).map((line, i) => line.trim())
    .filter(Boolean)
    .map((line, i) => ({ text: line, left: 0, right: 1000, top: i * 10, bottom: i * 10 + 8 }))
}

/** Cluster segments into rows by vertical overlap; tokens within a row carry an x position. */
function rowsOf(input) {
  const segs = segmentsOf(input).slice().sort((a, b) => a.top - b.top || a.left - b.left)
  const rows = []
  for (const seg of segs) {
    const h = Math.max(1, seg.bottom - seg.top)
    const row = rows.find(r => {
      const overlap = Math.min(r.bottom, seg.bottom) - Math.max(r.top, seg.top)
      return overlap > 0.4 * Math.min(h, Math.max(1, r.bottom - r.top))
    })
    if (row) {
      row.segs.push(seg)
      row.top = Math.min(row.top, seg.top); row.bottom = Math.max(row.bottom, seg.bottom)
    } else rows.push({ segs: [seg], top: seg.top, bottom: seg.bottom })
  }
  return rows.map(row => {
    const tokens = []
    for (const seg of row.segs.slice().sort((a, b) => a.left - b.left)) {
      const parts = seg.text.split(/\s+/).filter(Boolean)
      let cursor = 0
      for (const part of parts) {
        const idx = seg.text.indexOf(part, cursor)
        cursor = idx + part.length
        const frac = seg.text.length ? idx / seg.text.length : 0
        tokens.push({ raw: part, x: seg.left + frac * Math.max(1, seg.right - seg.left) })
      }
    }
    tokens.sort((a, b) => a.x - b.x)
    return { tokens, text: tokens.map(t => t.raw).join(' ') }
  }).filter(r => r.tokens.length)
}

// ---------------------------------------------------------------- token reading

// Letters OCR mistakes for digits and back, for matching anchor words ('Tota1' → 'total').
const alphaOf = tok => tok.toLowerCase().replace(/[^a-z0-9]/g, '')
  .replace(/0/g, 'o').replace(/1/g, 'l').replace(/5/g, 's')

/** Edit distance ≤ 1 (words of 4+ letters) — the fuzzy half of anchor matching. */
function nearWord(a, b) {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1 || a.length < 4) return false
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++ } else {
      edits++; if (edits > 1) return false
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++ }
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/**
 * A token as a number, or null. Character normalization happens ONLY here and only for
 * tokens that are otherwise numeric-shaped (spec §1.3): O/o→0, l/I→1, S→5 — '1S0' is 150,
 * but the word 'Total' is never rewritten. Thousands commas between digits are dropped.
 */
function numericToken(raw) {
  let t = String(raw || '').trim()
  let lessThan = false
  if (t.startsWith('<')) { lessThan = true; t = t.slice(1) }
  let unit = null
  const um = /(mcg|µg|ug|mg|kcal|g)$/i.exec(t)
  if (um && /\d/.test(t.slice(0, -um[0].length) || '')) { unit = um[1].toLowerCase().replace('µg', 'mcg').replace('ug', 'mcg'); t = t.slice(0, -um[0].length) }
  if (t.endsWith('%')) return { percent: true }
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return { value: Number(t.replace(/,/g, '')), unit, clean: true, lessThan }
  if (/^\d+(\.\d+)?$/.test(t)) return { value: Number(t), unit, clean: true, lessThan }
  if (/^[\dOolIS]+([.,][\dOolIS]+)?$/.test(t) && /\d/.test(t)) {
    const fixed = t.replace(/[Oo]/g, '0').replace(/[lI]/g, '1').replace(/S/g, '5').replace(',', '.')
    const value = Number(fixed)
    if (Number.isFinite(value)) return { value, unit, clean: false, lessThan }
  }
  return null
}

const isPercent = raw => /%$/.test(String(raw || '').trim()) || String(raw).trim() === '%'
const UNIT_WORDS = new Set(['g', 'mg', 'mcg', 'kcal'])

// ---------------------------------------------------------------- anchor matching

/** Find `words` as a sequence in the row's tokens; returns { end, exact } or null. */
function matchAnchor(row, words) {
  const toks = row.tokens.map(t => alphaOf(t.raw))
  outer:
  for (let i = 0; i + words.length <= toks.length; i++) {
    let exact = true
    for (let j = 0; j < words.length; j++) {
      if (toks[i + j] === words[j]) continue
      if (nearWord(toks[i + j], words[j])) { exact = false; continue }
      continue outer
    }
    return { end: i + words.length - 1, exact }
  }
  return null
}

/** First row matching any of the anchor word-lists; earlier lists win, then earlier rows. */
function findRow(rows, anchors, { exclude } = {}) {
  for (const words of anchors) {
    for (const row of rows) {
      if (exclude && exclude(row)) continue
      const m = matchAnchor(row, words)
      if (m) return { row, ...m }
    }
  }
  return null
}

// ---------------------------------------------------------------- value extraction

/**
 * The first real value after the anchor token. % tokens are skipped — never values (the
 * hard rule). A unit riding the next token ('25' 'g') is picked up. Returns
 * { value, unit, clean, lessThan, sawPercentOnly } or null.
 */
function valueAfter(row, endIdx, { beforeToo = false } = {}) {
  const order = []
  for (let i = endIdx + 1; i < row.tokens.length; i++) order.push(i)
  if (beforeToo) for (let i = endIdx - 1; i >= 0; i--) order.push(i)
  for (const i of order) {
    const raw = row.tokens[i].raw
    if (isPercent(raw)) continue
    const n = numericToken(raw)
    if (!n || n.percent) continue
    let unit = n.unit
    if (!unit) {
      const next = row.tokens[beforeToo && i < endIdx ? i - 1 : i + 1]
      if (next && UNIT_WORDS.has(alphaOf(next.raw))) unit = alphaOf(next.raw)
    }
    return { ...n, unit }
  }
  return null
}

// Sanity ranges (spec §1.4): outside → confidence 'check', never a silent fix.
const RANGES = {
  calories: [0, 2000], proteinG: [0, 100], carbsG: [0, 200], fatG: [0, 150],
  sugarsG: [0, 200], addedSugarsG: [0, 200], saturatedFatG: [0, 100], fiberG: [0, 60],
  sodiumMg: [0, 5000], cholesterolMg: [0, 1000],
}

function macroField(rows, anchors, field, kind, notes, { exclude, beforeToo } = {}) {
  const hit = findRow(rows, anchors, { exclude })
  if (!hit) return { value: null, conf: 'missing' }
  const got = valueAfter(hit.row, hit.end, { beforeToo })
  if (!got) return { value: null, conf: 'missing' }
  let { value, unit } = got
  if (kind === 'g' && unit === 'mg') { value = value / 1000; notes.push(field + '-in-mg') }
  if (kind === 'g' && unit === 'mcg') { value = value / 1e6; notes.push(field + '-in-mcg') }
  if (kind === 'mg' && unit === 'g') { value = value * 1000; notes.push(field + '-in-grams') }
  let conf = hit.exact && got.clean && !got.lessThan ? 'high' : 'check'
  const [lo, hi] = RANGES[field] || [0, Infinity]
  if (value < lo || value > hi) { conf = 'check'; notes.push(field + '-out-of-range') }
  return { value, conf }
}

// ---------------------------------------------------------------- the parse

export function parseLabel(input) {
  const rows = rowsOf(input || {})
  const notes = []
  const perServing = {
    calories: null, proteinG: null, carbsG: null, fatG: null, sugarsG: null,
    addedSugarsG: null, saturatedFatG: null, fiberG: null, sodiumMg: null, cholesterolMg: null,
  }
  const confidence = {}

  // Serving size: the rest of its row, kept as text.
  let servingSizeText = null
  const ssHit = findRow(rows, [['serving', 'size']])
  if (ssHit) {
    const rest = ssHit.row.tokens.slice(ssHit.end + 1).map(t => t.raw).join(' ').replace(/^[:\-]\s*/, '').trim()
    servingSizeText = rest || null
  }
  confidence.servingSizeText = servingSizeText ? (ssHit.exact ? 'high' : 'check') : 'missing'

  const servingWeightG = (() => {
    if (!servingSizeText) return null
    const paren = /\((\d+(?:\.\d+)?)\s*g\)/i.exec(servingSizeText)
    if (paren) return Number(paren[1])
    const bare = /(\d+(?:\.\d+)?)\s*g\b/i.exec(servingSizeText)
    return bare ? Number(bare[1]) : null
  })()

  // Servings per container: its own row, or a 'N servings per container' line anywhere.
  let servingsPerContainer = null, servingsApprox = false
  const spcHit = findRow(rows, [['servings', 'per', 'container'], ['serving', 'per', 'container']])
  if (spcHit) {
    servingsApprox = /about/i.test(spcHit.row.text)
    const got = valueAfter(spcHit.row, spcHit.end)
    if (got) servingsPerContainer = got.value
  }
  if (servingsPerContainer === null) {
    for (const row of rows) {
      const m = /(\d+(?:\.\d+)?)\s+servings?\s+per\s+container/i.exec(row.text)
      if (m) { servingsPerContainer = Number(m[1]); servingsApprox = /about/i.test(row.text); break }
    }
  }
  confidence.servingsPerContainer = servingsPerContainer !== null ? 'high' : 'missing'

  // Calories: the big standalone row — 'calories' as the row's first token wins; a
  // 'calories from fat' row never counts as the calorie row, and neither does the
  // 'Calories per gram: fat 9 · protein 4' footnote.
  let cal = null
  const calRows = rows.filter(r => !/from\s+fat|per\s+gram/i.test(r.text) && matchAnchor(r, ['calories']))
  calRows.sort((a, b) => (alphaOf(a.tokens[0].raw) === 'calories' ? 0 : 1) - (alphaOf(b.tokens[0].raw) === 'calories' ? 0 : 1))
  for (const row of calRows) {
    const m = matchAnchor(row, ['calories'])
    const got = valueAfter(row, m.end)
    if (got) { cal = { ...got, exact: m.exact }; break }
  }
  if (cal) {
    perServing.calories = Math.round(cal.value)
    confidence.calories = cal.exact && cal.clean ? 'high' : 'check'
    if (perServing.calories < RANGES.calories[0] || perServing.calories > RANGES.calories[1]) confidence.calories = 'check'
  } else confidence.calories = 'missing'

  // Macros. 'total fat' must not match the saturated/trans rows; protein excludes the
  // '% daily value' footnote family.
  const fields = [
    ['fatG', [['total', 'fat']], 'g', { exclude: r => /saturated|trans/i.test(r.text) }],
    ['saturatedFatG', [['saturated', 'fat']], 'g', {}],
    ['carbsG', [['total', 'carbohydrate'], ['total', 'carb'], ['total', 'carbs']], 'g', {}],
    ['fiberG', [['dietary', 'fiber'], ['fiber']], 'g', { exclude: r => /carbohydrate|carb/i.test(r.text) }],
    ['sugarsG', [['total', 'sugars'], ['total', 'sugar']], 'g', { exclude: r => /added/i.test(r.text) }],
    ['addedSugarsG', [['added', 'sugars'], ['added', 'sugar']], 'g', { beforeToo: true }],
    ['proteinG', [['protein']], 'g', { exclude: r => /daily\s+value/i.test(r.text) }],
    ['sodiumMg', [['sodium']], 'mg', {}],
    ['cholesterolMg', [['cholesterol']], 'mg', {}],
  ]
  for (const [field, anchors, kind, opts] of fields) {
    const { value, conf } = macroField(rows, anchors, field, kind, notes, opts)
    perServing[field] = value
    confidence[field] = conf
  }

  // Atwater cross-check (spec §1.3): fat×9 + protein×4 + carbs×4 against stated calories.
  // It only moves confidence and adds a flag — it never alters a number.
  const { calories, fatG, proteinG, carbsG } = perServing
  if ([calories, fatG, proteinG, carbsG].every(v => v !== null)) {
    const est = fatG * 9 + proteinG * 4 + carbsG * 4
    const off = Math.abs(est - calories) / Math.max(calories, 1)
    if (off > 0.25) {
      notes.push('calorie-cross-check')
      for (const f of ['calories', 'fatG', 'proteinG', 'carbsG']) if (confidence[f] === 'high') confidence[f] = 'check'
    }
  }

  return {
    servingSizeText, servingsPerContainer, servingsApprox, servingWeightG,
    perServing, confidence, notes,
  }
}
